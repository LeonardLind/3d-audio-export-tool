// Tests for tools/lib/reducers.js and its browser twin app/src/analysis/pca.ts.
//
//   node --test tools/test/reducers.test.js
//
// Evidence these tests provide:
//   * PCA eigenvalues / eigenvectors match an independent exact reference (cyclic Jacobi,
//     implemented only here) on random matrices with n < d and n > d, and on the real smoke
//     recording's Gram matrix;
//   * loadings reproduce the embedding exactly (Xs . v_c = score_c) and are orthonormal;
//   * the Node and browser PCA return bit-identical results;
//   * the fixed-100-iteration PCA used before v2.0 was not converged beyond component 5 on
//     the smoke file (regression evidence for the convergence loop);
//   * the exact t-SNE runs exactly the requested iterations, is deterministic, and its
//     gradient matches finite differences; tsne-js's Experiment 002 "3 iterations" failure
//     is reproduced and explained;
//   * UMAP and the random projection are deterministic under a seed.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

const reducers = require("../lib/reducers");
const {
  pca,
  reduceFeatures,
  reduceTsne,
  reduceUmap,
  reduceRandomProjection,
  makeRandom,
  randomNormal,
  standardizeFlat,
  tsneJointProbabilities,
  tsneCostGradient,
  PCA_TOLERANCE,
} = reducers;

const ROOT = path.resolve(__dirname, "..", "..");
const SMOKE_AUDIO = path.join(ROOT, "Assets", "smoke", "Luscinia_svecica_song.ogg");

// ---------------------------------------------------------------------------------------
// Test-only helpers
// ---------------------------------------------------------------------------------------

function gaussianMatrix(rows, cols, seed) {
  const random = makeRandom(seed);
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => randomNormal(random)));
}

// Random matrix with a planted, well-separated spectrum (latent factors with decreasing
// scale plus small noise), so every component has a clear eigen-gap.
function structuredMatrix(rows, cols, seed, factors = 6) {
  const random = makeRandom(seed);
  const latent = Array.from({ length: rows }, () => Array.from({ length: factors }, () => randomNormal(random)));
  const mixing = Array.from({ length: factors }, () => Array.from({ length: cols }, () => randomNormal(random)));
  return latent.map((z) =>
    Array.from({ length: cols }, (_, j) => {
      let v = 0.05 * randomNormal(random);
      for (let f = 0; f < factors; f += 1) v += z[f] * mixing[f][j] * 2 ** (factors - f);
      return v;
    }),
  );
}

// Independent standardisation (population std) for the reference computations.
function standardizeRef(matrix) {
  const n = matrix.length;
  const d = matrix[0].length;
  const out = matrix.map((row) => row.slice());
  for (let j = 0; j < d; j += 1) {
    let m = 0;
    for (let i = 0; i < n; i += 1) m += matrix[i][j];
    m /= n;
    let v = 0;
    for (let i = 0; i < n; i += 1) v += (matrix[i][j] - m) ** 2;
    const s = Math.sqrt(v / n) || 1;
    for (let i = 0; i < n; i += 1) out[i][j] = (matrix[i][j] - m) / s;
  }
  return out;
}

// Cyclic Jacobi eigensolver for a symmetric matrix (flat m x m). Returns eigenpairs sorted by
// descending eigenvalue. Exact up to rounding; O(m^3) per sweep. Test-only reference.
function jacobiEigen(A0, m) {
  const A = Float64Array.from(A0);
  const V = new Float64Array(m * m);
  for (let i = 0; i < m; i += 1) V[i * m + i] = 1;
  let scale = 0;
  for (let i = 0; i < m * m; i += 1) scale += A[i] * A[i];
  scale = Math.sqrt(scale);
  for (let sweep = 0; sweep < 100; sweep += 1) {
    let off = 0;
    for (let p = 0; p < m; p += 1) for (let q = p + 1; q < m; q += 1) off += A[p * m + q] ** 2;
    if (Math.sqrt(off) <= 1e-15 * scale) break;
    for (let p = 0; p < m; p += 1) {
      for (let q = p + 1; q < m; q += 1) {
        const apq = A[p * m + q];
        if (apq === 0) continue;
        const theta = (A[q * m + q] - A[p * m + p]) / (2 * apq);
        const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < m; k += 1) {
          const akp = A[k * m + p];
          const akq = A[k * m + q];
          A[k * m + p] = c * akp - s * akq;
          A[k * m + q] = s * akp + c * akq;
        }
        for (let k = 0; k < m; k += 1) {
          const apk = A[p * m + k];
          const aqk = A[q * m + k];
          A[p * m + k] = c * apk - s * aqk;
          A[q * m + k] = s * apk + c * aqk;
        }
        for (let k = 0; k < m; k += 1) {
          const vkp = V[k * m + p];
          const vkq = V[k * m + q];
          V[k * m + p] = c * vkp - s * vkq;
          V[k * m + q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const order = Array.from({ length: m }, (_, i) => i).sort((a, b) => A[b * m + b] - A[a * m + a]);
  return order.map((k) => ({
    value: A[k * m + k],
    vector: Float64Array.from({ length: m }, (_, i) => V[i * m + k]),
  }));
}

// Covariance C = Xs^T Xs / (n-1) (d x d) of the standardised matrix.
function covarianceRef(xs) {
  const n = xs.length;
  const d = xs[0].length;
  const C = new Float64Array(d * d);
  for (let a = 0; a < d; a += 1) {
    for (let b = a; b < d; b += 1) {
      let s = 0;
      for (let i = 0; i < n; i += 1) s += xs[i][a] * xs[i][b];
      C[a * d + b] = s / (n - 1);
      C[b * d + a] = s / (n - 1);
    }
  }
  return C;
}

function dotArr(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += a[i] * b[i];
  return s;
}

function maxAbs(values) {
  let m = 0;
  for (const v of values) m = Math.max(m, Math.abs(v));
  return m;
}

let smokeCache;
function smokeFeatures() {
  if (smokeCache !== undefined) return smokeCache;
  try {
    const { extractContinuousWindows } = require("../export_single_recording_dataset");
    const { windows } = extractContinuousWindows(SMOKE_AUDIO);
    smokeCache = windows.map((w) => w.rawFeature);
  } catch (err) {
    smokeCache = { error: err.message };
  }
  return smokeCache;
}

// ---------------------------------------------------------------------------------------
// PCA: exact-reference validation
// ---------------------------------------------------------------------------------------

for (const [label, rows, cols, seed] of [
  ["n < d (12 x 30)", 12, 30, 11],
  ["n > d (40 x 8)", 40, 8, 12],
]) {
  test(`PCA matches a Jacobi eigendecomposition of the covariance, ${label}`, () => {
    const matrix = structuredMatrix(rows, cols, seed, Math.min(6, cols - 1));
    const k = Math.min(rows - 1, cols);
    const result = pca(matrix, k);
    const xs = standardizeRef(matrix);
    const reference = jacobiEigen(covarianceRef(xs), cols);

    let traceC = 0;
    for (const e of reference) traceC += e.value;
    assert.ok(Math.abs(result.totalVariance - traceC) / traceC < 1e-12, "total variance = trace(C)");

    for (let c = 0; c < k; c += 1) {
      const ref = reference[c];
      const diag = result.diagnostics[c];
      assert.ok(diag.converged, `component ${c + 1} converged (residual ${diag.relativeResidual})`);
      // Relative to the largest eigenvalue: tiny trailing eigenvalues are only determined to
      // absolute (not relative) precision by any method.
      assert.ok(
        Math.abs(result.eigenvalues[c] - ref.value) / reference[0].value < 1e-10,
        `eigenvalue ${c + 1}: ${result.eigenvalues[c]} vs ${ref.value}`,
      );
      // Only compare eigenvectors where the eigenvalue is separated from its neighbours
      // (a degenerate eigenspace has no unique vector).
      const gapBelow = c + 1 < cols ? (ref.value - reference[c + 1].value) / reference[0].value : 1;
      const gapAbove = c > 0 ? (reference[c - 1].value - ref.value) / reference[0].value : 1;
      if (Math.min(gapBelow, gapAbove) > 1e-4 && ref.value / reference[0].value > 1e-8) {
        const cos = Math.abs(dotArr(result.loadings[c], ref.vector));
        assert.ok(1 - cos < 1e-9, `loading ${c + 1} parallel to reference eigenvector (1-|cos| = ${1 - cos})`);
      }
    }

    // Explained variance: per-component ratios = eigenvalue / trace, their sum is the total,
    // and with every non-trivial component the ratios sum to 1 (rank of Xs <= min(n-1, d)).
    for (let c = 0; c < k; c += 1) {
      assert.ok(Math.abs(result.explainedVarianceRatio[c] - result.eigenvalues[c] / result.totalVariance) < 1e-15);
      assert.equal(result.diagnostics[c].explainedVarianceRatio, result.explainedVarianceRatio[c]);
    }
    const sum = result.explainedVarianceRatio.reduce((s, v) => s + v, 0);
    assert.ok(Math.abs(sum - result.explainedVarianceTotal) < 1e-14);
    assert.ok(Math.abs(result.explainedVarianceTotal - 1) < 1e-10, `all components explain ${result.explainedVarianceTotal}`);
    for (let c = 1; c < k; c += 1) assert.ok(result.eigenvalues[c] <= result.eigenvalues[c - 1] * (1 + 1e-12));
  });
}

test("PCA on a pure Gaussian matrix (near-degenerate spectrum) still matches Jacobi eigenvalues", () => {
  const matrix = gaussianMatrix(25, 10, 99);
  const result = pca(matrix, 5);
  const reference = jacobiEigen(covarianceRef(standardizeRef(matrix)), 10);
  for (let c = 0; c < 5; c += 1) {
    assert.ok(
      Math.abs(result.eigenvalues[c] - reference[c].value) / reference[0].value < 1e-8,
      `eigenvalue ${c + 1}: ${result.eigenvalues[c]} vs ${reference[c].value} (iterations ${result.diagnostics[c].iterations})`,
    );
  }
});

// ---------------------------------------------------------------------------------------
// PCA: loadings, diagnostics, backward compatibility
// ---------------------------------------------------------------------------------------

test("PCA loadings are orthonormal and reproduce the embedding: Xs . v_c = score_c", () => {
  const matrix = structuredMatrix(30, 50, 5);
  const result = pca(matrix, 4);
  const { x, cols } = standardizeFlat(matrix);
  for (let c = 0; c < 4; c += 1) {
    const v = result.loadings[c];
    assert.equal(v.length, cols);
    assert.ok(Math.abs(dotArr(v, v) - 1) < 1e-12, "unit norm");
    for (let b = 0; b < c; b += 1) assert.ok(Math.abs(dotArr(v, result.loadings[b])) < 1e-9, `v${c + 1} _|_ v${b + 1}`);
    const column = result.embedding.map((row) => row[c]);
    const scale = maxAbs(column);
    let worst = 0;
    for (let i = 0; i < matrix.length; i += 1) {
      const s = dotArr(x.subarray(i * cols, (i + 1) * cols), v);
      worst = Math.max(worst, Math.abs(s - column[i]));
    }
    // Exact up to the eigen-solver's precision: Xs.v - score = sqrt((n-1)/lambda) (G u - lambda u)
    // to first order, so the error is bounded by the relative residual (< 1e-10 in 2-norm)
    // divided by max|u_i|; 1e-8 leaves a margin of ~100x.
    assert.ok(worst / scale < 1e-8, `component ${c + 1}: max |Xs.v - score| / max|score| = ${worst / scale}`);
    assert.ok(Math.abs(result.diagnostics[c].scoreReconstructionError - worst / scale) < 1e-12);
  }
  // Means / scales are the standardisation actually applied.
  const col0 = matrix.map((r) => r[0]);
  const m0 = col0.reduce((s, v) => s + v, 0) / col0.length;
  assert.ok(Math.abs(result.means[0] - m0) < 1e-12);
  assert.ok(Math.abs(result.scales[0] - Math.sqrt(col0.reduce((s, v) => s + (v - m0) ** 2, 0) / col0.length)) < 1e-12);
});

test("PCA diagnostics: iterations, residuals and eigen-gap probe", () => {
  const matrix = structuredMatrix(20, 40, 8);
  const result = pca(matrix, 3);
  assert.equal(result.diagnostics.length, 3);
  for (const d of result.diagnostics) {
    assert.ok(d.converged && d.relativeResidual < PCA_TOLERANCE);
    assert.ok(Number.isInteger(d.iterations) && d.iterations >= 0 && d.iterations <= 5000);
    assert.ok(d.nextEigenvalueRatio > 0 && d.nextEigenvalueRatio <= 1);
  }
  assert.ok(result.nextEigenvalue !== null && result.nextEigenvalue <= result.eigenvalues[2]);
  // The probe must not change the embedding.
  const noProbe = pca(matrix, 3, { probeNextEigenvalue: false });
  assert.deepEqual(noProbe.embedding, result.embedding);
  assert.equal(noProbe.nextEigenvalue, null);
  assert.equal(noProbe.diagnostics[2].nextEigenvalueRatio, null);
  // maxIterations is honoured and reported.
  const capped = pca(gaussianMatrix(30, 12, 3), 3, { maxIterations: 2 });
  for (const d of capped.diagnostics) assert.ok(d.iterations <= 2);
});

test("reduceFeatures PCA stays backward compatible and JSON-safe", () => {
  const matrix = structuredMatrix(15, 20, 2);
  const result = reduceFeatures(matrix, { method: "pca", dimensions: 3 });
  assert.equal(result.method, "pca");
  assert.equal(result.embedding.length, 15);
  assert.ok(result.embedding.every((row) => Array.isArray(row) && row.length === 3));
  assert.equal(result.details.dimensions, 3);
  assert.equal(result.details.explainedVarianceRatio.length, 3);
  assert.equal(typeof result.details.explainedVarianceTotal, "number");
  assert.equal(result.details.convergence.allConverged, true);
  // details must survive JSON (tools/apply_reducer.js writes it to disk).
  assert.deepEqual(JSON.parse(JSON.stringify(result.details)), result.details);
  assert.equal(result.model.loadings.length, 3);
  assert.equal(result.model.means.length, 20);
  // Auto (components = null) mode keeps working and reaches the 95% target.
  const auto = pca(matrix, null);
  assert.ok(auto.explainedVarianceTotal >= 0.95);
  assert.equal(auto.nextEigenvalue, null);
});

test("Node PCA and browser PCA (app/src/analysis/pca.ts) are bit-identical", async () => {
  const browser = await import(pathToFileURL(path.join(ROOT, "app", "src", "analysis", "pca.ts")).href);
  const cases = [structuredMatrix(18, 33, 4), gaussianMatrix(26, 9, 21)];
  const smoke = smokeFeatures();
  if (Array.isArray(smoke)) cases.push(smoke);
  for (const matrix of cases) {
    const n = matrix.length;
    const d = matrix[0].length;
    const flat = new Float64Array(n * d);
    matrix.forEach((row, i) => flat.set(row, i * d));
    const a = pca(matrix, 3);
    const b = browser.pca(flat, n, d, 3);
    assert.deepEqual(b.embedding, a.embedding, "embedding");
    assert.deepEqual(b.explainedVarianceRatio, a.explainedVarianceRatio);
    assert.equal(b.explainedVarianceTotal, a.explainedVarianceTotal);
    assert.deepEqual(b.eigenvalues, a.eigenvalues);
    assert.equal(b.nextEigenvalue, a.nextEigenvalue);
    assert.deepEqual(b.diagnostics, a.diagnostics);
    for (let c = 0; c < 3; c += 1) assert.deepEqual(Array.from(b.loadings[c]), Array.from(a.loadings[c]));
    assert.deepEqual(Array.from(b.means), Array.from(a.means));
    assert.deepEqual(Array.from(b.scales), Array.from(a.scales));
  }
  assert.equal(browser.PCA_TOLERANCE, reducers.PCA_TOLERANCE);
  assert.equal(browser.PCA_MAX_ITERATIONS, reducers.PCA_MAX_ITERATIONS);
});

// ---------------------------------------------------------------------------------------
// PCA on the real smoke recording (production regime feature matrix)
// ---------------------------------------------------------------------------------------

test("smoke file: 20 PCA components converge and match Jacobi; 100 fixed iterations did not", (t) => {
  const matrix = smokeFeatures();
  if (!Array.isArray(matrix)) {
    t.skip(`smoke features unavailable: ${matrix.error}`);
    return;
  }
  const n = matrix.length;
  const result = pca(matrix, 20);
  // Reference: Jacobi on the same Gram matrix (n x n), whose non-zero eigenvalues equal the
  // covariance eigenvalues.
  const { x, cols } = standardizeFlat(matrix);
  const G = new Float64Array(n * n);
  for (let i = 0; i < n; i += 1) {
    for (let j = i; j < n; j += 1) {
      const v = dotArr(x.subarray(i * cols, (i + 1) * cols), x.subarray(j * cols, (j + 1) * cols)) / (n - 1);
      G[i * n + j] = v;
      G[j * n + i] = v;
    }
  }
  const reference = jacobiEigen(G, n);
  for (let c = 0; c < 20; c += 1) {
    const d = result.diagnostics[c];
    assert.ok(d.converged, `component ${c + 1}: residual ${d.relativeResidual} after ${d.iterations}`);
    assert.ok(Math.abs(result.eigenvalues[c] - reference[c].value) / reference[c].value < 1e-12);
    const u = result.embedding.map((row) => row[c] / Math.sqrt(result.eigenvalues[c] * (n - 1)));
    const cos = Math.abs(dotArr(u, reference[c].vector));
    assert.ok(1 - cos < 1e-10, `component ${c + 1}: 1-|cos| = ${1 - cos}`);
  }

  // The pre-v2.0 behaviour: exactly 100 updates, no convergence check.
  const legacy = pca(matrix, 20, { tolerance: 0, maxIterations: 100 });
  for (let c = 0; c < 3; c += 1) assert.ok(legacy.diagnostics[c].relativeResidual < 1e-8, "PCs 1-3 were converged");
  const unconverged = legacy.diagnostics.filter((d) => d.relativeResidual >= 1e-8).map((d) => d.component);
  assert.ok(unconverged.includes(6), `unconverged at 100 iterations: ${unconverged.join(",")}`);
  const u6 = legacy.embedding.map((row) => row[5] / Math.sqrt(legacy.eigenvalues[5] * (n - 1)));
  assert.ok(1 - Math.abs(dotArr(u6, reference[5].vector)) > 0.1, "legacy PC6 was a mixed axis");

  // Report the numbers this test is evidence for.
  t.diagnostic(
    `n=${n} d=${cols}; iterations to 1e-10 for PCs 1-20: ${result.diagnostics.map((d) => d.iterations).join(",")}`,
  );
  t.diagnostic(
    `legacy 100-iteration relative residuals PCs 1-20: ${legacy.diagnostics.map((d) => d.relativeResidual.toExponential(1)).join(",")}`,
  );
});

// ---------------------------------------------------------------------------------------
// t-SNE
// ---------------------------------------------------------------------------------------

function clusteredData(perCluster, cols, seed, centres = 3) {
  const random = makeRandom(seed);
  const rows = [];
  const labels = [];
  for (let c = 0; c < centres; c += 1) {
    const centre = Array.from({ length: cols }, () => randomNormal(random) * 6);
    for (let i = 0; i < perCluster; i += 1) {
      rows.push(centre.map((v) => v + randomNormal(random)));
      labels.push(c);
    }
  }
  return { rows, labels };
}

function knnLabelAgreement(embedding, labels, k = 5) {
  let agree = 0;
  for (let i = 0; i < embedding.length; i += 1) {
    const order = embedding
      .map((p, j) => ({ j, d: i === j ? Infinity : p.reduce((s, v, a) => s + (v - embedding[i][a]) ** 2, 0) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, k);
    agree += order.filter((o) => labels[o.j] === labels[i]).length / k;
  }
  return agree / embedding.length;
}

test("exact t-SNE runs exactly the requested number of iterations", () => {
  const { rows } = clusteredData(10, 12, 3);
  for (const nIter of [1, 60, 300]) {
    const result = reduceTsne(rows, { dimensions: 3, perplexity: 5, nIter, exaggerationIterations: 50 });
    assert.equal(result.details.iterations, nIter);
    assert.equal(result.details.history.at(-1).iteration, nIter - 1);
    assert.ok(result.embedding.flat().every(Number.isFinite));
  }
  // Default degrees of freedom = max(dim - 1, 1) (scikit-learn's rule; Experiment 007 R6).
  for (const [dim, dof] of [[1, 1], [2, 1], [3, 2]]) {
    assert.equal(reduceTsne(rows, { dimensions: dim, perplexity: 5, nIter: 5 }).details.degreesOfFreedom, dof);
  }
  assert.equal(reduceTsne(rows, { dimensions: 3, perplexity: 5, nIter: 5, degreesOfFreedom: 1 }).details.degreesOfFreedom, 1);
});

test("exact t-SNE is deterministic (pca init, and seeded random init)", () => {
  const { rows } = clusteredData(8, 10, 4);
  const opts = { dimensions: 3, perplexity: 5, nIter: 200 };
  assert.deepEqual(reduceTsne(rows, opts).embedding, reduceTsne(rows, opts).embedding);
  const r1 = reduceTsne(rows, { ...opts, init: "random", seed: 1 });
  const r1b = reduceTsne(rows, { ...opts, init: "random", seed: 1 });
  const r2 = reduceTsne(rows, { ...opts, init: "random", seed: 2 });
  assert.deepEqual(r1.embedding, r1b.embedding);
  assert.notDeepEqual(r1.embedding, r2.embedding);
});

test("t-SNE joint probabilities: symmetric, sum to 1, perplexity matched", () => {
  const { rows } = clusteredData(10, 6, 5);
  const n = rows.length;
  const { x, cols } = standardizeFlat(rows);
  const d2 = new Float64Array(n * n);
  for (let i = 0; i < n; i += 1)
    for (let j = 0; j < n; j += 1) {
      let s = 0;
      for (let k = 0; k < cols; k += 1) s += (x[i * cols + k] - x[j * cols + k]) ** 2;
      d2[i * n + j] = s;
    }
  const { P, worstEntropyError } = tsneJointProbabilities(d2, n, 7);
  let total = 0;
  for (let i = 0; i < n; i += 1) {
    assert.equal(P[i * n + i], 0);
    for (let j = 0; j < n; j += 1) {
      assert.equal(P[i * n + j], P[j * n + i]);
      total += P[i * n + j];
    }
  }
  assert.ok(Math.abs(total - 1) < 1e-9, `sum P = ${total}`);
  assert.ok(worstEntropyError <= 1e-5);
  assert.throws(() => tsneJointProbabilities(d2, n, n));
});

test("t-SNE gradient matches central finite differences of the KL cost (dof 1 and 2)", () => {
  const { rows } = clusteredData(5, 4, 6);
  const n = rows.length;
  const { x, cols } = standardizeFlat(rows);
  const d2 = new Float64Array(n * n);
  for (let i = 0; i < n; i += 1)
    for (let j = 0; j < n; j += 1) {
      let s = 0;
      for (let k = 0; k < cols; k += 1) s += (x[i * cols + k] - x[j * cols + k]) ** 2;
      d2[i * n + j] = s;
    }
  const { P } = tsneJointProbabilities(d2, n, 4);
  const random = makeRandom(17);
  for (const [dim, dof] of [[2, 1], [3, 1], [3, 2]]) {
    const Y = Float64Array.from({ length: n * dim }, () => randomNormal(random));
    const { grad } = tsneCostGradient(Y, P, n, dim, dof);
    const h = 1e-6;
    let worst = 0;
    for (let k = 0; k < Y.length; k += 1) {
      const plus = Float64Array.from(Y);
      const minus = Float64Array.from(Y);
      plus[k] += h;
      minus[k] -= h;
      const numeric = (tsneCostGradient(plus, P, n, dim, dof).cost - tsneCostGradient(minus, P, n, dim, dof).cost) / (2 * h);
      worst = Math.max(worst, Math.abs(numeric - grad[k]) / Math.max(1e-6, Math.abs(grad[k])));
    }
    assert.ok(worst < 1e-5, `dim ${dim} dof ${dof}: worst relative gradient error ${worst}`);
  }
});

test("exact t-SNE separates well-separated clusters", () => {
  const { rows, labels } = clusteredData(15, 20, 7);
  const result = reduceTsne(rows, { dimensions: 3, perplexity: 10, nIter: 500 });
  const agreement = knnLabelAgreement(result.embedding, labels);
  assert.ok(agreement > 0.95, `5-NN label agreement ${agreement}`);
  assert.ok(result.details.klDivergence < result.details.history[0].cost);
});

test("tsne-js root cause: dim 20 run() returns 3 after one step from a ~1e9 gradient; dim 2/3 run in full", () => {
  // 22 rows = the Experiment 002 row count.
  const random = makeRandom(7);
  const rows = Array.from({ length: 22 }, () => Array.from({ length: 200 }, () => random()));
  const d20 = reduceTsne(rows, { engine: "tsne-js", dimensions: 20, seed: 1 });
  assert.equal(d20.details.iterations, 3, "reproduces Experiment 002's 'iterations: 3'");
  assert.ok(d20.details.progressIterEvents <= 4);
  assert.ok(d20.details.firstGradNorm > 1e6, `first gradient norm ${d20.details.firstGradNorm}`);
  for (const dim of [2, 3]) {
    const ok = reduceTsne(rows, { engine: "tsne-js", dimensions: dim, seed: 1 });
    assert.ok(ok.details.firstGradNorm < 1, `dim ${dim} first gradient norm ${ok.details.firstGradNorm}`);
    assert.ok(ok.details.iterations > 100, `dim ${dim} ran ${ok.details.iterations}`);
  }
  // Seeded init makes the legacy engine reproducible.
  const again = reduceTsne(rows, { engine: "tsne-js", dimensions: 3, seed: 1, nIter: 150 });
  const again2 = reduceTsne(rows, { engine: "tsne-js", dimensions: 3, seed: 1, nIter: 150 });
  assert.deepEqual(again.embedding, again2.embedding);
  // The exact engine runs all requested steps at dim 20 on the same data.
  const exact = reduceTsne(rows, { dimensions: 20, perplexity: 5, nIter: 300 });
  assert.equal(exact.details.iterations, 300);
  assert.ok(exact.embedding.flat().every(Number.isFinite));
});

// ---------------------------------------------------------------------------------------
// UMAP, random projection, dispatch
// ---------------------------------------------------------------------------------------

test("UMAP is deterministic under a seed and honours its options", () => {
  const { rows } = clusteredData(12, 10, 8);
  const opts = { dimensions: 3, seed: 5, nNeighbors: 6, minDist: 0.2, nEpochs: 100 };
  const a = reduceUmap(rows, opts);
  const b = reduceUmap(rows, opts);
  const c = reduceUmap(rows, { ...opts, seed: 6 });
  assert.deepEqual(a.embedding, b.embedding);
  assert.notDeepEqual(a.embedding, c.embedding);
  assert.equal(a.embedding[0].length, 3);
  assert.equal(a.details.nEpochs, 100);
  assert.equal(a.details.nNeighbors, 6);
  assert.equal(a.details.minDist, 0.2);
});

test("random projection is seeded, linear and centred", () => {
  const matrix = structuredMatrix(20, 15, 9);
  const a = reduceRandomProjection(matrix, { dimensions: 3, seed: 1 });
  const b = reduceRandomProjection(matrix, { dimensions: 3, seed: 1 });
  const c = reduceRandomProjection(matrix, { dimensions: 3, seed: 2 });
  assert.deepEqual(a.embedding, b.embedding);
  assert.notDeepEqual(a.embedding, c.embedding);
  // Standardised columns are centred, so every projected column has mean ~0.
  for (let d = 0; d < 3; d += 1) {
    const column = a.embedding.map((row) => row[d]);
    assert.ok(Math.abs(column.reduce((s, v) => s + v, 0) / column.length) < 1e-12);
  }
});

test("reduceFeatures dispatches every method and merges options", () => {
  const { rows } = clusteredData(8, 6, 10);
  assert.deepEqual(reducers.SUPPORTED_REDUCERS, ["pca", "umap", "tsne", "random-projection"]);
  for (const method of reducers.SUPPORTED_REDUCERS) {
    const result = reduceFeatures(rows, { method, dimensions: 2, seed: 3, nIter: 50, nEpochs: 50, perplexity: 4 });
    assert.equal(result.method, method);
    assert.equal(result.embedding.length, rows.length);
    assert.equal(result.embedding[0].length, 2);
    JSON.stringify(result.details);
  }
  // Namespaced options win over top-level ones.
  const umap = reduceFeatures(rows, { method: "umap", seed: 1, nNeighbors: 4, umap: { nNeighbors: 7, nEpochs: 30 } });
  assert.equal(umap.details.nNeighbors, 7);
  const tsne = reduceFeatures(rows, { method: "TSNE", tsne: { nIter: 40, perplexity: 3 } });
  assert.equal(tsne.details.iterations, 40);
  assert.throws(() => reduceFeatures(rows, { method: "isomap" }), /Unsupported reducer/);
});

test("smoke file: every reducer runs on the production feature matrix", (t) => {
  const matrix = smokeFeatures();
  if (!Array.isArray(matrix)) {
    t.skip(`smoke features unavailable: ${matrix.error}`);
    return;
  }
  const timings = {};
  for (const [method, extra] of [
    ["pca", {}],
    ["random-projection", {}],
    ["umap", { umap: { nNeighbors: 15 } }],
    ["tsne", {}],
  ]) {
    const started = process.hrtime.bigint();
    const result = reduceFeatures(matrix, { method, dimensions: 3, seed: 1, ...extra });
    timings[method] = Number(process.hrtime.bigint() - started) / 1e6;
    assert.equal(result.embedding.length, matrix.length);
    assert.ok(result.embedding.flat().every(Number.isFinite), method);
    if (method === "tsne") assert.equal(result.details.iterations, 1000);
    if (method === "pca") assert.equal(result.details.convergence.allConverged, true);
  }
  t.diagnostic(`n=${matrix.length} d=${matrix[0].length} ms: ${JSON.stringify(timings)}`);
  assert.ok(fs.existsSync(SMOKE_AUDIO));
});
