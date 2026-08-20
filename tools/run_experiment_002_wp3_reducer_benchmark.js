const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const TSNE = require("tsne-js");
const { reduceFeatures } = require("./lib/reducers");

const ROOT = path.resolve(__dirname, "..");
function argValue(name, fallback = null) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}
const MANIFEST = path.resolve(ROOT, argValue("manifest", "manifest_birdnet_first_test.csv"));
const MANIFEST_STEM = path.basename(MANIFEST, ".csv");
const RESULTS_DIR = path.join(ROOT, "05_Benchmark_Results");
const IS_DEFAULT_MANIFEST = path.basename(MANIFEST) === "manifest_birdnet_first_test.csv";
const OUTPUT_JSON = path.join(
  RESULTS_DIR,
  IS_DEFAULT_MANIFEST
    ? "experiment_002_wp3_reducer_results.json"
    : `experiment_002_wp3_reducer_${MANIFEST_STEM}_results.json`,
);

const SAMPLE_RATE = 16000;
const WINDOW_SECONDS = 1;
const FFT_SIZE = 512;
const HOP_SIZE = 256;
const PCA_VARIANCE_TARGET = 0.95;
let EMBEDDING_DIMENSIONS = Number(argValue("dimensions", "0"));
const TRUSTWORTHINESS_K = 5;
const RANDOM_SEED = 20260720;
const NEGATIVE_CONTROL_MARGIN = 0.02;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }

  const [headers, ...records] = rows.filter((entry) => entry.length > 1);
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])),
  );
}

function readWindowSamples(audioPath, startSeconds) {
  const buffer = execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    String(startSeconds),
    "-t",
    String(WINDOW_SECONDS),
    "-i",
    audioPath,
    "-ac",
    "1",
    "-ar",
    String(SAMPLE_RATE),
    "-f",
    "f32le",
    "pipe:1",
  ]);

  const samples = new Float32Array(SAMPLE_RATE * WINDOW_SECONDS);
  const sampleCount = Math.min(samples.length, Math.floor(buffer.length / 4));
  for (let i = 0; i < sampleCount; i += 1) {
    samples[i] = buffer.readFloatLE(i * 4);
  }
  return samples;
}

const HAMMING = Array.from(
  { length: FFT_SIZE },
  (_, n) => 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (FFT_SIZE - 1)),
);

function dftMagnitudes(frame) {
  const bins = FFT_SIZE / 2 + 1;
  const magnitudes = new Array(bins).fill(0);

  for (let k = 0; k < bins; k += 1) {
    let real = 0;
    let imag = 0;
    for (let n = 0; n < FFT_SIZE; n += 1) {
      const angle = (-2 * Math.PI * k * n) / FFT_SIZE;
      real += frame[n] * Math.cos(angle);
      imag += frame[n] * Math.sin(angle);
    }
    magnitudes[k] = Math.sqrt(real * real + imag * imag);
  }

  return magnitudes;
}

function stft(samples) {
  const spectra = [];
  for (let start = 0; start + FFT_SIZE <= samples.length; start += HOP_SIZE) {
    const frame = new Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i += 1) {
      frame[i] = samples[start + i] * HAMMING[i];
    }
    spectra.push(dftMagnitudes(frame));
  }
  return spectra;
}

function rawSpectrogramFeatures(spectra) {
  return spectra.flatMap((spectrum) => spectrum.map((value) => Math.log1p(value)));
}

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
  };
}

function squaredDistance(a, b) {
  let total = 0;
  for (let i = 0; i < a.length; i += 1) total += (a[i] - b[i]) ** 2;
  return total;
}

function ranksByDistance(matrix) {
  return matrix.map((row, i) => {
    const distances = matrix
      .map((other, j) => ({ index: j, distance: i === j ? Infinity : squaredDistance(row, other) }))
      .sort((a, b) => a.distance - b.distance);

    const ranks = new Map();
    distances.forEach((item, rank) => ranks.set(item.index, rank + 1));
    return { nearest: distances.map((item) => item.index), ranks };
  });
}

function trustworthiness(original, embedded, k) {
  const n = original.length;
  const originalRanks = ranksByDistance(standardize(original));
  const embeddedRanks = ranksByDistance(embedded);
  let penalty = 0;

  for (let i = 0; i < n; i += 1) {
    const originalNeighbors = new Set(originalRanks[i].nearest.slice(0, k));
    const embeddedNeighbors = embeddedRanks[i].nearest.slice(0, k);
    for (const neighbor of embeddedNeighbors) {
      if (!originalNeighbors.has(neighbor)) {
        penalty += originalRanks[i].ranks.get(neighbor) - k;
      }
    }
  }

  return 1 - (2 / (n * k * (2 * n - 3 * k - 1))) * penalty;
}

function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function randomNormal(random) {
  const u1 = Math.max(random(), 1e-12);
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function randomMatchedMatrix(matrix, seed) {
  const random = makeRandom(seed);
  return matrix.map((row) => row.map(() => randomNormal(random)));
}

function reducePca(matrix) {
  return reduceFeatures(matrix, {
    method: "pca",
    dimensions: EMBEDDING_DIMENSIONS,
  }).embedding;
}

function reduceUmap(matrix, seed) {
  return reduceFeatures(matrix, {
    method: "umap",
    dimensions: EMBEDDING_DIMENSIONS,
    seed,
    umap: {
      nNeighbors: 5,
      minDist: 0.1,
      spread: 1.0,
    },
  }).embedding;
}

function reduceTsne(matrix) {
  const model = new TSNE({
    dim: EMBEDDING_DIMENSIONS,
    perplexity: 5,
    earlyExaggeration: 4.0,
    learningRate: 100.0,
    nIter: 1000,
    metric: "euclidean",
  });
  model.init({ data: standardize(matrix), type: "dense" });
  const [error, iterations] = model.run();
  return {
    embedding: model.getOutput(),
    error,
    iterations,
  };
}

function evaluateReducer(name, matrix, randomSeed, reducer) {
  const randomMatrix = randomMatchedMatrix(matrix, randomSeed);
  const realReduced = reducer(matrix, randomSeed + 1000);
  const controlReduced = reducer(randomMatrix, randomSeed + 2000);
  const realEmbedding = Array.isArray(realReduced) ? realReduced : realReduced.embedding;
  const controlEmbedding = Array.isArray(controlReduced) ? controlReduced : controlReduced.embedding;
  const realTrustworthiness = trustworthiness(matrix, realEmbedding, TRUSTWORTHINESS_K);
  const controlTrustworthiness = trustworthiness(randomMatrix, controlEmbedding, TRUSTWORTHINESS_K);

  return {
    reducer: name,
    feature_type: "Raw flattened spectrograms",
    rows: matrix.length,
    input_dimensions: matrix[0].length,
    output_dimensions: realEmbedding[0].length,
    real_trustworthiness: realTrustworthiness,
    negative_control_type: "seeded Gaussian random data with matched row count and feature dimensionality",
    negative_control_seed: randomSeed,
    negative_control_trustworthiness: controlTrustworthiness,
    negative_control_threshold: `real - control >= ${NEGATIVE_CONTROL_MARGIN}`,
    negative_control_margin: realTrustworthiness - controlTrustworthiness,
    negative_control_pass: realTrustworthiness - controlTrustworthiness >= NEGATIVE_CONTROL_MARGIN,
    reducer_details: {
      real: Array.isArray(realReduced) ? {} : { error: realReduced.error, iterations: realReduced.iterations },
      control: Array.isArray(controlReduced)
        ? {}
        : { error: controlReduced.error, iterations: controlReduced.iterations },
    },
  };
}

function main() {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const manifestRows = parseCsv(fs.readFileSync(MANIFEST, "utf8"));
  const rawSpectrograms = [];

  for (const row of manifestRows) {
    const audioPath = path.join(ROOT, row.local_audio_path);
    const samples = readWindowSamples(audioPath, Number(row.start_time));
    rawSpectrograms.push(rawSpectrogramFeatures(stft(samples)));
  }

  const pcaAuto = pca(rawSpectrograms, null);
  const pcaAutoDimensions = pcaAuto.embedding[0].length;
  if (!EMBEDDING_DIMENSIONS) {
    EMBEDDING_DIMENSIONS = pcaAutoDimensions;
  }

  const results = [
    evaluateReducer("PCA", rawSpectrograms, RANDOM_SEED + 301, reducePca),
    evaluateReducer("UMAP", rawSpectrograms, RANDOM_SEED + 302, reduceUmap),
    evaluateReducer("t-SNE", rawSpectrograms, RANDOM_SEED + 303, reduceTsne),
  ];

  const eligible = results.filter((result) => result.negative_control_pass);
  const bestScore = Math.max(...eligible.map((result) => result.real_trustworthiness));
  const carriedForward = eligible.filter(
    (result) => bestScore - result.real_trustworthiness < NEGATIVE_CONTROL_MARGIN,
  );

  const payload = {
    experiment: "Experiment 002 - WP3 Raw Spectrogram Reducer Benchmark",
    date_run: "2026-07-20",
    manifest: path.relative(ROOT, MANIFEST).replace(/\\/g, "/"),
    manifest_rows: manifestRows.length,
    feature_type: "Raw flattened spectrograms",
    input_dimensions: rawSpectrograms[0].length,
    dimensionality_method:
      "Use the dimensionality required by raw spectrogram PCA to retain at least 95% explained variance for this manifest, unless --dimensions is explicitly supplied.",
    output_dimensions: EMBEDDING_DIMENSIONS,
    pca_auto95_explained_variance_total: pcaAuto.explainedVarianceRatio.reduce((sum, value) => sum + value, 0),
    reducers: ["PCA", "UMAP", "t-SNE"],
    trustworthiness_k: TRUSTWORTHINESS_K,
    negative_control_rule: `Pass if real trustworthiness exceeds matched random-control trustworthiness by at least ${NEGATIVE_CONTROL_MARGIN}.`,
    random_seed_base: RANDOM_SEED,
    reducer_parameters: {
      PCA: { components: EMBEDDING_DIMENSIONS },
      UMAP: { nComponents: EMBEDDING_DIMENSIONS, nNeighbors: 5, minDist: 0.1, spread: 1.0 },
      "t-SNE": { dim: EMBEDDING_DIMENSIONS, perplexity: 5, earlyExaggeration: 4.0, learningRate: 100.0, nIter: 1000 },
    },
    label_exclusion_verification:
      "Labels remain manifest metadata only; reducer inputs and trustworthiness scoring use raw spectrogram numeric features only.",
    results,
    decision: {
      eligible_reducers: eligible.map((result) => result.reducer),
      best_real_trustworthiness: Number.isFinite(bestScore) ? bestScore : null,
      carried_forward: carriedForward.map((result) => result.reducer),
      tie_band: NEGATIVE_CONTROL_MARGIN,
    },
  };

  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(payload, null, 2));
}

main();
