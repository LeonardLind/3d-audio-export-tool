import type { RevealMode } from '../state/types.ts';
import { RECENT_SECONDS, REVEAL_SECONDS, TRAIL_SECONDS } from './constants.ts';

export function revealTime(mode: RevealMode, time: number): number {
  return mode === 'all' ? Number.POSITIVE_INFINITY : time;
}

export function ageFactors(emissionTime: number, clock: number, fluxNorm: number) {
  if (clock === Number.POSITIVE_INFINITY) return { revealed: true, reveal: 1, recent: 0, pulse: 1, trail: 0 };
  const age = clock - emissionTime;
  const revealed = age >= 0;
  const reveal = revealed ? Math.min(1, Math.max(0, age / REVEAL_SECONDS)) : 0;
  const recent = Math.exp(-Math.max(age, 0) / RECENT_SECONDS);
  const pulse = 1 + recent * (0.6 + fluxNorm * 1.3);
  const trail = revealed ? Math.min(1, Math.max(0, 1 - age / TRAIL_SECONDS)) : 0;
  return { revealed, reveal, recent, pulse, trail };
}
