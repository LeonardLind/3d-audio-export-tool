import { fluxColor } from "../colorScale";
import type { RecordingPointDatum } from "../types";

const WIDTH = 300;
const HEIGHT = 155;
const MARGIN = { top: 8, right: 12, bottom: 22, left: 36 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;
// Number of most-recently-revealed points drawn as a connected white "recent path"
// (reference image 4: white square markers joined by faint lines).
const RECENT_COUNT = 6;

export interface ScatterDomain {
  centroidMaxHz: number;
}

// Centroid-Amplitude Profile: X = spectral centroid (Hz), Y = amplitude (0-1), color =
// spectral flux (blue -> red). Fills in progressively with playback (same visible-points
// list as the 3D view); axes are fixed from the full recording so they don't jump.
export function ScatterPlot({ points, domain }: { points: RecordingPointDatum[]; domain: ScatterDomain }) {
  const xOf = (centroidHz: number) =>
    domain.centroidMaxHz > 0 ? Math.min(1, centroidHz / domain.centroidMaxHz) * PLOT_WIDTH : PLOT_WIDTH / 2;
  const yOf = (amplitudeNorm: number) => PLOT_HEIGHT - amplitudeNorm * PLOT_HEIGHT;

  const recent = points.slice(-RECENT_COUNT);
  const recentPath = recent.map((point) => `${xOf(point.spectralCentroidHz)},${yOf(point.amplitudeNorm)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="scatter-plot">
      <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
        <line x1={0} y1={PLOT_HEIGHT} x2={PLOT_WIDTH} y2={PLOT_HEIGHT} stroke="#2a2f3a" strokeWidth={1} />
        <line x1={0} y1={0} x2={0} y2={PLOT_HEIGHT} stroke="#2a2f3a" strokeWidth={1} />

        {points.map((point) => (
          <circle
            key={point.id}
            cx={xOf(point.spectralCentroidHz)}
            cy={yOf(point.amplitudeNorm)}
            r={2.4}
            fill={fluxColor(point.spectralFluxNorm).getStyle()}
            fillOpacity={0.85}
          />
        ))}

        {/* Recent-path connector + white square markers for the latest points. */}
        {recent.length >= 2 && (
          <polyline points={recentPath} fill="none" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={0.8} />
        )}
        {recent.map((point) => (
          <rect
            key={`recent-${point.id}`}
            x={xOf(point.spectralCentroidHz) - 2.6}
            y={yOf(point.amplitudeNorm) - 2.6}
            width={5.2}
            height={5.2}
            fill="#ffffff"
            fillOpacity={0.92}
          />
        ))}
      </g>

      {/* X ticks (kHz). */}
      {[0, 0.5, 1].map((fraction) => (
        <text
          key={fraction}
          x={MARGIN.left + fraction * PLOT_WIDTH}
          y={HEIGHT - 16}
          fill="#8a90a0"
          fontSize={8}
          textAnchor="middle"
        >
          {((fraction * domain.centroidMaxHz) / 1000).toFixed(1)}
        </text>
      ))}
      <text x={WIDTH / 2} y={HEIGHT - 5} fill="#9ca3af" fontSize={9} textAnchor="middle">
        Spectral Centroid (kHz) →
      </text>
      <text x={12} y={HEIGHT / 2} fill="#9ca3af" fontSize={9} textAnchor="middle" transform={`rotate(-90 12 ${HEIGHT / 2})`}>
        Amplitude →
      </text>
    </svg>
  );
}
