import assert from 'node:assert/strict';
import test from 'node:test';
import { matteFragment, matteVertex } from '../src/cloud/matteShader.ts';
import { MATTE, LABEL_COUNT } from '../src/cloud/constants.ts';

test('canonical Matte fragment and constants survive source retirement', () => {
  assert.match(matteFragment, /gl_FragColor = vec4\(vColor \* 0\.95, vAlpha \* disc \* 0\.92\)/);
  assert.equal(MATTE.maxBallPixels, 200);
  assert.equal(MATTE.edgeOpacity, 0.34);
  assert.equal(LABEL_COUNT, 40);
  assert.match(matteVertex, /uAxisMask/);
  assert.match(matteVertex, /uOrthoDepth/);
});
