export type AudioOrigin = 'source-file' | 'transcode' | 'unknown' | 'analysis-rate' | 'browser-resampled';

// Structural so the shared contracts also type-check in the DOM-free test project.
export interface AudioBufferLike {
  readonly numberOfChannels: number;
  readonly length: number;
  readonly sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

export interface DecodedClip {
  key: string;
  origin: AudioOrigin;
  buffer: AudioBufferLike;
  mono: Float32Array;
  sampleRate: number;
}

export type ClipStatus =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; clip: DecodedClip }
  | { status: 'error'; reason: string };

export interface PlayHandle {
  stop(): void;
  heardTime(): number | null;
  readonly playing: boolean;
}
