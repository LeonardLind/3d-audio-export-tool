import { useMemo } from "react";
import type { RefObject } from "react";
import { useCurrentFrame } from "../components/useCurrentFrame";
import { speciesColor } from "./speciesColor";
import type { BirdnetResult, PanelSeries } from "../types";

const W = 700;
const H = 110;
const PAD = { l: 6, r: 6, t: 6, b: 18 };
const PW = W - PAD.l - PAD.r;
const BAR_H = 46;

// Connects BirdNET species identification directly to the acoustic timeline, instead of
// leaving it as an isolated confidence list. Each 3s chunk is drawn as a stacked column:
// segment height = that species' confidence (so a chunk with one dominant call reads as
// one tall block; a chunk with several plausible candidates reads as several partial
// blocks stacked, making model uncertainty visible rather than hidden behind a single
// falsely-confident label -- deliberately so, per the field-recording benchmark finding
// that per-chunk top-1 alone can be misleading without location/date filtering: see
// 08_Visualization_Sandbox/Field_Recording_Findings.md). A tick marks every chunk-to-chunk
// change in the TOP species ("transition"). Legend ranks species by how many chunks they
// won outright.
export function DetectionTimeline({
  birdnet,
  duration,
  panels,
  audioRef,
}: {
  birdnet: BirdnetResult;
  duration: number;
  panels: PanelSeries;
  audioRef: RefObject<HTMLAudioElement | null>;
}) {
  const frame = useCurrentFrame(panels, audioRef);
  const t = frame * panels.hopSeconds;

  const { columns, legend, transitions } = useMemo(() => {
    const cols = birdnet.timeline.map((chunk) => {
      const x = (chunk.start / duration) * PW;
      const width = ((chunk.end - chunk.start) / duration) * PW;
      // Each species' confidence is an independent sigmoid score, not a softmax over a
      // shared total -- they can in principle sum past 1.0. Clamp the stack so it never
      // overflows the bar; this is a legibility choice, not a probability claim.
      let y = 0;
      const segments: { y: number; h: number; color: string; s: (typeof chunk.species)[number] }[] = [];
      for (const s of chunk.species) {
        if (y >= BAR_H) break;
        const h = Math.min(s.confidence * BAR_H, BAR_H - y);
        segments.push({ y: BAR_H - y - h, h, color: speciesColor(s.scientificName), s });
        y += h;
      }
      return { x, width, segments, top: chunk.species[0] };
    });

    const counts = new Map<string, { commonName: string; wins: number; best: number }>();
    for (const col of cols) {
      if (!col.top) continue;
      const key = col.top.scientificName;
      const entry = counts.get(key) ?? { commonName: col.top.commonName, wins: 0, best: 0 };
      entry.wins += 1;
      entry.best = Math.max(entry.best, col.top.confidence);
      counts.set(key, entry);
    }
    const rankedLegend = [...counts.entries()]
      .sort((a, b) => b[1].wins - a[1].wins)
      .slice(0, 6)
      .map(([scientificName, info]) => ({ scientificName, ...info }));

    const ticks: number[] = [];
    for (let i = 1; i < cols.length; i += 1) {
      const prevTop = cols[i - 1].top?.scientificName;
      const curTop = cols[i].top?.scientificName;
      if (prevTop && curTop && prevTop !== curTop) ticks.push(cols[i].x);
    }

    return { columns: cols, legend: rankedLegend, transitions: ticks };
  }, [birdnet, duration]);

  const playX = (t / duration) * PW;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg">
        <g transform={`translate(${PAD.l},${PAD.t})`}>
          <line x1={0} y1={BAR_H} x2={PW} y2={BAR_H} stroke="#242a36" />
          {columns.map((col, i) => (
            <g key={i} transform={`translate(${col.x},0)`}>
              {col.segments.map((seg, j) => (
                <rect key={j} x={0} y={seg.y} width={Math.max(1, col.width - 1)} height={seg.h} fill={seg.color} fillOpacity={0.9} />
              ))}
            </g>
          ))}
          {transitions.map((x, i) => (
            <line key={i} x1={x} y1={-4} x2={x} y2={BAR_H} stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1} />
          ))}
          <line x1={playX} y1={-6} x2={playX} y2={BAR_H} stroke="#ffffff" strokeWidth={1.4} />
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <text key={f} x={f * PW} y={BAR_H + 12} fontSize={8} fill="#8a90a0" textAnchor="middle">
              {(f * duration).toFixed(0)}s
            </text>
          ))}
        </g>
      </svg>
      <div className="timeline-legend">
        {legend.map((entry) => (
          <span key={entry.scientificName} className="legend-pill">
            <span className="legend-dot" style={{ background: speciesColor(entry.scientificName) }} />
            {entry.commonName} <span className="legend-meta">{entry.wins}× · best {Math.round(entry.best * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}
