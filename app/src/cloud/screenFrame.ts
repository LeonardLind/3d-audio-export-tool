import type { Camera } from 'three';
import { Vector3 } from 'three';
import type { CloudRecording } from '../data/types.ts';
import type { AxisMask, RevealMode } from '../state/types.ts';
import type { ScreenFrame } from './types.ts';
import { radiusFraction } from './channels.ts';
import { ageFactors } from './revealClock.ts';
import { ballRadiusCss, equivalentOrthoDepth, pickPoint } from './geometry.ts';

export function createScreenFrame(count: number): ScreenFrame {
  return { sx: new Float32Array(count), sy: new Float32Array(count), depth: new Float32Array(count),
    radiusCss: new Float32Array(count), revealed: new Uint8Array(count), drawOrder: new Uint32Array(count), count };
}

export function updateScreenFrame(frame: ScreenFrame, recording: CloudRecording, camera: Camera,
  axes: AxisMask, reveal: RevealMode, time: number, width: number, height: number, dpr: number,
  scratch: Vector3, amplitudeMax: number): void {
  const ortho = camera.type === 'OrthographicCamera' ? camera as import('three').OrthographicCamera : null;
  const orthoDepth = ortho ? equivalentOrthoDepth((ortho.top - ortho.bottom) / ortho.zoom) : 0;
  for (let i = 0; i < frame.count; i++) {
    const point = recording.points[i];
    scratch.set(axes & 1 ? point.position[0] : 0, axes & 2 ? point.position[1] : 0, axes & 4 ? point.position[2] : 0);
    scratch.applyMatrix4(camera.matrixWorldInverse);
    const depth = -scratch.z;
    frame.depth[i] = depth;
    scratch.set(axes & 1 ? point.position[0] : 0, axes & 2 ? point.position[1] : 0, axes & 4 ? point.position[2] : 0).project(camera);
    frame.sx[i] = (scratch.x * 0.5 + 0.5) * width;
    frame.sy[i] = (-scratch.y * 0.5 + 0.5) * height;
    const age = ageFactors(point.emissionTime, reveal === 'all' ? Infinity : time, point.spectralFluxNorm);
    frame.revealed[i] = age.revealed && scratch.z >= -1 && scratch.z <= 1 && depth > 0 ? 1 : 0;
    frame.radiusCss[i] = ballRadiusCss(radiusFraction(point, amplitudeMax), orthoDepth || depth, dpr, age.reveal, age.pulse);
    frame.drawOrder[i] = i;
  }
}

export function pickAt(frame: ScreenFrame, x: number, y: number): number | null { return pickPoint(frame, x, y); }
