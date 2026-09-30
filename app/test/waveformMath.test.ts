import test from 'node:test';
import assert from 'node:assert/strict';
import { sliceMinMax, sharedPeak, playheadFraction } from '../src/compare/waveformMath.ts';

test('each sample lands in one min/max column, including a spike and non-divisible range', () => {
  const constant = Float32Array.from({ length: 11 }, () => 0.25);
  assert.deepEqual(sliceMinMax(constant, 0, 11, 4), Array.from({ length: 4 }, () => ({ min: 0.25, max: 0.25 })));
  for (let index = 0; index < 11; index += 1) {
    const input = new Float32Array(11);
    input[index] = 1;
    const columns = sliceMinMax(input, 0, 11, 4);
    assert.equal(columns.filter((column) => column.max === 1).length, 1, `sample ${index}`);
  }
  assert.deepEqual(sliceMinMax(Float32Array.of(0, -2, 0, 3, 0), 1, 4, 10), [{ min: -2, max: -2 }, { min: 0, max: 0 }, { min: 3, max: 3 }]);
});

test('shared scale handles peaks and silence; playhead follows scheduled output time', () => {
  assert.deepEqual(sharedPeak([0, -0.5], [0.8]), { peak: 0.8, silent: false });
  assert.deepEqual(sharedPeak([0], [0]), { peak: 1, silent: true });
  assert.equal(playheadFraction(1.9, 2, 4, false), null);
  assert.equal(playheadFraction(4, 2, 4, false), 0.5);
  assert.equal(playheadFraction(6.1, 2, 4, false), null);
  assert.ok(Math.abs(playheadFraction(6.5, 2, 4, true)! - 0.125) < 1e-12);
});
