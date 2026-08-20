import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { PanelSeries } from "../types";
import { chromaColor } from "../colorScale";
import { buildBitmap, scrollWindow } from "./panelBitmap";

const WINDOW_SECONDS = 5;
const WIDTH = 300;
const HEIGHT = 168;
const METER_W = 40; // right-hand live current-chroma column
const PAD = { left: 20, right: 4, top: 6, bottom: 16 };
const PLOT_W = WIDTH - PAD.left - PAD.right - METER_W - 6;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;
const ROW_H = PLOT_H / 12;
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Estimate the active note + chord from one chroma column (12 pitch classes). Pure
// post-processing of precomputed chroma -- no FFT in the browser. Matches the column
// against the 12 major and 12 minor triad templates and picks the best; falls back to
// just the dominant note when nothing scores like a clear triad (or during near-silence).
function detectChord(chroma: number[]) {
  const total = chroma.reduce((sum, value) => sum + value, 0);
  const dominant = chroma.reduce((best, value, i) => (value > chroma[best] ? i : best), 0);
  if (total < 0.05) return { note: "—", chord: "—", dominant: -1 };

  const norm = chroma.map((value) => value / total);
  let best = { score: -1, label: "—" };
  for (let root = 0; root < 12; root += 1) {
    const major = norm[root] + norm[(root + 4) % 12] + norm[(root + 7) % 12];
    const minor = norm[root] + norm[(root + 3) % 12] + norm[(root + 7) % 12];
    if (major > best.score) best = { score: major, label: `${NOTES[root]} maj` };
    if (minor > best.score) best = { score: minor, label: `${NOTES[root]} min` };
  }
  return { note: NOTES[dominant], chord: best.score > 0.55 ? best.label : "—", dominant };
}

export function ChromagramPanel({
  panels,
  audioRef,
}: {
  panels: PanelSeries;
  audioRef: RefObject<HTMLAudioElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<HTMLCanvasElement | null>(null);
  const [readout, setReadout] = useState({ note: "—", chord: "—" });

  useEffect(() => {
    sourceRef.current = buildBitmap(panels.chroma.length, 12, (col, row) => {
      const color = chromaColor(Math.pow(panels.chroma[col][row], 0.7));
      return [Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255)];
    });
  }, [panels]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const cols = panels.chroma.length;
    const lastTime = (cols - 1) * panels.hopSeconds;
    let raf = 0;
    let lastNote = "";
    let lastChord = "";

    const draw = () => {
      const t = audioRef.current?.currentTime ?? 0;
      const { start } = scrollWindow(t, WINDOW_SECONDS, lastTime);
      const frame = Math.min(cols - 1, Math.max(0, Math.round(t / panels.hopSeconds)));
      const current = panels.chroma[frame] ?? new Array(12).fill(0);
      const detected = detectChord(current);

      ctx.fillStyle = "#04050a";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const source = sourceRef.current;
      if (source) {
        const sx = start / panels.hopSeconds;
        const sw = WINDOW_SECONDS / panels.hopSeconds;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(source, sx, 0, sw, 12, PAD.left, PAD.top, PLOT_W, PLOT_H);
      }

      ctx.strokeStyle = "#2a2f3a";
      ctx.lineWidth = 1;
      ctx.strokeRect(PAD.left, PAD.top, PLOT_W, PLOT_H);

      // Pitch-class labels down the left (C bottom .. B top). Dominant note lit up.
      ctx.font = "7px ui-monospace, Consolas, monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let pc = 0; pc < 12; pc += 1) {
        const y = PAD.top + PLOT_H - (pc + 0.5) * ROW_H;
        ctx.fillStyle = pc === detected.dominant ? "#ffffff" : "#6b7280";
        ctx.fillText(NOTES[pc], PAD.left - 3, y);
      }

      // Time ticks.
      ctx.fillStyle = "#8a90a0";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let i = 0; i <= 3; i += 1) {
        const fraction = i / 3;
        const x = PAD.left + fraction * PLOT_W;
        ctx.fillText(`${(start + fraction * WINDOW_SECONDS).toFixed(1)}s`, x, PAD.top + PLOT_H + 3);
      }

      // "Now" marker on the heatmap.
      const nowX = PAD.left + ((t - start) / WINDOW_SECONDS) * PLOT_W;
      if (nowX >= PAD.left && nowX <= PAD.left + PLOT_W) {
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath();
        ctx.moveTo(nowX, PAD.top);
        ctx.lineTo(nowX, PAD.top + PLOT_H);
        ctx.stroke();
      }

      // Live current-chroma meter on the right: one cell per pitch class, brightness =
      // current energy, dominant bin ringed. Makes "which note is strongest right now"
      // unmistakable at a glance.
      const meterX = WIDTH - METER_W - PAD.right;
      for (let pc = 0; pc < 12; pc += 1) {
        const y = PAD.top + PLOT_H - (pc + 1) * ROW_H;
        const value = current[pc];
        const color = chromaColor(Math.pow(value, 0.7));
        ctx.fillStyle = `rgb(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)})`;
        ctx.fillRect(meterX, y + 0.5, METER_W, ROW_H - 1);
        if (pc === detected.dominant) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.4;
          ctx.strokeRect(meterX + 0.7, y + 1, METER_W - 1.4, ROW_H - 2);
        }
        ctx.fillStyle = value > 0.4 ? "#04050a" : "#aeb4c0";
        ctx.font = "7px ui-monospace, Consolas, monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(NOTES[pc], meterX + 3, y + ROW_H / 2);
      }

      if (detected.note !== lastNote || detected.chord !== lastChord) {
        lastNote = detected.note;
        lastChord = detected.chord;
        setReadout({ note: detected.note, chord: detected.chord });
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [panels, audioRef]);

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Chromagram</h2>
        <div className="chord-readout">
          <span className="chord-note">{readout.note}</span>
          <span className="chord-name">{readout.chord}</span>
        </div>
      </div>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="panel-canvas" />
    </div>
  );
}
