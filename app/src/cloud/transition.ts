import type { AxisMask, TransitionPlan } from '../state/types.ts';

export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2;
}

export function transitionPlan(from: AxisMask, to: AxisMask, reducedMotion = false): { kind: TransitionPlan; durationMs: number } {
  if (from === to || reducedMotion) return { kind: 'instant', durationMs: 0 };
  const one = (mask: AxisMask) => mask === 1 || mask === 2 || mask === 4;
  return one(from) || one(to) ? { kind: 'fade', durationMs: 140 } : { kind: 'rotate', durationMs: 700 };
}
