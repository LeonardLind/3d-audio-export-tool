const { UMAP } = require("umap-js");

const SUPPORTED_REDUCERS = ["pca", "umap"];
const PCA_VARIANCE_TARGET = 0.95;

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function std(values) {
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

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

function dot(a, b) {
  let total = 0;
  for (let i = 0; i < a.length; i += 1) total += a[i] * b[i];
  return total;
}

function normalize(vector) {
  const length = Math.sqrt(dot(vector, vector)) || 1;
  return vector.map((value) => value / length);
}

function multiplyMatrixVector(matrix, vector) {
  return matrix.map((row) => dot(row, vector));
}

function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function pca(matrix, components = null) {
  const x = standardize(matrix);
  const n = x.length;
  const maxComponents = Math.min(n - 1, x[0].length);
  let gram = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => dot(x[i], x[j]) / Math.max(1, n - 1)),
  );
  const embeddings = Array.from({ length: n }, () => []);
  const explained = [];
  const totalVariance = x[0].reduce((sum, _, j) => {
    const values = x.map((row) => row[j]);
    return sum + values.reduce((colSum, value) => colSum + value * value, 0) / Math.max(1, n - 1);
  }, 0);
  const targetComponents = components ?? maxComponents;

  for (let component = 0; component < targetComponents; component += 1) {
    let vector = normalize(Array.from({ length: n }, (_, i) => Math.sin((i + 1) * (component + 1))));

    for (let iteration = 0; iteration < 100; iteration += 1) {
      vector = normalize(multiplyMatrixVector(gram, vector));
    }

    const gv = multiplyMatrixVector(gram, vector);
    const eigenvalue = dot(vector, gv);
    explained.push(eigenvalue);

    for (let i = 0; i < n; i += 1) {
      embeddings[i].push(vector[i] * Math.sqrt(Math.max(0, eigenvalue * (n - 1))));
    }

    gram = gram.map((row, i) => row.map((value, j) => value - eigenvalue * vector[i] * vector[j]));
    const cumulative = explained.reduce((sum, value) => sum + value, 0) / totalVariance;
    if (components === null && cumulative >= PCA_VARIANCE_TARGET) break;
  }

  return {
    embedding: embeddings,
    explainedVarianceRatio: explained.map((value) => value / totalVariance),
    explainedVarianceTotal: explained.reduce((sum, value) => sum + value, 0) / totalVariance,
  };
}

function reduceWithPca(matrix, settings) {
  const result = pca(matrix, settings.dimensions);
  return {
    method: "pca",
    embedding: result.embedding,
    details: {
      dimensions: result.embedding[0].length,
      explainedVarianceRatio: result.explainedVarianceRatio,
      explainedVarianceTotal: result.explainedVarianceTotal,
    },
  };
}

function reduceWithUmap(matrix, settings) {
  const random = makeRandom(settings.seed ?? 0);
  const umap = new UMAP({
    nComponents: settings.dimensions,
    nNeighbors: settings.nNeighbors ?? 5,
    minDist: settings.minDist ?? 0.1,
    spread: settings.spread ?? 1.0,
    random,
  });

  return {
    method: "umap",
    embedding: umap.fit(standardize(matrix)),
    details: {
      dimensions: settings.dimensions,
      nNeighbors: settings.nNeighbors ?? 5,
      minDist: settings.minDist ?? 0.1,
      spread: settings.spread ?? 1.0,
    },
  };
}

function reduceFeatures(matrix, config = {}) {
  const method = (config.method ?? "pca").toLowerCase();
  if (!SUPPORTED_REDUCERS.includes(method)) {
    throw new Error(`Unsupported reducer "${method}". Supported reducers: ${SUPPORTED_REDUCERS.join(", ")}`);
  }

  const dimensions = config.dimensions ?? 3;
  const methodConfig = config[method] ?? {};
  const settings = { ...methodConfig, dimensions, seed: config.seed };

  return method === "pca" ? reduceWithPca(matrix, settings) : reduceWithUmap(matrix, settings);
}

module.exports = {
  SUPPORTED_REDUCERS,
  makeRandom,
  pca,
  reduceFeatures,
  standardize,
};
