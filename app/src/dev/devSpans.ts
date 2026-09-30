import type { CloudRecording } from '../data/types.ts';

export const PREVIEW_SENTINEL = '__OWNER_PREVIEW__';
export function devSpans(recording: CloudRecording) {
  if (recording.sampleRate !== 22050 || recording.fftSize !== 1024) return null;
  const spans = [];
  for (const point of recording.points) {
    const frame = point.emissionTime * 22050 / 512;
    const startFrame = Math.round(frame);
    if (!Number.isFinite(frame) || Math.abs(frame - startFrame) > 1e-9 || startFrame < 0) return null;
    const startSeconds = 512 * startFrame / 22050;
    const endSeconds = (512 * startFrame + 3584) / 22050;
    if (endSeconds > recording.durationSeconds) return null;
    spans.push({ startSeconds, endSeconds });
  }
  return spans;
}
