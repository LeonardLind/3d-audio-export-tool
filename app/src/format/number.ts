// Decimal-string rounding avoids the binary multiplication error at e.g. 1.005.
export function roundDecimal(value: number, places = 0): string {
  if (!Number.isFinite(value)) throw new RangeError('Expected a finite number');
  if (!Number.isInteger(places) || places < 0 || places > 12) throw new RangeError('Invalid decimal precision');
  const negative = value < 0;
  const [coefficient, exponentText = '0'] = Math.abs(value).toString().split('e');
  const [whole, fraction = ''] = coefficient.split('.');
  const digits = BigInt(whole + fraction);
  const shift = Number(exponentText) - fraction.length + places;
  let rounded: bigint;
  if (shift >= 0) rounded = digits * 10n ** BigInt(shift);
  else {
    const divisor = 10n ** BigInt(-shift);
    rounded = digits / divisor + (digits % divisor * 2n >= divisor ? 1n : 0n);
  }
  const text = rounded.toString().padStart(places + 1, '0');
  return `${negative && rounded !== 0n ? '-' : ''}${places ? `${text.slice(0, -places)}.${text.slice(-places)}` : text}`;
}

export const formatKHz = (hz: number) => `${roundDecimal(hz / 1000, 2)} kHz`;
export const formatLabelK = (hz: number) => `${roundDecimal(hz / 1000, 2)}K`;
export const formatSeconds = (seconds: number) => `${roundDecimal(seconds, 2)} s`;
export const formatPercent = (fraction: number) => `${roundDecimal(fraction * 100)}%`;
export const formatDbfs = (rms: number) => rms > 0 ? `${roundDecimal(20 * Math.log10(rms), 1)} dBFS` : '−∞ dBFS';
export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
