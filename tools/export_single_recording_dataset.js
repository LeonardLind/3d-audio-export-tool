// Offline preprocessing step (see 06_Technical_Architecture/Technical_Architecture.md).
// Same feature family as export_visualization_dataset.js (raw flattened spectrogram ->
// PCA, D-010/D-004), but instead of one point per BirdNET-detected call, this samples
// the ENTIRE recording continuously on a fixed time grid (a short spectrogram window
// every ~150ms) so the position/color/size channels describe every moment of the
// audio, not just the moments BirdNET flagged as a labeled call. That is a real
// change in what a "point" represents -- see the amendment note in
// 06_Technical_Architecture/Technical_Architecture.md.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { reduceFeatures } = require("./lib/reducers");
const { makeFft } = require("./lib/fft");
const { buildAnalysis } = require("./lib/analysis");

const ROOT = path.resolve(__dirname, "..");
const AUDIO_ID = process.argv[2] || "4_2MM06988_20250412_033000";
const DETECTIONS_CSV = path.join(
  ROOT,
  "Assets",
  "slice_2_acoustic_data",
  "Audio",
  "Audio",
  "output",
  `${AUDIO_ID}.csv`,
);
const AUDIO_PATH = path.join(ROOT, "Assets", "slice_2_acoustic_data", "Audio", "Audio", `${AUDIO_ID}.wav`);
const OUTPUT_JSON = path.join(ROOT, "app", "public", "data", `dataset_field_${AUDIO_ID}.json`);
const OUTPUT_AUDIO = path.join(ROOT, "app", "public", "assets", `${AUDIO_ID}.wav`);

// Analysis resolution (retuned 2026-07-24 for the music-visualization use case). The
// previous 16kHz / 512-FFT / 0.5s-window / 0.15s-hop / 50%-drop settings were tuned for
// sparse birdsong detections and smeared every musical note/transient together. These
// values keep the SAME feature family (raw flattened spectrogram -> PCA, D-010/D-004) --
// they only change the sampling grid, which is a visualization tuning knob, NOT a
// scientific claim, and they do NOT touch the benchmark scripts (Experiments 001-006).
//   - 22050 Hz  -> captures up to ~11 kHz (was capped at 8 kHz), matching the reference
//                  frequency axis and recovering cymbals/harmonics/air in music.
//   - 1024 FFT  -> ~21.5 Hz/bin, finer than the old 31 Hz/bin.
//   - 0.15s window / ~0.05s hop -> ~20 points/sec (was ~3), so fast passages get their
//                  own points instead of being averaged away.
const SAMPLE_RATE = 22050;
const FFT_SIZE = 1024;
const HOP_SIZE = 512;
const FRAME_HOP_SECONDS = HOP_SIZE / SAMPLE_RATE;
const POINT_WINDOW_SECONDS = 0.15;
const POINT_HOP_SECONDS = 0.05;
const FRAMES_PER_POINT = Math.max(1, Math.round(POINT_WINDOW_SECONDS / FRAME_HOP_SECONDS));
// PCA over an N x ~3000 matrix is O(N^2 * dims); keep N bounded so long recordings stay
// tractable. Short clips sample at the full POINT_HOP; long ones widen the hop to hit
// this cap instead. (The 15s sample clip lands at ~300 points, well under the cap.)
const MAX_POINTS = 700;
const PCA_DIMENSIONS = 3;
const POSITION_SPREAD = 6;
const CONFIDENCE_THRESHOLD = 0.5;
const SIMILARITY_NEIGHBORS = 3;
// Fraction of the full spectrum energy the spectral-rolloff descriptor sits below.
const ROLLOFF_PERCENT = 0.85;
// Adjacent samples 0.15s apart overlap ~70% of their analysis window, so they are
// trivially near-identical in feature space -- without this exclusion, "nearest
// neighbor" edges would just re-draw the temporal path. Excluding close-in-time
// candidates means a similarity edge only appears when two DIFFERENT moments in the
// recording independently sound alike (e.g. a repeated phrase later in the song).
const SIMILARITY_MIN_TIME_GAP_SECONDS = 1.5;
// Noise-filtering fix (2026-07-21 diagnostic follow-up): continuous sampling grabs a
// window every 0.15s regardless of whether the bird is calling, so on a real 60s field
// recording a large fraction of points are quiet background/inter-call silence, diluting
// PCA's variance budget (see Technical_Architecture.md amendment). Rather than a fixed
// absolute amplitude cutoff -- which wouldn't transfer across recordings with different
// gain/mic distance -- the threshold is the Nth percentile of THIS recording's own
// amplitude distribution, in the same spirit as Experiment 006 picking the loudest
// window per detection, generalized from "pick the single loudest" to "keep the
// above-threshold loud ones" across continuous samples instead of only within BirdNET
// detection intervals.
// Gentler than the old 50%: drop only the quietest 20% (near-silence) so subtle musical
// detail survives, while true silence still doesn't dilute PCA's variance budget.
const AMPLITUDE_FILTER_PERCENTILE = 0.2;
// Panel + descriptor time-series resolution (TimeWindow spectrogram, Chromagram, and the
// live descriptor gauges/radar). Supplementary display only (like the 8-axis radar) --
// never drives position/color/size, not part of the D-010 feature set. Computed offline
// here, per the strict one-way boundary in 06_Technical_Architecture (the browser never
// runs an FFT); the app just looks up the current-playback-time column at 60fps. The STFT
// is decimated in frequency (bins) so the JSON stays reasonable; PANEL_TIME_STRIDE=1
// keeps every ~23ms frame so descriptors and the scroll feel continuous.
const PANEL_TIME_STRIDE = 1;
const PANEL_FREQ_BINS = 96; // decimate 513 STFT bins down to this many display rows
const CHROMA_MIN_HZ = 55; // ignore sub-A1 energy when folding bins into pitch classes
const A4_HZ = 440;

const fft = makeFft(FFT_SIZE);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else value += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  if (value.length > 0 || row.length > 0) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }
  const [headers, ...records] = rows.filter((entry) => entry.length > 1);
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])),
  );
}

// Same filter + per-window best-confidence dedupe as tools/build_manifest_slice2.js.
// Used only to derive a whole-recording species caption -- points are no longer tied
// to individual detections once sampling is continuous.
function selectDetections(rows) {
  const bestByWindow = new Map();
  for (const row of rows) {
    if ((row.model || "").trim().toLowerCase() !== "birdnet") continue;
    const confidence = Number(row.confidence);
    if (!(confidence > CONFIDENCE_THRESHOLD)) continue;
    const key = `${row.start_time}\t${row.end_time}`;
    const current = bestByWindow.get(key);
    if (current && Number(current.confidence) >= confidence) continue;
    bestByWindow.set(key, row);
  }
  return [...bestByWindow.values()];
}

function dominantCommonName(detections) {
  const totals = new Map();
  for (const detection of detections) {
    const entry = totals.get(detection.common_name) ?? { count: 0, confidenceSum: 0 };
    entry.count += 1;
    entry.confidenceSum += Number(detection.confidence);
    totals.set(detection.common_name, entry);
  }
  return [...totals.entries()].sort(
    (a, b) => b[1].count - a[1].count || b[1].confidenceSum - a[1].confidenceSum,
  )[0]?.[0] ?? "Unknown";
}

function readFullAudio(audioPath) {
  const buffer = execFileSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-i", audioPath, "-ac", "1", "-ar", String(SAMPLE_RATE), "-f", "f32le", "pipe:1"],
    { maxBuffer: 1024 * 1024 * 64 },
  );
  const samples = new Float32Array(Math.floor(buffer.length / 4));
  for (let i = 0; i < samples.length; i += 1) samples[i] = buffer.readFloatLE(i * 4);
  return samples;
}

function frameRms(samples, start, length) {
  let energy = 0;
  for (let i = 0; i < length; i += 1) energy += (samples[start + i] ?? 0) ** 2;
  return Math.sqrt(energy / length);
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

const HAMMING = Array.from(
  { length: FFT_SIZE },
  (_, n) => 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (FFT_SIZE - 1)),
);
const FREQUENCIES = Array.from({ length: FFT_SIZE / 2 + 1 }, (_, k) => (k * SAMPLE_RATE) / FFT_SIZE);

// STFT over the WHOLE recording, computed once, so continuous sampling doesn't need
// one ffmpeg subprocess + one spectrogram per point. Uses the radix-2 FFT (tools/lib/fft)
// -- the magnitude buffer is reused per call, so each frame's spectrum is copied out.
function stft(samples) {
  const spectra = [];
  const frame = new Float64Array(FFT_SIZE);
  for (let start = 0; start + FFT_SIZE <= samples.length; start += HOP_SIZE) {
    for (let i = 0; i < FFT_SIZE; i += 1) frame[i] = samples[start + i] * HAMMING[i];
    spectra.push(Float64Array.from(fft.magnitudes(frame)));
  }
  return spectra;
}

function rawSpectrogramFeatures(spectra) {
  // Build a plain flat array explicitly: spectra frames are Float64Array now, and
  // Array.prototype.flatMap does NOT flatten typed arrays.
  const features = [];
  for (const spectrum of spectra) {
    for (let k = 0; k < spectrum.length; k += 1) features.push(Math.log1p(spectrum[k]));
  }
  return features;
}

// Spectral centroid of one frame -- the amplitude-weighted mean frequency. Distinct
// from dominantFrequencyHz (the single loudest bin at the loudest instant): centroid
// is a smoother, whole-window "center of mass" measure, used for the
// Centroid-Amplitude Profile panel.
function frameCentroid(spectrum) {
  const total = spectrum.reduce((sum, value) => sum + value, 0) + 1e-12;
  return spectrum.reduce((sum, value, i) => sum + value * FREQUENCIES[i], 0) / total;
}

// Per-frame descriptor time-series over the whole recording. This is the data behind the
// live descriptor gauges + the instantaneous radar. All supplementary display -- none of
// it drives the D-010 raw-spectrogram position. Raw physical units (Hz etc.); the app
// normalizes for the gauges. One pass per frame, each descriptor computed inline to avoid
// re-summing the spectrum many times.
function analyzeFrames(spectra, samples) {
  const frameCount = spectra.length;
  const binCount = FREQUENCIES.length;
  const freqMean = mean(FREQUENCIES);
  let freqVar = 1e-12;
  for (const f of FREQUENCIES) freqVar += (f - freqMean) ** 2;
  const log2Bins = Math.log2(binCount);

  const out = {
    centroid: new Array(frameCount),
    bandwidth: new Array(frameCount), // spectral spread (std dev around centroid)
    rolloff: new Array(frameCount),
    flatness: new Array(frameCount), // geometric/arithmetic mean: ~0 tonal, ~1 noise-like
    crest: new Array(frameCount),
    entropy: new Array(frameCount),
    slope: new Array(frameCount),
    rms: new Array(frameCount),
    zcr: new Array(frameCount),
  };

  for (let t = 0; t < frameCount; t += 1) {
    const spectrum = spectra[t];
    let total = 1e-12;
    let maxMag = 0;
    let logSum = 0;
    let centroidNum = 0;
    for (let k = 0; k < binCount; k += 1) {
      const m = spectrum[k];
      total += m;
      if (m > maxMag) maxMag = m;
      logSum += Math.log(m + 1e-12);
      centroidNum += m * FREQUENCIES[k];
    }
    const arithMean = total / binCount;
    const centroid = centroidNum / total;

    let varNum = 0;
    let entropy = 0;
    let cov = 0;
    for (let k = 0; k < binCount; k += 1) {
      const m = spectrum[k];
      varNum += m * (FREQUENCIES[k] - centroid) ** 2;
      const p = m / total;
      if (p > 0) entropy += p * Math.log2(p);
      cov += (FREQUENCIES[k] - freqMean) * (m - arithMean);
    }

    let acc = 0;
    const target = ROLLOFF_PERCENT * total;
    let rolloff = FREQUENCIES[binCount - 1];
    for (let k = 0; k < binCount; k += 1) {
      acc += spectrum[k];
      if (acc >= target) {
        rolloff = FREQUENCIES[k];
        break;
      }
    }

    const start = t * HOP_SIZE;
    let energy = 0;
    let crossings = 0;
    let prev = samples[start] ?? 0;
    for (let i = 0; i < FFT_SIZE; i += 1) {
      const s = samples[start + i] ?? 0;
      energy += s * s;
      if ((s >= 0) !== (prev >= 0)) crossings += 1;
      prev = s;
    }

    out.centroid[t] = centroid;
    out.bandwidth[t] = Math.sqrt(varNum / total);
    out.rolloff[t] = rolloff;
    out.flatness[t] = Math.exp(logSum / binCount) / (arithMean + 1e-12);
    out.crest[t] = maxMag / (arithMean + 1e-12);
    out.entropy[t] = -entropy / log2Bins;
    out.slope[t] = cov / freqVar;
    out.rms[t] = Math.sqrt(energy / FFT_SIZE);
    out.zcr[t] = crossings / FFT_SIZE;
  }

  return out;
}

// Whole-recording averages of the inherited 8-axis descriptor set (v0.4 Reference
// Implementation Analysis), derived from the per-frame series so the numbers are
// consistent with the live gauges. Supplementary display only (D-010 found this set
// fails the negative control; raw flattened spectrograms drive position).
function wholeRecordingDescriptors(frameSeries) {
  const { centroid, rms } = frameSeries;
  const centroidDeltas = centroid.slice(1).map((value, i) => Math.abs(value - centroid[i]));
  const rmsDeltas = rms.slice(1).map((value, i) => Math.abs(value - rms[i]));
  return {
    spectralCentroid: mean(frameSeries.centroid),
    spectralSpread: mean(frameSeries.bandwidth),
    spectralEntropy: mean(frameSeries.entropy),
    spectralCrest: mean(frameSeries.crest),
    spectralSlope: mean(frameSeries.slope),
    frequencyModulation: centroidDeltas.length ? mean(centroidDeltas) : 0,
    amplitudeModulation: rmsDeltas.length ? mean(rmsDeltas) : 0,
    tonality: mean(frameSeries.flatness),
  };
}

// Spectral flux: how much the spectrum is CHANGING frame-to-frame -- the summed
// positive magnitude difference between consecutive frames. High during onsets/
// transitions, low during steady tones or silence. Used as the color channel of the
// Centroid-Amplitude Profile panel (matches the reference "SPECTRAL FLUX" legend).
function spectralFluxPerFrame(spectra) {
  const flux = new Array(spectra.length).fill(0);
  for (let t = 1; t < spectra.length; t += 1) {
    const current = spectra[t];
    const previous = spectra[t - 1];
    let sum = 0;
    for (let k = 0; k < current.length; k += 1) {
      const delta = current[k] - previous[k];
      if (delta > 0) sum += delta;
    }
    flux[t] = sum;
  }
  return flux;
}

// Chromagram column: fold every spectral bin into one of 12 pitch classes
// (C, C#, ... B) by its distance in semitones from A4, accumulating magnitude. This is
// the standard "chroma" feature -- octave-invariant harmonic content. Supplementary
// display only, same status as the 8-axis descriptors.
function chromaOfSpectrum(spectrum) {
  const chroma = new Array(12).fill(0);
  for (let k = 1; k < spectrum.length; k += 1) {
    const freq = FREQUENCIES[k];
    if (freq < CHROMA_MIN_HZ) continue;
    const pitchClass = ((Math.round(12 * Math.log2(freq / A4_HZ)) % 12) + 12) % 12;
    chroma[pitchClass] += spectrum[k];
  }
  return chroma;
}

// Rounding precision per descriptor key, to keep the JSON compact without lying.
const DESCRIPTOR_ROUND = {
  centroid: 0,
  rolloff: 0,
  bandwidth: 0,
  freqMod: 0,
  flux: 2,
  crest: 2,
  flatness: 4,
  entropy: 4,
  zcr: 4,
  rms: 5,
  ampMod: 5,
  slope: 6,
};

function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// Decimated, playback-scrollable time-series for the TimeWindow spectrogram, Chromagram,
// and the live descriptor gauges/radar. Every array is indexed by the same panel frame
// (frame i covers time i * hopSeconds), so the app looks up one column per playback
// instant. Magnitudes/chroma are globally normalized to 0-1 for direct rendering; the
// descriptor arrays keep raw physical units plus a [min,max] range for gauge scaling.
function buildPanelSeries(spectra, frameSeries, frameFlux) {
  const bins = FFT_SIZE / 2 + 1;
  const groupSize = Math.ceil(bins / PANEL_FREQ_BINS);
  const groupCount = Math.ceil(bins / groupSize);

  const freqHz = [];
  for (let g = 0; g < groupCount; g += 1) {
    const lo = g * groupSize;
    const hi = Math.min(bins, lo + groupSize);
    let freqSum = 0;
    for (let k = lo; k < hi; k += 1) freqSum += FREQUENCIES[k];
    freqHz.push(Math.round(freqSum / (hi - lo)));
  }

  const rawFrames = [];
  const centroidTrack = [];
  const rawChroma = [];
  let magMax = 1e-9;
  let chromaMax = 1e-9;

  // Kept-frame indices (after time decimation) so descriptor series line up with the
  // spectrogram/chroma columns and the delta descriptors use the right neighbor.
  const keptIndices = [];
  for (let t = 0; t < spectra.length; t += PANEL_TIME_STRIDE) keptIndices.push(t);

  for (const t of keptIndices) {
    const spectrum = spectra[t];
    const column = new Array(groupCount).fill(0);
    for (let g = 0; g < groupCount; g += 1) {
      const lo = g * groupSize;
      const hi = Math.min(bins, lo + groupSize);
      let magSum = 0;
      for (let k = lo; k < hi; k += 1) magSum += spectrum[k];
      const value = Math.log1p(magSum / (hi - lo));
      column[g] = value;
      if (value > magMax) magMax = value;
    }
    rawFrames.push(column);
    centroidTrack.push(Math.round(frameSeries.centroid[t]));
    const chroma = chromaOfSpectrum(spectrum);
    for (const value of chroma) if (value > chromaMax) chromaMax = value;
    rawChroma.push(chroma);
  }

  // Descriptor series aligned to keptIndices. freqMod/ampMod are |delta| vs the previous
  // kept frame. flux comes from the cross-frame spectral flux (normalized to its max).
  const fluxMax = Math.max(1e-9, ...keptIndices.map((t) => frameFlux[t]));
  const descriptors = {
    centroid: [], rolloff: [], flatness: [], flux: [], bandwidth: [], rms: [],
    zcr: [], crest: [], entropy: [], slope: [], freqMod: [], ampMod: [],
  };
  keptIndices.forEach((t, i) => {
    const prev = keptIndices[Math.max(0, i - 1)];
    descriptors.centroid.push(roundTo(frameSeries.centroid[t], DESCRIPTOR_ROUND.centroid));
    descriptors.rolloff.push(roundTo(frameSeries.rolloff[t], DESCRIPTOR_ROUND.rolloff));
    descriptors.flatness.push(roundTo(frameSeries.flatness[t], DESCRIPTOR_ROUND.flatness));
    descriptors.flux.push(roundTo(frameFlux[t] / fluxMax, DESCRIPTOR_ROUND.flux));
    descriptors.bandwidth.push(roundTo(frameSeries.bandwidth[t], DESCRIPTOR_ROUND.bandwidth));
    descriptors.rms.push(roundTo(frameSeries.rms[t], DESCRIPTOR_ROUND.rms));
    descriptors.zcr.push(roundTo(frameSeries.zcr[t], DESCRIPTOR_ROUND.zcr));
    descriptors.crest.push(roundTo(frameSeries.crest[t], DESCRIPTOR_ROUND.crest));
    descriptors.entropy.push(roundTo(frameSeries.entropy[t], DESCRIPTOR_ROUND.entropy));
    descriptors.slope.push(roundTo(frameSeries.slope[t], DESCRIPTOR_ROUND.slope));
    descriptors.freqMod.push(roundTo(Math.abs(frameSeries.centroid[t] - frameSeries.centroid[prev]), DESCRIPTOR_ROUND.freqMod));
    descriptors.ampMod.push(roundTo(Math.abs(frameSeries.rms[t] - frameSeries.rms[prev]), DESCRIPTOR_ROUND.ampMod));
  });

  const descriptorRanges = {};
  for (const key of Object.keys(descriptors)) descriptorRanges[key] = minMax(descriptors[key]);

  return {
    hopSeconds: FRAME_HOP_SECONDS * PANEL_TIME_STRIDE,
    nyquistHz: SAMPLE_RATE / 2,
    freqHz,
    // frame magnitudes normalized 0-1 (log-magnitude / global max), rounded for size
    frames: rawFrames.map((column) => column.map((value) => Number((value / magMax).toFixed(3)))),
    centroidTrack,
    chroma: rawChroma.map((column) => column.map((value) => Number((value / chromaMax).toFixed(3)))),
    chromaMax: Number(chromaMax.toFixed(4)),
    descriptors,
    descriptorRanges,
  };
}

function dominantFrequencyBin(spectrum) {
  let bestBin = 0;
  let bestMagnitude = -Infinity;
  for (let bin = 0; bin < spectrum.length; bin += 1) {
    if (spectrum[bin] > bestMagnitude) {
      bestMagnitude = spectrum[bin];
      bestBin = bin;
    }
  }
  return bestBin;
}

function minMax(values) {
  return values.reduce(
    ([min, max], value) => [Math.min(min, value), Math.max(max, value)],
    [Infinity, -Infinity],
  );
}

function normalize(value, min, max) {
  return max - min > 0 ? (value - min) / (max - min) : 0.5;
}

// The amplitude value below which `percentile` fraction of this recording's own
// continuous-sample points fall -- e.g. percentile=0.5 -> the median amplitude.
function amplitudeThreshold(rawPoints, percentile) {
  const sorted = rawPoints.map((point) => point.amplitude).sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(percentile * (sorted.length - 1)));
  return sorted[index];
}

// Slice the whole-file spectrogram/audio into overlapping fixed-length windows on a
// uniform time grid -- this is what turns 20 detection-triggered points into hundreds
// of continuous samples covering the full 60s.
function buildContinuousPoints(spectra, samples, audioId, frameFlux, pointHopFrames) {
  const points = [];
  let startFrame = 0;
  while (startFrame + FRAMES_PER_POINT <= spectra.length) {
    const t = startFrame * FRAME_HOP_SECONDS;
    const pointFrames = spectra.slice(startFrame, startFrame + FRAMES_PER_POINT);

    const sampleStart = startFrame * HOP_SIZE;
    const sampleLength = (FRAMES_PER_POINT - 1) * HOP_SIZE + FFT_SIZE;
    const amplitude = frameRms(samples, sampleStart, sampleLength);

    let loudestFrameOffset = 0;
    let loudestFrameRms = -Infinity;
    for (let i = 0; i < FRAMES_PER_POINT; i += 1) {
      const value = frameRms(samples, sampleStart + i * HOP_SIZE, FFT_SIZE);
      if (value > loudestFrameRms) {
        loudestFrameRms = value;
        loudestFrameOffset = i;
      }
    }
    const dominantBin = dominantFrequencyBin(pointFrames[loudestFrameOffset]);
    const spectralCentroidHz = mean(pointFrames.map(frameCentroid));
    const spectralFlux = mean(frameFlux.slice(startFrame, startFrame + FRAMES_PER_POINT));

    points.push({
      id: `${audioId}_${t.toFixed(3)}`,
      emissionTime: t,
      amplitude,
      dominantFrequencyHz: FREQUENCIES[dominantBin],
      spectralCentroidHz,
      spectralFlux,
      rawFeature: rawSpectrogramFeatures(pointFrames),
    });

    startFrame += pointHopFrames;
  }
  return points;
}

// Similarity edges -- distinct from the temporal path (Core Philosophy: edges must
// represent real data). Each point links to its SIMILARITY_NEIGHBORS closest
// points in the 3D PCA embedding, EXCLUDING points within SIMILARITY_MIN_TIME_GAP_SECONDS
// of it, so an edge means "these two moments sound alike," not "these two moments
// are close together in time" (that's already the temporal path's job).
function buildSimilarityEdges(points) {
  const edgeKeys = new Set();
  const edges = [];
  for (let i = 0; i < points.length; i += 1) {
    const candidates = [];
    for (let j = 0; j < points.length; j += 1) {
      if (i === j) continue;
      if (Math.abs(points[i].emissionTime - points[j].emissionTime) < SIMILARITY_MIN_TIME_GAP_SECONDS) continue;
      const [ax, ay, az] = points[i].position;
      const [bx, by, bz] = points[j].position;
      const distance = Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2);
      candidates.push({ index: j, distance });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    for (const candidate of candidates.slice(0, SIMILARITY_NEIGHBORS)) {
      const key = i < candidate.index ? `${i}\t${candidate.index}` : `${candidate.index}\t${i}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push([Math.min(i, candidate.index), Math.max(i, candidate.index)]);
    }
  }
  return edges;
}

// The core pipeline: continuous fixed-grid sampling -> raw flattened spectrogram
// (D-010) -> PCA top-3 (D-004) -> similarity edges -> payload. Factored out of main()
// so other scripts (e.g. a diagnostic run on a non-project audio file) can reuse
// EXACTLY this pipeline instead of re-implementing it. Does not touch the filesystem
// beyond reading `audioPath` -- writing output is the caller's job.
function runContinuousSamplingPipeline({ audioId, audioPath, commonName, generatedFrom, audioUrl }) {
  const samples = readFullAudio(audioPath);
  const spectra = stft(samples);
  const frameFlux = spectralFluxPerFrame(spectra);
  const frameSeries = analyzeFrames(spectra, samples);

  // Adaptive point hop: sample at POINT_HOP_SECONDS for short clips, but widen it on long
  // recordings so PCA (O(N^2 * dims)) stays tractable and the particle count stays sane.
  const baseHopFrames = Math.max(1, Math.round(POINT_HOP_SECONDS / FRAME_HOP_SECONDS));
  const capHopFrames = Math.ceil(spectra.length / MAX_POINTS);
  const pointHopFrames = Math.max(baseHopFrames, capHopFrames);
  const allContinuousPoints = buildContinuousPoints(spectra, samples, audioId, frameFlux, pointHopFrames);

  // Noise filter: drop the quietest AMPLITUDE_FILTER_PERCENTILE fraction of windows
  // (likely silence/background) before PCA sees them -- see constant comment above.
  const amplitudeThresholdValue = amplitudeThreshold(allContinuousPoints, AMPLITUDE_FILTER_PERCENTILE);
  const rawPoints = allContinuousPoints.filter((point) => point.amplitude >= amplitudeThresholdValue);

  const featureMatrix = rawPoints.map((point) => point.rawFeature);
  const spectralDescriptors = wholeRecordingDescriptors(frameSeries);

  // Position -> feature-space embedding fit on this single recording's own points
  // (Core Philosophy: not a cross-recording comparison set here).
  const { embedding, details } = reduceFeatures(featureMatrix, {
    method: "pca",
    dimensions: PCA_DIMENSIONS,
  });
  const explainedVarianceTotal = details.explainedVarianceTotal;

  const positionRanges = Array.from({ length: PCA_DIMENSIONS }, (_, dim) =>
    minMax(embedding.map((point) => point[dim])),
  );
  const maxAbsPosition = Math.max(
    ...positionRanges.map(([min, max]) => Math.max(Math.abs(min), Math.abs(max))),
  );
  const positionScale = maxAbsPosition > 0 ? POSITION_SPREAD / maxAbsPosition : 1;

  const [ampMin, ampMax] = minMax(rawPoints.map((point) => point.amplitude));
  const [freqMin, freqMax] = minMax(rawPoints.map((point) => point.dominantFrequencyHz));
  const [fluxMin, fluxMax] = minMax(rawPoints.map((point) => point.spectralFlux));
  // 3D-view color channel. The reference "MULTI-SCALE ANALYSIS" view colors points by
  // SPECTRAL CENTROID (its legend runs 0 -> max kHz), so centroidNorm is normalized
  // from 0 (not the min) up to the recording's max centroid, matching that legend.
  const centroidMaxHz = Math.max(...rawPoints.map((point) => point.spectralCentroidHz));

  const points = rawPoints
    .map((point, index) => ({
      id: point.id,
      emissionTime: point.emissionTime,
      position: embedding[index].map((value) => value * positionScale),
      amplitude: point.amplitude,
      amplitudeNorm: normalize(point.amplitude, ampMin, ampMax),
      dominantFrequencyHz: point.dominantFrequencyHz,
      colorT: normalize(point.dominantFrequencyHz, freqMin, freqMax),
      spectralCentroidHz: point.spectralCentroidHz,
      centroidNorm: centroidMaxHz > 0 ? Math.min(1, point.spectralCentroidHz / centroidMaxHz) : 0.5,
      spectralFlux: point.spectralFlux,
      spectralFluxNorm: normalize(point.spectralFlux, fluxMin, fluxMax),
    }))
    .sort((a, b) => a.emissionTime - b.emissionTime);

  const similarityEdges = buildSimilarityEdges(points);
  const panels = buildPanelSeries(spectra, frameSeries, frameFlux);
  // Experimental bioacoustic analysis for the sandbox gallery (modular, offline, does not
  // drive the 3D position). Aligned to panels (PANEL_TIME_STRIDE=1 -> same frame hop).
  const analysis = buildAnalysis({
    spectra,
    frameSeries,
    hopSeconds: FRAME_HOP_SECONDS,
    sampleRate: SAMPLE_RATE,
    fftSize: FFT_SIZE,
  });

  return {
    audioId,
    audioUrl: audioUrl ?? `/assets/${audioId}.wav`,
    commonName,
    generatedFrom,
    pipeline:
      `continuous raw flattened spectrogram at ${SAMPLE_RATE}Hz / ${FFT_SIZE}-FFT, ${POINT_WINDOW_SECONDS}s window / ~${POINT_HOP_SECONDS}s hop across the whole recording (D-010) -> amplitude noise filter (quietest ${Math.round(AMPLITUDE_FILTER_PERCENTILE * 100)}% dropped) -> PCA top-3 components fit on this recording (D-004)`,
    sampleRate: SAMPLE_RATE,
    fftSize: FFT_SIZE,
    samplingWindowSeconds: POINT_WINDOW_SECONDS,
    samplingHopSeconds: pointHopFrames * FRAME_HOP_SECONDS,
    durationSeconds: samples.length / SAMPLE_RATE,
    amplitudeFilterPercentile: AMPLITUDE_FILTER_PERCENTILE,
    amplitudeFilterThreshold: amplitudeThresholdValue,
    pointsBeforeAmplitudeFilter: allContinuousPoints.length,
    confidenceThreshold: CONFIDENCE_THRESHOLD,
    pcaExplainedVarianceTotal: explainedVarianceTotal,
    similarityNeighbors: SIMILARITY_NEIGHBORS,
    similarityMinTimeGapSeconds: SIMILARITY_MIN_TIME_GAP_SECONDS,
    // 3D color legend range: points are colored by spectralCentroidHz / centroidMaxHz.
    centroidMaxHz,
    // Supplementary display only -- the inherited 8-axis descriptor set that did NOT
    // win the WP2 benchmark (D-010). Not used to drive position/color/size above.
    spectralDescriptors,
    pointCount: points.length,
    points,
    similarityEdges,
    // Supplementary, playback-scrollable time-series for the TimeWindow spectrogram +
    // Chromagram panels. Precomputed offline (browser never runs an FFT). Not a feature-
    // set claim -- purely visualization, same status as spectralDescriptors above.
    panels,
    // Experimental bioacoustic analysis for the sandbox gallery (pitch, syllables, ACI,
    // self-similarity, soundscape indices). Modular + supplementary; see tools/lib/analysis.js.
    analysis,
  };
}

async function main() {
  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.mkdirSync(path.dirname(OUTPUT_AUDIO), { recursive: true });

  const allRows = parseCsv(fs.readFileSync(DETECTIONS_CSV, "utf8").replace(/^﻿/, ""));
  const detections = selectDetections(allRows);
  const commonName = dominantCommonName(detections);

  const payload = runContinuousSamplingPipeline({
    audioId: AUDIO_ID,
    audioPath: AUDIO_PATH,
    commonName,
    generatedFrom: path.relative(ROOT, DETECTIONS_CSV).replace(/\\/g, "/"),
  });

  // Independent cross-check against the CSV-derived commonName above: real BirdNET
  // inference run directly on this recording's own audio (tools/lib/birdnet.js).
  try {
    const { classifyRecording } = require("./lib/birdnet");
    payload.birdnetDetections = await classifyRecording(AUDIO_PATH);
  } catch (err) {
    console.error(`BirdNET classification failed, continuing without it: ${err.message}`);
    payload.birdnetDetections = null;
  }

  fs.copyFileSync(AUDIO_PATH, OUTPUT_AUDIO);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  const { upsertDataset } = require("./lib/manifest");
  upsertDataset({
    id: `field_${AUDIO_ID}`,
    label: `Field Recording — ${AUDIO_ID} (${commonName})`,
    kind: "field",
    path: `/data/dataset_field_${AUDIO_ID}.json`,
    durationSeconds: payload.durationSeconds,
  });
  console.log(`Wrote ${payload.points.length} points for ${AUDIO_ID} to ${path.relative(ROOT, OUTPUT_JSON)}`);
  console.log(`Copied audio to ${path.relative(ROOT, OUTPUT_AUDIO)}`);
}

// Reuses the EXACT continuous-sampling front half of the pipeline above (decode -> STFT ->
// windows -> amplitude filter -> analysis), but stops BEFORE the per-recording PCA and
// returns the raw window feature vectors. The Behavior Comparison batch tool
// (tools/build_behavior_comparison.js) needs the raw windows from every recording so it can
// fit ONE SHARED PCA across all of them -- the per-recording PCA that
// runContinuousSamplingPipeline applies puts each recording in its own incomparable
// coordinate system, which cannot be meaningfully averaged (see D-001 in
// 01_Master_Framework: fit one shared model, THEN combine). Returns raw windows + the same
// analysis/descriptors the sandbox uses, so the classifier has every feature available.
function extractContinuousWindows(audioPath) {
  const samples = readFullAudio(audioPath);
  const spectra = stft(samples);
  const frameFlux = spectralFluxPerFrame(spectra);
  const frameSeries = analyzeFrames(spectra, samples);

  const baseHopFrames = Math.max(1, Math.round(POINT_HOP_SECONDS / FRAME_HOP_SECONDS));
  const capHopFrames = Math.ceil(spectra.length / MAX_POINTS);
  const pointHopFrames = Math.max(baseHopFrames, capHopFrames);
  const allContinuousPoints = buildContinuousPoints(spectra, samples, "win", frameFlux, pointHopFrames);

  const amplitudeThresholdValue = amplitudeThreshold(allContinuousPoints, AMPLITUDE_FILTER_PERCENTILE);
  const windows = allContinuousPoints.filter((point) => point.amplitude >= amplitudeThresholdValue);

  return {
    durationSeconds: samples.length / SAMPLE_RATE,
    sampleRate: SAMPLE_RATE,
    fftSize: FFT_SIZE,
    windows, // each has: emissionTime, amplitude, dominantFrequencyHz, spectralCentroidHz, spectralFlux, rawFeature
    panels: buildPanelSeries(spectra, frameSeries, frameFlux),
    analysis: buildAnalysis({ spectra, frameSeries, hopSeconds: FRAME_HOP_SECONDS, sampleRate: SAMPLE_RATE, fftSize: FFT_SIZE }),
  };
}

module.exports = { runContinuousSamplingPipeline, extractContinuousWindows };

if (require.main === module) main();
