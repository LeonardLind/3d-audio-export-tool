import test from 'node:test';
import assert from 'node:assert/strict';
import type { BrowserAnalysis } from '../src/analysis/pipeline.ts';
import { buildUploadExport, uploadAssetId, uploadExportFilename } from '../src/export/uploadExport.ts';
import { browserUploadPartial } from './fixtures/payloads.ts';

test('upload export preserves the legacy flat rename contract', () => {
  const analysis = browserUploadPartial() as unknown as BrowserAnalysis;
  const before = JSON.stringify(analysis);
  const renamed = buildUploadExport(analysis, 'my_clip', 'Bird');
  assert.equal(renamed.audioId, 'my_clip');
  assert.equal(renamed.commonName, 'Bird');
  assert.equal(renamed.audioUrl, `/assets/${analysis.generatedFrom}`);
  assert.deepEqual(renamed.points.map((point) => point.id), analysis.points.map((point) => `my_clip_${point.emissionTime.toFixed(3)}`));
  assert.equal(uploadExportFilename(renamed), 'my_clip_cloud.json');
  assert.equal(uploadAssetId('My Clip.ogg'), 'my_clip');
  assert.equal(JSON.stringify(analysis), before);
});
