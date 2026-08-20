import { useMemo } from "react";
import type { RefObject } from "react";
import { useCurrentFrame } from "../components/useCurrentFrame";
import { speciesColor } from "./speciesColor";
import type { BirdnetResult, PanelSeries, PitchTrack } from "../types";

const W = 340;
const H = 150;
const PAD = { l: 34, r: 8, t: 8, b: 20 };
const PW = W - PAD.l - PAD.r;
const PH = H - PAD.t - PAD.b;

// Pitch (fundamental-frequency) contour over time, on a log-frequency y-axis. Point
// brightness/size encodes voicing confidence, so tonal whistles read strongly while
// noisy/unvoiced frames fade out. A white line marks the current playback position.
// When BirdNET timeline data is available, a faint background band per chunk is colored
// by whichever species BirdNET scored highest in that window -- so you can see which
// pitch shapes coincide with which identification, not just where pitch exists.
export function PitchTrajectory({
  pitch,
  panels,
  birdnet,
  duration,
  audioRef,
}: {
  pitch: PitchTrack;
  panels: PanelSeries;
  birdnet?: BirdnetResult | null;
  duration: number;
  audioRef: RefObject<HTMLAudioElement | null>;
}) {
  const frame = useCurrentFrame(panels, audioRef);
  const n = pitch.hz.length;
  const logMin = Math.log(pitch.minHz);
  const logMax = Math.log(pitch.maxHz);

  const points = useMemo(() => {
    const step = Math.max(1, Math.round(n / 340));
    const out: { x: number; y: number; v: number }[] = [];
    for (let i = 0; i < n; i += step) {
      const hz = pitch.hz[i];
      if (hz <= pitch.minHz) continue;
      out.push({
        x: PAD.l + (i / (n - 1)) * PW,
        y: PAD.t + PH - ((Math.log(hz) - logMin) / (logMax - logMin)) * PH,
        v: pitch.voicing[i],
      });
    }
    return out;
  }, [pitch, n, logMin, logMax]);

  const bands = useMemo(() => {
    if (!birdnet || duration <= 0) return [];
    return birdnet.timeline
      .filter((chunk) => chunk.species[0])
      .map((chunk) => ({
        x: PAD.l + (chunk.start / duration) * PW,
        width: ((chunk.end - chunk.start) / duration) * PW,
        color: speciesColor(chunk.species[0].scientificName),
        opacity: 0.08 + chunk.species[0].confidence * 0.18,
      }));
  }, [birdnet, duration]);

  const playX = PAD.l + (frame / (n - 1 || 1)) * PW;
  const ticks = [pitch.minHz, Math.round(Math.sqrt(pitch.minHz * pitch.maxHz)), pitch.maxHz];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg">
      {bands.map((b, i) => (
        <rect key={i} x={b.x} y={PAD.t} width={b.width} height={PH} fill={b.color} fillOpacity={b.opacity} />
      ))}
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + PH} stroke="#242a36" />
      <line x1={PAD.l} y1={PAD.t + PH} x2={PAD.l + PW} y2={PAD.t + PH} stroke="#242a36" />
      {ticks.map((hz) => {
        const y = PAD.t + PH - ((Math.log(hz) - logMin) / (logMax - logMin)) * PH;
        return (
          <text key={hz} x={PAD.l - 4} y={y} fontSize={8} fill="#8a90a0" textAnchor="end" dominantBaseline="middle">
            {hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : hz}
          </text>
        );
      })}
      {points.map((p, i) => (
        // White, not a palette color: species bands behind these dots are colored from
        // the same categorical palette (see speciesColor.ts), and a same-hued dot would
        // vanish against a same-colored band -- confirmed visually on the field recording,
        // where the dominant species happened to hash to the same green.
        <circle key={i} cx={p.x} cy={p.y} r={1 + p.v * 2.6} fill="#ffffff" fillOpacity={0.15 + p.v * 0.85} />
      ))}
      <line x1={playX} y1={PAD.t} x2={playX} y2={PAD.t + PH} stroke="#ffffff" strokeOpacity={0.5} />
      <text x={PAD.l} y={H - 6} fontSize={8} fill="#9ca3af">
        time →   y = f0 (Hz, log)   ·   brightness = voicing{birdnet ? "   ·   band = top species" : ""}
      </text>
    </svg>
  );
}
