import test from 'node:test';
import assert from 'node:assert/strict';
import { measuredRows, compareFootnote } from '../src/compare/measuredRows.ts';
import type { CloudPoint, CloudRecording } from '../src/data/types.ts';

const point: CloudPoint = { id: 'a', emissionTime: 1.25, position: [0, 0, 0], amplitude: 0.1, amplitudeNorm: 0, dominantFrequencyHz: 5426.3671875, colorT: 0, spectralCentroidHz: 3500, centroidNorm: 0.5, spectralFlux: 2, spectralFluxNorm: 0.29 };
const louder: CloudPoint = { ...point, id: 'b', amplitude: 0.2 };
const recording = { points: [point, louder], sampleRate: 22050, fftSize: 1024, frequencyRange: { binWidthHz: 21.5332 } } as CloudRecording;

test('compare values keep payload units, row order and within-recording strength', () => {
  const rows = measuredRows(point, recording);
  assert.deepEqual(rows.map((row) => row.id), ['startsAt', 'strongest', 'average', 'strength', 'level', 'change']);
  assert.equal(rows[0].value, '1.25 s');
  assert.equal(rows[1].value, '5.43 kHz');
  assert.equal(rows[2].value, '3.50 kHz');
  assert.equal(rows[3].value, '50%');
  assert.equal(rows[4].value, '-20.0 dBFS');
  assert.equal(rows[5].value, '29%');
  assert.match(compareFootnote(recording), /21.53 Hz/);
});

test('digital silence has no level row and displays the silence value', () => {
  const rows = measuredRows({ ...point, amplitude: 0 }, recording);
  assert.equal(rows.find((row) => row.id === 'strongest')?.value, '— (digital silence)');
  assert.equal(rows.some((row) => row.id === 'level'), false);
});
