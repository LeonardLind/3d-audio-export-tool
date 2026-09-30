import test from 'node:test';
import assert from 'node:assert/strict';
import { certifiedSpan, toSampleRange } from '../src/data/pointSpan.ts';

test('only explicit, bounded spans certify and sample rounding is independent', () => {
  assert.equal(certifiedSpan({}, 2), null);
  assert.equal(certifiedSpan({ audioStartSeconds: 1, audioEndSeconds: 1 }, 2), null);
  assert.equal(certifiedSpan({ audioStartSeconds: 1, audioEndSeconds: 2.1 }, 2), null);
  const span = certifiedSpan({ audioStartSeconds: 0.001, audioEndSeconds: 0.164 }, 2);
  assert.deepEqual(span, { startSeconds: 0.001, endSeconds: 0.164 });
  assert.deepEqual(toSampleRange(span!, 48000, 10000), { start: 48, end: 7872 });
  assert.equal(toSampleRange({ startSeconds: -0.1, endSeconds: 0.2 }, 48000, 10000), null);
  assert.equal(toSampleRange({ startSeconds: 0, endSeconds: 2 }, 48000, 10000), null);
});
