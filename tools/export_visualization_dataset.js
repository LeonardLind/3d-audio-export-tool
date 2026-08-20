// Offline preprocessing step (see 06_Technical_Architecture/Technical_Architecture.md).
// Reads the Experiment 006 loudest-1s-window selections, recomputes the adopted
// raw-flattened-spectrogram + PCA pipeline (D-004, D-010), and writes one JSON
// point per sample for the app/ frontend to fetch and render. Never run in the browser.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { reduceFeatures } = require("./lib/reducers");

const ROOT = path.resolve(__dirname, "..");
const SELECTED_WINDOWS_CSV = path.join(ROOT, "05_Benchmark_Results", "experiment_006_loudest_windows.csv");
const OUTPUT_JSON = path.join(ROOT, "app", "public", "data", "points.json");

const SAMPLE_RATE = 16000;
const WINDOW_SECONDS = 1;
const WINDOW_SAMPLES = SAMPLE_RATE * WINDOW_SECONDS;
const FFT_SIZE = 512;
const HOP_SIZE = 256;
const PCA_DIMENSIONS = 3;
const POSITION_SPREAD = 6;

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

  const samples = new Float32Array(WINDOW_SAMPLES);
  const sampleCount = Math.min(samples.length, Math.floor(buffer.length / 4));
  for (let i = 0; i < sampleCount; i += 1) samples[i] = buffer.readFloatLE(i * 4);
  return samples;
}

const HAMMING = Array.from(
  { length: FFT_SIZE },
  (_, n) => 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (FFT_SIZE - 1)),
);
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

function rawSpectrogramFeatures(spectra) {
  return spectra.flatMap((spectrum) => spectrum.map((value) => Math.log1p(value)));
}

function frameRms(samples, start, length) {
  let energy = 0;
  for (let i = 0; i < length; i += 1) energy += samples[start + i] ** 2;
  return Math.sqrt(energy / length);
}

function windowRms(samples) {
  return frameRms(samples, 0, samples.length);
}

// "Most active frequency band at emission time" (Core Philosophy) -> the frequency
// bin with peak magnitude in the single loudest STFT frame of the window.
function dominantFrequencyHz(spectra, samples) {
  let loudestFrameIndex = 0;
  let loudestFrameRms = -Infinity;
  let frameIndex = 0;
  for (let start = 0; start + FFT_SIZE <= samples.length; start += HOP_SIZE) {
    const value = frameRms(samples, start, FFT_SIZE);
    if (value > loudestFrameRms) {
      loudestFrameRms = value;
      loudestFrameIndex = frameIndex;
    }
    frameIndex += 1;
  }
  const spectrum = spectra[loudestFrameIndex];
  let bestBin = 0;
  let bestMagnitude = -Infinity;
  for (let bin = 0; bin < spectrum.length; bin += 1) {
    if (spectrum[bin] > bestMagnitude) {
      bestMagnitude = spectrum[bin];
      bestBin = bin;
    }
  }
  return FREQUENCIES[bestBin];
}

// audio_id looks like "4_2MM06988_20250401_160000" -> recorder + recording start.
function parseRecordingStart(audioId) {
  const match = audioId.match(/(\d{8})_(\d{6})$/);
  if (!match) return null;
  const [, datePart, timePart] = match;
  const year = Number(datePart.slice(0, 4));
  const month = Number(datePart.slice(4, 6));
  const day = Number(datePart.slice(6, 8));
  const hour = Number(timePart.slice(0, 2));
  const minute = Number(timePart.slice(2, 4));
  const second = Number(timePart.slice(4, 6));
  return Date.UTC(year, month - 1, day, hour, minute, second);
}

function minMax(values) {
  return values.reduce(
    ([min, max], value) => [Math.min(min, value), Math.max(max, value)],
    [Infinity, -Infinity],
  );
}

function normalize(value, min, max) {
  return max - min > 0 ? (value - min) / (max - min) : 0.5;
}

function main() {
  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  const rows = parseCsv(fs.readFileSync(SELECTED_WINDOWS_CSV, "utf8"));

  const featureMatrix = [];
  const samplesInfo = [];

  for (const row of rows) {
    const audioPath = path.join(ROOT, row.local_audio_path);
    const samples = readSamples(audioPath, Number(row.selected_start), WINDOW_SECONDS);
    const spectra = stft(samples);
    featureMatrix.push(rawSpectrogramFeatures(spectra));

    const recordingStartMs = parseRecordingStart(row.audio_id);
    const timestampMs =
      recordingStartMs !== null ? recordingStartMs + Number(row.selected_start) * 1000 : null;

    samplesInfo.push({
      id: `${row.audio_id}_${row.selected_start}`,
      audioId: row.audio_id,
      commonName: row.common_name,
      confidence: Number(row.confidence),
      selectedStart: Number(row.selected_start),
      selectedEnd: Number(row.selected_end),
      amplitude: windowRms(samples),
      dominantFrequencyHz: dominantFrequencyHz(spectra, samples),
      timestampMs,
    });
  }

  // D-004: PCA over the D-010 raw-flattened-spectrogram feature matrix, same
  // reducer helper used for the adopted benchmark (tools/lib/reducers.js).
  const { embedding } = reduceFeatures(featureMatrix, { method: "pca", dimensions: PCA_DIMENSIONS });

  const positionRanges = Array.from({ length: PCA_DIMENSIONS }, (_, dim) =>
    minMax(embedding.map((point) => point[dim])),
  );
  const maxAbsPosition = Math.max(
    ...positionRanges.map(([min, max]) => Math.max(Math.abs(min), Math.abs(max))),
  );
  const positionScale = maxAbsPosition > 0 ? POSITION_SPREAD / maxAbsPosition : 1;

  const [ampMin, ampMax] = minMax(samplesInfo.map((sample) => sample.amplitude));
  const [freqMin, freqMax] = minMax(samplesInfo.map((sample) => sample.dominantFrequencyHz));

  const points = samplesInfo
    .map((sample, index) => ({
      id: sample.id,
      audioId: sample.audioId,
      commonName: sample.commonName,
      confidence: sample.confidence,
      position: embedding[index].map((value) => value * positionScale),
      amplitude: sample.amplitude,
      amplitudeNorm: normalize(sample.amplitude, ampMin, ampMax),
      dominantFrequencyHz: sample.dominantFrequencyHz,
      colorT: normalize(sample.dominantFrequencyHz, freqMin, freqMax),
      timestampMs: sample.timestampMs,
    }))
    // Temporal-adjacency caveat: see Technical_Architecture.md. This orders points
    // by absolute recording timestamp as a placeholder "path through time," not a
    // claim of biological continuity between unrelated detection events.
    .sort((a, b) => (a.timestampMs ?? 0) - (b.timestampMs ?? 0));

  const payload = {
    generatedFrom: "05_Benchmark_Results/experiment_006_loudest_windows.csv",
    pipeline: "raw flattened spectrogram (D-010) -> PCA top-3 components (D-004)",
    pointCount: points.length,
    pcaDimensions: PCA_DIMENSIONS,
    points,
  };

  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${points.length} points to ${path.relative(ROOT, OUTPUT_JSON)}`);
}

main();
