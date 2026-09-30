import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const pure = [
  'state/reducer.ts', 'state/selection.ts', 'cloud/channels.ts', 'cloud/geometry.ts',
  'cloud/constants.ts', 'data/types.ts', 'evidence/types.ts', 'copy/define.ts',
];

test('pure modules contain no runtime React, Three or DOM access', async () => {
  for (const path of pure) {
    const source = await readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /(?:from\s+['"](?:react|three|@react-three)|\b(?:document|window|HTMLElement|HTMLAudioElement)\.)/, path);
  }
});
