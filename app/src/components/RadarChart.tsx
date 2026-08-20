import type { SpectralDescriptors } from "../types";

interface Axis {
  key: keyof SpectralDescriptors;
  label: string;
  min: number;
  max: number;
}

// Heuristic display ranges chosen only so the eight axes plot at a readable scale --
// not a scientific claim about "typical" values. Axis order matches the reference image
// (clockwise from top): Centroid, Spread, Tonality, Crest, Entropy, Slope, Amp. Mod.,
// Freq. Mod.
const AXES: Axis[] = [
  { key: "spectralCentroid", label: "Centroid", min: 0, max: 9000 },
  { key: "spectralSpread", label: "Spread", min: 0, max: 4000 },
  { key: "tonality", label: "Tonality", min: 0, max: 1 },
  { key: "spectralCrest", label: "Crest", min: 0, max: 80 },
  { key: "spectralEntropy", label: "Entropy", min: 0, max: 1 },
  { key: "spectralSlope", label: "Slope", min: -0.001, max: 0.001 },
  { key: "amplitudeModulation", label: "Amp. Mod.", min: 0, max: 0.05 },
  { key: "frequencyModulation", label: "Freq. Mod.", min: 0, max: 2000 },
];

const SIZE = 250;
const CENTER = SIZE / 2;
const MAX_RADIUS = 82;

function clampNormalize(value: number, min: number, max: number) {
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

function axisPoint(index: number, radius: number): [number, number] {
  const angle = (index / AXES.length) * Math.PI * 2 - Math.PI / 2;
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)];
}

function polygonFor(values: SpectralDescriptors) {
  return AXES.map((axis, i) => axisPoint(i, clampNormalize(values[axis.key], axis.min, axis.max) * MAX_RADIUS))
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}

// Live instantaneous descriptor shape (`values`) drawn over a faint whole-recording
// average (`baseline`), so you can see how the current instant deviates from the norm.
export function RadarChart({ values, baseline }: { values: SpectralDescriptors; baseline?: SpectralDescriptors }) {
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="radar-chart">
      {[0.25, 0.5, 0.75, 1].map((ring) => (
        <polygon
          key={ring}
          points={AXES.map((_, i) => axisPoint(i, ring * MAX_RADIUS).join(",")).join(" ")}
          fill="none"
          stroke="#242a36"
          strokeWidth={1}
        />
      ))}
      {AXES.map((axis, i) => {
        const [x, y] = axisPoint(i, MAX_RADIUS);
        return <line key={axis.key} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="#242a36" strokeWidth={1} />;
      })}

      {baseline && (
        <polygon points={polygonFor(baseline)} fill="none" stroke="#5b6472" strokeWidth={1} strokeDasharray="3 3" />
      )}

      <polygon
        points={polygonFor(values)}
        fill="#c81e78"
        fillOpacity={0.4}
        stroke="#ff6ec7"
        strokeWidth={1.5}
        style={{ transition: "all 0.08s linear" }}
      />

      {AXES.map((axis, i) => {
        const [x, y] = axisPoint(i, MAX_RADIUS + 20);
        return (
          <text key={axis.key} x={x} y={y} fill="#9ca3af" fontSize={8.5} textAnchor="middle" dominantBaseline="middle">
            {axis.label}
          </text>
        );
      })}
    </svg>
  );
}
