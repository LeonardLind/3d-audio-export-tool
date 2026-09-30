import assert from 'node:assert/strict';
import test from 'node:test';
import { labelCandidates, labelText, radiusFraction } from '../src/cloud/channels.ts';
import type { CloudPoint } from '../src/data/types.ts';

const p = (amplitude: number, dominantFrequencyHz = 5426.3671875) => ({ amplitude, dominantFrequencyHz }) as CloudPoint;

test('the 40 loudest candidates preserve time order at ties and include zero Hz', () => {
  const points = Array.from({ length: 45 }, (_, i) => p(i === 44 ? 100 : i % 3, i === 0 ? 0 : 1000));
  const selected = labelCandidates(points);
  assert.equal(selected.length, 40);
  assert.equal(selected[0], 44);
  assert.deepEqual(selected.slice(1, 4), [2, 5, 8]);
  assert.ok(labelCandidates([p(1, 0)]).includes(0));
});

test('v0.7 energy radius has the exact floor and normalized loudest', () => {
  assert.equal(radiusFraction(p(0), 1), 0.035);
  assert.equal(radiusFraction(p(0.5), 1), 0.5);
  assert.equal(radiusFraction(p(1), 1), 1);
  assert.equal(radiusFraction(p(0), 0), 0.035);
});

test('numbers use the Exp 011 decimal formatter and silence draws no text', () => {
  assert.equal(labelText(p(1)), '5.43K');
  assert.equal(labelText(p(0)), null);
});
