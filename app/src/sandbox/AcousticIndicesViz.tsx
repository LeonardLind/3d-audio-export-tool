import { useMemo } from "react";
import type { AciAnalysis, AcousticIndices } from "../types";

const W = 340;
const H = 64;

// Soundscape-ecology summary indices, computed offline (tools/lib/analysis.js). ACI is
// shown as a per-second timeline; the rest as stat tiles. NDSI (biophony 2-11kHz vs
// anthrophony 1-2kHz) is derived here from the per-band energies.
export function AcousticIndicesViz({ aci, indices }: { aci: AciAnalysis; indices: AcousticIndices }) {
  const maxAci = Math.max(1e-6, ...aci.series.map((s) => s.aci));
  const barW = W / Math.max(1, aci.series.length);

  const ndsi = useMemo(() => {
    let bio = 0;
    let anth = 0;
    for (const b of indices.bands) {
      const center = (b.loHz + b.hiHz) / 2;
      if (center >= 1000 && center < 2000) anth += b.meanEnergy;
      else if (center >= 2000) bio += b.meanEnergy;
    }
    return bio + anth > 0 ? (bio - anth) / (bio + anth) : 0;
  }, [indices]);

  const tiles = [
    { k: "ACI", v: aci.total.toFixed(0), hint: "complexity" },
    { k: "ADI", v: indices.adi.toFixed(2), hint: "diversity" },
    { k: "AEI", v: indices.aei.toFixed(2), hint: "evenness" },
    { k: "BI", v: indices.bi.toFixed(1), hint: "bioacoustic" },
    { k: "H", v: indices.entropyH.toFixed(2), hint: "entropy" },
    { k: "NDSI", v: ndsi.toFixed(2), hint: "bio vs anthro" },
  ];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg">
        {aci.series.map((s, i) => {
          const h = (s.aci / maxAci) * (H - 16);
          return <rect key={i} x={i * barW + 1} y={H - h - 2} width={Math.max(1, barW - 2)} height={h} fill="#f59e0b" fillOpacity={0.85} />;
        })}
        <text x={3} y={11} fontSize={8} fill="#9ca3af">
          ACI per {aci.clusterSeconds}s window
        </text>
      </svg>
      <div className="tiles">
        {tiles.map((t) => (
          <div className="tile" key={t.k}>
            <span className="tile-v">{t.v}</span>
            <span className="tile-k">{t.k}</span>
            <span className="tile-h">{t.hint}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
