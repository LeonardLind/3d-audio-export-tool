// PCA ported from tools/lib/reducers.js (the `pca` function behind reduceFeatures({method:
// "pca"}) -- exactly what export_single_recording_dataset.js calls, with dimensions 3).
//
// Same algorithm, same numbers: column standardization with POPULATION std, a Gram
// (n x n) matrix divided by max(1, n-1), power iteration per component from the
// deterministic sin((i+1)*(component+1)) start vector until the relative residual
// ||G v - lambda v|| / |lambda| < PCA_TOLERANCE (1e-10) or PCA_MAX_ITERATIONS (5000)
// updates, Hotelling deflation between components, scores scaled by
// sqrt(eigenvalue * (n-1)), loadings Xs^T u / ||Xs^T u||. Before v2.0 both implementations
// ran a fixed 100 iterations with no convergence check; see the header of
// tools/lib/reducers.js for the measurement that motivated the change.
//
// Storage is flat Float64Arrays (as in the Node version since v2.0), because the feature
// matrix here is up to 700 x ~3078 and nested arrays of that size cost tens of MB of boxed
// numbers in a browser tab. tools/test/reducers.test.js asserts this file and the Node
// version return bit-identical results.

export const PCA_TOLERANCE = 1e-10;
export const PCA_MAX_ITERATIONS = 5000;

export interface PcaComponentDiagnostics {
  component: number; // 1-based
  eigenvalue: number;
  explainedVarianceRatio: number;
  // ||G u - lambda u|| / |lambda| for the returned eigenvector (G = the deflated Gram matrix).
  relativeResidual: number;
  iterations: number;
  converged: boolean;
  // max_i |Xs_i . loading - score_i| / max_i |score_i|.
  scoreReconstructionError: number;
  // lambda_{c+1} / lambda_c; close to 1 = this axis and the next are nearly degenerate.
  nextEigenvalueRatio: number | null;
}

export interface PcaOptions {
  tolerance?: number;
  maxIterations?: number;
  probeNextEigenvalue?: boolean;
}

export interface PcaResult {
  // n x dimensions scores, row-major.
  embedding: number[][];
  explainedVarianceRatio: number[];
  explainedVarianceTotal: number;
  eigenvalues: number[];
  nextEigenvalue: number | null;
  totalVariance: number;
  // Standardisation: x_std = (x - means) / scales, per feature column.
  means: Float64Array;
  scales: Float64Array;
  // One unit-norm feature-space direction per component; standardised row . loading = score.
  loadings: Float64Array[];
  diagnostics: PcaComponentDiagnostics[];
  tolerance: number;
  maxIterations: number;
}

// matrix: flat row-major n x cols.
export function pca(
  matrix: Float64Array,
  rows: number,
  cols: number,
  components: number,
  options: PcaOptions = {},
): PcaResult {
  const tolerance = options.tolerance ?? PCA_TOLERANCE;
  const maxIterations = options.maxIterations ?? PCA_MAX_ITERATIONS;
  const probeNext = options.probeNextEigenvalue ?? true;
  const n = rows;
  const maxComponents = Math.min(n - 1, cols);
  const x = new Float64Array(matrix.length);
  const means = new Float64Array(cols);
  const scales = new Float64Array(cols);

  // --- standardize: (value - columnMean) / columnPopulationStd, std 0 -> 1 -----------
  for (let j = 0; j < cols; j += 1) {
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += matrix[i * cols + j];
    const columnMean = sum / n;
    let sqSum = 0;
    for (let i = 0; i < n; i += 1) {
      const d = matrix[i * cols + j] - columnMean;
      sqSum += d * d;
    }
    const scale = Math.sqrt(sqSum / n) || 1;
    means[j] = columnMean;
    scales[j] = scale;
    for (let i = 0; i < n; i += 1) x[i * cols + j] = (matrix[i * cols + j] - columnMean) / scale;
  }

  // --- Gram matrix: G[i][j] = <x_i, x_j> / max(1, n-1) ------------------------------
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

  const embedding: number[][] = Array.from({ length: n }, () => [] as number[]);
  const eigenvalues: number[] = [];
  const diagnostics: PcaComponentDiagnostics[] = [];
  const loadings: Float64Array[] = [];
  const vector = new Float64Array(n);
  const product = new Float64Array(n);

  const solve = (component: number) => {
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

  for (let component = 0; component < components; component += 1) {
    const { eigenvalue, relativeResidual, iterations } = solve(component);
    eigenvalues.push(eigenvalue);

    const scoreScale = Math.sqrt(Math.max(0, eigenvalue * (n - 1)));
    for (let i = 0; i < n; i += 1) embedding[i].push(vector[i] * scoreScale);

    // Loading v_c = Xs^T u_c, normalised to unit length (same sign as the score).
    const loading = new Float64Array(cols);
    for (let i = 0; i < n; i += 1) {
      const ui = vector[i];
      const row = i * cols;
      for (let k = 0; k < cols; k += 1) loading[k] += x[row + k] * ui;
    }
    normalizeInPlace(loading);
    loadings.push(loading);

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
  }

  let nextEigenvalue: number | null = null;
  if (probeNext && eigenvalues.length < maxComponents) {
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

function normalizeInPlace(vector: Float64Array) {
  let sq = 0;
  for (let i = 0; i < vector.length; i += 1) sq += vector[i] * vector[i];
  const length = Math.sqrt(sq) || 1;
  for (let i = 0; i < vector.length; i += 1) vector[i] /= length;
}

function multiply(matrix: Float64Array, vector: Float64Array, out: Float64Array, n: number) {
  for (let i = 0; i < n; i += 1) {
    let total = 0;
    const row = i * n;
    for (let j = 0; j < n; j += 1) total += matrix[row + j] * vector[j];
    out[i] = total;
  }
}
