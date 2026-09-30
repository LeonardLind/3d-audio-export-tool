import assert from 'node:assert/strict';
import test from 'node:test';
import { applyClick } from '../src/state/selection.ts';

test('A then B; later clicks replace B; shift replaces A', () => {
  let s = { a: null as number | null, b: null as number | null };
  s = applyClick(s, 0, 4); assert.deepEqual(s, { a: 0, b: null });
  s = applyClick(s, 1, 4); assert.deepEqual(s, { a: 0, b: 1 });
  s = applyClick(s, 2, 4); assert.deepEqual(s, { a: 0, b: 2 });
  s = applyClick(s, 1, 4, true); assert.deepEqual(s, { a: 1, b: 2 });
  s = applyClick(s, 1, 4); assert.deepEqual(s, { a: null, b: 2 });
});

test('invalid index is ignored', () => {
  const s = { a: 0, b: 1 };
  assert.equal(applyClick(s, 4, 4), s);
  assert.equal(applyClick(s, -1, 4), s);
});
