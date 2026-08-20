import { ScatterPlot, type ScatterDomain } from "./ScatterPlot";
import { fluxColor } from "../colorScale";
import type { RecordingPointDatum } from "../types";

interface CentroidAmplitudePanelProps {
  points: RecordingPointDatum[];
  domain: ScatterDomain;
  total: number;
}

const FLUX_STOPS = [0, 0.25, 0.5, 0.75, 1];
const FLUX_GRADIENT = `linear-gradient(to right, ${FLUX_STOPS.map((s) => fluxColor(s).getStyle()).join(", ")})`;

export function CentroidAmplitudePanel({ points, domain, total }: CentroidAmplitudePanelProps) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Centroid-Amplitude Profile</h2>
        <span className="flux-scale">
          <span>0</span>
          <span className="flux-bar" style={{ background: FLUX_GRADIENT }} />
          <span>1</span>
          <span className="flux-label">Spectral Flux</span>
        </span>
      </div>
      <p className="panel-note">
        Centroid vs. amplitude ({points.length}/{total}) · color = flux · squares = latest points
      </p>
      <ScatterPlot points={points} domain={domain} />
    </div>
  );
}
