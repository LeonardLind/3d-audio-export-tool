import type { RecordingPointDatum } from '../types.ts';

export interface CloudPoint extends RecordingPointDatum {
  audioStartSeconds?: number;
  audioEndSeconds?: number;
}

export interface SourceInfo {
  filename: string;
  extension: string;
  codec: string | null;
  container: string | null;
  sampleRateHz: number | null;
  channels: number | null;
  durationSeconds: number | null;
  sizeBytes: number;
  browserPlayable: boolean;
  [key: string]: unknown;
}

export interface FrequencyRange {
  minHz: number;
  maxHz: number;
  analysisNyquistHz: number;
  sourceNyquistHz: number | null;
  bandLimited: boolean;
  binWidthHz: number;
}

export interface DatasetManifestEntry {
  id: string;
  label: string;
  kind: 'sample' | 'field' | 'diagnostic';
  path: string;
  durationSeconds: number;
}

export type RecordingOrigin = 'published' | 'upload';

export interface CloudRecording {
  key: string;
  origin: RecordingOrigin;
  audioId: string;
  audioUrl: string | null;
  commonName: string;
  durationSeconds: number;
  sampleRate: number;
  analysisSampleRateHz: number;
  fftSize: number;
  samplingWindowSeconds: number;
  samplingHopSeconds: number;
  pointCount: number;
  points: CloudPoint[];
  similarityEdges: [number, number][];
  droppedEdges: number;
  centroidMaxHz: number;
  colorMaxHz: number;
  frequencyRange: FrequencyRange | null;
  source: SourceInfo | null;
  contractVersion: 1 | 2;
  evidence: unknown;
  raw: Record<string, unknown>;
  warnings: string[];
}

export type NormalizeResult =
  | { ok: true; recording: CloudRecording }
  | { ok: false; reason: string; newerVersion?: number };

export interface V2Raw extends Record<string, unknown> {
  contractVersion: 2;
  evidence?: unknown;
  viewPreservation?: unknown;
  axisMeaning?: unknown;
  similaritySpace?: unknown;
  similarityEdges3D?: unknown;
  display?: unknown;
  description?: unknown;
}
