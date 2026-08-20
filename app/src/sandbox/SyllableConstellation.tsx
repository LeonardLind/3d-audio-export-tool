import { useMemo } from "react";
import type { RefObject } from "react";
import { useCurrentFrame } from "../components/useCurrentFrame";
import { centroidColor } from "../colorScale";
import { speciesColor } from "./speciesColor";
import type { BirdnetResult, PanelSeries, SyllableAnalysis } from "../types";

const W = 340;
const H = 160;
const PAD = { l: 32, r: 8, t: 8, b: 20 };
const PW = W - PAD.l - PAD.r;
const PH = H - PAD.t - PAD.b;

// Each detected syllable as a node: x = onset time, y = peak frequency, size = loudness,
// color = frequency. A faint line links them in order (the "call sequence"); the currently
// sounding syllable is ringed. Makes call rhythm, tessitura, and structure legible at once.
// When BirdNET timeline data is available, each node also gets an outer ring colored by
// whichever species BirdNET scored highest during that syllable's 3s chunk.
export function SyllableConstellation({
  data,
  nyquist,
  duration,
  panels,
  birdnet,
  audioRef,
}: {
  data: SyllableAnalysis;
  nyquist: number;
  duration: number;
  panels: PanelSeries;
  birdnet?: BirdnetResult | null;
  audioRef: RefObject<HTMLAudioElement | null>;
}) {
  const frame = useCurrentFrame(panels, audioRef);
  const t = frame * panels.hopSeconds;
  const maxAmp = Math.max(1e-6, ...data.syllables.map((s) => s.peakAmp));

  const nodes = useMemo(
    () =>
      data.syllables.map((s) => {
        const chunk = birdnet?.timeline.find((c) => s.start >= c.start && s.start < c.end);
        const top = chunk?.species[0] ?? null;
        return {
          x: PAD.l + (s.start / (duration || 1)) * PW,
          y: PAD.t + PH - Math.min(1, s.peakFreq / nyquist) * PH,
          r: 3 + (s.peakAmp / maxAmp) * 7,
          color: centroidColor(Math.min(1, s.peakFreq / nyquist)).getStyle(),
          ring: top ? speciesColor(top.scientificName) : null,
          topLabel: top?.commonName,
          s,
        };
      }),
    [data, nyquist, duration, maxAmp, birdnet],
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg">
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + PH} stroke="#242a36" />
      <line x1={PAD.l} y1={PAD.t + PH} x2={PAD.l + PW} y2={PAD.t + PH} stroke="#242a36" />
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <text key={f} x={PAD.l - 4} y={PAD.t + PH - f * PH} fontSize={8} fill="#8a90a0" textAnchor="end" dominantBaseline="middle">
          {((f * nyquist) / 1000).toFixed(0)}k
        </text>
      ))}
      <polyline points={nodes.map((nd) => `${nd.x},${nd.y}`).join(" ")} fill="none" stroke="#5b6472" strokeOpacity={0.4} />
      {nodes.map((nd, i) => {
        const active = t >= nd.s.start && t <= nd.s.end;
        return (
          <g key={i}>
            {nd.ring && <circle cx={nd.x} cy={nd.y} r={nd.r + 2.5} fill="none" stroke={nd.ring} strokeWidth={1.4} strokeOpacity={0.8} />}
            <circle
              cx={nd.x}
              cy={nd.y}
              r={nd.r}
              fill={nd.color}
              fillOpacity={active ? 1 : 0.7}
              stroke={active ? "#ffffff" : "none"}
              strokeWidth={active ? 1.6 : 0}
            >
              <title>{`${nd.s.start}s · ${nd.s.peakFreq} Hz · ${(nd.s.duration * 1000).toFixed(0)} ms${nd.topLabel ? ` · ${nd.topLabel}` : ""}`}</title>
            </circle>
          </g>
        );
      })}
      <text x={PAD.l} y={H - 6} fontSize={8} fill="#9ca3af">
        time →   y = peak freq   ·   size = loudness{birdnet ? "   ·   ring = top species" : ""}
      </text>
    </svg>
  );
}
