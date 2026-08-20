import { useMemo } from "react";
import type { RefObject } from "react";
import { RadarChart } from "./RadarChart";
import { useCurrentFrame } from "./useCurrentFrame";
import type { DescriptorKey, PanelSeries, SpectralDescriptors } from "../types";

interface GaugeDef {
  key: DescriptorKey;
  label: string;
  color: string;
  format: (value: number) => string;
}

const hz = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(2)} kHz` : `${Math.round(value)} Hz`);
const unit2 = (value: number) => value.toFixed(2);
const unit3 = (value: number) => value.toFixed(3);
const num1 = (value: number) => value.toFixed(1);

// The descriptors the user called out, shown as live sparklines. Each reads its own
// per-frame series from the payload; none of these drive the 3D position (D-010).
const GAUGES: GaugeDef[] = [
  { key: "centroid", label: "Spectral Centroid", color: "#ff9e3d", format: hz },
  { key: "rolloff", label: "Spectral Rolloff", color: "#ffd23d", format: hz },
  { key: "bandwidth", label: "Spectral Bandwidth", color: "#7bd1ff", format: hz },
  { key: "flux", label: "Spectral Flux", color: "#ff5bbf", format: unit2 },
  { key: "flatness", label: "Spectral Flatness", color: "#a78bfa", format: unit3 },
  { key: "rms", label: "RMS Energy", color: "#4ade80", format: unit3 },
  { key: "zcr", label: "Zero-Crossing Rate", color: "#38bdf8", format: unit3 },
  { key: "crest", label: "Spectral Crest", color: "#fb7185", format: num1 },
  { key: "entropy", label: "Spectral Entropy", color: "#c0cbe0", format: unit3 },
];

const SPARK_W = 250;
const SPARK_H = 30;
const SPARK_SAMPLES = 130;

function Sparkline({ series, range, frame, color }: { series: number[]; range: [number, number]; frame: number; color: string }) {
  // Downsample the full series to a fixed width once; recompute only if the series ref
  // changes. Past (up to the playhead) draws bright + filled; future draws faint.
  const points = useMemo(() => {
    const [min, max] = range;
    const span = max - min || 1;
    const count = Math.min(SPARK_SAMPLES, series.length);
    return Array.from({ length: count }, (_, i) => {
      const srcIndex = Math.round((i / (count - 1 || 1)) * (series.length - 1));
      const norm = Math.min(1, Math.max(0, (series[srcIndex] - min) / span));
      return { x: (i / (count - 1 || 1)) * SPARK_W, y: SPARK_H - norm * (SPARK_H - 2) - 1, srcIndex };
    });
  }, [series, range]);

  const playedCount = points.filter((point) => point.srcIndex <= frame).length;
  const played = points.slice(0, Math.max(1, playedCount));
  const head = played[played.length - 1];
  const line = (pts: typeof points) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = played.length >= 2 ? `0,${SPARK_H} ${line(played)} ${head.x.toFixed(1)},${SPARK_H}` : "";

  return (
    <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} className="spark" preserveAspectRatio="none">
      <polyline points={line(points)} fill="none" stroke={color} strokeOpacity={0.18} strokeWidth={1} />
      {area && <polygon points={area} fill={color} fillOpacity={0.14} />}
      {played.length >= 2 && <polyline points={line(played)} fill="none" stroke={color} strokeWidth={1.4} />}
      {head && <circle cx={head.x} cy={head.y} r={1.9} fill={color} />}
    </svg>
  );
}

export function SpectralDescriptorsPanel({
  panels,
  baseline,
  audioRef,
}: {
  panels: PanelSeries;
  baseline: SpectralDescriptors;
  audioRef: RefObject<HTMLAudioElement | null>;
}) {
  const frame = useCurrentFrame(panels, audioRef);
  const d = panels.descriptors;

  const radarValues: SpectralDescriptors = {
    spectralCentroid: d.centroid[frame] ?? 0,
    spectralSpread: d.bandwidth[frame] ?? 0,
    spectralEntropy: d.entropy[frame] ?? 0,
    spectralCrest: d.crest[frame] ?? 0,
    spectralSlope: d.slope[frame] ?? 0,
    frequencyModulation: d.freqMod[frame] ?? 0,
    amplitudeModulation: d.ampMod[frame] ?? 0,
    tonality: d.flatness[frame] ?? 0,
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Spectral Descriptors</h2>
        <span className="panel-tag">live</span>
      </div>
      <p className="panel-note">
        Instantaneous shape (magenta) vs. whole-recording average (dashed). Supplementary display — the raw flattened
        spectrogram (not these) drives the 3D position (D-010).
      </p>
      <RadarChart values={radarValues} baseline={baseline} />
      <div className="gauges">
        {GAUGES.map((gauge) => (
          <div key={gauge.key} className="gauge">
            <div className="gauge-top">
              <span className="gauge-label">{gauge.label}</span>
              <span className="gauge-val" style={{ color: gauge.color }}>
                {gauge.format(d[gauge.key][frame] ?? 0)}
              </span>
            </div>
            <Sparkline series={d[gauge.key]} range={panels.descriptorRanges[gauge.key]} frame={frame} color={gauge.color} />
          </div>
        ))}
      </div>
    </div>
  );
}
