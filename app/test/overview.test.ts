import test from 'node:test';
import assert from 'node:assert/strict';
import { overviewColumns } from '../src/audio/overview.ts';

test('overview min/max partitions all samples, including a non-divisible tail', () => {
  const input = Float32Array.of(0, 1, -3, 2, 4, -2, 0, 9, 0, 0, -8);
  assert.deepEqual(overviewColumns(input, 4), [
    { min: 0, max: 1 }, { min: -3, max: 4 }, { min: -2, max: 9 }, { min: -8, max: 0 },
  ]);
  assert.deepEqual(overviewColumns(Float32Array.of(2, 2), 8), [{ min: 2, max: 2 }, { min: 2, max: 2 }]);
  assert.deepEqual(overviewColumns([], 4), []);
  assert.throws(() => overviewColumns(input, 0), RangeError);
});
