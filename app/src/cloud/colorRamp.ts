const HEX_STOPS = ['#0d0887', '#6a00a8', '#b12a90', '#e16462', '#fca636', '#f0f921'] as const;
export const PLASMA_STOPS = HEX_STOPS;

export type Rgb = readonly [number, number, number];
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function srgbToLinear(x: number): number {
  const c = clamp01(x);
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function linearToSrgb(x: number): number {
  const c = clamp01(x);
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

function hexLinear(hex: string): Rgb {
  return [0, 1, 2].map((i) => srgbToLinear(parseInt(hex.slice(i * 2 + 1, i * 2 + 3), 16) / 255)) as unknown as Rgb;
}
const LINEAR_STOPS = HEX_STOPS.map(hexLinear);

// THREE.Color.lerp interpolates the linear channels of CSS-parsed colours.
export function plasmaLinear(t: number): Rgb {
  const scaled = clamp01(t) * (LINEAR_STOPS.length - 1);
  const i = Math.min(LINEAR_STOPS.length - 2, Math.floor(scaled));
  const f = scaled - i;
  const a = LINEAR_STOPS[i], b = LINEAR_STOPS[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export function restingDotDisplayRgb(t: number): Rgb {
  const color = plasmaLinear(t);
  // The preserved v0.7 ShaderMaterial writes directly to the display framebuffer;
  // it has no colorspace_fragment conversion. Match its actual blended bytes.
  const background = [4 / 255, 5 / 255, 10 / 255];
  const alpha = 0.95 * 0.92;
  return [0, 1, 2].map((i) => alpha * 0.95 * 0.95 * color[i] + (1 - alpha) * background[i]) as unknown as Rgb;
}

export function legibleEdgeLinear(t: number): Rgb {
  const color = plasmaLinear(t);
  const peak = Math.max(...color);
  const factor = peak > 0 && peak < 0.55 ? 0.55 / peak : 1;
  return color.map((channel) => channel * factor) as unknown as Rgb;
}
