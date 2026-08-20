// Exports an arbitrary sample audio file (default: the MicrosoftTeams-video.mp3 drop in
// sample-test-audio/) as one entry in the Audio Source Switch (see app/public/data/manifest.json
// and app/src/App.tsx), alongside real field recordings from export_single_recording_dataset.js.
//
// Runs the exact same offline pipeline as export_single_recording_dataset.js via its
// exported runContinuousSamplingPipeline (continuous raw-flattened-spectrogram sampling
// -> PCA top-3, D-010/D-004), plus the supplementary panel time-series (spectrogram,
// centroid track, chromagram, spectral flux). Unlike the project-dataset exporter, there
// is no BirdNET detections CSV here, so the species caption is passed in directly and the
// audio is served in its original container (mp3) rather than copied as .wav.
//
// Also runs REAL BirdNET species classification (tools/lib/birdnet.js) -- the actual
// official model, not an approximation -- and attaches the result as
// payload.birdnetDetections for the Species Confidence sandbox card + timeline overlays.

const fs = require("fs");
const path = require("path");
const { runContinuousSamplingPipeline } = require("./export_single_recording_dataset");
const { classifyRecording } = require("./lib/birdnet");
const { upsertDataset } = require("./lib/manifest");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_AUDIO_PATH = path.join(ROOT, "sample-test-audio", "MicrosoftTeams-video.mp3");
const AUDIO_PATH = process.argv[2] || DEFAULT_AUDIO_PATH;
const CAPTION = process.argv[3] || "MicrosoftTeams Video — sample test clip";
const DATASET_ID = "sample";

async function main() {
  if (!fs.existsSync(AUDIO_PATH)) {
    console.error(`Audio file not found: ${AUDIO_PATH}`);
    console.error("Usage: node tools/export_sample_recording.js [path-to-audio-file] [caption]");
    process.exit(1);
  }

  const audioBasename = path.basename(AUDIO_PATH);
  const audioId = audioBasename.replace(/\.[^.]+$/, "");
  const OUTPUT_JSON = path.join(ROOT, "app", "public", "data", `dataset_${DATASET_ID}.json`);
  const OUTPUT_AUDIO = path.join(ROOT, "app", "public", "assets", audioBasename);

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.mkdirSync(path.dirname(OUTPUT_AUDIO), { recursive: true });

  const payload = runContinuousSamplingPipeline({
    audioId,
    audioPath: AUDIO_PATH,
    commonName: CAPTION,
    generatedFrom: `SAMPLE: ${path.relative(ROOT, AUDIO_PATH).replace(/\\/g, "/")} (not part of the project dataset)`,
    // Serve the original file as-is (mp3 plays fine in <audio>); don't force a .wav url.
    audioUrl: `/assets/${audioBasename}`,
  });

  console.log("Running real BirdNET classification (official ONNX weights)...");
  try {
    payload.birdnetDetections = await classifyRecording(AUDIO_PATH);
    const top = payload.birdnetDetections.detections[0];
    if (top) {
      console.log(`  top detection: ${top.commonName} (${top.scientificName}) — confidence ${top.confidence} at ${top.atSeconds}s`);
    } else {
      console.log("  no species detected above the confidence floor");
    }
  } catch (err) {
    console.error(`  BirdNET classification failed, continuing without it: ${err.message}`);
    payload.birdnetDetections = null;
  }

  fs.copyFileSync(AUDIO_PATH, OUTPUT_AUDIO);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  upsertDataset({
    id: DATASET_ID,
    label: `Sample Audio — ${CAPTION}`,
    kind: "sample",
    path: `/data/dataset_${DATASET_ID}.json`,
    durationSeconds: payload.durationSeconds,
  });

  console.log(`Wrote ${payload.points.length} points to ${path.relative(ROOT, OUTPUT_JSON)}`);
  console.log(`Duration ${payload.durationSeconds.toFixed(2)}s, centroidMax ${Math.round(payload.centroidMaxHz)} Hz, PCA var ${payload.pcaExplainedVarianceTotal.toFixed(4)}`);
  console.log(`Panel frames: ${payload.panels.frames.length} @ ${payload.panels.hopSeconds.toFixed(3)}s hop, ${payload.panels.freqHz.length} freq rows`);
  console.log(`Copied audio to ${path.relative(ROOT, OUTPUT_AUDIO)}`);
}

main();
