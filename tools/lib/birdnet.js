// Real BirdNET species classification, run locally via ONNX Runtime for Node -- no
// Python required. Uses the official BirdNET v2.4 model weights (Kahl et al. 2021,
// Cornell Lab of Ornithology / Chemnitz University of Technology), converted to ONNX and
// published by the community at https://huggingface.co/tphakala/BirdNET-v2.4. Same
// trained weights the BirdNET website/analyzer use, so results should match (modulo the
// TFLite->ONNX conversion and any location/date filtering the website applies that this
// script does not).
//
// Model card: input is raw mono PCM, 48kHz, exactly 3.0s (144000 samples) float32 in
// [-1, 1]; output is [6522] per-species logits -- apply sigmoid for confidence in [0, 1].
// Model license: CC BY-NC-SA 4.0 (non-commercial, share-alike) -- fine for this research
// project; would need addressing before any commercial use.
//
// Fully self-contained and independent of the main D-010 visualization pipeline: this
// module does its own audio decode at 48kHz and never touches position/color/size.

const fs = require("fs");
const path = require("path");
const https = require("https");
const { execFileSync } = require("child_process");

const MODEL_DIR = path.join(__dirname, "..", "models");
const MODEL_PATH = path.join(MODEL_DIR, "BirdNET_v2.4_fp32.onnx");
const LABELS_PATH = path.join(MODEL_DIR, "labels.txt");
const MODEL_URL = "https://huggingface.co/tphakala/BirdNET-v2.4/resolve/main/BirdNET_v2.4_fp32.onnx";
const LABELS_URL = "https://huggingface.co/tphakala/BirdNET-v2.4/resolve/main/labels.txt";

const BIRDNET_SAMPLE_RATE = 48000;
const CHUNK_SECONDS = 3.0;
const CHUNK_SAMPLES = Math.round(BIRDNET_SAMPLE_RATE * CHUNK_SECONDS);
const MIN_CONFIDENCE = 0.03; // BirdNET-Analyzer's own default min-confidence floor
const TOP_N = 12;
const TIMELINE_TOP_N = 3; // species kept per chunk, for showing simultaneous/overlapping calls

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const request = (targetUrl, redirects) => {
      if (redirects > 5) return reject(new Error(`Too many redirects fetching ${url}`));
      https
        .get(targetUrl, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            // Hugging Face's redirect chain sometimes returns a relative Location (e.g.
            // for labels.txt) rather than an absolute URL -- resolve against the URL we
            // just requested, not the original.
            const nextUrl = new URL(res.headers.location, targetUrl).toString();
            request(nextUrl, redirects + 1);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`GET ${targetUrl} -> ${res.statusCode}`));
            res.resume();
            return;
          }
          const total = Number(res.headers["content-length"] || 0);
          let received = 0;
          const tmpPath = `${destPath}.download`;
          const file = fs.createWriteStream(tmpPath);
          res.on("data", (chunk) => {
            received += chunk.length;
            if (total > 0) {
              const pct = ((received / total) * 100).toFixed(0);
              process.stdout.write(`\r  downloading ${path.basename(destPath)}: ${pct}% (${(received / 1e6).toFixed(1)}MB)`);
            }
          });
          res.pipe(file);
          file.on("finish", () => {
            file.close(() => {
              process.stdout.write("\n");
              fs.renameSync(tmpPath, destPath);
              resolve();
            });
          });
          file.on("error", reject);
        })
        .on("error", reject);
    };
    request(url, 0);
  });
}

// Fetches the official model + labels into tools/models/ on first use (~60MB, one-time).
// Idempotent: skips any file that already exists.
async function ensureModelFiles() {
  fs.mkdirSync(MODEL_DIR, { recursive: true });
  if (!fs.existsSync(MODEL_PATH)) {
    console.log("BirdNET model not found locally -- downloading official weights from Hugging Face (~60MB, one-time)...");
    console.log(`  source: ${MODEL_URL}`);
    console.log("  license: CC BY-NC-SA 4.0 (Kahl et al., Cornell Lab of Ornithology / Chemnitz University of Technology)");
    await download(MODEL_URL, MODEL_PATH);
  }
  if (!fs.existsSync(LABELS_PATH)) {
    console.log("Downloading BirdNET species label list...");
    await download(LABELS_URL, LABELS_PATH);
  }
}

function loadLabels() {
  const lines = fs.readFileSync(LABELS_PATH, "utf8").trim().split("\n");
  // Format per model card: "Scientific name_Common name", one per line, index-aligned
  // with the model's output vector.
  return lines.map((line) => {
    const [scientificName, commonName] = line.trim().split("_");
    return { scientificName, commonName: commonName ?? scientificName };
  });
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

// Decodes audio to mono float32 PCM at BirdNET's required 48kHz -- deliberately separate
// from the visualization pipeline's own (22.05kHz) decode in export_single_recording_dataset.js.
function readAudioAt48k(audioPath) {
  const buffer = execFileSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-i", audioPath, "-ac", "1", "-ar", String(BIRDNET_SAMPLE_RATE), "-f", "f32le", "pipe:1"],
    { maxBuffer: 1024 * 1024 * 256 },
  );
  const samples = new Float32Array(Math.floor(buffer.length / 4));
  for (let i = 0; i < samples.length; i += 1) samples[i] = buffer.readFloatLE(i * 4);
  return samples;
}

let sessionPromise = null;
async function getSession() {
  const ort = require("onnxruntime-node");
  if (!sessionPromise) sessionPromise = ort.InferenceSession.create(MODEL_PATH);
  return sessionPromise;
}

// Runs the real BirdNET model over the whole recording (non-overlapping 3s chunks, last
// chunk zero-padded) and returns the top species by max confidence across all chunks --
// the same "which species is this recording most confidently X" question the BirdNET
// website answers. No location/date filtering is applied (the website's species-range
// model is a separate component this does not replicate), so results may differ slightly
// from a location-filtered website run.
async function classifyRecording(audioPath) {
  await ensureModelFiles();
  const ort = require("onnxruntime-node");
  const session = await getSession();
  const labels = loadLabels();
  const samples = readAudioAt48k(audioPath);

  const chunkCount = Math.max(1, Math.ceil(samples.length / CHUNK_SAMPLES));
  const bestConfidence = new Float32Array(labels.length).fill(0);
  const bestChunkTime = new Float32Array(labels.length).fill(0);
  // Per-chunk breakdown: which species were active in EACH 3s window, so the app can
  // show simultaneous/overlapping calls and species transitions over time, not just the
  // single best-anywhere-in-the-clip detection.
  const timeline = [];

  for (let c = 0; c < chunkCount; c += 1) {
    const chunk = new Float32Array(CHUNK_SAMPLES);
    const start = c * CHUNK_SAMPLES;
    const available = Math.min(CHUNK_SAMPLES, samples.length - start);
    for (let i = 0; i < available; i += 1) chunk[i] = samples[start + i];

    // Per-chunk peak normalization -- matches BirdNET-Analyzer's own preprocessing, so
    // gain differences between a close-mic clip and a distant field recording don't bias
    // results. Note: tested empirically against a real 60s field recording (peak 0.15 vs.
    // ~1.0 for a close-mic clip) and made no measurable difference to confidence scores --
    // the model appears internally gain-invariant (linear gain doesn't change SNR anyway).
    // Kept as correct, harmless standard practice; the real driver of per-chunk noise on
    // field recordings turned out to be the lack of location/date filtering (see
    // 08_Visualization_Sandbox/Field_Recording_Findings.md), not gain.
    // Capped at 50x gain so near-silent chunks aren't amplified into false "loud" noise.
    let chunkPeak = 0;
    for (let i = 0; i < available; i += 1) {
      const abs = Math.abs(chunk[i]);
      if (abs > chunkPeak) chunkPeak = abs;
    }
    if (chunkPeak > 1e-6) {
      const gain = Math.min(50, 0.9 / chunkPeak);
      for (let i = 0; i < available; i += 1) chunk[i] *= gain;
    }

    const inputName = session.inputNames[0];
    const tensor = new ort.Tensor("float32", chunk, [1, CHUNK_SAMPLES]);
    // eslint-disable-next-line no-await-in-loop
    const results = await session.run({ [inputName]: tensor });
    const logits = results[session.outputNames[0]].data;

    const chunkScores = [];
    for (let k = 0; k < labels.length; k += 1) {
      const confidence = sigmoid(logits[k]);
      if (confidence > bestConfidence[k]) {
        bestConfidence[k] = confidence;
        bestChunkTime[k] = c * CHUNK_SECONDS;
      }
      if (confidence >= MIN_CONFIDENCE) {
        chunkScores.push({ k, confidence });
      }
    }
    chunkScores.sort((a, b) => b.confidence - a.confidence);
    timeline.push({
      start: Math.round(c * CHUNK_SECONDS * 10) / 10,
      end: Math.round(Math.min(samples.length / BIRDNET_SAMPLE_RATE, (c + 1) * CHUNK_SECONDS) * 10) / 10,
      species: chunkScores.slice(0, TIMELINE_TOP_N).map(({ k, confidence }) => ({
        scientificName: labels[k].scientificName,
        commonName: labels[k].commonName,
        confidence: Math.round(confidence * 1000) / 1000,
      })),
    });
  }

  const detections = [];
  for (let k = 0; k < labels.length; k += 1) {
    if (bestConfidence[k] >= MIN_CONFIDENCE) {
      detections.push({
        scientificName: labels[k].scientificName,
        commonName: labels[k].commonName,
        confidence: Math.round(bestConfidence[k] * 1000) / 1000,
        atSeconds: Math.round(bestChunkTime[k] * 10) / 10,
      });
    }
  }
  detections.sort((a, b) => b.confidence - a.confidence);

  return {
    model: "BirdNET v2.4 (official weights, ONNX inference, CC BY-NC-SA 4.0)",
    source: "https://huggingface.co/tphakala/BirdNET-v2.4",
    chunkSeconds: CHUNK_SECONDS,
    chunkCount,
    minConfidence: MIN_CONFIDENCE,
    detections: detections.slice(0, TOP_N),
    // Per-chunk species breakdown, for time-based overlays (Pitch Trajectory, Syllable
    // Constellation, Detection Timeline). One entry per 3s chunk, chronological.
    timeline,
  };
}

module.exports = { classifyRecording };
