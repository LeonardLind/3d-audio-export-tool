import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateGates, FEATURES } from '../src/evidence/gates.ts';
import { ACCEPTED_EVIDENCE, APPROVED_COPY } from '../src/evidence/accepted.ts';
import type { CloudRecording } from '../src/data/types.ts';
import type { GateInput } from '../src/evidence/types.ts';

const forged = JSON.parse(readFileSync(new URL('./fixtures/forged_v2.json', import.meta.url), 'utf8'));
function input(): GateInput {
  return { recording: { ...forged, key: 'test', origin: 'published', contractVersion: 2,
    raw: forged, points: [{ audioStartSeconds: 0, audioEndSeconds: 0.1 }],
    similarityEdges: [[0, 0]], durationSeconds: 1 } as CloudRecording,
  accepted: ACCEPTED_EVIDENCE, approvedCopy: APPROVED_COPY,
  env: { build: 'prod', preview: true }, view: 7, clipStatus: { status: 'idle' } };
}

test('all committed acceptance and copy locks are closed', () => {
  assert.ok(Object.values(ACCEPTED_EVIDENCE).every((v) => v === null));
  assert.ok(Object.values(APPROVED_COPY).every((v) => v === false));
  for (const state of [input(), { ...input(), recording: null }]) {
    const gates = evaluateGates(state);
    for (const feature of FEATURES) assert.equal(gates[feature].status, 'hidden', feature);
  }
});

test('forged payloads and preview requests cannot unlock production', () => {
  const candidate = input();
  for (const view of [1, 2, 3, 4, 5, 6, 7] as const) {
    const gates = evaluateGates({ ...candidate, view });
    assert.ok(Object.values(gates).every((gate) => gate.status === 'hidden'));
  }
});

test('development edges require xyz and preview audio requires matching keyed PCM', () => {
  const candidate = { ...input(), env: { build: 'dev', preview: true } as const };
  assert.equal(evaluateGates(candidate).similarityLines.status, 'preview');
  assert.equal(evaluateGates({ ...candidate, view: 3 }).similarityLines.status, 'hidden');
  assert.equal(evaluateGates(candidate).momentPlayback.status, 'hidden');
  const mono = new Float32Array(100);
  const clip = { key: 'different-recording', origin: 'source-file' as const, mono, sampleRate: 100,
    buffer: { numberOfChannels: 1, length: 100, sampleRate: 100, getChannelData: () => mono } };
  const state = { ...candidate, previewSpans: [{ startSeconds: 0, endSeconds: 0.1 }],
    clipStatus: { status: 'ready', clip } as const };
  assert.equal(evaluateGates(state).momentPlayback.status, 'hidden');
  assert.equal(evaluateGates({ ...state, clipStatus: { status: 'ready', clip: { ...clip, key: 'test' } } }).momentPlayback.status, 'preview');
});
