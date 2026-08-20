import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { PanelSeries } from "../types";
import { buildBitmap, scrollWindow } from "./panelBitmap";

const WINDOW_SECONDS = 5;
const WIDTH = 300;
const HEIGHT = 150;
const PAD = { left: 34, right: 8, top: 6, bottom: 16 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

// TIME WINDOW panel: a grayscale spectrogram of the last WINDOW_SECONDS of audio,
// scrolling with playback, with the per-frame SPECTRAL CENTROID drawn as a red track on
// top (reference image 3, upper panel). Supplementary display -- all data is precomputed
// offline in panels.frames / panels.centroidTrack.
export function SpectrogramPanel({
  panels,
  audioRef,
}: {
  panels: PanelSeries;
  audioRef: RefObject<HTMLAudioElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Full-recording grayscale bitmap, built once. Gamma < 1 lifts quiet detail so the
    // faint structure reads against black, as in the reference.
    sourceRef.current = buildBitmap(panels.frames.length, panels.freqHz.length, (col, row) => {
      const value = Math.pow(panels.frames[col][row], 0.55);
      const level = Math.round(255 * value);
      return [level, level, level];
    });
  }, [panels]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const cols = panels.frames.length;
    const lastTime = (cols - 1) * panels.hopSeconds;
    const nyquist = panels.nyquistHz;
    let raf = 0;

    const draw = () => {
      const t = audioRef.current?.currentTime ?? 0;
      const { start, end } = scrollWindow(t, WINDOW_SECONDS, lastTime);

      ctx.fillStyle = "#04050a";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const source = sourceRef.current;
      if (source) {
        const sx = start / panels.hopSeconds;
        const sw = WINDOW_SECONDS / panels.hopSeconds;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(source, sx, 0, sw, source.height, PAD.left, PAD.top, PLOT_W, PLOT_H);
      }

      // Red spectral-centroid track over the window.
      ctx.strokeStyle = "#ff3b3b";
      ctx.fillStyle = "#ff3b3b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      let started = false;
      const firstFrame = Math.max(0, Math.floor(start / panels.hopSeconds));
      const lastFrame = Math.min(cols - 1, Math.ceil(end / panels.hopSeconds));
      for (let f = firstFrame; f <= lastFrame; f += 1) {
        const frameTime = f * panels.hopSeconds;
        const x = PAD.left + ((frameTime - start) / WINDOW_SECONDS) * PLOT_W;
        const y = PAD.top + PLOT_H - Math.min(1, panels.centroidTrack[f] / nyquist) * PLOT_H;
        ctx.fillRect(x - 0.6, y - 0.6, 1.6, 1.6);
        if (started) ctx.lineTo(x, y);
        else {
          ctx.moveTo(x, y);
          started = true;
        }
      }
      ctx.globalAlpha = 0.55;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Axes frame.
      ctx.strokeStyle = "#2a2f3a";
      ctx.lineWidth = 1;
      ctx.strokeRect(PAD.left, PAD.top, PLOT_W, PLOT_H);

      // Frequency ticks (kHz) up the left edge.
      ctx.fillStyle = "#8a90a0";
      ctx.font = "8px ui-monospace, Consolas, monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let i = 0; i <= 4; i += 1) {
        const fraction = i / 4;
        const y = PAD.top + PLOT_H - fraction * PLOT_H;
        const khz = ((fraction * nyquist) / 1000).toFixed(1);
        ctx.fillText(`${khz}`, PAD.left - 4, y);
      }

      // Time ticks (s) along the bottom.
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let i = 0; i <= 4; i += 1) {
        const fraction = i / 4;
        const x = PAD.left + fraction * PLOT_W;
        const seconds = (start + fraction * WINDOW_SECONDS).toFixed(1);
        ctx.fillText(`${seconds}s`, x, PAD.top + PLOT_H + 3);
      }

      // "Now" marker.
      const nowX = PAD.left + ((t - start) / WINDOW_SECONDS) * PLOT_W;
      if (nowX >= PAD.left && nowX <= PAD.left + PLOT_W) {
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.moveTo(nowX, PAD.top);
        ctx.lineTo(nowX, PAD.top + PLOT_H);
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [panels, audioRef]);

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Time Window</h2>
        <span className="legend-chip">
          <span className="legend-swatch" style={{ background: "#ff3b3b" }} /> Spectral Centroid
        </span>
      </div>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="panel-canvas" />
    </div>
  );
}
