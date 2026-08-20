import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { centroidColor } from "../colorScale";
import { buildBitmap } from "../components/panelBitmap";
import type { SelfSimilarity } from "../types";

const SIZE = 200;

// Self-similarity (recurrence) matrix: every moment compared to every other by cosine
// similarity of their spectra. The bright main diagonal is each frame vs itself; bright
// OFF-diagonal blocks mean the recording repeats itself (repeated phrases/calls). A moving
// crosshair marks the current playback time on both axes.
export function SelfSimilarityPlot({
  data,
  duration,
  audioRef,
}: {
  data: SelfSimilarity;
  duration: number;
  audioRef: RefObject<HTMLAudioElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const n = data.n;
    // buildBitmap places row r at pixel y = n-1-r; invert the row lookup so the main
    // diagonal runs corner-to-corner (time increases left->right and top->bottom).
    sourceRef.current = buildBitmap(n, n, (x, r) => {
      const value = data.matrix[(n - 1 - r) * n + x];
      const color = centroidColor(Math.pow(Math.max(0, value), 0.8));
      return [Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255)];
    });
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const draw = () => {
      ctx.fillStyle = "#04050a";
      ctx.fillRect(0, 0, SIZE, SIZE);
      if (sourceRef.current) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sourceRef.current, 0, 0, data.n, data.n, 0, 0, SIZE, SIZE);
      }
      const t = audioRef.current?.currentTime ?? 0;
      const p = Math.min(1, Math.max(0, duration > 0 ? t / duration : 0)) * SIZE;
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, SIZE);
      ctx.moveTo(0, p);
      ctx.lineTo(SIZE, p);
      ctx.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [data, duration, audioRef]);

  return <canvas ref={canvasRef} width={SIZE} height={SIZE} className="viz-canvas" />;
}
