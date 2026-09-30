import { overviewColumns } from '../audio/overview.ts';
import type { WaveformColumn } from './types.ts';

export function sliceMinMax(samples: ArrayLike<number>, start: number, end: number, columns: number): WaveformColumn[] {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > samples.length || start >= end) {
    throw new RangeError('sliceMinMax: invalid sample range');
  }
  return overviewColumns(Array.prototype.slice.call(samples, start, end) as number[], columns);
}

export function sharedPeak(a: ArrayLike<number>, b: ArrayLike<number>): { peak: number; silent: boolean } {
  let peak = 0;
  for (const values of [a, b]) for (let i = 0; i < values.length; i += 1) peak = Math.max(peak, Math.abs(values[i]));
  return { peak: peak || 1, silent: peak === 0 };
}

export function playheadFraction(heard: number, startAt: number, duration: number, loop: boolean): number | null {
  if (!Number.isFinite(heard) || !Number.isFinite(startAt) || !(duration > 0) || heard < startAt) return null;
  const elapsed = heard - startAt;
  if (!loop && elapsed > duration) return null;
  return loop ? (elapsed % duration) / duration : Math.min(1, elapsed / duration);
}
