import assert from 'node:assert/strict';
import test from 'node:test';
import { PLASMA_STOPS, plasmaLinear, restingDotDisplayRgb, srgbToLinear, legibleEdgeLinear } from '../src/cloud/colorRamp.ts';

test('plasma stops and linear conversion match the v0.7 colour source', () => {
  assert.deepEqual(PLASMA_STOPS, ['#0d0887', '#6a00a8', '#b12a90', '#e16462', '#fca636', '#f0f921']);
  assert.ok(Math.abs(srgbToLinear(0.5) - 0.21404114048223255) < 1e-12);
  assert.equal(plasmaLinear(0)[0], srgbToLinear(13 / 255));
});

test('resting dot key uses the matte colour and alpha product', () => {
  const rgb = restingDotDisplayRgb(1);
  assert.ok(rgb.every((channel) => channel >= 0 && channel <= 1));
  assert.deepEqual(rgb.map((v) => Math.round(v * 255)), [176, 191, 4]);
  assert.deepEqual(restingDotDisplayRgb(0).map((v) => Math.round(v * 255)), [1, 1, 50]);
});

test('edge colour raises dark ends while keeping channel ratios', () => {
  const a = plasmaLinear(0), b = legibleEdgeLinear(0);
  assert.equal(Math.max(...b), 0.55);
  assert.ok(Math.abs(a[0] / a[2] - b[0] / b[2]) < 1e-12);
});
