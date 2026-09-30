import test from 'node:test';
import assert from 'node:assert/strict';
import { parseManifest, pickInitialDataset } from '../src/data/manifest.ts';

test('manifest validates entries and picks requested, sample or first', () => {
  const entries = parseManifest([
    { id: 'field', label: 'Field', kind: 'field', path: '/data/f.json', durationSeconds: 3 },
    { id: 'sample', label: 'Sample', kind: 'sample', path: '/data/s.json', durationSeconds: 2 },
  ]);
  assert.equal(pickInitialDataset(entries, 'field')?.id, 'field');
  assert.equal(pickInitialDataset(entries, 'missing')?.id, 'sample');
  assert.equal(pickInitialDataset(entries.slice(0, 1))?.id, 'field');
  assert.equal(pickInitialDataset([]), null);
  assert.throws(() => parseManifest([entries[0], entries[0]]), /duplicate id/);
});
