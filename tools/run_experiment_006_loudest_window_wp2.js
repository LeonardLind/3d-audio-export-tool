const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const MANIFEST = path.join(ROOT, "manifest_slice2_birdnet_150.csv");
const RESULTS_DIR = path.join(ROOT, "05_Benchmark_Results");
const OUTPUT_JSON = path.join(RESULTS_DIR, "experiment_006_loudest_window_wp2_results.json");
const SELECTED_WINDOWS_CSV = path.join(RESULTS_DIR, "experiment_006_loudest_windows.csv");

const SAMPLE_RATE = 16000;
const WINDOW_SECONDS = 1;
const WINDOW_SAMPLES = SAMPLE_RATE * WINDOW_SECONDS;
const RMS_HOP_SECONDS = 0.1;
const RMS_HOP_SAMPLES = Math.round(SAMPLE_RATE * RMS_HOP_SECONDS);
const FFT_SIZE = 512;
const HOP_SIZE = 256;
const MFCC_COUNT = 13;
const PCA_VARIANCE_TARGET = 0.95;
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
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])),
  );
}

function escapeCsv(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function readSamples(audioPath, startSeconds, durationSeconds) {
  const buffer = execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    String(startSeconds),
    "-t",
    String(durationSeconds),
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

  const samples = new Float32Array(Math.max(WINDOW_SAMPLES, Math.ceil(durationSeconds * SAMPLE_RATE)));
  const sampleCount = Math.min(samples.length, Math.floor(buffer.length / 4));
  for (let i = 0; i < sampleCount; i += 1) samples[i] = buffer.readFloatLE(i * 4);
  return samples;
}

function rms(samples, start, length) {
  let energy = 0;
  for (let i = 0; i < length; i += 1) {
    const value = samples[start + i] ?? 0;
    energy += value * value;
  }
  return Math.sqrt(energy / length);
}

function selectLoudestWindow(audioPath, detectionStart, detectionEnd) {
  const duration = Math.max(WINDOW_SECONDS, detectionEnd - detectionStart);
  const detectionSamples = readSamples(audioPath, detectionStart, duration);
  const maxStart = Math.max(0, detectionSamples.length - WINDOW_SAMPLES);
  let bestStart = 0;
  let bestRms = -Infinity;

  for (let start = 0; start <= maxStart; start += RMS_HOP_SAMPLES) {
    const value = rms(detectionSamples, start, WINDOW_SAMPLES);
    if (value > bestRms) {
      bestRms = value;
      bestStart = start;
    }
  }

  const tailStart = maxStart;
  const tailRms = rms(detectionSamples, tailStart, WINDOW_SAMPLES);
  if (tailRms > bestRms) {
    bestRms = tailRms;
    bestStart = tailStart;
  }

  const selectedSamples = new Float32Array(WINDOW_SAMPLES);
  for (let i = 0; i < WINDOW_SAMPLES; i += 1) selectedSamples[i] = detectionSamples[bestStart + i] ?? 0;

  return {
    samples: selectedSamples,
    selectedStart: detectionStart + bestStart / SAMPLE_RATE,
    selectedEnd: detectionStart + bestStart / SAMPLE_RATE + WINDOW_SECONDS,
    offsetSeconds: bestStart / SAMPLE_RATE,
    rms: bestRms,
  };
}

const HAMMING = Array.from(
  { length: FFT_SIZE },
  (_, n) => 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (FFT_SIZE - 1)),
);

function hzToMel(hz) {
  return 2595 * Math.log10(1 + hz / 700);
}

function melToHz(mel) {
  return 700 * (10 ** (mel / 2595) - 1);
}

function makeMelFilters(count, fftSize, sampleRate, minHz = 50, maxHz = sampleRate / 2) {
  const minMel = hzToMel(minHz);
  const maxMel = hzToMel(maxHz);
  const points = Array.from({ length: count + 2 }, (_, i) =>
    melToHz(minMel + (i / (count + 1)) * (maxMel - minMel)),
  );
  const bins = points.map((hz) => Math.floor(((fftSize + 1) * hz) / sampleRate));
  const filters = [];
  for (let m = 1; m <= count; m += 1) {
    const filter = new Array(fftSize / 2 + 1).fill(0);
    for (let k = bins[m - 1]; k < bins[m]; k += 1) filter[k] = (k - bins[m - 1]) / Math.max(1, bins[m] - bins[m - 1]);
    for (let k = bins[m]; k < bins[m + 1]; k += 1) filter[k] = (bins[m + 1] - k) / Math.max(1, bins[m + 1] - bins[m]);
    filters.push(filter);
  }
  return filters;
}

const MEL_FILTERS = makeMelFilters(26, FFT_SIZE, SAMPLE_RATE);
const FREQUENCIES = Array.from({ length: FFT_SIZE / 2 + 1 }, (_, k) => (k * SAMPLE_RATE) / FFT_SIZE);

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

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function std(values) {
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

function spectralDescriptors(spectra, samples) {
  const centroids = [];
  const spreads = [];
  const entropies = [];
  const crests = [];
  const slopes = [];
  const tonalities = [];

  for (const spectrum of spectra) {
    const total = spectrum.reduce((sum, value) => sum + value, 0) + 1e-12;
    const centroid = spectrum.reduce((sum, value, i) => sum + value * FREQUENCIES[i], 0) / total;
    const spread = Math.sqrt(spectrum.reduce((sum, value, i) => sum + value * (FREQUENCIES[i] - centroid) ** 2, 0) / total);
    const probabilities = spectrum.map((value) => value / total);
    const entropy = -probabilities.reduce((sum, probability) => probability > 0 ? sum + probability * Math.log2(probability) : sum, 0) / Math.log2(spectrum.length);
    const crest = Math.max(...spectrum) / (total / spectrum.length + 1e-12);
    const xMean = mean(FREQUENCIES);
    const yMean = mean(spectrum);
    const covariance = spectrum.reduce((sum, value, i) => sum + (FREQUENCIES[i] - xMean) * (value - yMean), 0);
    const variance = FREQUENCIES.reduce((sum, value) => sum + (value - xMean) ** 2, 0) + 1e-12;
    const geometricMean = Math.exp(mean(spectrum.map((value) => Math.log(value + 1e-12))));
    const arithmeticMean = total / spectrum.length;
    centroids.push(centroid);
    spreads.push(spread);
    entropies.push(entropy);
    crests.push(crest);
    slopes.push(covariance / variance);
    tonalities.push(geometricMean / (arithmeticMean + 1e-12));
  }

  const rmsByFrame = [];
  for (let start = 0; start + FFT_SIZE <= samples.length; start += HOP_SIZE) {
    let energy = 0;
    for (let i = 0; i < FFT_SIZE; i += 1) energy += samples[start + i] ** 2;
    rmsByFrame.push(Math.sqrt(energy / FFT_SIZE));
  }

  const centroidDeltas = centroids.slice(1).map((value, i) => Math.abs(value - centroids[i]));
  const rmsDeltas = rmsByFrame.slice(1).map((value, i) => Math.abs(value - rmsByFrame[i]));
  return [mean(centroids), mean(spreads), mean(entropies), mean(crests), mean(slopes), mean(centroidDeltas), mean(rmsDeltas), mean(tonalities)];
}

function mfccFeatures(spectra) {
  const coefficientsByFrame = spectra.map((spectrum) => {
    const powers = spectrum.map((value) => value * value);
    const melEnergies = MEL_FILTERS.map((filter) => Math.log(filter.reduce((sum, weight, i) => sum + weight * powers[i], 0) + 1e-12));
    return Array.from({ length: MFCC_COUNT }, (_, n) =>
      melEnergies.reduce((sum, energy, m) => sum + energy * Math.cos((Math.PI * n * (m + 0.5)) / melEnergies.length), 0),
    );
  });
  const features = [];
  for (let coefficient = 0; coefficient < MFCC_COUNT; coefficient += 1) {
    const values = coefficientsByFrame.map((frame) => frame[coefficient]);
    features.push(mean(values), std(values));
  }
  return features;
}

function rawSpectrogramFeatures(spectra) {
  return spectra.flatMap((spectrum) => spectrum.map((value) => Math.log1p(value)));
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

function pca(matrix) {
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

  for (let component = 0; component < maxComponents; component += 1) {
    let vector = normalize(Array.from({ length: n }, (_, i) => Math.sin((i + 1) * (component + 1))));
    for (let iteration = 0; iteration < 100; iteration += 1) vector = normalize(multiplyMatrixVector(gram, vector));
    const gv = multiplyMatrixVector(gram, vector);
    const eigenvalue = dot(vector, gv);
    explained.push(eigenvalue);
    for (let i = 0; i < n; i += 1) embeddings[i].push(vector[i] * Math.sqrt(Math.max(0, eigenvalue * (n - 1))));
    gram = gram.map((row, i) => row.map((value, j) => value - eigenvalue * vector[i] * vector[j]));
    if (explained.reduce((sum, value) => sum + value, 0) / totalVariance >= PCA_VARIANCE_TARGET) break;
  }
  return {
    embedding: embeddings,
    explainedVarianceRatio: explained.map((value) => value / totalVariance),
    explainedVarianceTotal: explained.reduce((sum, value) => sum + value, 0) / totalVariance,
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
    for (const neighbor of embeddedRanks[i].nearest.slice(0, k)) {
      if (!originalNeighbors.has(neighbor)) penalty += originalRanks[i].ranks.get(neighbor) - k;
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

function evaluate(name, matrix, seedOffset) {
  const realPca = pca(matrix);
  const realTrustworthiness = trustworthiness(matrix, realPca.embedding, TRUSTWORTHINESS_K);
  const randomMatrix = randomMatchedMatrix(matrix, RANDOM_SEED + seedOffset);
  const randomPca = pca(randomMatrix);
  const randomTrustworthiness = trustworthiness(randomMatrix, randomPca.embedding, TRUSTWORTHINESS_K);
  return {
    feature_type: name,
    rows: matrix.length,
    dimensions: matrix[0].length,
    pca_components: realPca.embedding[0].length,
    trustworthiness_k: TRUSTWORTHINESS_K,
    real_trustworthiness: realTrustworthiness,
    negative_control_seed: RANDOM_SEED + seedOffset,
    negative_control_trustworthiness: randomTrustworthiness,
    negative_control_margin: realTrustworthiness - randomTrustworthiness,
    negative_control_threshold: `real - control >= ${NEGATIVE_CONTROL_MARGIN}`,
    negative_control_pass: realTrustworthiness - randomTrustworthiness >= NEGATIVE_CONTROL_MARGIN,
    random_pca_components: randomPca.embedding[0].length,
    random_explained_variance_total: randomPca.explainedVarianceTotal,
    explained_variance_total: realPca.explainedVarianceTotal,
  };
}

function main() {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const manifestRows = parseCsv(fs.readFileSync(MANIFEST, "utf8"));
  const mfcc = [];
  const descriptors = [];
  const rawSpectrograms = [];
  const selectedWindows = [];

  for (const row of manifestRows) {
    const audioPath = path.join(ROOT, row.local_audio_path);
    const detectionStart = Number(row.start_time);
    const detectionEnd = Number(row.end_time);
    const selection = selectLoudestWindow(audioPath, detectionStart, detectionEnd);
    const spectra = stft(selection.samples);
    mfcc.push(mfccFeatures(spectra));
    descriptors.push(spectralDescriptors(spectra, selection.samples));
    rawSpectrograms.push(rawSpectrogramFeatures(spectra));
    selectedWindows.push({
      audio_id: row.audio_id,
      common_name: row.common_name,
      confidence: row.confidence,
      detection_start: row.start_time,
      detection_end: row.end_time,
      selected_start: selection.selectedStart.toFixed(3),
      selected_end: selection.selectedEnd.toFixed(3),
      offset_seconds: selection.offsetSeconds.toFixed(3),
      selected_rms: selection.rms,
      local_audio_path: row.local_audio_path,
    });
  }

  const results = [
    evaluate("MFCCs", mfcc, 1),
    evaluate("Inherited 8-axis spectral descriptors", descriptors, 2),
    evaluate("Raw flattened spectrograms", rawSpectrograms, 3),
  ];
  const eligible = results.filter((result) => result.negative_control_pass);
  const bestScore = Math.max(...eligible.map((result) => result.real_trustworthiness));
  const carriedForward = eligible.filter((result) => bestScore - result.real_trustworthiness < NEGATIVE_CONTROL_MARGIN);
  const rawResult = results.find((result) => result.feature_type === "Raw flattened spectrograms");
  const oldRawTrustworthiness = 0.9837652582159624;

  const selectedFields = [
    "audio_id",
    "common_name",
    "confidence",
    "detection_start",
    "detection_end",
    "selected_start",
    "selected_end",
    "offset_seconds",
    "selected_rms",
    "local_audio_path",
  ];
  fs.writeFileSync(
    SELECTED_WINDOWS_CSV,
    `${[selectedFields.join(","), ...selectedWindows.map((row) => selectedFields.map((field) => escapeCsv(row[field])).join(","))].join("\n")}\n`,
    "utf8",
  );

  const payload = {
    experiment: "Experiment 006 - Loudest 1s Window Selection WP2 Retest",
    date_run: "2026-07-20",
    manifest: path.relative(ROOT, MANIFEST).replace(/\\/g, "/"),
    manifest_rows: manifestRows.length,
    window_rule:
      "For each manifest row, search the full BirdNET detection interval start_time to end_time and select the 1000 ms sub-window with highest RMS using a 100 ms hop.",
    selected_windows_csv: path.relative(ROOT, SELECTED_WINDOWS_CSV).replace(/\\/g, "/"),
    pca_component_rule: `Auto PCA to >= ${PCA_VARIANCE_TARGET} cumulative explained variance for each feature matrix.`,
    primary_metric: "trustworthiness",
    trustworthiness_k: TRUSTWORTHINESS_K,
    negative_control_threshold: `Pass if real trustworthiness exceeds matched random-control trustworthiness by at least ${NEGATIVE_CONTROL_MARGIN}.`,
    random_seed_base: RANDOM_SEED,
    previous_fixed_start_raw_spectrogram_trustworthiness: oldRawTrustworthiness,
    new_loudest_window_raw_spectrogram_trustworthiness: rawResult.real_trustworthiness,
    raw_spectrogram_trustworthiness_delta: rawResult.real_trustworthiness - oldRawTrustworthiness,
    results,
    decision: {
      eligible_candidates: eligible.map((result) => result.feature_type),
      carried_forward: carriedForward.map((result) => result.feature_type),
      best_real_trustworthiness: bestScore,
      d010_change: "No change: raw flattened spectrograms remain the only candidate to pass the fair negative-control rule.",
    },
  };

  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(payload, null, 2));
}

main();
