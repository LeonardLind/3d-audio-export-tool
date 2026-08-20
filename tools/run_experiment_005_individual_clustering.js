const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { pca, standardize, makeRandom } = require("./lib/reducers");

const ROOT = path.resolve(__dirname, "..");
const ASSET_ROOT = path.join(ROOT, "Assets", "slice_2_acoustic_data");
const RESULTS_DIR = path.join(ROOT, "05_Benchmark_Results");
const OUTPUT_JSON = path.join(RESULTS_DIR, "experiment_005_individual_clustering_results.json");
const OUTPUT_MANIFEST = path.join(ROOT, "manifest_experiment_005_individual_validation.csv");

const SAMPLE_RATE = 16000;
const WINDOW_SECONDS = 1;
const FFT_SIZE = 512;
const HOP_SIZE = 256;
const TRUSTWORTHINESS_K = 5;
const MAX_RECORDINGS_PER_INDIVIDUAL = 50;
const PERMUTATIONS = 1000;
const RANDOM_SEED = 20260720;

function walkFiles(dir, predicate, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(fullPath, predicate, files);
    else if (predicate(fullPath)) files.push(fullPath);
  }
  return files;
}

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
      } else if (char === '"') quoted = false;
      else value += char;
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
    } else value += char;
  }
  if (value.length > 0 || row.length > 0) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }

  const [headers, ...records] = rows.filter((entry) => entry.length > 1);
  if (!headers) return [];
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])),
  );
}

function escapeCsv(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function individualId(audioId) {
  return audioId.replace(/_\d{8}_\d{6}$/, "");
}

function buildValidationManifest() {
  const wavByBase = new Map();
  for (const wavPath of walkFiles(ASSET_ROOT, (file) => path.extname(file).toLowerCase() === ".wav")) {
    wavByBase.set(path.basename(wavPath, ".wav"), wavPath);
  }

  const csvPaths = walkFiles(ASSET_ROOT, (file) => {
    return path.extname(file).toLowerCase() === ".csv" && path.basename(path.dirname(file)).toLowerCase() === "output";
  }).sort();

  const bestByRecording = new Map();
  for (const csvPath of csvPaths) {
    const rows = parseCsv(fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, ""));
    for (const row of rows) {
      if ((row.model || "").trim().toLowerCase() !== "birdnet") continue;
      const confidence = Number(row.confidence);
      if (!(confidence > 0.5)) continue;
      const wavPath = wavByBase.get(row.audio_id);
      if (!wavPath) continue;

      const current = bestByRecording.get(row.audio_id);
      if (current && Number(current.confidence) >= confidence) continue;

      bestByRecording.set(row.audio_id, {
        individual_id: individualId(row.audio_id),
        audio_id: row.audio_id,
        source_csv: path.relative(ROOT, csvPath).replace(/\\/g, "/"),
        local_audio_path: path.relative(ROOT, wavPath).replace(/\\/g, "/"),
        input_file_path: row.input_file_path,
        model: row.model,
        common_name: row.common_name,
        scientific_name: row.scientific_name,
        confidence: row.confidence,
        start_time: row.start_time,
        end_time: row.end_time,
      });
    }
  }

  const byIndividual = new Map();
  for (const row of bestByRecording.values()) {
    if (!byIndividual.has(row.individual_id)) byIndividual.set(row.individual_id, []);
    byIndividual.get(row.individual_id).push(row);
  }

  const selectedIndividuals = [...byIndividual.entries()]
    .filter(([, rows]) => rows.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3);

  const balancedCount = Math.min(
    MAX_RECORDINGS_PER_INDIVIDUAL,
    ...selectedIndividuals.map(([, rows]) => rows.length),
  );

  const selectedRows = selectedIndividuals.flatMap(([id, rows]) => {
    return rows
      .sort(
        (a, b) =>
          Number(b.confidence) - Number(a.confidence) ||
          a.audio_id.localeCompare(b.audio_id) ||
          Number(a.start_time) - Number(b.start_time),
      )
      .slice(0, balancedCount)
      .map((row) => ({ ...row, individual_id: id }));
  });

  selectedRows.sort((a, b) => a.individual_id.localeCompare(b.individual_id) || a.audio_id.localeCompare(b.audio_id));

  const fieldnames = [
    "individual_id",
    "audio_id",
    "source_csv",
    "local_audio_path",
    "input_file_path",
    "model",
    "common_name",
    "scientific_name",
    "confidence",
    "start_time",
    "end_time",
  ];
  fs.writeFileSync(
    OUTPUT_MANIFEST,
    `${[fieldnames.join(","), ...selectedRows.map((row) => fieldnames.map((field) => escapeCsv(row[field])).join(","))].join("\n")}\n`,
    "utf8",
  );

  return {
    selectedRows,
    selectedIndividuals: selectedIndividuals.map(([id, rows]) => ({ individual_id: id, eligible_recordings: rows.length })),
    balancedCount,
  };
}

const HAMMING = Array.from(
  { length: FFT_SIZE },
  (_, n) => 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (FFT_SIZE - 1)),
);

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
  for (let i = 0; i < sampleCount; i += 1) samples[i] = buffer.readFloatLE(i * 4);
  return samples;
}

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
    for (let i = 0; i < FFT_SIZE; i += 1) frame[i] = samples[start + i] * HAMMING[i];
    spectra.push(dftMagnitudes(frame));
  }
  return spectra;
}

function rawSpectrogramFeatures(spectra) {
  return spectra.flatMap((spectrum) => spectrum.map((value) => Math.log1p(value)));
}

function squaredDistance(a, b) {
  let total = 0;
  for (let i = 0; i < a.length; i += 1) total += (a[i] - b[i]) ** 2;
  return total;
}

function euclidean(a, b) {
  return Math.sqrt(squaredDistance(a, b));
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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
    for (const neighbor of embeddedRanks[i].nearest.slice(0, k)) {
      if (!originalNeighbors.has(neighbor)) penalty += originalRanks[i].ranks.get(neighbor) - k;
    }
  }
  return 1 - (2 / (n * k * (2 * n - 3 * k - 1))) * penalty;
}

function distanceStats(embedding, labels) {
  const same = [];
  const different = [];
  for (let i = 0; i < embedding.length; i += 1) {
    for (let j = i + 1; j < embedding.length; j += 1) {
      const distance = euclidean(embedding[i], embedding[j]);
      if (labels[i] === labels[j]) same.push(distance);
      else different.push(distance);
    }
  }
  return {
    same_pairs: same.length,
    different_pairs: different.length,
    same_mean_distance: mean(same),
    different_mean_distance: mean(different),
    same_median_distance: median(same),
    different_median_distance: median(different),
    mean_distance_delta: mean(different) - mean(same),
    median_distance_delta: median(different) - median(same),
    mean_distance_ratio: mean(same) / mean(different),
  };
}

function nearestNeighborSameLabelRate(embedding, labels) {
  let hits = 0;
  for (let i = 0; i < embedding.length; i += 1) {
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let j = 0; j < embedding.length; j += 1) {
      if (i === j) continue;
      const distance = squaredDistance(embedding[i], embedding[j]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = j;
      }
    }
    if (labels[i] === labels[bestIndex]) hits += 1;
  }
  return hits / embedding.length;
}

function shuffle(values, random) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function permutationTest(embedding, labels, observedDelta) {
  const random = makeRandom(RANDOM_SEED + 5);
  let atLeastObserved = 0;
  const deltas = [];
  for (let i = 0; i < PERMUTATIONS; i += 1) {
    const shuffled = shuffle(labels, random);
    const delta = distanceStats(embedding, shuffled).mean_distance_delta;
    deltas.push(delta);
    if (delta >= observedDelta) atLeastObserved += 1;
  }
  return {
    permutations: PERMUTATIONS,
    p_value_greater_equal: (atLeastObserved + 1) / (PERMUTATIONS + 1),
    shuffled_delta_mean: mean(deltas),
    shuffled_delta_median: median(deltas),
  };
}

function main() {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const { selectedRows, selectedIndividuals, balancedCount } = buildValidationManifest();
  const labels = selectedRows.map((row) => row.individual_id);
  const features = selectedRows.map((row) => {
    const samples = readWindowSamples(path.join(ROOT, row.local_audio_path), Number(row.start_time));
    return rawSpectrogramFeatures(stft(samples));
  });

  const pcaResult = pca(features, null);
  const embedding = pcaResult.embedding;
  const stats = distanceStats(embedding, labels);
  const nearestNeighborRate = nearestNeighborSameLabelRate(embedding, labels);
  const permutation = permutationTest(embedding, labels, stats.mean_distance_delta);
  const expectedBalancedBaseline = 1 / selectedIndividuals.length;

  const payload = {
    experiment: "Experiment 005 - Same-Individual Clustering Failure-Criteria Test",
    date_run: "2026-07-20",
    adopted_method: "raw flattened spectrograms + PCA",
    failure_criterion:
      "Repeated recordings of the same individual/song do not cluster together more closely than recordings of different individuals.",
    manifest: path.relative(ROOT, OUTPUT_MANIFEST).replace(/\\/g, "/"),
    source_dataset: "Assets/slice_2_acoustic_data",
    selected_individuals: selectedIndividuals,
    balanced_recordings_per_individual: balancedCount,
    rows: selectedRows.length,
    one_clip_per_recording: true,
    feature_dimensions: features[0].length,
    pca_components_auto95: embedding[0].length,
    pca_explained_variance_total: pcaResult.explainedVarianceTotal,
    trustworthiness_k: TRUSTWORTHINESS_K,
    trustworthiness: trustworthiness(features, embedding, TRUSTWORTHINESS_K),
    distance_test: stats,
    nearest_neighbor_same_individual_rate: nearestNeighborRate,
    expected_balanced_nearest_neighbor_baseline: expectedBalancedBaseline,
    permutation_test: permutation,
    decision: {
      same_individual_closer: stats.mean_distance_delta > 0,
      passes_initial_failure_criterion_check:
        stats.mean_distance_delta > 0 && permutation.p_value_greater_equal < 0.05,
      caveat:
        "Only two recorder/individual IDs were available locally/S3 under the tested prefix; this test may still reflect recorder/site/species/recording-condition effects rather than true biological individual identity.",
    },
  };

  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(payload, null, 2));
}

main();
