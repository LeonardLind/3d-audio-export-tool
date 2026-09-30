import assert from 'node:assert/strict';
import test from 'node:test';
import { ageFactors, revealTime } from '../src/cloud/revealClock.ts';

test('rest reveals every measured point without pulse or trail', () => {
  assert.equal(revealTime('all', 0), Infinity);
  assert.deepEqual(ageFactors(10, Infinity, 1), { revealed: true, reveal: 1, recent: 0, pulse: 1, trail: 0 });
});

test('playback reveal and pulse use the v0.7 law', () => {
  assert.equal(ageFactors(1, 0.9, 1).revealed, false);
  const start = ageFactors(1, 1, 1);
  assert.equal(start.pulse, 2.9);
  assert.equal(start.trail, 1);
  assert.equal(ageFactors(1, 2.5, 1).trail, 0);
});
