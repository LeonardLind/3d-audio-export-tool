import assert from 'node:assert/strict';
import test from 'node:test';
import { ballRadiusCss, currentPointIndex, fitOrtho, gridLines, labelsOverlap, pickPoint, placeLabels, projectToView, viewBasis } from '../src/cloud/geometry.ts';
import type { AxisMask } from '../src/state/types.ts';
import type { ScreenFrame } from '../src/cloud/types.ts';

test('all seven bases are right handed and flat positions use raw components', () => {
  for (const mask of [1, 2, 3, 4, 5, 6, 7] as AxisMask[]) {
    const b = viewBasis(mask);
    const cross = [b.right[1] * b.up[2] - b.right[2] * b.up[1], b.right[2] * b.up[0] - b.right[0] * b.up[2], b.right[0] * b.up[1] - b.right[1] * b.up[0]];
    assert.deepEqual(cross, b.back);
  }
  assert.deepEqual(projectToView([2, 3, 5], 5), [2, 5]);
  assert.deepEqual(projectToView([2, 3, 5], 6), [3, 5]);
  assert.deepEqual(projectToView([2, 3, 5], 2), [3, 0]);
});

test('fit uses one scale and preserves relative distances', () => {
  const points = [{ position: [0, 0, 0] as const }, { position: [10, 2, 0] as const }];
  const fit = fitOrtho(points, 3, 1000, 500);
  assert.equal(fit.worldPerPixel, 10 / 880);
  assert.deepEqual(fit.center, [5, 1]);
});

test('ball size is DPR independent until the device-pixel clamp', () => {
  const depth = Math.sqrt(170);
  assert.ok(Math.abs(ballRadiusCss(1, depth, 1) * 2 - 42.797) < 0.01);
  assert.equal(ballRadiusCss(1, depth, 1), ballRadiusCss(1, depth, 2));
  assert.equal(ballRadiusCss(1, 0.01, 2), 50);
});

test('label collision priority follows candidate order', () => {
  const boxes = [{ x: 0, y: 0, width: 10, height: 10 }, { x: 12.9, y: 0, width: 10, height: 10 }, { x: 13, y: 0, width: 10, height: 10 }];
  assert.equal(labelsOverlap(boxes[0], boxes[1]), true);
  assert.equal(labelsOverlap(boxes[0], boxes[2]), false);
  const placed = new Uint8Array(3);
  assert.equal(placeLabels(boxes, new Uint8Array([1, 1, 1]), placed, 100, 100), 2);
  assert.deepEqual([...placed], [1, 0, 1]);
});

test('picking chooses the nearest revealed disc and point-time lookup is bounded', () => {
  const frame: ScreenFrame = { sx: new Float32Array([10, 10]), sy: new Float32Array([10, 10]),
    depth: new Float32Array([5, 2]), radiusCss: new Float32Array([5, 5]),
    revealed: new Uint8Array([1, 1]), drawOrder: new Uint32Array([0, 1]), count: 2 };
  assert.equal(pickPoint(frame, 10, 10), 1);
  frame.revealed[1] = 0; assert.equal(pickPoint(frame, 10, 10), 0);
  assert.equal(currentPointIndex([1, 2, 3], 0), null);
  assert.equal(currentPointIndex([1, 2, 3], 2), 1);
  assert.equal(currentPointIndex([1, 2, 3], Infinity), 2);
  assert.ok(gridLines(-3, 3).values.length >= 6);
});
