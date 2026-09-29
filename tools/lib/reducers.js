// Dimensionality reducers used by the exporter (PCA, D-004) and by the reducer benchmarks
// (Experiments 002/004: PCA vs UMAP vs t-SNE, scored by trustworthiness against a seeded
// matched-Gaussian negative control).
//
// app/src/analysis/pca.ts is a line-for-line twin of the `pca` function below. Any change to
// the PCA arithmetic must be made in BOTH files; tools/test/reducers.test.js asserts the two
// produce bit-identical output, and tools/verify_browser_port_parity.mjs checks the whole
// browser pipeline against an exported dataset.
//
// v2.0 changes (evidence: tools/test/reducers.test.js and the measurements quoted here):
//   * PCA power iteration now runs until the relative residual ||G u - lambda u|| / lambda
//     is below PCA_TOLERANCE (1e-10) or PCA_MAX_ITERATIONS (5000) updates, instead of a
//     fixed 100 iterations with no check. Measured on Assets/smoke/Luscinia_svecica_song.ogg
//     (234 windows x 3078 dims, production regime): components 1-3 were already converged
//     at 100 iterations (worst relative residual 4.3e-10, component 3), but components 6-20
//     were not (relative residual up to 5.3e-3). Component 6's 100-iteration eigenvector
//     had |cos| = 0.675 with the exact (Jacobi) eigenvector, because lambda7/lambda6 = 0.989.
//     On this recording, callers asking for more than 5 components (auto-95% mode, 20-D
//     benchmark runs) were therefore receiving mixed, unconverged axes. Whether that
//     affected the Experiment 001/002/004 numbers (different datasets) is unmeasured.
//     The exported 3-D positions of the smoke file moved by at most 6.9e-9 (scale +-6), with
//     no sign flips and identical similarity edges.
//   * PCA returns per-component convergence diagnostics, the eigen-gap to the next axis,
//     the standardisation means/scales and the loadings (feature-space direction per axis).
//   * t-SNE: an exact O(n^2) implementation replaces tsne-js (see TSNE_JS_ROOT_CAUSE below
//     for why tsne-js reported 3 iterations in Experiment 002). tsne-js stays reachable as
//     engine "tsne-js" only so that old failure can be reproduced.
//   * UMAP takes an explicit seeded random and nNeighbors/minDist/spread/nEpochs.
//   * A seeded Gaussian random projection is available as a structure-free baseline.

const { UMAP } = require("umap-js");

const SUPPORTED_REDUCERS = ["pca", "umap", "tsne", "random-projection"];
const PCA_VARIANCE_TARGET = 0.95;
const PCA_TOLERANCE = 1e-10;
const PCA_MAX_ITERATIONS = 5000;
const MACHINE_EPSILON = Number.EPSILON;

// ---------------------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------------------

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function std(values) {
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

// Nested-array column standardisation (population std, std 0 -> 1). Kept unchanged for
// the experiment scripts that import it (trustworthiness ranks, UMAP input).
function standardize(matrix) {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const means = new Array(cols).fill(0);
  const scales = new Array(cols).fill(0);

  for (let j = 0; j < cols; j += 1) {
    means[j] = mean(matrix.map((row) => row[j]));
    scales[j] = std(matrix.map((row) => row[j])) || 1;
  }

  return Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (matrix[i][j] - means[j]) / scales[j]),
  );
}

// The same standardisation into a flat row-major Float64Array, keeping means/scales.
// Arithmetic order is identical to app/src/analysis/pca.ts.
function standardizeFlat(matrix) {
  const n = matrix.length;
  const cols = matrix[0].length;
  const x = new Float64Array(n * cols);
  const means = new Float64Array(cols);
  const scales = new Float64Array(cols);
  for (let j = 0; j < cols; j += 1) {
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += matrix[i][j];
    const columnMean = sum / n;
    let sqSum = 0;
    for (let i = 0; i < n; i += 1) {
      const d = matrix[i][j] - columnMean;
      sqSum += d * d;
    }
    const scale = Math.sqrt(sqSum / n) || 1;
    means[j] = columnMean;
    scales[j] = scale;
    for (let i = 0; i < n; i += 1) x[i * cols + j] = (matrix[i][j] - columnMean) / scale;
  }
  return { x, means, scales, rows: n, cols };
}

function flatToRows(flat, rows, cols) {
  return Array.from({ length: rows }, (_, i) => Array.from(flat.subarray(i * cols, (i + 1) * cols)));
}

// 32-bit LCG (Numerical Recipes constants). The same generator the benchmarks use for the
// negative-control matrices, so seeds stay comparable with Experiments 002/004.
function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

// Box-Muller, identical to randomNormal() in tools/run_experiment_002_wp3_reducer_benchmark.js.
function randomNormal(random) {
  const u1 = Math.max(random(), 1e-12);
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ---------------------------------------------------------------------------------------
// PCA (dual / Gram-matrix power iteration with Hotelling deflation)
// ---------------------------------------------------------------------------------------
//
// With Xs the n x d standardised matrix and G = Xs Xs^T / (n-1) (n x n, cheap because
// n <= 700 << d = 3078), each unit eigenvector u_c of G with eigenvalue lambda_c gives
//   score_c   = u_c * sqrt(lambda_c * (n-1))            (the embedding column)
//   loading_c = Xs^T u_c / ||Xs^T u_c||                  (unit d-vector: the PCA axis)
// and Xs . loading_c = score_c, because ||Xs^T u_c||^2 = (n-1) lambda_c. Deriving the
// loading from u_c this way gives it the same sign as the score, so no separate sign
// convention has to be tracked. (A PCA axis and its negation are equally valid; the sign
// that comes out is whatever the deterministic start vector converges to.)
//
// options: { tolerance = PCA_TOLERANCE, maxIterations = PCA_MAX_ITERATIONS,
//            probeNextEigenvalue = true }
// The probe computes one extra eigenvalue after the requested components so the gap
// lambda_{k+1} / lambda_k of the last axis is known; it does not change the embedding and
// is skipped in auto-95% mode (components === null).
function pca(matrix, components = null, options = {}) {
  const tolerance = options.tolerance ?? PCA_TOLERANCE;
  const maxIterations = options.maxIterations ?? PCA_MAX_ITERATIONS;
  const probeNext = options.probeNextEigenvalue ?? true;

  const { x, means, scales, rows: n, cols } = standardizeFlat(matrix);
  const maxComponents = Math.min(n - 1, cols);

  // --- Gram matrix: G[i][j] = <x_i, x_j> / max(1, n-1) -----------------------------------
  const denom = Math.max(1, n - 1);
  const gram = new Float64Array(n * n);
  for (let i = 0; i < n; i += 1) {
    for (let j = i; j < n; j += 1) {
      let total = 0;
      const ai = i * cols;
      const aj = j * cols;
      for (let k = 0; k < cols; k += 1) total += x[ai + k] * x[aj + k];
      const value = total / denom;
      gram[i * n + j] = value;
      gram[j * n + i] = value;
    }
  }

  // Total variance = trace of the covariance matrix = trace of this Gram matrix.
  let totalVariance = 0;
  for (let i = 0; i < n; i += 1) totalVariance += gram[i * n + i];

  const targetComponents = components ?? maxComponents;
  const embedding = Array.from({ length: n }, () => []);
  const eigenvalues = [];
  const diagnostics = [];
  const loadings = [];
  const vector = new Float64Array(n);
  const product = new Float64Array(n);

  // Power iteration from the deterministic sin((i+1)*(component+1)) start vector until the
  // relative residual ||G v - lambda v|| / |lambda| < tolerance, or maxIterations updates.
  const solve = (component) => {
    for (let i = 0; i < n; i += 1) vector[i] = Math.sin((i + 1) * (component + 1));
    normalizeInPlace(vector);
    let iterations = 0;
    let eigenvalue = 0;
    let relativeResidual = Infinity;
    for (;;) {
      multiply(gram, vector, product, n);
      eigenvalue = 0;
      for (let i = 0; i < n; i += 1) eigenvalue += vector[i] * product[i];
      let sq = 0;
      for (let i = 0; i < n; i += 1) {
        const r = product[i] - eigenvalue * vector[i];
        sq += r * r;
      }
      const residual = Math.sqrt(sq);
      relativeResidual = eigenvalue !== 0 ? residual / Math.abs(eigenvalue) : residual === 0 ? 0 : Infinity;
      if (relativeResidual < tolerance || iterations >= maxIterations) break;
      vector.set(product);
      normalizeInPlace(vector);
      iterations += 1;
    }
    return { eigenvalue, relativeResidual, iterations };
  };

  for (let component = 0; component < targetComponents; component += 1) {
    const { eigenvalue, relativeResidual, iterations } = solve(component);
    eigenvalues.push(eigenvalue);

    const scoreScale = Math.sqrt(Math.max(0, eigenvalue * (n - 1)));
    for (let i = 0; i < n; i += 1) embedding[i].push(vector[i] * scoreScale);

    // Loading v_c = Xs^T u_c, normalised to unit length.
    const loading = new Float64Array(cols);
    for (let i = 0; i < n; i += 1) {
      const ui = vector[i];
      const row = i * cols;
      for (let k = 0; k < cols; k += 1) loading[k] += x[row + k] * ui;
    }
    normalizeInPlace(loading);
    loadings.push(loading);

    // Self-check: max_i |Xs_i . v_c - score_ic| relative to max_i |score_ic|.
    let worst = 0;
    let largest = 0;
    for (let i = 0; i < n; i += 1) {
      let s = 0;
      const row = i * cols;
      for (let k = 0; k < cols; k += 1) s += x[row + k] * loading[k];
      const score = vector[i] * scoreScale;
      worst = Math.max(worst, Math.abs(s - score));
      largest = Math.max(largest, Math.abs(score));
    }

    diagnostics.push({
      component: component + 1,
      eigenvalue,
      explainedVarianceRatio: eigenvalue / totalVariance,
      relativeResidual,
      iterations,
      converged: relativeResidual < tolerance,
      scoreReconstructionError: largest > 0 ? worst / largest : worst,
      nextEigenvalueRatio: null,
    });

    // Hotelling deflation, so the next power iteration finds the next component.
    for (let i = 0; i < n; i += 1) {
      const vi = eigenvalue * vector[i];
      for (let j = 0; j < n; j += 1) gram[i * n + j] -= vi * vector[j];
    }

    const explainedSoFar = eigenvalues.reduce((sum, value) => sum + value, 0);
    if (components === null && explainedSoFar / totalVariance >= PCA_VARIANCE_TARGET) break;
  }

  // Eigen-gap of each axis to the next. A ratio close to 1 means the axis and the next one
  // are nearly degenerate: their ORDER and individual directions are then unstable (small
  // data changes can rotate one into the other), even when both are fully converged.
  let nextEigenvalue = null;
  if (components !== null && probeNext && eigenvalues.length < maxComponents) {
    nextEigenvalue = solve(eigenvalues.length).eigenvalue;
  }
  for (let c = 0; c < diagnostics.length; c += 1) {
    const following = c + 1 < eigenvalues.length ? eigenvalues[c + 1] : nextEigenvalue;
    diagnostics[c].nextEigenvalueRatio =
      following === null || eigenvalues[c] === 0 ? null : following / eigenvalues[c];
  }

  const explainedSum = eigenvalues.reduce((sum, value) => sum + value, 0);
  return {
    embedding,
    explainedVarianceRatio: eigenvalues.map((value) => value / totalVariance),
    explainedVarianceTotal: explainedSum / totalVariance,
    eigenvalues,
    nextEigenvalue,
    totalVariance,
    means,
    scales,
    loadings,
    diagnostics,
    tolerance,
    maxIterations,
  };
}

function normalizeInPlace(vector) {
  let sq = 0;
  for (let i = 0; i < vector.length; i += 1) sq += vector[i] * vector[i];
  const length = Math.sqrt(sq) || 1;
  for (let i = 0; i < vector.length; i += 1) vector[i] /= length;
}

function multiply(matrix, vector, out, n) {
  for (let i = 0; i < n; i += 1) {
    let total = 0;
    const row = i * n;
    for (let j = 0; j < n; j += 1) total += matrix[row + j] * vector[j];
    out[i] = total;
  }
}

function reducePca(matrix, settings = {}) {
  const result = pca(matrix, settings.dimensions ?? 3, {
    tolerance: settings.tolerance,
    maxIterations: settings.maxIterations,
    probeNextEigenvalue: settings.probeNextEigenvalue,
  });
  return {
    method: "pca",
    embedding: result.embedding,
    // JSON-safe summary (tools/apply_reducer.js writes `details` to disk).
    details: {
      dimensions: result.embedding[0].length,
      explainedVarianceRatio: result.explainedVarianceRatio,
      explainedVarianceTotal: result.explainedVarianceTotal,
      eigenvalues: result.eigenvalues,
      nextEigenvalue: result.nextEigenvalue,
      totalVariance: result.totalVariance,
      convergence: {
        algorithm: "Gram-matrix power iteration, Hotelling deflation, sin((i+1)(c+1)) start vector",
        tolerance: result.tolerance,
        maxIterations: result.maxIterations,
        allConverged: result.diagnostics.every((d) => d.converged),
        components: result.diagnostics,
      },
    },
    // Large typed arrays, kept out of `details` so they are never serialised by accident.
    model: {
      means: result.means,
      scales: result.scales,
      loadings: result.loadings,
    },
  };
}

// ---------------------------------------------------------------------------------------
// UMAP (umap-js 1.4.0)
// ---------------------------------------------------------------------------------------
// umap-js draws every random number (RP forest, NN-descent, embedding init, negative
// sampling) from the `random` it is given; the only Math.random in its dist is the
// constructor default (dist/umap.js). A seeded generator therefore makes it deterministic,
// which the tests assert. Defaults nNeighbors 5 / minDist 0.1 / spread 1.0 are the
// Experiment 002/004 settings, kept so old runs stay reproducible; umap-js's own default
// nNeighbors is 15.
function reduceUmap(matrix, settings = {}) {
  const seed = settings.seed ?? 0;
  const nNeighbors = settings.nNeighbors ?? 5;
  const minDist = settings.minDist ?? 0.1;
  const spread = settings.spread ?? 1.0;
  const params = {
    nComponents: settings.dimensions ?? 3,
    nNeighbors,
    minDist,
    spread,
    random: makeRandom(seed),
  };
  if (settings.nEpochs !== undefined) params.nEpochs = settings.nEpochs;
  const umap = new UMAP(params);
  const embedding = umap.fit(standardize(matrix));

  return {
    method: "umap",
    embedding,
    details: {
      dimensions: params.nComponents,
      nNeighbors,
      minDist,
      spread,
      nEpochs: umap.getNEpochs(),
      seed,
      random: "32-bit LCG makeRandom(seed)",
      input: "column-standardised (population std)",
    },
  };
}

// ---------------------------------------------------------------------------------------
// t-SNE
// ---------------------------------------------------------------------------------------
//
// TSNE_JS_ROOT_CAUSE -- why Experiment 002 recorded "iterations: 3" for tsne-js 1.0.3 with
// nIter = 1000 at dim = 20 (Experiment 004 ran it at dim = 106 and is equally suspect).
// It was NOT a wrong option name: `nIter` is read correctly (dist/index.js:
// `this.nIter = config.nIter || 1000`), and at dim 2 or 3 the library does run to 1000.
// The cause is dist/kl-divergence.js, which builds the output kernel as
//     powseq(divseq(addseq(n, 1), alpha), beta)   ==  ((1 + d^2) / alpha)^beta
// instead of (1 + d^2 / alpha)^beta, with alpha = max(dim - 1, 1), beta = -(alpha + 1) / 2.
// Up to the rescaling y -> y * sqrt(alpha), that kernel is the correct one times the
// constant alpha^(-beta) = alpha^((alpha+1)/2). The constant cancels in Q but NOT in the
// gradient, where the kernel multiplies (P - Q). For alpha = 1 (dim <= 2) it is 1; for dim 3
// it is 2^1.5 = 2.83; for dim 20 it is 19^10 ~ 6.1e12. At dim 20 the first gradient is
// therefore enormous. Measured (reviewer re-run, 2026-09-29) on a 22 x 200 matrix of
// makeRandom(7) uniform values (the Experiment 002 row count), perplexity 5, early
// exaggeration 4, learning rate 100, seeded N(0, 1e-4^2) init via reduceTsne({engine:
// "tsne-js", seed}): first gradient norm 4.67e9 / 4.82e9 / 4.89e9 at dim 20 (seeds 1 / 0 / 2)
// vs 1.37e-3 / 1.21e-3 / 9.6e-4 at dim 3. After that single step the embedding has exploded
// (max |y| ~ 8e10, min pairwise d^2 ~ 3e21). The kernel does NOT underflow to 0 (largest
// value ~ 1e-213) and the gradient entries are non-zero (~ 1e-194), but their squares
// (~ 1e-388) underflow, so the library's norm() = sqrt(sum g^2) returns exactly 0. Phase 1
// (i = 0..49) therefore breaks at i = 1 via `if (minGradNorm >= gradNorm) break`
// (minGradNorm = 0 in phases 1-2), phase 2 breaks at its first pass (i = 2) and phase 3 at its
// first pass (i = 3, minGradNorm 1e-6). Exactly ONE gradient step is taken and 4
// progressIter events fire; run() returns the last loop index, 3. The tests reproduce this.
// Other properties of tsne-js 1.0.3, read from its source, that rule it out for a fair
// benchmark:
//   * input affinities use NON-squared Euclidean distance (pairwise-distances.js returns
//     sqrt(sum d^2); joint-probabilities.js uses exp(-d * beta)); standard t-SNE uses d^2;
//   * the output init uses Math.random (randn.js): not seedable, runs not reproducible
//     (Experiment 002 noted the t-SNE result changed between runs);
//   * gainsUpdate raises the gain when update and gradient have the SAME sign, the
//     opposite of the delta-bar-delta rule (raise the gain while successive steps keep
//     going downhill, i.e. update and gradient have OPPOSITE signs);
//   * it stops early (30 iterations without improvement; gradient norm or cost change
//     <= 1e-6 in the final phase), so nIter is only an upper bound.
//
// The exact implementation below uses the standard formulation: squared Euclidean input
// distances, a per-point binary search for the conditional P that matches the perplexity,
// symmetrised joint P, a Student-t output kernel with `degreesOfFreedom` (default "auto" =
// max(dim - 1, 1), the rule scikit-learn and tsne-js use and Experiment 007 R6 pre-registers;
// pass 1 for the classic van der Maaten & Hinton kernel), early exaggeration (12 for 250
// iterations, momentum 0.5) then momentum 0.8 with update/gains reset between the phases,
// delta-bar-delta gains (+0.2 / x0.8, floor 0.01), learning rate "auto" =
// max(n / earlyExaggeration / 4, 50), and init "pca" (PCA scores scaled so axis 1 has
// population std 1e-4) or seeded "random" N(0, 1e-4^2).
// Checked against scikit-learn's source (main branch, sklearn/manifold/_t_sne.py, fetched
// 2026-09-29; scikit-learn itself is not installed here, so no numerical comparison was run):
// these match sklearn's degrees_of_freedom = max(n_components - 1, 1), early_exaggeration 12,
// _EXPLORATION_MAX_ITER 250 at momentum 0.5 then 0.8, update/gains re-initialised per
// _gradient_descent call, gains +0.2 where update*grad < 0 else x0.8 clipped at min_gain 0.01,
// learning_rate "auto" = max(N / early_exaggeration / 4, 50), init "pca" divided by
// np.std(X_embedded[:, 0]) * 1e-4, and the 2 * sum P log(P / Q) cost. Deliberate deviations:
//   * sklearn's default method is "barnes_hut"; this is the exact O(n^2) method;
//   * sklearn stops early (n_iter_without_progress 300, min_grad_norm 1e-7, checked every 50
//     iterations); this runs EXACTLY nIter gradient steps (Experiment 007 R2);
//   * default perplexity here is min(30, (n - 1) / 3); sklearn's is 30 (and it rejects
//     perplexity >= n);
//   * sklearn's exact _kl_divergence multiplies (P - Q) by the kernel w = base^-(dof+1)/2,
//     which equals the true derivative factor base^-1 only when dof = 1. This file uses the
//     true analytic gradient of the reported KL cost for every dof (checked against finite
//     differences in the tests), so for dof != 1 (e.g. 3-D output with "auto") the gradient
//     differs from sklearn's exact method.

function squaredDistanceMatrix(x, n, cols) {
  const d2 = new Float64Array(n * n);
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      let s = 0;
      const ai = i * cols;
      const aj = j * cols;
      for (let k = 0; k < cols; k += 1) {
        const t = x[ai + k] - x[aj + k];
        s += t * t;
      }
      d2[i * n + j] = s;
      d2[j * n + i] = s;
    }
  }
  return d2;
}

// Joint probabilities P (n x n, flat, symmetric, zero diagonal, sums to 1 up to the epsilon
// floor). Row i's conditional distribution is exp(-beta_i * (d2_ij - min_j d2_ij)).
// Subtracting the row minimum leaves the normalised distribution and its entropy unchanged
// but avoids underflow for 3078-D inputs. Natural-log entropy; target = ln(perplexity).
function tsneJointProbabilities(d2, n, perplexity, { tolerance = 1e-5, maxSteps = 100 } = {}) {
  if (!(perplexity > 0) || perplexity >= n) {
    throw new Error(`t-SNE perplexity must be in (0, n); got ${perplexity} with n = ${n}`);
  }
  const target = Math.log(perplexity);
  const conditional = new Float64Array(n * n);
  const row = new Float64Array(n);
  let worstEntropyError = 0;
  for (let i = 0; i < n; i += 1) {
    let minD = Infinity;
    for (let j = 0; j < n; j += 1) if (j !== i && d2[i * n + j] < minD) minD = d2[i * n + j];
    let beta = 1;
    let betaMin = -Infinity;
    let betaMax = Infinity;
    let entropyError = Infinity;
    for (let step = 0; step < maxSteps; step += 1) {
      let sum = 0;
      for (let j = 0; j < n; j += 1) {
        row[j] = j === i ? 0 : Math.exp(-beta * (d2[i * n + j] - minD));
        sum += row[j];
      }
      let weighted = 0;
      for (let j = 0; j < n; j += 1) {
        row[j] /= sum;
        if (j !== i) weighted += row[j] * (d2[i * n + j] - minD);
      }
      const entropy = Math.log(sum) + beta * weighted;
      entropyError = entropy - target;
      if (Math.abs(entropyError) <= tolerance) break;
      if (entropyError > 0) {
        betaMin = beta;
        beta = betaMax === Infinity ? beta * 2 : (beta + betaMax) / 2;
      } else {
        betaMax = beta;
        beta = betaMin === -Infinity ? beta / 2 : (beta + betaMin) / 2;
      }
    }
    worstEntropyError = Math.max(worstEntropyError, Math.abs(entropyError));
    conditional.set(row, i * n);
  }
  const P = new Float64Array(n * n);
  let total = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const v = conditional[i * n + j] + conditional[j * n + i];
      P[i * n + j] = v;
      total += v;
    }
  }
  for (let k = 0; k < P.length; k += 1) P[k] = Math.max(P[k] / total, MACHINE_EPSILON);
  for (let i = 0; i < n; i += 1) P[i * n + i] = 0;
  return { P, worstEntropyError };
}

// KL(P || Q) and its exact gradient for embedding Y (flat n x dim), Student-t kernel with
// `dof` degrees of freedom: w_ij = (1 + |y_i - y_j|^2 / dof)^(-(dof+1)/2), q_ij = w_ij / Z.
//   dKL/dy_i = (2 (dof+1) / dof) * sum_j (p_ij - q_ij) (1 + |y_i - y_j|^2 / dof)^(-1) (y_i - y_j)
// `exaggeration` multiplies P inside (p - q) only -- the usual early-exaggeration heuristic;
// with exaggeration = 1 the returned gradient is the true gradient of the returned cost.
// `work` is an optional n*n scratch buffer reused across iterations.
function tsneCostGradient(Y, P, n, dim, dof, exaggeration = 1, grad = new Float64Array(n * dim), work = null) {
  const buffer = work ?? new Float64Array(n * n); // upper: (1 + d^2/dof)^-1, lower: w
  const power = -(dof + 1) / 2;
  let Z = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      let s = 0;
      for (let k = 0; k < dim; k += 1) {
        const t = Y[i * dim + k] - Y[j * dim + k];
        s += t * t;
      }
      const base = 1 + s / dof;
      const w = dof === 1 ? 1 / base : base ** power;
      buffer[i * n + j] = 1 / base;
      buffer[j * n + i] = w;
      Z += 2 * w;
    }
  }
  const zSafe = Math.max(Z, MACHINE_EPSILON);
  let cost = 0;
  grad.fill(0);
  const coefficient = (2 * (dof + 1)) / dof;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const q = Math.max(buffer[j * n + i] / zSafe, MACHINE_EPSILON);
      const p = P[i * n + j];
      cost += 2 * p * Math.log(Math.max(p, MACHINE_EPSILON) / q);
      const m = coefficient * (exaggeration * p - q) * buffer[i * n + j];
      for (let k = 0; k < dim; k += 1) {
        const t = m * (Y[i * dim + k] - Y[j * dim + k]);
        grad[i * dim + k] += t;
        grad[j * dim + k] -= t;
      }
    }
  }
  return { cost, grad };
}

function reduceTsne(matrix, settings = {}) {
  if ((settings.engine ?? "exact") === "tsne-js") return reduceTsneJsLegacy(matrix, settings);

  const dim = settings.dimensions ?? 3;
  const seed = settings.seed ?? 0;
  const n = matrix.length;
  const perplexity = settings.perplexity ?? Math.min(30, (n - 1) / 3);
  const nIter = settings.nIter ?? 1000;
  const earlyExaggeration = settings.earlyExaggeration ?? 12;
  const exaggerationIterations = Math.min(nIter, settings.exaggerationIterations ?? 250);
  const learningRate =
    settings.learningRate === undefined || settings.learningRate === "auto"
      ? Math.max(n / earlyExaggeration / 4, 50)
      : settings.learningRate;
  const momentumEarly = settings.momentumEarly ?? 0.5;
  const momentumFinal = settings.momentumFinal ?? 0.8;
  const minGain = settings.minGain ?? 0.01;
  const dofSetting = settings.degreesOfFreedom ?? "auto";
  const dof = dofSetting === "auto" ? Math.max(dim - 1, 1) : dofSetting;
  const init = settings.init ?? "pca";

  const { x, cols } = standardizeFlat(matrix);
  const d2 = squaredDistanceMatrix(x, n, cols);
  const { P, worstEntropyError } = tsneJointProbabilities(d2, n, perplexity);

  const Y = new Float64Array(n * dim);
  if (init === "pca") {
    const scores = pca(matrix, dim, { probeNextEigenvalue: false }).embedding;
    let s = 0;
    let s2 = 0;
    for (let i = 0; i < n; i += 1) {
      s += scores[i][0];
      s2 += scores[i][0] * scores[i][0];
    }
    const sd = Math.sqrt(Math.max(s2 / n - (s / n) ** 2, 0)) || 1;
    for (let i = 0; i < n; i += 1) for (let k = 0; k < dim; k += 1) Y[i * dim + k] = (scores[i][k] / sd) * 1e-4;
  } else if (init === "random") {
    const random = makeRandom(seed);
    for (let k = 0; k < Y.length; k += 1) Y[k] = randomNormal(random) * 1e-4;
  } else {
    throw new Error(`Unsupported t-SNE init "${init}" (use "pca" or "random")`);
  }

  const update = new Float64Array(n * dim);
  const gains = new Float64Array(n * dim).fill(1);
  const grad = new Float64Array(n * dim);
  const work = new Float64Array(n * n);
  const history = [];
  let iterations = 0;
  let gradNorm = 0;
  for (let it = 0; it < nIter; it += 1) {
    const early = it < exaggerationIterations;
    if (it === exaggerationIterations) {
      // New optimisation phase (exaggeration off, momentum 0.8): momentum and gains restart.
      update.fill(0);
      gains.fill(1);
    }
    const momentum = early ? momentumEarly : momentumFinal;
    const { cost } = tsneCostGradient(Y, P, n, dim, dof, early ? earlyExaggeration : 1, grad, work);
    let sq = 0;
    for (let k = 0; k < grad.length; k += 1) sq += grad[k] * grad[k];
    gradNorm = Math.sqrt(sq);
    if (it % 50 === 0 || it === nIter - 1) history.push({ iteration: it, cost, gradNorm, exaggerated: early });
    for (let k = 0; k < grad.length; k += 1) {
      gains[k] = update[k] * grad[k] < 0 ? gains[k] + 0.2 : gains[k] * 0.8;
      if (gains[k] < minGain) gains[k] = minGain;
      update[k] = momentum * update[k] - learningRate * gains[k] * grad[k];
      Y[k] += update[k];
    }
    iterations += 1;
  }
  const final = tsneCostGradient(Y, P, n, dim, dof, 1, new Float64Array(n * dim), work);

  return {
    method: "tsne",
    embedding: flatToRows(Y, n, dim),
    details: {
      engine: "exact",
      dimensions: dim,
      perplexity,
      nIter,
      iterations,
      earlyExaggeration,
      exaggerationIterations,
      learningRate,
      momentumEarly,
      momentumFinal,
      minGain,
      degreesOfFreedom: dof,
      init,
      seed: init === "random" ? seed : null,
      deterministic: true,
      klDivergence: final.cost,
      finalGradNorm: gradNorm,
      perplexityWorstEntropyError: worstEntropyError,
      history,
      input: "column-standardised (population std), squared Euclidean distances",
    },
  };
}

// Legacy tsne-js path, kept ONLY to reproduce Experiments 002/004. The Math.random init is
// overwritten with a seeded one (outputEmbedding is the public ndarray init() creates), so
// runs are reproducible, but every defect listed in TSNE_JS_ROOT_CAUSE still applies.
function reduceTsneJsLegacy(matrix, settings = {}) {
  const TSNE = require("tsne-js");
  const dim = settings.dimensions ?? 3;
  const seed = settings.seed ?? 0;
  const config = {
    dim,
    perplexity: settings.perplexity ?? 5,
    earlyExaggeration: settings.earlyExaggeration ?? 4.0,
    learningRate: settings.learningRate ?? 100.0,
    nIter: settings.nIter ?? 1000,
    metric: "euclidean",
  };
  const model = new TSNE(config);
  model.init({ data: standardize(matrix), type: "dense" });
  const random = makeRandom(seed);
  const data = model.outputEmbedding.data;
  for (let k = 0; k < data.length; k += 1) data[k] = randomNormal(random) * 1e-4;
  let gradientSteps = 0;
  let firstGradNorm = null;
  model.on("progressIter", ([, , gradNorm]) => {
    if (firstGradNorm === null) firstGradNorm = gradNorm;
    gradientSteps += 1;
  });
  const [error, iterations] = model.run();
  return {
    method: "tsne",
    embedding: model.getOutput(),
    details: {
      engine: "tsne-js",
      ...config,
      seed,
      klDivergence: error,
      iterations, // what tsne-js run() returns: the last loop index, not a step count
      progressIterEvents: gradientSteps,
      firstGradNorm,
      warning: "tsne-js 1.0.3 is defective for dim > 2; see TSNE_JS_ROOT_CAUSE in tools/lib/reducers.js",
    },
  };
}

// ---------------------------------------------------------------------------------------
// Seeded Gaussian random projection (baseline)
// ---------------------------------------------------------------------------------------
// embedding = Xs R, R (d x k) with i.i.d. N(0, 1/k) entries drawn from makeRandom(seed) via
// Box-Muller, filled column by column. A structure-free linear map: a floor any learned
// reducer should beat on real data.
function reduceRandomProjection(matrix, settings = {}) {
  const dim = settings.dimensions ?? 3;
  const seed = settings.seed ?? 0;
  const { x, rows: n, cols } = standardizeFlat(matrix);
  const random = makeRandom(seed);
  const scale = 1 / Math.sqrt(dim);
  const R = new Float64Array(cols * dim);
  for (let c = 0; c < dim; c += 1) for (let k = 0; k < cols; k += 1) R[k * dim + c] = randomNormal(random) * scale;
  const embedding = Array.from({ length: n }, (_, i) => {
    const out = new Array(dim).fill(0);
    const row = i * cols;
    for (let k = 0; k < cols; k += 1) {
      const v = x[row + k];
      for (let c = 0; c < dim; c += 1) out[c] += v * R[k * dim + c];
    }
    return out;
  });
  return {
    method: "random-projection",
    embedding,
    details: {
      dimensions: dim,
      seed,
      distribution: "N(0, 1/dimensions), 32-bit LCG + Box-Muller",
      input: "column-standardised (population std)",
    },
  };
}

// ---------------------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------------------
// reduceFeatures(matrix, { method = "pca", dimensions = 3, seed = 0, <method>: {...}, ...options })
// Method options may be given top-level or namespaced under the method name (the namespaced
// object wins), e.g. { method: "umap", umap: { nNeighbors: 15 } } (tools/reducer_config.json).
function reduceFeatures(matrix, config = {}) {
  const method = (config.method ?? "pca").toLowerCase();
  if (!SUPPORTED_REDUCERS.includes(method)) {
    throw new Error(`Unsupported reducer "${method}". Supported reducers: ${SUPPORTED_REDUCERS.join(", ")}`);
  }

  const dimensions = config.dimensions ?? 3;
  const topLevel = { ...config };
  for (const key of ["method", "dimensions", "seed", ...SUPPORTED_REDUCERS]) delete topLevel[key];
  const methodConfig = config[method] ?? {};
  const settings = { ...topLevel, ...methodConfig, dimensions, seed: config.seed ?? 0 };

  switch (method) {
    case "pca":
      return reducePca(matrix, settings);
    case "umap":
      return reduceUmap(matrix, settings);
    case "tsne":
      return reduceTsne(matrix, settings);
    default:
      return reduceRandomProjection(matrix, settings);
  }
}

module.exports = {
  SUPPORTED_REDUCERS,
  PCA_TOLERANCE,
  PCA_MAX_ITERATIONS,
  makeRandom,
  randomNormal,
  pca,
  reduceFeatures,
  reducePca,
  reduceUmap,
  reduceTsne,
  reduceRandomProjection,
  standardize,
  standardizeFlat,
  tsneJointProbabilities,
  tsneCostGradient,
};
