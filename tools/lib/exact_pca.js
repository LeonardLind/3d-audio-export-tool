// Exact PCA reference for Experiments 007/008. This is separate from the production reducer.
const fs = require("node:fs");
const path = require("node:path");
const { standardizeFlat } = require("./reducers");

const REQUIRED_ML_MATRIX_VERSION = "6.14.0";

function loadEvd() {
  let entry;
  try {
    entry = require.resolve("ml-matrix");
  } catch (cause) {
    throw new Error(`exact PCA requires ml-matrix ${REQUIRED_ML_MATRIX_VERSION}: package is missing`, { cause });
  }
  // The package does not export package.json, so read it relative to its resolved entry.
  const packagePath = path.join(path.dirname(entry), "package.json");
  let metadata;
  try {
    metadata = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  } catch (cause) {
    throw new Error(`exact PCA cannot verify ml-matrix version at ${packagePath}`, { cause });
  }
  if (metadata.name !== "ml-matrix" || metadata.version !== REQUIRED_ML_MATRIX_VERSION) {
    throw new Error(`exact PCA requires ml-matrix ${REQUIRED_ML_MATRIX_VERSION}; found ${metadata.name}@${metadata.version}`);
  }
  const { EigenvalueDecomposition, Matrix } = require("ml-matrix");
  if (typeof EigenvalueDecomposition !== "function" || typeof Matrix !== "function") {
    throw new Error("exact PCA requires ml-matrix EigenvalueDecomposition and Matrix");
  }
  return { EigenvalueDecomposition, Matrix };
}

// Check presence/version when this module is loaded, before any experiment starts.
const { EigenvalueDecomposition, Matrix } = loadEvd();

function exactPca(matrix) {
  if (!Array.isArray(matrix) || matrix.length < 2 || !Array.isArray(matrix[0]) || matrix[0].length < 1) {
    throw new RangeError("exact PCA requires at least 2 rows and 1 feature");
  }
  const n = matrix.length;
  const d = matrix[0].length;
  for (const row of matrix) {
    if (!Array.isArray(row) || row.length !== d || row.some((value) => !Number.isFinite(value))) {
      throw new TypeError("exact PCA requires a rectangular matrix of finite numbers");
    }
  }

  const { x, means, scales } = standardizeFlat(matrix);
  const gram = Matrix.zeros(n, n);
  for (let i = 0; i < n; i += 1) {
    for (let j = i; j < n; j += 1) {
      let sum = 0;
      for (let k = 0; k < d; k += 1) sum += x[i * d + k] * x[j * d + k];
      const value = sum / (n - 1);
      gram.set(i, j, value);
      gram.set(j, i, value);
    }
  }
  const evd = new EigenvalueDecomposition(gram, { assumeSymmetric: true });
  const vectors = evd.eigenvectorMatrix;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => evd.realEigenvalues[b] - evd.realEigenvalues[a]);
  const largest = Math.max(0, evd.realEigenvalues[order[0]]);
  const roundoff = Math.max(1, largest) * n * Number.EPSILON * 64;
  const eigenvalues = order.map((index) => {
    const value = evd.realEigenvalues[index];
    if (!Number.isFinite(value) || value < -roundoff) throw new Error(`exact PCA Gram matrix has invalid eigenvalue ${value}`);
    return Math.max(0, value);
  });
  // A centered n-row matrix has rank at most n-1. Exclude its null axis even if
  // roundoff gives that axis a tiny positive eigenvalue.
  const variance = eigenvalues.slice(0, n - 1);
  const totalVariance = variance.reduce((sum, value) => sum + value, 0);
  const explainedVarianceRatio = eigenvalues.map((value, index) =>
    index < n - 1 && totalVariance > 0 ? value / totalVariance : 0,
  );
  let d95 = 0;
  if (totalVariance > roundoff) {
    let cumulative = 0;
    for (let c = 0; c < n - 1; c += 1) {
      cumulative += variance[c] / totalVariance;
      d95 = c + 1;
      if (cumulative >= 0.95) break;
    }
  }
  const scores = Array.from({ length: n }, () => new Array(d95));
  const loadings = Array.from({ length: d95 }, () => new Array(d));
  for (let c = 0; c < d95; c += 1) {
    const column = order[c];
    const scale = Math.sqrt(variance[c] * (n - 1));
    for (let i = 0; i < n; i += 1) scores[i][c] = vectors.get(i, column) * scale;
    for (let j = 0; j < d; j += 1) {
      let sum = 0;
      for (let i = 0; i < n; i += 1) sum += x[i * d + j] * vectors.get(i, column);
      loadings[c][j] = scale > 0 ? sum / scale : 0;
    }
  }
  return {
    d95,
    eigenvalues,
    explainedVarianceRatio,
    totalVariance,
    scores,
    loadings,
    means: Array.from(means),
    scales: Array.from(scales),
    mlMatrixVersion: REQUIRED_ML_MATRIX_VERSION,
  };
}

module.exports = { exactPca, REQUIRED_ML_MATRIX_VERSION };
