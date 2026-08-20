import { centroidColor } from "../colorScale";

// Horizontal color-key for the 3D view: the plasma ramp keyed to SPECTRAL CENTROID,
// labeled 0 -> the recording's max centroid in kHz. Sits under the audio player in the
// top-left; display-only, doesn't cover the 3D scene.
const STOPS = Array.from({ length: 11 }, (_, i) => i / 10);
const GRADIENT = `linear-gradient(to right, ${STOPS.map((s) => centroidColor(s).getStyle()).join(", ")})`;

export function CentroidLegend({ maxHz }: { maxHz: number }) {
  const maxKHz = maxHz / 1000;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => (fraction * maxKHz).toFixed(1));

  return (
    <div className="centroid-legend">
      <div className="legend-title">SPECTRAL CENTROID</div>
      <div className="legend-bar" style={{ background: GRADIENT }} />
      <div className="legend-ticks">
        {ticks.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
        <span className="legend-unit">kHz</span>
      </div>
    </div>
  );
}
