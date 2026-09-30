import type { AxisMask } from '../state/types.ts';

export interface ViewBasis {
  right: readonly [number, number, number];
  up: readonly [number, number, number];
  back: readonly [number, number, number];
  mask: AxisMask;
}

export interface ScreenFrame {
  sx: Float32Array;
  sy: Float32Array;
  depth: Float32Array;
  radiusCss: Float32Array;
  revealed: Uint8Array;
  drawOrder: Uint32Array;
  count: number;
}

export interface LabelBox { x: number; y: number; width: number; height: number }
