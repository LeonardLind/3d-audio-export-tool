/// <reference lib="webworker" />
import { analyzeSamples, type BrowserAnalysis, type Progress } from "./pipeline";

// The STFT + PCA run here rather than on the main thread: PCA is O(n^2 * features) and
// takes hundreds of milliseconds on a short clip, seconds on a long one, and a blocked
// main thread would freeze the 3D canvas and the progress readout that is meant to show
// the work happening. Web Audio is not available in a worker, so decoding stays on the
// main thread (see decodeAudio.ts) and only the raw mono Float32Array crosses over --
// transferred, not copied.

export interface AnalyzeRequest {
  samples: Float32Array;
  audioId: string;
  commonName: string;
  filename: string;
  sourceSampleRateHz: number | null;
  sourceChannels: number | null;
}

export type AnalyzeResponse =
  | { type: "progress"; progress: Progress }
  | { type: "result"; analysis: BrowserAnalysis }
  | { type: "error"; message: string };

self.onmessage = (event: MessageEvent<AnalyzeRequest>) => {
  const request = event.data;
  const post = (message: AnalyzeResponse) => (self as unknown as Worker).postMessage(message);
  try {
    const analysis = analyzeSamples({
      ...request,
      onProgress: (progress) => post({ type: "progress", progress }),
    });
    post({ type: "result", analysis });
  } catch (error) {
    post({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
};
