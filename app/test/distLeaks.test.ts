import assert from 'node:assert/strict';
import test from 'node:test';
import { findLeaks } from '../scripts/distLeaks.mjs';

test('dist guard catches owner code and wording', () => {
  assert.deepEqual(findLeaks({ 'assets/main.js': '__OWNER_PREVIEW__' }), ['assets/main.js']);
  assert.deepEqual(findLeaks({ 'assets/OwnerPanel-123.js': 'x' }), ['assets/OwnerPanel-123.js']);
  assert.deepEqual(findLeaks({ 'assets/dev/preview.js': 'x' }), ['assets/dev/preview.js']);
  assert.deepEqual(findLeaks({ 'index.html': '<main>Acoustic Cloud</main>' }), []);
});
