import { useEffect, useRef, useState } from 'react';
import type { RangeHandle } from '../audio/engine.ts';
import { playheadFraction, sliceMinMax } from './waveformMath.ts';
import styles from './Compare.module.css';

export interface MomentWaveformProps {
  samples: Float32Array;
  start: number;
  end: number;
  sampleRate: number;
  peak: number;
  color: string;
  slot: 'a' | 'b';
  handle: RangeHandle | null;
}

export function MomentWaveform({ samples, start, end, sampleRate, peak, color, slot, handle }: MomentWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [dpr, setDpr] = useState(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const update = () => { setWidth(canvas.clientWidth); setDpr(window.devicePixelRatio || 1); };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(canvas);
    window.addEventListener('resize', update);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width || end <= start) return;
    const pixels = Math.max(1, Math.round(width * dpr));
    const height = Math.max(1, Math.round(88 * dpr));
    canvas.width = pixels;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0a0d16';
    ctx.fillRect(0, 0, pixels, height);
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(pixels, height / 2);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.85;
    const half = height * 0.46;
    if (end - start < 2 * pixels) {
      ctx.beginPath();
      for (let i = start; i < end; i += 1) {
        const x = (i - start) / Math.max(1, end - start - 1) * (pixels - 1);
        const y = height / 2 - samples[i] / peak * half;
        if (i === start) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else {
      const columns = sliceMinMax(samples, start, end, pixels);
      for (let c = 0; c < columns.length; c += 1) {
        const upper = height / 2 - columns[c].max / peak * half;
        const lower = height / 2 - columns[c].min / peak * half;
        ctx.beginPath();
        ctx.moveTo(c + 0.5, upper);
        ctx.lineTo(c + 0.5, Math.max(upper + 1, lower));
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }, [samples, start, end, width, dpr, peak, color]);

  useEffect(() => {
    const marker = playheadRef.current;
    if (!marker || !handle) return;
    const segment = handle.segments.find((part) => part.slot === slot);
    if (!segment) return;
    let frame = 0;
    const tick = () => {
      const heard = handle.heardTime();
      const fraction = heard === null ? null : playheadFraction(heard, segment.startAt,
        segment.durationSeconds, handle.loop && handle.segments.length === 1);
      marker.style.display = fraction === null ? 'none' : 'block';
      if (fraction !== null) marker.style.transform = `translateX(${fraction * width}px)`;
      if (handle.playing) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); marker.style.display = 'none'; };
  }, [handle, slot, width]);

  return <div className={styles.waveformBlock}>
    <div className={styles.waveformFrame}>
      <canvas ref={canvasRef} className={styles.waveform} aria-label={`${slot.toUpperCase()} audio waveform`} />
      <div ref={playheadRef} className={styles.playhead} aria-hidden="true" />
    </div>
    <div className={styles.waveformScale}><span>0 s</span><span>±{peak.toFixed(2)}</span><span>{((end - start) / sampleRate).toFixed(3)} s</span></div>
  </div>;
}
