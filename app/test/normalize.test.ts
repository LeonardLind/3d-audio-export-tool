import test from 'node:test';
import assert from 'node:assert/strict';
import { toCloudRecording } from '../src/data/normalize.ts';
import { fullExport, appProfile, browserUploadPartial, cloudViewWrapper, v3Payload } from './fixtures/payloads.ts';

const normalize = (payload: unknown) => toCloudRecording(payload, { key: 'pub:fixture', origin: 'published' });

test('four payload shapes normalize and preserve original payload', () => {
  for (const payload of [fullExport(), appProfile(), browserUploadPartial(), cloudViewWrapper()]) {
    const before = JSON.stringify(payload);
    const result = normalize(payload);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.recording.points.length, 3);
      assert.deepEqual(result.recording.similarityEdges, [[0, 2]]);
      assert.equal(result.recording.analysisSampleRateHz, 22050);
      assert.equal(result.recording.contractVersion, 1);
    }
    assert.equal(JSON.stringify(payload), before);
  }
  assert.equal(normalize({ kind: 'birdsong-cloud-view', cloud: [] }).ok, false);
  const upload = normalize(browserUploadPartial());
  assert.equal(upload.ok, true);
  if (upload.ok) {
    assert.equal(upload.recording.source?.sampleRateHz, 48000);
    assert.equal(upload.recording.source?.channels, null);
  }
});

test('version, point and edge failures are explicit', () => {
  const newer = normalize(v3Payload());
  assert.equal(newer.ok, false);
  if (!newer.ok) assert.equal(newer.newerVersion, 3);
  for (const version of [1.5, '2']) assert.equal(normalize({ ...fullExport(), contractVersion: version }).ok, false);
  const bad = fullExport();
  bad.points[1].emissionTime = -1;
  const invalid = normalize(bad);
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.match(invalid.reason, /Point 1 emissionTime/);
  const swapped = fullExport();
  [swapped.points[0].emissionTime, swapped.points[1].emissionTime] = [swapped.points[1].emissionTime, swapped.points[0].emissionTime];
  const order = normalize(swapped);
  assert.equal(order.ok, false);
  if (!order.ok) assert.match(order.reason, /Point 1 emissionTime is before point 0/);
  const position = fullExport();
  position.points[0].position = [1, Infinity, 2];
  const pos = normalize(position);
  assert.equal(pos.ok, false);
  if (!pos.ok) assert.match(pos.reason, /Point 0 position/);
  assert.equal(normalize({ ...fullExport(), centroidMaxHz: Infinity }).ok, false);
  assert.equal(normalize({ ...fullExport(), analysisSampleRateHz: NaN }).ok, false);
  const edges = normalize({ ...fullExport(), similarityEdges: [[0, 2], [0, 9], [1, 1], [0.5, 2]] });
  assert.equal(edges.ok, true);
  if (edges.ok) {
    assert.equal(edges.recording.droppedEdges, 3);
    assert.deepEqual(edges.recording.similarityEdges, [[0, 2]]);
  }
});
