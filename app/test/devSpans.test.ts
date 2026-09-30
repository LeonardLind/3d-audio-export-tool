import test from 'node:test';
import assert from 'node:assert/strict';
import { devSpans } from '../src/dev/devSpans.ts';
import type { CloudRecording } from '../src/data/types.ts';

test('preview spans use exact grid arithmetic, never nominal duration or ids', () => {
  const recording = { sampleRate: 22050, fftSize: 1024, durationSeconds: 1,
    points: [{ id: 'invented_999', emissionTime: 512 / 22050 }], samplingWindowSeconds: 100 } as CloudRecording;
  assert.deepEqual(devSpans(recording), [{ startSeconds: 512 / 22050, endSeconds: 4096 / 22050 }]);
  assert.equal(devSpans({ ...recording, durationSeconds: 0.01 }), null);
  assert.equal(devSpans({ ...recording, points: [{ ...recording.points[0], emissionTime: 0.0123 }] }), null);
});
