import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roundDecimal, formatClock, formatDbfs } from '../src/format/number.ts';
import { evRule } from '../src/evidence/evRule.ts';

test('decimal ties round away from zero without binary multiplication', () => {
  assert.equal(roundDecimal(1.005, 2), '1.01');
  assert.equal(roundDecimal(-1.005, 2), '-1.01');
  assert.equal(roundDecimal(9.995, 2), '10.00');
  assert.equal(roundDecimal(1e-7, 8), '0.00000010');
  assert.equal(roundDecimal(-0.001, 2), '0.00');
  assert.throws(() => roundDecimal(NaN));
  assert.equal(formatClock(125.8), '2:05');
  assert.equal(formatDbfs(0), '−∞ dBFS');
});

test('variance labels use selected axes and reject inconsistent ratios', () => {
  assert.equal(evRule([0.1, 0.2, 0.05], 0.35, 5), '15%');
  assert.equal(evRule([0.001, 0, 0], 0.001, 1), 'under 1%');
  assert.equal(evRule([0, 0, 0], 0, 7), '0%');
  assert.equal(evRule([0.1, 0.2, 0.05], 0.4, 7), null);
  assert.equal(evRule([NaN, 0, 0], 0, 1), null);
});
