// PCA ported from tools/lib/reducers.js (the `pca` + `reduceWithPca` path, method "pca",
// dimensions 3 -- exactly what export_single_recording_dataset.js calls).
//
// Same algorithm, same numbers: column standardization with POPULATION std, a Gram
// (n x n) matrix divided by max(1, n-1), 100 power iterations per component from the
// deterministic sin((i+1)*(component+1)) seed vector, Hotelling deflation between
// components, scores scaled by sqrt(eigenvalue * (n-1)).
//
// The only difference from the Node original is storage: flat Float64Arrays instead of
// nested JS arrays, because the feature matrix here is up to 700 x ~3078 and nested
// arrays of that size cost tens of MB of boxed numbers in a browser tab. Arithmetic and
// iteration order are unchanged.

export interface PcaResult {
  // n x dimensions scores, row-major.
  embedding: number[][];
  explainedVarianceRatio: number[];
  explainedVarianceTotal: number;
}

// matrix: flat row-major n x cols.
export function pca(matrix: Float64Array, rows: number, cols: number, components: number): PcaResult {
  const n = rows;
  const x = new Float64Array(matrix.length);

  // --- standardize: (value - columnMean) / columnPopulationStd, std 0 -> 1 -----------
  for (let j = 0; j < cols; j += 1) {
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += matrix[i * cols + j];
    const mean = sum / n;
    let sqSum = 0;
    for (let i = 0; i < n; i += 1) {
      const d = matrix[i * cols + j] - mean;
      sqSum += d * d;
    }
    const scale = Math.sqrt(sqSum / n) || 1;
    for (let i = 0; i < n; i += 1) x[i * cols + j] = (matrix[i * cols + j] - mean) / scale;
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

  // Total variance: sum over columns of sum_i x[i][j]^2 / max(1, n-1) -- i.e. the trace
  // of the covariance matrix, which equals the trace of this Gram matrix.
  let totalVariance = 0;
  for (let i = 0; i < n; i += 1) totalVariance += gram[i * n + i];

  const embedding: number[][] = Array.from({ length: n }, () => [] as number[]);
  const explained: number[] = [];
  const vector = new Float64Array(n);
  const product = new Float64Array(n);

  for (let component = 0; component < components; component += 1) {
    for (let i = 0; i < n; i += 1) vector[i] = Math.sin((i + 1) * (component + 1));
    normalizeInPlace(vector);

    for (let iteration = 0; iteration < 100; iteration += 1) {
      multiply(gram, vector, product, n);
      vector.set(product);
      normalizeInPlace(vector);
    }

    multiply(gram, vector, product, n);
    let eigenvalue = 0;
    for (let i = 0; i < n; i += 1) eigenvalue += vector[i] * product[i];
    explained.push(eigenvalue);

    const scoreScale = Math.sqrt(Math.max(0, eigenvalue * (n - 1)));
    for (let i = 0; i < n; i += 1) embedding[i].push(vector[i] * scoreScale);

    // Hotelling deflation, so the next power iteration finds the next component.
    for (let i = 0; i < n; i += 1) {
      const vi = eigenvalue * vector[i];
      for (let j = 0; j < n; j += 1) gram[i * n + j] -= vi * vector[j];
    }
  }

  const explainedSum = explained.reduce((sum, value) => sum + value, 0);
  return {
    embedding,
    explainedVarianceRatio: explained.map((value) => value / totalVariance),
    explainedVarianceTotal: explainedSum / totalVariance,
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
