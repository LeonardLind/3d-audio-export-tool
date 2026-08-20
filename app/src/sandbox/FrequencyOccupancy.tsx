import { centroidColor } from "../colorScale";
import type { AcousticIndices } from "../types";

// How much of the recording each frequency band is active (energy above a per-band
// threshold). Reveals which parts of the spectrum the sound actually occupies -- e.g. a
// tight high band for an insect stridulation vs. broad low bands for wind. Bands run high
// (top) to low (bottom), colored by band center frequency.
export function FrequencyOccupancy({ indices, nyquist }: { indices: AcousticIndices; nyquist: number }) {
  const bands = [...indices.bands].reverse();
  return (
    <div className="occ">
      {bands.map((b, i) => {
        const center = (b.loHz + b.hiHz) / 2;
        return (
          <div className="occ-row" key={i}>
            <span className="occ-label">
              {(b.loHz / 1000).toFixed(1)}–{(b.hiHz / 1000).toFixed(1)}k
            </span>
            <div className="occ-track">
              <div
                className="occ-fill"
                style={{ width: `${Math.max(1.5, b.occupancy * 100)}%`, background: centroidColor(Math.min(1, center / nyquist)).getStyle() }}
              />
            </div>
            <span className="occ-val">{Math.round(b.occupancy * 100)}%</span>
          </div>
        );
      })}
    </div>
  );
}
