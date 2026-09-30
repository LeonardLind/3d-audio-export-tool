import test from 'node:test';
import assert from 'node:assert/strict';
import { toCloudRecording } from '../src/data/normalize.ts';
import { buildExportCloud, buildViewExport } from '../src/export/viewExport.ts';
import { fullExport } from './fixtures/payloads.ts';

test('view export unwraps to identical points and edges and keeps v2 blocks', () => {
  const input = { ...fullExport(), contractVersion: 2, viewPreservation: { status: 'pending' },
    panels: { frames: [1], centroidTrack: [2] }, analysis: { selfSimilarity: [3], indices: [4] } };
  const before = JSON.stringify(input);
  const normalized = toCloudRecording(input, { key: 'pub:fixture', origin: 'published' });
  assert.equal(normalized.ok, true);
  if (!normalized.ok) return;
  const exported = buildViewExport(normalized.recording, { axes: 7, exportedAt: '2026-01-01T00:00:00Z' });
  assert.equal(exported.kind, 'birdsong-cloud-view');
  assert.equal(exported.displaySettings.labelCount, 40);
  assert.deepEqual(exported.cloud.points, input.points);
  assert.deepEqual(exported.cloud.similarityEdges, input.similarityEdges);
  assert.deepEqual(exported.cloud.viewPreservation, input.viewPreservation);
  assert.deepEqual(exported.cloud.panels, { centroidTrack: [2] });
  assert.deepEqual(exported.cloud.analysis, { indices: [4] });
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(buildExportCloud(input), exported.cloud);
  const again = toCloudRecording(exported, { key: 'pub:fixture', origin: 'published' });
  assert.equal(again.ok, true);
  if (again.ok) {
    assert.deepEqual(again.recording.points, normalized.recording.points);
    assert.deepEqual(again.recording.similarityEdges, normalized.recording.similarityEdges);
  }
});
