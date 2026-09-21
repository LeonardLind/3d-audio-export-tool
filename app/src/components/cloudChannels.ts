import type { RecordingPointDatum } from "../types";

// The v2 cloud's display-channel definitions: how a point's measured values become its
// sprite size and its printed number. Kept out of ParticleFieldV2.tsx so both that
// renderer and the controls panel can import them (and so the component file exports
// nothing but components).

// Smallest radius fraction any point is drawn at. The quietest surviving window on the
// sample clip is already 0.052 of the loudest, which is plainly visible; this only guards
// a clip whose amplitude range is so wide the quiet end would round away entirely.
export const MIN_RADIUS_FRACTION = 0.035;

// Peak sprite pixels. Held equal across the three size modes so switching mode reads as
// "the spread changed", not "everything got bigger" -- the spread is the thing being
// compared. 62 puts the loudest point at the same size v1 drew it.
export const SIZE_SCALE = 62;

// How sprite radius is derived from the window's RMS amplitude. All three show the SAME
// measurement -- how loud that moment is -- and differ only in how far apart loud and quiet
// are drawn. Button names say the visual result, notes say the arithmetic, so switching is a
// choice about contrast rather than about what is being shown.
export type SizeMode = "energy" | "amplitude" | "legacy";

export const SIZE_MODE_LABEL: Record<SizeMode, string> = {
  energy: "Strong",
  amplitude: "Softer",
  legacy: "Old (v1)",
};

// First line of every note, so the channel is never ambiguous however the buttons are read.
export const SIZE_LEAD = "Ball size = how loud that 0.15 s moment is.";

export const SIZE_MODE_NOTE: Record<SizeMode, string> = {
  energy:
    "Biggest difference between loud and quiet: half as loud is drawn half as wide. Measured from silence, so a tiny ball really does mean a near-silent moment. (radius = RMS / loudest RMS)",
  amplitude:
    "Same idea, gentler. Quiet moments are pulled up in size so they stay easy to spot, at the cost of loud ones standing out less. (radius = square root of RMS / loudest RMS)",
  legacy:
    "The old version, kept so you can see the difference. Every ball started at a quarter of full width, and size was measured from the quietest kept moment instead of from silence — so loud and quiet ended up looking alike. (radius = (0.6 + 1.8 x amplitudeNorm) / 2.4)",
};

// Which measured field the per-point number shows.
export type LabelValue = "centroid" | "dominant" | "amplitude" | "flux" | "time" | "none";

export const LABEL_VALUE_LABEL: Record<LabelValue, string> = {
  centroid: "Avg freq",
  dominant: "Peak freq",
  amplitude: "Loudness",
  flux: "Change",
  time: "Time",
  none: "Off",
};

export const LABEL_VALUE_NOTE: Record<LabelValue, string> = {
  centroid:
    "Average frequency of that moment, in kHz — where the sound sits overall, low hum to high whistle. This is also what the colour shows, so a yellow ball carries a high number. (point.spectralCentroidHz)",
  dominant:
    "The single loudest frequency at the loudest instant of that moment, in kHz. The most useful of these to print, because it is the one that regularly DISAGREES with what the colour already shows: on the field recording the two are only weakly related (r = 0.29), and where they diverge it means one clear tone is standing out of broadband noise. (point.dominantFrequencyHz)",
  amplitude:
    "How loud that moment is, as the raw value 0 = silence. This is the same number ball size uses, so it is the one to print while judging the size options. (point.amplitude, RMS)",
  flux:
    "How fast the sound is changing right there. High on a sharp attack or a jump in pitch, low on a steady held tone. Worth knowing before you rely on it: it tracks loudness very closely on real material (r = 0.94 on the field recording, 0.81 on the sample clip), so it largely repeats what ball size already tells you. (point.spectralFlux)",
  time: "When that moment happens in the recording, in seconds from the start. (point.emissionTime)",
  none: "No numbers drawn.",
};

// kHz with two decimals, e.g. 5425 Hz -> "5.43K". Every one of these is a field of the
// point datum printed as-is: nothing is rescaled, smoothed or averaged for display.
export function formatLabel(point: RecordingPointDatum, value: LabelValue): string {
  switch (value) {
    case "centroid":
      return `${(point.spectralCentroidHz / 1000).toFixed(2)}K`;
    case "dominant":
      return `${(point.dominantFrequencyHz / 1000).toFixed(2)}K`;
    case "amplitude":
      return point.amplitude.toFixed(3);
    case "flux":
      return point.spectralFlux.toFixed(0);
    case "time":
      return `${point.emissionTime.toFixed(2)}s`;
    default:
      return "";
  }
}

export function radiusFraction(point: RecordingPointDatum, amplitudeMax: number, mode: SizeMode): number {
  if (mode === "legacy") return (0.6 + point.amplitudeNorm * 1.8) / 2.4;
  const ratio = amplitudeMax > 0 ? point.amplitude / amplitudeMax : 0;
  return Math.max(MIN_RADIUS_FRACTION, mode === "energy" ? ratio : Math.sqrt(ratio));
}
