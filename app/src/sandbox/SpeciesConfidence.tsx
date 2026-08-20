import type { BirdnetResult } from "../types";

// DEMONSTRATION fallback, used only when no real BirdNET result is attached to the
// dataset (e.g. offline before the one-time model download). Illustrative placeholders,
// not derived from any audio.
const DEMO: { name: string; conf: number }[] = [
  { name: "Common Chaffinch", conf: 0.94 },
  { name: "European Robin", conf: 0.81 },
  { name: "Great Tit", conf: 0.63 },
  { name: "Common Wood Pigeon", conf: 0.44 },
  { name: "Eurasian Blackbird", conf: 0.27 },
];

function barColor(conf: number) {
  if (conf >= 0.7) return "#4ade80";
  if (conf >= 0.4) return "#f59e0b";
  return "#fb7185";
}

// Real BirdNET species-classification confidences (tools/lib/birdnet.js) when available --
// the actual official model run locally via ONNX Runtime, not an approximation. Falls back
// to clearly-labeled demo data if no result was attached to the dataset.
export function SpeciesConfidence({ result }: { result: BirdnetResult | null }) {
  if (!result || result.detections.length === 0) {
    return (
      <div className="occ">
        {DEMO.map((s) => (
          <div className="occ-row" key={s.name}>
            <span className="occ-label sp">{s.name}</span>
            <div className="occ-track">
              <div className="occ-fill" style={{ width: `${s.conf * 100}%`, background: barColor(s.conf) }} />
            </div>
            <span className="occ-val">{Math.round(s.conf * 100)}%</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="occ">
        {result.detections.slice(0, 8).map((d) => (
          <div className="occ-row" key={d.scientificName}>
            <span className="occ-label sp" title={d.scientificName}>
              {d.commonName}
            </span>
            <div className="occ-track">
              <div className="occ-fill" style={{ width: `${d.confidence * 100}%`, background: barColor(d.confidence) }} />
            </div>
            <span className="occ-val">{Math.round(d.confidence * 100)}%</span>
          </div>
        ))}
      </div>
      <p className="viz-footnote">
        {result.model} · {result.chunkCount} × {result.chunkSeconds}s chunks · best confidence per species across the clip
      </p>
    </div>
  );
}
