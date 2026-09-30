import type { CloudPoint } from '../data/types.ts';
import { formatLabelK } from '../format/number.ts';
import { MIN_RADIUS_FRACTION, LABEL_COUNT } from './constants.ts';

// The energy branch of the original v0.7 size law.
export function radiusFraction(point: CloudPoint, amplitudeMax: number): number {
  const ratio = amplitudeMax > 0 ? point.amplitude / amplitudeMax : 0;
  return Math.max(MIN_RADIUS_FRACTION, ratio);
}

// Stable sort keeps the original time order when amplitudes tie.
export function labelCandidates(points: readonly CloudPoint[], count = LABEL_COUNT): number[] {
  return points.map((_, index) => index)
    .sort((a, b) => points[b].amplitude - points[a].amplitude || a - b)
    .slice(0, Math.max(0, count));
}

export function labelText(point: CloudPoint): string | null {
  return point.amplitude > 0 ? formatLabelK(point.dominantFrequencyHz) : null;
}
