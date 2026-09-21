// The continuous-sampling pipeline, ported from
// tools/export_single_recording_dataset.js -> runContinuousSamplingPipeline().
//
// Scope: this port computes ONLY what the 3D manifold and the spectral-centroid bar need
// -- continuous windows -> raw flattened spectrogram (D-010) -> amplitude noise filter ->
// PCA top-3 (D-004) -> similarity edges, plus the per-frame centroid track. It deliberately
// does NOT compute the 12 descriptor series, the chromagram, the spectrogram frames, the
// sandbox analysis (pitch/syllables/ACI/self-similarity/indices) or BirdNET species
// classification. Those stay in the offline generator; an uploaded clip's payload marks
// them as omitted rather than shipping zeros that would read as real values.
//
// Every constant below is copied from the exporter. Change one here and the same change
// has to be made there, or an uploaded clip stops being comparable to an exported one.

// Explicit .ts extensions (allowed by allowImportingTsExtensions in tsconfig.app.json, and
// resolved as-is by Vite) so that tools/verify_browser_port_parity.mjs can import this module
// straight into Node's type stripping and check it against the offline exporter. Node ESM
// will not resolve an extensionless specifier, and a parity check nobody can run is not a
// check. This is the only place in app/src that does it.
import { makeFft } from "./fft.ts";
import { pca } from "./pca.ts";
import type { RecordingPointDatum } from "../types.ts";

export const ANALYSIS_SAMPLE_RATE = 22050;
const FFT_SIZE = 1024;
const HOP_SIZE = 512;
const POINT_WINDOW_SECONDS = 0.15;
const POINT_HOP_SECONDS = 0.05;
const MAX_POINTS = 700;
const PCA_DIMENSIONS = 3;
const POSITION_SPREAD = 6;
const SIMILARITY_NEIGHBORS = 3;
const SIMILARITY_MIN_TIME_GAP_SECONDS = 1.5;
const AMPLITUDE_FILTER_PERCENTILE = 0.2;

const HAMMING = Float64Array.from(
  { length: FFT_SIZE },
  (_, n) => 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (FFT_SIZE - 1)),
);

// Everything the Upload tab produces. A structural subset of RecordingPayload: the fields
// that are here mean exactly what they mean in an exported dataset, and the ones the
// pipeline does not compute are absent (and listed in `omittedFields`) rather than faked.
export interface BrowserAnalysis {
  contractVersion: number;
  kind: "browser-upload-partial";
  audioId: string;
  audioUrl: string;
  commonName: string;
  generatedFrom: string;
  generatedAt: string;
  pipeline: string;
  analyzedIn: string;
  omittedFields: string[];
  sampleRate: number;
  analysisSampleRateHz: number;
  sourceSampleRateHz: number | null;
  sourceChannels: number | null;
  fftSize: number;
  binWidthHz: number;
  samplingWindowSeconds: number;
  samplingHopSeconds: number;
  durationSeconds: number;
  frequencyRange: {
    minHz: number;
    maxHz: number;
    analysisNyquistHz: number;
    sourceNyquistHz: number | null;
    bandLimited: boolean;
    binWidthHz: number;
  };
  amplitudeFilterPercentile: number;
  amplitudeFilterThreshold: number;
  pointsBeforeAmplitudeFilter: number;
  pcaExplainedVarianceTotal: number;
  pcaExplainedVarianceRatio: number[];
  similarityNeighbors: number;
  similarityMinTimeGapSeconds: number;
  centroidMaxHz: number;
  amplitudeMax: number;
  pointCount: number;
  points: RecordingPointDatum[];
  similarityEdges: [number, number][];
  centroidTrack: { hopSeconds: number; nyquistHz: number; values: number[] };
}

export type ProgressStage = "decode" | "stft" | "windows" | "pca" | "edges" | "done";

export interface Progress {
  stage: ProgressStage;
  fraction: number;
  note: string;
}

function frameRms(samples: Float32Array, start: number, length: number) {
  let energy = 0;
  for (let i = 0; i < length; i += 1) {
    const value = samples[start + i] ?? 0;
    energy += value * value;
  }
  return Math.sqrt(energy / length);
}

function frameCentroid(spectrum: Float64Array, freqs: Float64Array) {
  let total = 1e-12;
  let weighted = 0;
  for (let k = 0; k < spectrum.length; k += 1) {
    total += spectrum[k];
    weighted += spectrum[k] * freqs[k];
  }
  return weighted / total;
}

function minMax(values: number[]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return [min, max];
}

function normalize(value: number, min: number, max: number) {
  return max - min > 0 ? (value - min) / (max - min) : 0.5;
}

// Each point links to its SIMILARITY_NEIGHBORS closest points in the 3D PCA embedding,
// EXCLUDING points within SIMILARITY_MIN_TIME_GAP_SECONDS of it, so an edge means "these
// two moments sound alike", not "these two moments are adjacent in time".
function buildSimilarityEdges(points: RecordingPointDatum[]): [number, number][] {
  const edgeKeys = new Set<string>();
  const edges: [number, number][] = [];
  for (let i = 0; i < points.length; i += 1) {
    const candidates: { index: number; distance: number }[] = [];
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

export interface AnalyzeInput {
  samples: Float32Array;
  audioId: string;
  commonName: string;
  filename: string;
  sourceSampleRateHz: number | null;
  sourceChannels: number | null;
  onProgress?: (progress: Progress) => void;
}

export function analyzeSamples({
  samples,
  audioId,
  commonName,
  filename,
  sourceSampleRateHz,
  sourceChannels,
  onProgress,
}: AnalyzeInput): BrowserAnalysis {
  const report = (stage: ProgressStage, fraction: number, note: string) =>
    onProgress?.({ stage, fraction, note });

  const sampleRate = ANALYSIS_SAMPLE_RATE;
  const frameHopSeconds = HOP_SIZE / sampleRate;
  const framesPerPoint = Math.max(1, Math.round(POINT_WINDOW_SECONDS / frameHopSeconds));
  const bins = FFT_SIZE / 2 + 1;
  const freqs = Float64Array.from({ length: bins }, (_, k) => (k * sampleRate) / FFT_SIZE);
  const fft = makeFft(FFT_SIZE);

  // --- STFT over the whole recording, computed once --------------------------------
  const frameCount = samples.length >= FFT_SIZE ? Math.floor((samples.length - FFT_SIZE) / HOP_SIZE) + 1 : 0;
  if (frameCount < framesPerPoint) {
    const needed = ((framesPerPoint - 1) * HOP_SIZE + FFT_SIZE) / sampleRate;
    throw new Error(`Recording is too short to analyze: needs at least ${needed.toFixed(2)} s of audio.`);
  }
  // One flat buffer instead of frameCount separate Float64Arrays -- a 3-minute clip is
  // ~7700 frames x 513 bins, and the per-array overhead is what makes that hurt.
  const spectra = new Float64Array(frameCount * bins);
  const frame = new Float64Array(FFT_SIZE);
  const frameCentroidHz = new Float64Array(frameCount);
  const frameFlux = new Float64Array(frameCount);
  const spectrumView = (t: number) => spectra.subarray(t * bins, (t + 1) * bins);

  for (let t = 0; t < frameCount; t += 1) {
    const start = t * HOP_SIZE;
    for (let i = 0; i < FFT_SIZE; i += 1) frame[i] = samples[start + i] * HAMMING[i];
    spectra.set(fft.magnitudes(frame), t * bins);
    frameCentroidHz[t] = frameCentroid(spectrumView(t), freqs);
    if (t > 0) {
      // Spectral flux: summed POSITIVE magnitude difference vs the previous frame.
      let sum = 0;
      const current = t * bins;
      const previous = (t - 1) * bins;
      for (let k = 0; k < bins; k += 1) {
        const delta = spectra[current + k] - spectra[previous + k];
        if (delta > 0) sum += delta;
      }
      frameFlux[t] = sum;
    }
    if (t % 512 === 0) report("stft", t / frameCount, `STFT frame ${t} / ${frameCount}`);
  }
  report("windows", 0, "Sampling windows");

  // --- Continuous windows on a uniform time grid -----------------------------------
  // Adaptive hop: POINT_HOP_SECONDS on short clips, widened on long ones so PCA
  // (O(n^2 * dims)) stays tractable and the particle count stays sane.
  const baseHopFrames = Math.max(1, Math.round(POINT_HOP_SECONDS / frameHopSeconds));
  const capHopFrames = Math.ceil(frameCount / MAX_POINTS);
  const pointHopFrames = Math.max(baseHopFrames, capHopFrames);
  const sampleLength = (framesPerPoint - 1) * HOP_SIZE + FFT_SIZE;

  interface RawPoint {
    startFrame: number;
    emissionTime: number;
    amplitude: number;
    dominantFrequencyHz: number;
    spectralCentroidHz: number;
    spectralFlux: number;
  }
  const allPoints: RawPoint[] = [];
  for (let startFrame = 0; startFrame + framesPerPoint <= frameCount; startFrame += pointHopFrames) {
    const sampleStart = startFrame * HOP_SIZE;
    const amplitude = frameRms(samples, sampleStart, sampleLength);

    let loudestFrameOffset = 0;
    let loudestFrameRms = -Infinity;
    for (let i = 0; i < framesPerPoint; i += 1) {
      const value = frameRms(samples, sampleStart + i * HOP_SIZE, FFT_SIZE);
      if (value > loudestFrameRms) {
        loudestFrameRms = value;
        loudestFrameOffset = i;
      }
    }

    // Dominant frequency = single loudest bin at the loudest instant in the window.
    const loudest = spectrumView(startFrame + loudestFrameOffset);
    let bestBin = 0;
    let bestMagnitude = -Infinity;
    for (let k = 0; k < bins; k += 1) {
      if (loudest[k] > bestMagnitude) {
        bestMagnitude = loudest[k];
        bestBin = k;
      }
    }

    let centroidSum = 0;
    let fluxSum = 0;
    for (let i = 0; i < framesPerPoint; i += 1) {
      centroidSum += frameCentroidHz[startFrame + i];
      fluxSum += frameFlux[startFrame + i];
    }

    allPoints.push({
      startFrame,
      emissionTime: startFrame * frameHopSeconds,
      amplitude,
      dominantFrequencyHz: freqs[bestBin],
      spectralCentroidHz: centroidSum / framesPerPoint,
      spectralFlux: fluxSum / framesPerPoint,
    });
  }

  // --- Amplitude noise filter: drop the quietest AMPLITUDE_FILTER_PERCENTILE --------
  const sortedAmplitudes = allPoints.map((point) => point.amplitude).sort((a, b) => a - b);
  const thresholdIndex = Math.min(
    sortedAmplitudes.length - 1,
    Math.floor(AMPLITUDE_FILTER_PERCENTILE * (sortedAmplitudes.length - 1)),
  );
  const amplitudeThreshold = sortedAmplitudes[thresholdIndex];
  const rawPoints = allPoints.filter((point) => point.amplitude >= amplitudeThreshold);
  if (rawPoints.length < 4) {
    throw new Error(
      `Only ${rawPoints.length} usable windows survived the amplitude filter -- the clip is too short or too quiet.`,
    );
  }

  // --- Raw flattened spectrogram features (D-010), kept points only -----------------
  const featureWidth = framesPerPoint * bins;
  const featureMatrix = new Float64Array(rawPoints.length * featureWidth);
  rawPoints.forEach((point, index) => {
    let write = index * featureWidth;
    for (let i = 0; i < framesPerPoint; i += 1) {
      const read = (point.startFrame + i) * bins;
      for (let k = 0; k < bins; k += 1) featureMatrix[write + k] = Math.log1p(spectra[read + k]);
      write += bins;
    }
  });
  report("pca", 0, `PCA on ${rawPoints.length} x ${featureWidth} matrix`);

  // --- PCA top-3 (D-004), fit on this recording's own points ------------------------
  const { embedding, explainedVarianceTotal, explainedVarianceRatio } = pca(
    featureMatrix,
    rawPoints.length,
    featureWidth,
    PCA_DIMENSIONS,
  );

  let maxAbsPosition = 0;
  for (const row of embedding) {
    for (const value of row) maxAbsPosition = Math.max(maxAbsPosition, Math.abs(value));
  }
  const positionScale = maxAbsPosition > 0 ? POSITION_SPREAD / maxAbsPosition : 1;

  const [ampMin, ampMax] = minMax(rawPoints.map((point) => point.amplitude));
  const [freqMin, freqMax] = minMax(rawPoints.map((point) => point.dominantFrequencyHz));
  const [fluxMin, fluxMax] = minMax(rawPoints.map((point) => point.spectralFlux));
  const centroidMaxHz = rawPoints.reduce((max, point) => Math.max(max, point.spectralCentroidHz), -Infinity);

  const points: RecordingPointDatum[] = rawPoints
    .map((point, index) => ({
      id: `${audioId}_${point.emissionTime.toFixed(3)}`,
      emissionTime: point.emissionTime,
      position: [
        embedding[index][0] * positionScale,
        embedding[index][1] * positionScale,
        embedding[index][2] * positionScale,
      ] as [number, number, number],
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

  report("edges", 0, "Similarity edges");
  const similarityEdges = buildSimilarityEdges(points);

  const analysisNyquistHz = sampleRate / 2;
  const sourceNyquistHz = sourceSampleRateHz ? sourceSampleRateHz / 2 : null;
  report("done", 1, `${points.length} points, ${similarityEdges.length} edges`);

  return {
    contractVersion: 1,
    kind: "browser-upload-partial",
    audioId,
    audioUrl: `/assets/${filename}`,
    commonName,
    generatedFrom: filename,
    generatedAt: new Date().toISOString(),
    pipeline:
      `continuous raw flattened spectrogram at ${sampleRate}Hz / ${FFT_SIZE}-FFT, ${POINT_WINDOW_SECONDS}s window / ~${POINT_HOP_SECONDS}s hop across the whole recording (D-010) -> amplitude noise filter (quietest ${Math.round(AMPLITUDE_FILTER_PERCENTILE * 100)}% dropped) -> PCA top-3 components fit on this recording (D-004)`,
    analyzedIn:
      "browser (app/src/analysis/*, ported from tools/export_single_recording_dataset.js); decode + resample by Web Audio OfflineAudioContext, not ffmpeg",
    omittedFields: [
      "panels.frames",
      "panels.freqHz",
      "panels.chroma",
      "panels.chromaMax",
      "panels.descriptors",
      "panels.descriptorRanges",
      "spectralDescriptors",
      "analysis",
      "birdnetDetections",
    ],
    sampleRate,
    analysisSampleRateHz: sampleRate,
    sourceSampleRateHz,
    sourceChannels,
    fftSize: FFT_SIZE,
    binWidthHz: sampleRate / FFT_SIZE,
    samplingWindowSeconds: POINT_WINDOW_SECONDS,
    samplingHopSeconds: pointHopFrames * frameHopSeconds,
    durationSeconds: samples.length / sampleRate,
    frequencyRange: {
      minHz: 0,
      maxHz: sourceNyquistHz === null ? analysisNyquistHz : Math.min(analysisNyquistHz, sourceNyquistHz),
      analysisNyquistHz,
      sourceNyquistHz,
      // true when the source could not fill the analysis band: everything above
      // sourceNyquistHz is resampling, not signal.
      bandLimited: sourceNyquistHz !== null && sourceNyquistHz < analysisNyquistHz,
      binWidthHz: sampleRate / FFT_SIZE,
    },
    amplitudeFilterPercentile: AMPLITUDE_FILTER_PERCENTILE,
    amplitudeFilterThreshold: amplitudeThreshold,
    pointsBeforeAmplitudeFilter: allPoints.length,
    pcaExplainedVarianceTotal: explainedVarianceTotal,
    pcaExplainedVarianceRatio: explainedVarianceRatio,
    similarityNeighbors: SIMILARITY_NEIGHBORS,
    similarityMinTimeGapSeconds: SIMILARITY_MIN_TIME_GAP_SECONDS,
    centroidMaxHz,
    amplitudeMax: ampMax,
    pointCount: points.length,
    points,
    similarityEdges,
    // Per-STFT-frame spectral centroid (Hz) -- the same numbers the offline exporter puts
    // in panels.centroidTrack, at the same hop, rounded to whole Hz the same way.
    centroidTrack: {
      hopSeconds: frameHopSeconds,
      nyquistHz: analysisNyquistHz,
      values: Array.from(frameCentroidHz, (value) => Math.round(value)),
    },
  };
}
