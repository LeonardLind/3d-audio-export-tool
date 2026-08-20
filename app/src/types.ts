// Structural shape PointCloud actually needs to render a point; both PointDatum
// and RecordingPointDatum satisfy it, so the renderer doesn't care which dataset a
// point came from.
export interface RenderablePoint {
  id: string;
  position: [number, number, number];
  amplitudeNorm: number;
  // 0-1 normalized spectral centroid (0 = low, 1 = recording's max centroid). Drives the
  // 3D-view color channel + legend, matching the reference "SPECTRAL CENTROID" view.
  centroidNorm: number;
}

export interface PointDatum {
  id: string;
  audioId: string;
  commonName: string;
  confidence: number;
  position: [number, number, number];
  amplitude: number;
  amplitudeNorm: number;
  dominantFrequencyHz: number;
  colorT: number;
  timestampMs: number | null;
}

export interface PointsPayload {
  generatedFrom: string;
  pipeline: string;
  pointCount: number;
  pcaDimensions: number;
  points: PointDatum[];
}

// Continuous sampling: each point is a fixed-length spectrogram window sampled on a
// uniform time grid across the whole recording, not a specific BirdNET-labeled call.
export interface RecordingPointDatum {
  id: string;
  emissionTime: number;
  position: [number, number, number];
  amplitude: number;
  amplitudeNorm: number;
  dominantFrequencyHz: number;
  colorT: number;
  spectralCentroidHz: number;
  centroidNorm: number;
  spectralFlux: number;
  spectralFluxNorm: number;
}

// Keys of the per-frame descriptor time-series. All supplementary display -- none of
// this drives the D-010 raw-spectrogram 3D position.
export type DescriptorKey =
  | "centroid"
  | "rolloff"
  | "flatness"
  | "flux"
  | "bandwidth"
  | "rms"
  | "zcr"
  | "crest"
  | "entropy"
  | "slope"
  | "freqMod"
  | "ampMod";

export type DescriptorSeries = Record<DescriptorKey, number[]>;
export type DescriptorRanges = Record<DescriptorKey, [number, number]>;

// Supplementary, playback-scrollable time-series for the TimeWindow spectrogram,
// Chromagram, and live descriptor gauges/radar. Precomputed offline (browser never runs
// an FFT). Every array is indexed by the same panel frame: frame i covers time
// i * hopSeconds.
export interface PanelSeries {
  hopSeconds: number;
  nyquistHz: number;
  // Center frequency (Hz) of each spectrogram display row, low -> high.
  freqHz: number[];
  // frames[i][row] = normalized (0-1) log-magnitude for that time/frequency cell.
  frames: number[][];
  // Spectral centroid (Hz) per frame -- the red overlay track on the spectrogram.
  centroidTrack: number[];
  // chroma[i][pitchClass] = normalized (0-1) energy, pitchClass 0=C .. 11=B.
  chroma: number[][];
  // Real (un-normalized) maximum chroma value, for an honest legend label.
  chromaMax: number;
  // Per-frame descriptor values (raw physical units) + their [min,max] over the clip.
  descriptors: DescriptorSeries;
  descriptorRanges: DescriptorRanges;
}

// The inherited 8-axis descriptor set (v0.4 Reference Implementation Analysis).
// Supplementary/visualization only -- D-010 found raw flattened spectrograms, not
// this descriptor set, pass the negative control; it does not drive position/color/size.
export interface SpectralDescriptors {
  spectralCentroid: number;
  spectralSpread: number;
  spectralEntropy: number;
  spectralCrest: number;
  spectralSlope: number;
  frequencyModulation: number;
  amplitudeModulation: number;
  tonality: number;
}

// --- Experimental sandbox analysis (see tools/lib/analysis.js). All supplementary. -----
export interface PitchTrack {
  minHz: number;
  maxHz: number;
  hz: number[];
  voicing: number[];
}

export interface Syllable {
  start: number;
  end: number;
  duration: number;
  peakFreq: number;
  peakAmp: number;
}

export interface SyllableAnalysis {
  syllables: Syllable[];
  count: number;
  meanDuration: number;
  meanGap: number;
  repetitionRate: number;
}

export interface AciAnalysis {
  series: { t: number; aci: number }[];
  total: number;
  clusterSeconds: number;
}

export interface SelfSimilarity {
  n: number;
  matrix: number[];
  times: number[];
}

export interface BandOccupancy {
  loHz: number;
  hiHz: number;
  occupancy: number;
  meanEnergy: number;
}

export interface AcousticIndices {
  bands: BandOccupancy[];
  adi: number;
  aei: number;
  bi: number;
  entropyH: number;
  entropyTemporal: number;
  entropySpectral: number;
}

// Real BirdNET species classification (tools/lib/birdnet.js), run locally via ONNX
// Runtime on the official model weights -- not an approximation. null if the model wasn't
// available when this dataset was exported (e.g. offline / first run before the one-time
// model download completed); the UI falls back to demo data in that case.
export interface BirdnetDetection {
  scientificName: string;
  commonName: string;
  confidence: number;
  atSeconds: number;
}

// One 3s analysis chunk's species breakdown -- multiple entries mean simultaneous/
// overlapping calls (or the model being unsure between similar-sounding species).
export interface BirdnetTimelineEntry {
  start: number;
  end: number;
  species: { scientificName: string; commonName: string; confidence: number }[];
}

export interface BirdnetResult {
  model: string;
  source: string;
  chunkSeconds: number;
  chunkCount: number;
  minConfidence: number;
  detections: BirdnetDetection[];
  timeline: BirdnetTimelineEntry[];
}

// --- Behavior Comparison (experimental) --- app/public/data/behavior_comparison.json,
// built by tools/build_behavior_comparison.js. All classifications are heuristic + exploratory.
export interface BehaviorScore {
  id: string;
  name: string;
  probability: number;
}

export interface BehaviorRecording {
  id: string;
  xenoCantoId: string;
  sourceUrl: string;
  recordist: string;
  license: string;
  xcType: string;
  audioUrl: string;
  durationSeconds: number;
  category: string;
  categoryName: string;
  confidence: number;
  scores: BehaviorScore[];
  drivers: string[];
  points: [number, number, number][];
  meanPos: [number, number, number];
  features: Record<string, number>;
}

export interface BehaviorCategory {
  id: string;
  name: string;
  color: string;
  count: number;
  recordingIds: string[];
  centroid: [number, number, number];
  // Column-major 4x4 mapping a unit sphere -> the category's covariance ellipsoid
  // ("average shape"). null when too few recordings to form one.
  ellipsoidMatrix: number[] | null;
  representativeId: string | null;
  meanConfidence: number;
}

export interface BehaviorComparison {
  kind: string;
  species: string;
  recordingCount: number;
  sharedPcaExplainedVariance: number;
  windowsPerRecording: number;
  framing: string;
  categories: BehaviorCategory[];
  recordings: BehaviorRecording[];
}

// One entry in the Audio Source Switch (app/public/data/manifest.json), written by each
// export script via tools/lib/manifest.js.
export interface DatasetManifestEntry {
  id: string;
  label: string;
  kind: "sample" | "field" | "diagnostic";
  path: string;
  durationSeconds: number;
}

export interface Analysis {
  pitch: PitchTrack;
  syllables: SyllableAnalysis;
  aci: AciAnalysis;
  selfSimilarity: SelfSimilarity;
  indices: AcousticIndices;
  hopSeconds: number;
}

export interface RecordingPayload {
  audioId: string;
  audioUrl: string;
  commonName: string;
  generatedFrom: string;
  pipeline: string;
  sampleRate: number;
  fftSize: number;
  samplingWindowSeconds: number;
  samplingHopSeconds: number;
  durationSeconds: number;
  confidenceThreshold: number;
  pcaExplainedVarianceTotal: number;
  // Recording's maximum spectral centroid (Hz) -- top of the 3D-view color legend.
  centroidMaxHz: number;
  spectralDescriptors: SpectralDescriptors;
  pointCount: number;
  points: RecordingPointDatum[];
  // [pointIndex, pointIndex] pairs into `points` -- nearest neighbors in 3D feature
  // space, NOT temporal adjacency. See buildSimilarityEdges in the export script.
  similarityEdges: [number, number][];
  panels: PanelSeries;
  analysis: Analysis;
  birdnetDetections: BirdnetResult | null;
}
