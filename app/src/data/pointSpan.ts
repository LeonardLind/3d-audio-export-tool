import type { CloudPoint } from './types.ts';

export interface Span { startSeconds: number; endSeconds: number }
export interface SampleRange { start: number; end: number }

// Only the explicit payload fields can certify a span. An emission time or grid
// position is insufficient evidence for audible moment playback.
export function certifiedSpan(point: Pick<CloudPoint, 'audioStartSeconds' | 'audioEndSeconds'>, durationSeconds: number): Span | null {
  const start = point.audioStartSeconds;
  const end = point.audioEndSeconds;
  if (typeof start !== 'number' || !Number.isFinite(start) || typeof end !== 'number' || !Number.isFinite(end)
    || !Number.isFinite(durationSeconds) || start < 0 || start >= end || end > durationSeconds) return null;
  return { startSeconds: start, endSeconds: end };
}

export function toSampleRange(span: Span, sampleRateHz: number, sampleLength: number): SampleRange | null {
  if (!Number.isFinite(span.startSeconds) || !Number.isFinite(span.endSeconds)
    || !Number.isSafeInteger(sampleRateHz) || sampleRateHz <= 0
    || !Number.isSafeInteger(sampleLength) || sampleLength < 0) return null;
  const start = Math.round(span.startSeconds * sampleRateHz);
  const end = Math.round(span.endSeconds * sampleRateHz);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end > sampleLength || start >= end) return null;
  return { start, end };
}
