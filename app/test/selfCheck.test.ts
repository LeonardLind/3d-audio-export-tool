import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSamples } from '../src/analysis/pipeline.ts';
import { verifyAnalysisSpans } from '../src/audio/selfCheck.ts';

test('Upload span self-check matches the real analyzer and catches one-sample shifts', () => {
  const samples = Float32Array.from({ length: 6 * 22050 }, (_, i) => Math.sin(i * 0.071) * (0.3 + 0.1 * Math.cos(i * 0.0003)));
  const output = analyzeSamples({ samples, audioId: 'check', commonName: 'Check', filename: 'check.wav', sourceSampleRateHz: 22050, sourceChannels: 1 });
  const passed = verifyAnalysisSpans(samples, output.points);
  assert.deepEqual(passed, { status: 'passed', matched: output.points.length, total: output.points.length, firstMismatch: null });
  const shifted = new Float32Array(samples.length);
  shifted.set(samples.subarray(0, -1), 1);
  const failed = verifyAnalysisSpans(shifted, output.points);
  assert.equal(failed.status, 'failed');
  assert.ok(failed.matched < failed.total);
  const edited = output.points.map((point) => ({ ...point }));
  edited[2].amplitude += 1e-6;
  assert.equal(verifyAnalysisSpans(samples, edited).firstMismatch, 2);
  const offGrid = output.points.map((point) => ({ ...point }));
  offGrid[1].emissionTime += 1 / 22050;
  assert.equal(verifyAnalysisSpans(samples, offGrid).firstMismatch, 1);
});
