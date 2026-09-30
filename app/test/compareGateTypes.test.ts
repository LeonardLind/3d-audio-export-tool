import test from 'node:test';
import assert from 'node:assert/strict';
import type { OpenGate } from '../src/evidence/types.ts';

test('compare audio prop accepts only a branded open gate at type level', () => {
  const gate: OpenGate<unknown> | undefined = undefined;
  assert.equal(gate, undefined);
  // @ts-expect-error a plain object cannot open the audio controls
  const forged: OpenGate<unknown> = {};
  assert.ok(forged);
});
