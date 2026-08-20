// Diagnostic-only script (see chat request 2026-07-21). Runs the EXACT SAME
// continuous-sampling + raw-flattened-spectrogram + PCA pipeline as
// export_single_recording_dataset.js (via its exported runContinuousSamplingPipeline),
// but on an arbitrary external audio file that is NOT part of the project's dataset --
// used to test whether the "random-looking shape" problem on real recordings is caused
// by background noise/silence diluting the signal, or by the pipeline itself.
//
// Output is written to separate diagnostic_* files so it never touches the real
// single_recording.json / its audio asset.

const fs = require("fs");
const path = require("path");
const { runContinuousSamplingPipeline } = require("./export_single_recording_dataset");
const { upsertDataset } = require("./lib/manifest");

const ROOT = path.resolve(__dirname, "..");
// Clean reference recordings for diagnostic testing live in sample-test-audio/ --
// not part of Assets/ (the real project dataset). Defaults to the Xeno-canto wood
// pigeon file used for the noise-dilution-vs-pipeline diagnostic.
const DEFAULT_AUDIO_PATH = path.join(
  ROOT,
  "sample-test-audio",
  "XC1157222 - ringduva - Columba palumbus palumbus.wav",
);
const AUDIO_PATH = process.argv[2] || DEFAULT_AUDIO_PATH;
const AUDIO_ID = "diagnostic_wood_pigeon";
const COMMON_NAME = "Common Wood Pigeon (Columba palumbus) -- Xeno-canto XC1157222, DIAGNOSTIC TEST ONLY, not part of the project dataset";
const OUTPUT_JSON = path.join(ROOT, "app", "public", "data", "diagnostic_recording.json");
const OUTPUT_AUDIO = path.join(ROOT, "app", "public", "assets", `${AUDIO_ID}.wav`);

if (!fs.existsSync(AUDIO_PATH)) {
  console.error(`Audio file not found: ${AUDIO_PATH}`);
  console.error("Usage: node tools/diagnose_external_recording.js [path-to-audio-file]");
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
fs.mkdirSync(path.dirname(OUTPUT_AUDIO), { recursive: true });

const payload = runContinuousSamplingPipeline({
  audioId: AUDIO_ID,
  audioPath: AUDIO_PATH,
  commonName: COMMON_NAME,
  generatedFrom: `DIAGNOSTIC: ${AUDIO_PATH} (external Xeno-canto file, not project data)`,
});

fs.copyFileSync(AUDIO_PATH, OUTPUT_AUDIO);
fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
upsertDataset({
  id: "diagnostic",
  label: "Diagnostic — Xeno-canto Wood Pigeon",
  kind: "diagnostic",
  path: "/data/diagnostic_recording.json",
  durationSeconds: payload.durationSeconds,
});

console.log(`Wrote ${payload.points.length} points to ${path.relative(ROOT, OUTPUT_JSON)}`);
console.log(`pcaExplainedVarianceTotal: ${payload.pcaExplainedVarianceTotal}`);
console.log(`Copied audio to ${path.relative(ROOT, OUTPUT_AUDIO)}`);
