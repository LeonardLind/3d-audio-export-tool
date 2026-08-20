import { Color } from "three";

const BLUE = new Color("#2255ff");
const GREEN = new Color("#22dd66");
const RED = new Color("#ff3322");

// Frequency-band color channel (Core Philosophy / Visual Channel Convention):
// low frequency -> blue, mid -> green, high -> red. Retained for any view that still
// colors by dominant frequency band.
export function frequencyColor(t: number): Color {
  const clamped = Math.min(1, Math.max(0, t));
  if (clamped < 0.5) return BLUE.clone().lerp(GREEN, clamped / 0.5);
  return GREEN.clone().lerp(RED, (clamped - 0.5) / 0.5);
}

// Piecewise-linear interpolation across an ordered list of color stops.
function ramp(stops: Color[], t: number): Color {
  const clamped = Math.min(1, Math.max(0, t));
  const scaled = clamped * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(scaled));
  return stops[i].clone().lerp(stops[i + 1], scaled - i);
}

// Plasma-style ramp for the 3D "MULTI-SCALE ANALYSIS" view, colored by SPECTRAL CENTROID
// (dark blue/purple -> magenta -> orange -> yellow), matching the reference legend.
const PLASMA = [
  new Color("#0d0887"),
  new Color("#6a00a8"),
  new Color("#b12a90"),
  new Color("#e16462"),
  new Color("#fca636"),
  new Color("#f0f921"),
];
export function centroidColor(t: number): Color {
  return ramp(PLASMA, t);
}

// Spectral-flux ramp for the Centroid-Amplitude Profile (blue -> red), matching the
// reference "SPECTRAL FLUX" legend.
const FLUX = [new Color("#2a6cf0"), new Color("#8a5cf0"), new Color("#ff3b3b")];
export function fluxColor(t: number): Color {
  return ramp(FLUX, t);
}

// Chromagram heatmap ramp (blue -> magenta -> red -> green), matching the reference
// chromagram color bar. Deep blue at zero energy, green at the peak.
const CHROMA = [
  new Color("#101a8c"),
  new Color("#3b1fb0"),
  new Color("#a01fb0"),
  new Color("#ff2a2a"),
  new Color("#37d43a"),
];
export function chromaColor(t: number): Color {
  return ramp(CHROMA, t);
}
