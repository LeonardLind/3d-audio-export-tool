import assert from 'node:assert/strict';
import test from 'node:test';
import { easeInOutCubic, transitionPlan } from '../src/cloud/transition.ts';

test('rotation and fade plans respect reduced motion', () => {
  assert.deepEqual(transitionPlan(7, 3), { kind: 'rotate', durationMs: 700 });
  assert.deepEqual(transitionPlan(3, 1), { kind: 'fade', durationMs: 140 });
  assert.deepEqual(transitionPlan(7, 3, true), { kind: 'instant', durationMs: 0 });
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.equal(easeInOutCubic(0.5), 0.5);
});
