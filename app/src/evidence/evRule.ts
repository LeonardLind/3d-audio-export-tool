import { roundDecimal } from '../format/number.ts';
import { finiteVector } from './blocks.ts';

export function evRule(ratios: unknown, total: unknown, mask: number): string | null {
  if (!finiteVector(ratios, 3) || ratios.some((v) => v < 0 || v > 1)
    || typeof total !== 'number' || !Number.isFinite(total)
    || Math.abs(ratios[0] + ratios[1] + ratios[2] - total) > 1e-9
    || !Number.isInteger(mask) || mask < 1 || mask > 7) return null;
  let sum = 0;
  for (let i = 0; i < 3; i += 1) if (mask & (1 << i)) sum += ratios[i];
  // Shift the shortest round-trip decimal string before rounding (011's ev rule).
  const [coefficient, exponent = '0'] = sum.toString().split('e');
  const percent = Number(`${coefficient}e${Number(exponent) + 2}`);
  const rounded = roundDecimal(percent);
  return sum > 0 && rounded === '0' ? 'under 1%' : `${rounded}%`;
}
