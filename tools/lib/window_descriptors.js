// Per-point (per-window) acoustic descriptors (v2.0).
//
// A point in the shipped export is a window of framesPerPoint consecutive STFT frames
// [startFrame, startFrame + framesPerPoint) starting at emissionTime = startFrame * hop
// (tools/export_single_recording_dataset.js, buildContinuousPoints). v2.0 needs to say, per
// point, what that moment sounds like (bright/dark, tonal/noisy, ...) so axis meanings and
// per-sound captions can be CHECKED against measurements rather than written by hand.
//
// No new formulas: every per-frame value comes from code the project already ships --
//   analyzeFrames()        centroid, rolloff (85%), bandwidth (spread), flatness, entropy,
//                          crest, slope, rms, zcr    (export_single_recording_dataset.js)
//   spectralFluxPerFrame() flux                      (export_single_recording_dataset.js)
//   buildAnalysis().pitch  HPS f0 + voicing          (tools/lib/analysis.js)
// freqMod / ampMod use the per-frame |delta| definition of buildPanelSeries (frame t vs
// frame t-1; 0 for frame 0), applied to the UNROUNDED frame series.
//
// Aggregation over a window's frames is the arithmetic mean unless stated. flux is
// therefore bit-identical to the pipeline's own point.spectralFlux (same mean over the
// same slice), which the tests assert as an alignment check.
//
// What this module does NOT do: it does not claim which descriptor explains a PCA axis.
// That is a separate, tested step; this module only supplies the measurements.

const {
  analyzeFrames,
  spectralFluxPerFrame,
  binFrequencies,
  stft,
  FFT_SIZE,
  HOP_SIZE,
} = require("../export_single_recording_dataset");
const { buildAnalysis } = require("./analysis");

// A frame counts as voiced when its HPS voicing exceeds this value. 0.15 is the threshold
// the codebase already uses for "voiced" in tools/lib/behavior.js (summaryFeatures:
// voicedHz / voicedFrac). It is an existing convention, NOT independently validated here.
// Note: voicing in analysis.js is normalised to the recording's own maximum HPS strength
// and RMS, so it is recording-relative, not an absolute periodicity measure.
const VOICING_THRESHOLD = 0.15;
// pitchHz is reported only when at least this fraction of the window's frames are voiced.
const MIN_VOICED_FRACTION = 0.5;

// Families used to label axes / captions. Each descriptor sits in exactly one family.
// Direction words describe what a HIGHER value means physically. Units are the units of
// the aggregated value as computed (STFT magnitudes are linear, un-normalised).
const DESCRIPTOR_FAMILIES = {
  brightness: {
    name: "Brightness",
    plain: "how high in frequency the sound's energy sits",
    higher: "brighter / higher-sounding",
    lower: "darker / lower-sounding",
    descriptors: {
      centroidHz: { name: "Spectral centroid", unit: "Hz", definition: "magnitude-weighted mean frequency of the frame, averaged over the window" },
      rolloffHz: { name: "Spectral roll-off (85%)", unit: "Hz", definition: "frequency below which 85% of the frame's summed magnitude lies, averaged over the window" },
    },
    // Measured in tools/test/window_descriptors.test.js (pure 2 kHz tone, pitchAlternation
    // seed 1): centroid ~2076 Hz clean, ~2379 Hz at 40 dB SNR, ~3940 Hz at 20 dB SNR.
    caveats: [
      "Noise-floor sensitive: linear-magnitude weighting lets a white background pull centroid/roll-off toward mid-band (a pure 2 kHz tone reads ~2076 Hz clean, ~2379 Hz at 40 dB SNR, ~3940 Hz at 20 dB SNR). Orderings held in the synthetic tests; absolute Hz values are not the tone's frequency.",
    ],
  },
  noisiness: {
    name: "Noisiness",
    plain: "how hiss-like (noisy) versus whistle-like (tonal) the sound is",
    higher: "noisier / more hiss-like",
    lower: "more tonal / purer",
    descriptors: {
      flatness: { name: "Spectral flatness", unit: "ratio 0-1", definition: "geometric mean / arithmetic mean of the magnitude spectrum (near 0 for a pure tone; reaches 1 only for a perfectly flat spectrum -- white noise measures ~0.845 here, matching 2*exp(-gamma/2)/sqrt(pi) ~ 0.846 for Rayleigh-distributed bin magnitudes), averaged over the window" },
      entropy: { name: "Spectral entropy", unit: "normalised 0-1", definition: "Shannon entropy of the magnitude distribution over bins divided by log2(bins), averaged over the window" },
    },
  },
  loudness: {
    name: "Loudness",
    plain: "how loud the sound is",
    higher: "louder",
    lower: "quieter",
    descriptors: {
      rms: { name: "RMS level", unit: "linear amplitude re full scale 1.0 (20*log10 gives dB re full-scale; a full-scale sine reads -3.01 dB on this scale)", definition: "root-mean-square of each 1024-sample frame, averaged over the window" },
    },
  },
  width: {
    name: "Bandwidth",
    plain: "how wide a range of frequencies the sound covers at once",
    higher: "wider band / fuller",
    lower: "narrower band / thinner",
    descriptors: {
      bandwidthHz: { name: "Spectral bandwidth (spread)", unit: "Hz", definition: "magnitude-weighted standard deviation of frequency around the centroid, averaged over the window" },
    },
    // Measured in tools/test/window_descriptors.test.js (bandwidthAlternation, 200 Hz vs
    // 4000 Hz band noise centred at 4 kHz): direction correct with no background and at
    // 40 dB SNR, already REVERSED at 30 dB SNR (and at 20 dB), because linear-magnitude
    // weighting lets a broadband noise floor dominate the spread of a narrow sound.
    caveats: [
      "Noise-floor sensitive: on synthetic 200 Hz vs 4000 Hz band noise the ordering is correct without background noise and at 40 dB SNR but already reverses at 30 dB SNR (and at 20 dB SNR). The crossover lies between 40 and 30 dB and was not located more finely.",
    ],
  },
  pitch: {
    name: "Pitch",
    plain: "the perceived note (fundamental frequency) of tonal sounds",
    higher: "higher-pitched",
    lower: "lower-pitched",
    descriptors: {
      pitchHz: { name: "Fundamental frequency (HPS)", unit: "Hz", definition: `median HPS f0 over voiced frames (voicing > ${VOICING_THRESHOLD}); null when fewer than ${MIN_VOICED_FRACTION * 100}% of frames are voiced. At 22050 Hz / 1024-FFT the HPS search ends at bin 171 (~3682 Hz), so f0 above that cannot be reported` },
    },
    // Measured in tools/test/window_descriptors.test.js. The HPS estimator in
    // tools/lib/analysis.js is accurate on HARMONIC tones (1 kHz / 2 kHz with harmonics
    // 1, 0.5, 0.25 -> 991 / 2003 Hz) but returns sub-harmonics on PURE tones (1 kHz -> 495 Hz,
    // 2 kHz -> 668 Hz, clean), and its voicing marks broadband noise as voiced while a pure
    // tone next to it reads unvoiced. Many bird whistles are near-pure tones, so this family
    // is NOT validated for labelling real recordings.
    validatedForLabelling: false,
    caveats: [
      "HPS returns sub-harmonics on pure tones (clean synthetic 1 kHz -> 495 Hz, 2 kHz -> 668 Hz); correct only when harmonics are present.",
      "Voicing is recording-relative and marks broadband noise as voiced (noise bursts voicedFraction 1.0 vs pure-tone bursts 0.0 in noisinessAlternation), while in a file of pure tones only the same tones read voicedFraction 1.0 with the wrong (sub-harmonic) pitch -- so a non-null pitchHz does not certify a correct pitch.",
      "Search range ends at ~3682 Hz at 22050 Hz / 1024-FFT.",
    ],
  },
  peakiness: {
    name: "Peakiness",
    plain: "how much one frequency peak stands out above the rest",
    higher: "one strong peak",
    lower: "energy spread evenly",
    descriptors: {
      crest: { name: "Spectral crest", unit: "ratio (max / mean magnitude)", definition: "largest bin magnitude divided by mean bin magnitude, averaged over the window" },
    },
  },
  tilt: {
    name: "Spectral tilt",
    plain: "whether energy leans toward low or high frequencies overall",
    higher: "tilted toward high frequencies",
    lower: "tilted toward low frequencies",
    descriptors: {
      slope: { name: "Spectral slope", unit: "linear STFT magnitude per Hz", definition: "least-squares slope of magnitude against frequency, averaged over the window" },
    },
  },
  change: {
    name: "Change",
    plain: "how fast the sound is changing within the moment",
    higher: "changing / unsteady",
    lower: "steady",
    descriptors: {
      flux: { name: "Spectral flux", unit: "linear STFT magnitude (summed positive increase per ~23.2 ms frame)", definition: "sum over bins of positive magnitude increase vs the previous frame, averaged over the window (identical to the export's point.spectralFlux)" },
      freqMod: { name: "Frequency modulation", unit: "Hz per frame (~23.2 ms)", definition: "|centroid(t) - centroid(t-1)| averaged over the window" },
      ampMod: { name: "Amplitude modulation", unit: "linear amplitude per frame (~23.2 ms)", definition: "|rms(t) - rms(t-1)| averaged over the window" },
    },
  },
};

// Computed and exported per point, but never used to label an axis or caption.
const EXCLUDED_FROM_LABELLING = {
  zcr: {
    name: "Zero-crossing rate",
    unit: "crossings per sample",
    reason:
      "Redundant with brightness + noisiness: for a tone it tracks frequency (~2f/sampleRate, i.e. brightness) and for noise it rises with noisiness, so it mixes two families that already have their own descriptors (see 08_Visualization_Sandbox/Bioacoustics_Research.md: 'rough proxy for dominant frequency / noisiness'). Using it as a label would double-count those families and give an ambiguous caption.",
  },
};

const DESCRIPTOR_KEYS = [
  "centroidHz", "rolloffHz", "bandwidthHz", "flatness", "entropy", "crest", "slope",
  "zcr", "rms", "flux", "freqMod", "ampMod", "pitchHz", "voicedFraction",
];

// Map descriptor key -> family id (zcr and voicedFraction are not in a family).
const FAMILY_OF = Object.fromEntries(
  Object.entries(DESCRIPTOR_FAMILIES).flatMap(([family, spec]) => Object.keys(spec.descriptors).map((key) => [key, family])),
);

function meanRange(values, start, end) {
  let sum = 0;
  for (let t = start; t < end; t += 1) sum += values[t];
  return sum / (end - start);
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function absDeltaSeries(values) {
  const out = new Array(values.length);
  for (let t = 0; t < values.length; t += 1) out[t] = t === 0 ? 0 : Math.abs(values[t] - values[t - 1]);
  return out;
}

// Duration in seconds of the audio a window of framesPerPoint frames actually spans.
function windowSpanSeconds(framesPerPoint, sampleRate) {
  return ((framesPerPoint - 1) * HOP_SIZE + FFT_SIZE) / sampleRate;
}

// Per-point descriptors.
//   spectra, frameSeries, frameFlux  -- as produced by the pipeline (computeContinuousFrontEnd)
//   points        -- objects with emissionTime (seconds) or startFrame
//   framesPerPoint, frameHopSeconds, sampleRate
//   pitch         -- optional {hz, voicing} per frame (buildAnalysis().pitch); computed from
//                    the same spectra/frameSeries via buildAnalysis if omitted
// Returns one row per point, in input order:
//   { emissionTime, startFrame, endFrame, startTime, endTime, <DESCRIPTOR_KEYS...> }
// endFrame is exclusive; [startTime, endTime) is the exact audio span of the window.
function computeWindowDescriptors({
  spectra,
  frameSeries,
  frameFlux,
  points,
  framesPerPoint,
  frameHopSeconds,
  sampleRate,
  pitch,
}) {
  if (!spectra?.length) return [];
  const pitchTrack =
    pitch ?? buildAnalysis({ spectra, frameSeries, hopSeconds: frameHopSeconds, sampleRate, fftSize: FFT_SIZE }).pitch;
  const freqModSeries = absDeltaSeries(frameSeries.centroid);
  const ampModSeries = absDeltaSeries(frameSeries.rms);
  const span = windowSpanSeconds(framesPerPoint, sampleRate);

  return points.map((point) => {
    const startFrame = Number.isInteger(point.startFrame) ? point.startFrame : Math.round(point.emissionTime / frameHopSeconds);
    const endFrame = startFrame + framesPerPoint;
    if (startFrame < 0 || endFrame > spectra.length) {
      throw new Error(`Window [${startFrame}, ${endFrame}) is outside the ${spectra.length}-frame STFT`);
    }
    const voicedHz = [];
    for (let t = startFrame; t < endFrame; t += 1) {
      if (pitchTrack.voicing[t] > VOICING_THRESHOLD && pitchTrack.hz[t] > 0) voicedHz.push(pitchTrack.hz[t]);
    }
    const voicedFraction = voicedHz.length / framesPerPoint;
    const emissionTime = point.emissionTime ?? startFrame * frameHopSeconds;
    return {
      emissionTime,
      startFrame,
      endFrame,
      startTime: emissionTime,
      endTime: emissionTime + span,
      centroidHz: meanRange(frameSeries.centroid, startFrame, endFrame),
      rolloffHz: meanRange(frameSeries.rolloff, startFrame, endFrame),
      bandwidthHz: meanRange(frameSeries.bandwidth, startFrame, endFrame),
      flatness: meanRange(frameSeries.flatness, startFrame, endFrame),
      entropy: meanRange(frameSeries.entropy, startFrame, endFrame),
      crest: meanRange(frameSeries.crest, startFrame, endFrame),
      slope: meanRange(frameSeries.slope, startFrame, endFrame),
      zcr: meanRange(frameSeries.zcr, startFrame, endFrame),
      rms: meanRange(frameSeries.rms, startFrame, endFrame),
      flux: meanRange(frameFlux, startFrame, endFrame),
      freqMod: meanRange(freqModSeries, startFrame, endFrame),
      ampMod: meanRange(ampModSeries, startFrame, endFrame),
      pitchHz: voicedFraction >= MIN_VOICED_FRACTION ? median(voicedHz) : null,
      voicedFraction,
    };
  });
}

// Convenience: descriptors for the windows of a computeContinuousFrontEnd() result.
// which = "kept" (after the amplitude filter, i.e. the exported points; default) or "all".
function descriptorsFromFrontEnd(frontEnd, { which = "kept", pitch } = {}) {
  return computeWindowDescriptors({
    spectra: frontEnd.spectra,
    frameSeries: frontEnd.frameSeries,
    frameFlux: frontEnd.frameFlux,
    points: which === "all" ? frontEnd.allContinuousPoints : frontEnd.rawPoints,
    framesPerPoint: frontEnd.framesPerPoint,
    frameHopSeconds: frontEnd.frameHopSeconds,
    sampleRate: frontEnd.sampleRate,
    pitch,
  });
}

// Standalone path from raw samples (no PCA): STFT + frame series with the shipped code,
// then descriptors for the given points. Used when only descriptors are needed.
function descriptorsFromSamples({ samples, sampleRate, points, framesPerPoint }) {
  const freqs = binFrequencies(sampleRate);
  const spectra = stft(samples);
  return computeWindowDescriptors({
    spectra,
    frameSeries: analyzeFrames(spectra, samples, freqs),
    frameFlux: spectralFluxPerFrame(spectra),
    points,
    framesPerPoint,
    frameHopSeconds: HOP_SIZE / sampleRate,
    sampleRate,
  });
}

// Ground-truth labelling for synthetic controls: a window gets a segment's label only when
// its whole audio span [startTime, endTime) lies inside that segment; otherwise null
// (straddles a boundary, or sits in a gap). Conservative on purpose.
const SEGMENT_EPSILON_SECONDS = 1e-9;
function labelWindowsBySegments(rows, segments) {
  const starts = new Float64Array(segments.length);
  const ends = new Float64Array(segments.length);
  for (let s = 0; s < segments.length; s += 1) {
    starts[s] = Number(segments[s].start) - SEGMENT_EPSILON_SECONDS;
    ends[s] = Number(segments[s].end) + SEGMENT_EPSILON_SECONDS;
  }
  const labels = new Array(rows.length);
  for (let r = 0; r < rows.length; r += 1) {
    const startTime = Number(rows[r].startTime);
    const endTime = Number(rows[r].endTime);
    let label = null;
    for (let s = 0; s < segments.length; s += 1) {
      if (startTime >= starts[s] && endTime <= ends[s]) {
        label = segments[s].label;
        break;
      }
    }
    labels[r] = label;
  }
  return labels;
}

module.exports = {
  computeWindowDescriptors,
  descriptorsFromFrontEnd,
  descriptorsFromSamples,
  labelWindowsBySegments,
  windowSpanSeconds,
  DESCRIPTOR_FAMILIES,
  EXCLUDED_FROM_LABELLING,
  DESCRIPTOR_KEYS,
  FAMILY_OF,
  VOICING_THRESHOLD,
  MIN_VOICED_FRACTION,
};
