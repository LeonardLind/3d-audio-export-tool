import type { LabelBox } from './types.ts';
import type { ScreenFrame, ViewBasis } from './types.ts';
import type { AxisMask } from '../state/types.ts';
import { LABEL_GAP_PIXELS, LABEL_PIXEL_HEIGHT, MATTE, SIZE_SCALE } from './constants.ts';

type Vec3 = readonly [number, number, number];
const X: Vec3 = [1, 0, 0], Y: Vec3 = [0, 1, 0], Z: Vec3 = [0, 0, 1];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function toggleAxis(mask: AxisMask, axis: 1 | 2 | 4): AxisMask { return (mask ^ axis || mask) as AxisMask; }

export function viewBasis(mask: AxisMask): ViewBasis {
  let right: Vec3 = X, up: Vec3 = Y;
  if (mask === 5) up = Z;
  else if (mask === 6) { right = Y; up = Z; }
  else if (mask === 2) { right = Y; up = Z; }
  else if (mask === 4) { right = Z; up = X; }
  // XZ naturally looks from -Y because X × Z = -Y.
  return { right, up, back: cross(right, up), mask };
}

export function projectToView(position: Vec3, mask: AxisMask): readonly [number, number] {
  const basis = viewBasis(mask);
  return [dot(position, basis.right), mask === 1 || mask === 2 || mask === 4 ? 0 : dot(position, basis.up)];
}

export interface OrthoFit { center: readonly [number, number]; worldPerPixel: number; worldHeight: number; worldWidth: number }
export function fitOrtho(points: readonly { position: Vec3 }[], mask: AxisMask, width: number, height: number): OrthoFit {
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const point of points) {
    const [u, v] = projectToView(point.position, mask);
    minU = Math.min(minU, u); maxU = Math.max(maxU, u);
    minV = Math.min(minV, v); maxV = Math.max(maxV, v);
  }
  if (!points.length) { minU = minV = -1; maxU = maxV = 1; }
  const safeWidth = Math.max(1, width), safeHeight = Math.max(1, height);
  const worldPerPixel = Math.max((maxU - minU) / (safeWidth * 0.88), (maxV - minV) / (safeHeight * 0.88), 1 / Math.min(safeWidth, safeHeight));
  return { center: [(minU + maxU) / 2, (minV + maxV) / 2], worldPerPixel,
    worldHeight: worldPerPixel * safeHeight, worldWidth: worldPerPixel * safeWidth };
}

export function equivalentOrthoDepth(worldHeight: number): number { return worldHeight / (2 * Math.tan(26 * Math.PI / 180)); }

export function ballRadiusCss(radiusFraction: number, depth: number, pixelRatio: number, reveal = 1, pulse = 1): number {
  const dpr = Math.max(0.1, pixelRatio);
  const diameterDevice = Math.min(MATTE.maxBallPixels, Math.max(0, radiusFraction * SIZE_SCALE * dpr * 9 * pulse * reveal / Math.max(0.001, depth)));
  return diameterDevice / dpr / 2;
}

// The same box is used for drawing and collision. The live radius includes the pulse.
export function labelBox(sx: number, sy: number, radiusCss: number, width: number): LabelBox {
  return { x: sx + radiusCss + 4, y: sy - LABEL_PIXEL_HEIGHT / 2,
    width, height: LABEL_PIXEL_HEIGHT };
}

export function writeLabelBox(target: LabelBox, sx: number, sy: number, radiusCss: number, width: number): void {
  target.x = sx + radiusCss + 4;
  target.y = sy - LABEL_PIXEL_HEIGHT / 2;
  target.width = width;
  target.height = LABEL_PIXEL_HEIGHT;
}

export function labelsOverlap(a: LabelBox, b: LabelBox): boolean {
  return a.x < b.x + b.width + LABEL_GAP_PIXELS &&
    a.x + a.width + LABEL_GAP_PIXELS > b.x &&
    a.y < b.y + b.height + LABEL_GAP_PIXELS &&
    a.y + a.height + LABEL_GAP_PIXELS > b.y;
}

export function placeLabels(boxes: readonly LabelBox[], visible: Uint8Array, placed: Uint8Array, viewportWidth: number, viewportHeight: number): number {
  placed.fill(0);
  let count = 0;
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    if (!visible[i] || box.x < 0 || box.y < 0 || box.x + box.width > viewportWidth || box.y + box.height > viewportHeight) continue;
    let overlaps = false;
    for (let j = 0; j < i; j++) if (placed[j] && labelsOverlap(box, boxes[j])) { overlaps = true; break; }
    if (!overlaps) { placed[i] = 1; count++; }
  }
  return count;
}

export function pickPoint(frame: ScreenFrame, x: number, y: number): number | null {
  let best: number | null = null, bestDepth = Infinity, nearDistance = 6;
  for (let i = 0; i < frame.count; i++) {
    if (!frame.revealed[i] || frame.depth[i] <= 0) continue;
    const dx = x - frame.sx[i], dy = y - frame.sy[i];
    const dist = Math.hypot(dx, dy);
    if (dist <= frame.radiusCss[i]) {
      if (frame.depth[i] < bestDepth) { best = i; bestDepth = frame.depth[i]; }
    } else if (bestDepth === Infinity && dist - frame.radiusCss[i] <= nearDistance) {
      nearDistance = dist - frame.radiusCss[i]; best = i;
    }
  }
  return best;
}

export function drawOrderByDepth(depth: ArrayLike<number>): number[] {
  return Array.from({ length: depth.length }, (_, i) => i).sort((a, b) => depth[b] - depth[a] || a - b);
}
export function drawOrderBySize(radius: ArrayLike<number>): number[] {
  return Array.from({ length: radius.length }, (_, i) => i).sort((a, b) => radius[b] - radius[a] || a - b);
}

export function currentPointIndex(emissionTimes: ArrayLike<number>, time: number): number | null {
  let low = 0, high = emissionTimes.length;
  while (low < high) { const mid = (low + high) >>> 1; if (emissionTimes[mid] <= time) low = mid + 1; else high = mid; }
  return low ? low - 1 : null;
}

export function gridLines(min: number, max: number): { step: number; values: number[] } {
  const span = Math.max(1e-9, max - min);
  const raw = span / 9;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 5, 10].find((factor) => factor * power >= raw) ?? 10) * power;
  const values: number[] = [];
  for (let value = Math.ceil(min / step) * step; value <= max + 1e-9 && values.length < 100; value += step) values.push(value);
  return { step, values };
}
