const test = require("node:test");
const assert = require("node:assert/strict");
const { exactPca, REQUIRED_ML_MATRIX_VERSION } = require("../lib/exact_pca");
const { standardizeFlat } = require("../lib/reducers");

// Independent cyclic Jacobi reference, matching the reference route in reducers.test.js.
function jacobiEigen(input, n) {
  const a = Float64Array.from(input);
  const v = new Float64Array(n * n);
  for (let i = 0; i < n; i += 1) v[i * n + i] = 1;
  const norm = Math.hypot(...a);
  for (let sweep = 0; sweep < 100; sweep += 1) {
    let off = 0;
    for (let p = 0; p < n; p += 1) for (let q = p + 1; q < n; q += 1) off += a[p * n + q] ** 2;
    if (Math.sqrt(off) <= 1e-15 * norm) break;
    for (let p = 0; p < n; p += 1) for (let q = p + 1; q < n; q += 1) {
      const apq = a[p * n + q];
      if (apq === 0) continue;
      const theta = (a[q * n + q] - a[p * n + p]) / (2 * apq);
      const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(1 + t * t);
      const s = t * c;
      for (let k = 0; k < n; k += 1) {
        const x = a[k * n + p], y = a[k * n + q];
        a[k * n + p] = c * x - s * y;
        a[k * n + q] = s * x + c * y;
      }
      for (let k = 0; k < n; k += 1) {
        const x = a[p * n + k], y = a[q * n + k];
        a[p * n + k] = c * x - s * y;
        a[q * n + k] = s * x + c * y;
        const vx = v[k * n + p], vy = v[k * n + q];
        v[k * n + p] = c * vx - s * vy;
        v[k * n + q] = s * vx + c * vy;
      }
    }
  }
  return Array.from({ length: n }, (_, i) => a[i * n + i]).sort((x, y) => y - x);
}

function close(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} vs ${expected}`);
}

test("installed exact EVD is ml-matrix 6.14.0 and matches independent Jacobi", () => {
  assert.equal(REQUIRED_ML_MATRIX_VERSION, "6.14.0");
  for (const [n, d] of [[5, 9], [8, 3]]) {
    const matrix = Array.from({ length: n }, (_, i) =>
      Array.from({ length: d }, (_, j) => Math.sin((i + 1) * (j + 2)) + 0.2 * i * j));
    const got = exactPca(matrix);
    assert.equal(got.mlMatrixVersion, "6.14.0");
    const { x } = standardizeFlat(matrix);
    const gram = new Float64Array(n * n);
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) {
      for (let k = 0; k < d; k += 1) gram[i * n + j] += x[i * d + k] * x[j * d + k] / (n - 1);
    }
    const reference = jacobiEigen(gram, n);
    for (let c = 0; c < n; c += 1) close(got.eigenvalues[c], Math.max(0, reference[c]));
    close(got.explainedVarianceRatio.reduce((a, b) => a + b, 0), 1);
    assert.ok(got.d95 >= 1 && got.d95 <= n - 1);
    const before = got.explainedVarianceRatio.slice(0, got.d95 - 1).reduce((a, b) => a + b, 0);
    const at = before + got.explainedVarianceRatio[got.d95 - 1];
    assert.ok(before < 0.95 && at >= 0.95);
  }
});

test("scores and loadings reconstruct centered standardized data at full rank", () => {
  const matrix = [[2, 4, 7], [4, 7, 1], [7, 1, 5]];
  const got = exactPca(matrix);
  assert.equal(got.d95, 2);
  const { x } = standardizeFlat(matrix);
  for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) {
    const rebuilt = got.scores[i].reduce((sum, score, c) => sum + score * got.loadings[c][j], 0);
    close(rebuilt, x[i * 3 + j]);
  }
});

test("rank-one, zero-variance, and malformed inputs have explicit results", () => {
  const rankOne = exactPca([[1, 10], [2, 20], [3, 30], [4, 40]]);
  assert.equal(rankOne.d95, 1);
  close(rankOne.explainedVarianceRatio[0], 1);
  assert.equal(rankOne.scores.length, 4);
  assert.equal(rankOne.loadings[0].length, 2);
  const zero = exactPca([[5, 7], [5, 7], [5, 7]]);
  assert.equal(zero.d95, 0);
  assert.deepEqual(zero.eigenvalues, [0, 0, 0]);
  assert.deepEqual(zero.explainedVarianceRatio, [0, 0, 0]);
  assert.deepEqual(zero.scores, [[], [], []]);
  assert.throws(() => exactPca([[1]]), /at least 2 rows/);
  assert.throws(() => exactPca([[1], [1, 2]]), /rectangular/);
  assert.throws(() => exactPca([[1], [Infinity]]), /finite/);
});
