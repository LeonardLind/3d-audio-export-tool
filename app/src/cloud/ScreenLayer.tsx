import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { CloudRecording } from '../data/types.ts';
import type { AxisMask, RevealMode, Selection } from '../state/types.ts';
import type { ScreenFrame, LabelBox } from './types.ts';
import { labelCandidates, labelText } from './channels.ts';
import { currentPointIndex, labelsOverlap, placeLabels, writeLabelBox } from './geometry.ts';
import { updateScreenFrame } from './screenFrame.ts';
import { LABEL_PIXEL_HEIGHT } from './constants.ts';

export interface ScreenLayerProps {
  recording: CloudRecording;
  audioRef: RefObject<HTMLAudioElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  frameRef: RefObject<ScreenFrame>;
  axes: AxisMask;
  reveal: RevealMode;
  playing: boolean;
  selection: Selection;
  hover: number | null;
  transitionActive: boolean;
  onDiagnostics?: (visibleLabels: number, overlaps: number) => void;
}

function ring(ctx: CanvasRenderingContext2D, frame: ScreenFrame, index: number | null, color: string, chip?: string) {
  if (index === null || index < 0 || index >= frame.count || !frame.revealed[index]) return;
  const x = frame.sx[index], y = frame.sy[index], radius = frame.radiusCss[index] + 3;
  ctx.beginPath(); ctx.arc(x, y, Math.max(3, radius), 0, Math.PI * 2);
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
  if (chip) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x + radius + 2, y - 11, 19, 18, 4); ctx.fill();
    ctx.fillStyle = '#04050a'; ctx.font = '700 11px ui-sans-serif, sans-serif'; ctx.fillText(chip, x + radius + 7, y + 2);
  }
}

function axisMarks(ctx: CanvasRenderingContext2D, axes: AxisMask, width: number, height: number) {
  if (axes === 7) return;
  const horizontal = axes === 2 || axes === 6 ? 'Y' : axes === 4 ? 'Z' : 'X';
  const vertical = axes === 3 ? 'Y' : axes === 5 || axes === 6 ? 'Z' : null;
  ctx.fillStyle = '#8a93a6'; ctx.font = '500 11px ui-sans-serif, sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`−${horizontal}`, 16, height / 2);
  ctx.textAlign = 'right'; ctx.fillText(`+${horizontal}`, width - 16, height / 2);
  if (vertical) {
    ctx.textAlign = 'center';
    ctx.fillText(`+${vertical}`, width / 2, 18);
    ctx.fillText(`−${vertical}`, width / 2, height - 70);
  }
}

export function ScreenLayer({ recording, audioRef, canvasRef, frameRef, axes, reveal, playing, selection, hover, transitionActive, onDiagnostics }: ScreenLayerProps) {
  const scratch = useMemo(() => new Vector3(), []);
  const candidates = useMemo(() => labelCandidates(recording.points), [recording]);
  const strings = useMemo(() => candidates.map((index) => labelText(recording.points[index])), [candidates, recording]);
  const emissions = useMemo(() => Float32Array.from(recording.points, (point) => point.emissionTime), [recording]);
  const amplitudeMax = useMemo(() => recording.points.reduce((max, point) => Math.max(max, point.amplitude), 0), [recording]);
  const boxes = useMemo<LabelBox[]>(() => candidates.map(() => ({ x: 0, y: 0, width: 0, height: LABEL_PIXEL_HEIGHT })), [candidates]);
  const widths = useMemo(() => new Float32Array(candidates.length), [candidates]);
  const visible = useMemo(() => new Uint8Array(candidates.length), [candidates]);
  const placed = useMemo(() => new Uint8Array(candidates.length), [candidates]);
  const measuredRef = useRef(false);

  useEffect(() => { measuredRef.current = false; }, [recording]);

  useFrame(({ camera, size, gl }) => {
    const canvas = canvasRef.current, frame = frameRef.current;
    if (!canvas || !frame) return;
    const dpr = gl.getPixelRatio();
    const backingWidth = Math.round(size.width * dpr), backingHeight = Math.round(size.height * dpr);
    if (canvas.width !== backingWidth || canvas.height !== backingHeight) { canvas.width = backingWidth; canvas.height = backingHeight; }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    updateScreenFrame(frame, recording, camera, axes, reveal, audioRef.current?.currentTime ?? 0, size.width, size.height, dpr, scratch, amplitudeMax);
    if (transitionActive) return;
    axisMarks(ctx, axes, size.width, size.height);

    ctx.font = '600 13px ui-monospace, "Cascadia Mono", Consolas, monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    if (!measuredRef.current) {
      for (let i = 0; i < strings.length; i++) { const value = strings[i]; widths[i] = value ? ctx.measureText(value).width : 0; }
      measuredRef.current = true;
    }
    for (let i = 0; i < candidates.length; i++) {
      const index = candidates[i], box = boxes[i];
      visible[i] = frame.revealed[index] && strings[i] ? 1 : 0;
      writeLabelBox(box, frame.sx[index], frame.sy[index], frame.radiusCss[index], widths[i]);
    }
    const count = placeLabels(boxes, visible, placed, size.width, size.height);
    ctx.lineJoin = 'round'; ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(2,4,10,.85)'; ctx.fillStyle = '#f2f5fb';
    for (let i = 0; i < candidates.length; i++) {
      const value = strings[i];
      if (!placed[i] || !value) continue;
      ctx.strokeText(value, boxes[i].x, boxes[i].y + LABEL_PIXEL_HEIGHT / 2);
      ctx.fillText(value, boxes[i].x, boxes[i].y + LABEL_PIXEL_HEIGHT / 2);
    }
    ring(ctx, frame, hover, '#f2f5fb');
    ring(ctx, frame, selection.a, '#4dd9ff', 'A');
    ring(ctx, frame, selection.b, '#7cf29a', 'B');
    if (playing && reveal === 'follow') {
      ring(ctx, frame, currentPointIndex(emissions, audioRef.current?.currentTime ?? 0), '#ffffff');
    }
    if (import.meta.env.DEV || onDiagnostics) {
      let overlaps = 0;
      for (let i = 0; i < boxes.length; i++) for (let j = 0; j < i; j++) {
        if (placed[i] && placed[j] && labelsOverlap(boxes[i], boxes[j])) overlaps++;
      }
      onDiagnostics?.(count, overlaps);
      if (import.meta.env.DEV) {
        canvas.dataset.visibleLabels = String(count);
        canvas.dataset.labelOverlaps = String(overlaps);
      }
    }
  });
  return null;
}
