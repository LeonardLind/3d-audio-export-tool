// Parity check for the browser analysis port used by the app's Upload tab.
//
// app/src/analysis/{fft,pca,pipeline}.ts is a line-for-line port of tools/lib/fft.js, the
// `pca` path of tools/lib/reducers.js, and runContinuousSamplingPipeline() in
// tools/export_single_recording_dataset.js. 06_Technical_Architecture's Rejected
// Alternatives called out exactly one risk in having two implementations of the same math:
// silent numerical drift. This script is the answer to that -- it feeds the port the
// IDENTICAL sample buffer ffmpeg hands the exporter and compares every field against an
// already-exported dataset.
//
// It deliberately does NOT go through the browser decode path. That step (Web Audio
// resample + channel downmix vs. ffmpeg) genuinely differs and is documented as differing;
// what has to stay exact is everything from the STFT onwards.
//
//   node tools/verify_browser_port_parity.mjs
//   node tools/verify_browser_port_parity.mjs <audio file> <exported dataset json>
//
// Exits non-zero if any field drifts past its tolerance, so it can gate a change to either
// implementation.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeSamples } from "../app/src/analysis/pipeline.ts";
import ffbin from "./lib/ffbin.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AUDIO = process.argv[2] ?? path.join(ROOT, "sample-test-audio", "MicrosoftTeams-video.mp3");
const DATASET = process.argv[3] ?? path.join(ROOT, "app", "public", "data", "dataset_sample.json");

// Floating-point reassociation only: the port sums the same terms in the same order but out
// of flat typed arrays rather than nested JS arrays, so a handful of ULPs is expected and
// anything larger is a real behavioural difference.
const SCALAR_TOLERANCE = 1e-9;
const FIELD_TOLERANCE = 1e-9;
const POSITION_TOLERANCE = 1e-6;

const reference = JSON.parse(fs.readFileSync(DATASET, "utf8"));

// Exactly the command readFullAudio() in the exporter runs.
const raw = execFileSync(
  ffbin.FFMPEG,
  ["-hide_banner", "-loglevel", "error", "-i", AUDIO, "-ac", "1", "-ar", String(reference.sampleRate), "-f", "f32le", "pipe:1"],
  { maxBuffer: 1024 * 1024 * 256 },
);
const samples = new Float32Array(Math.floor(raw.length / 4));
for (let i = 0; i < samples.length; i += 1) samples[i] = raw.readFloatLE(i * 4);

console.log(`audio     ${path.relative(ROOT, AUDIO)}`);
console.log(`reference ${path.relative(ROOT, DATASET)}`);
console.log(`samples   ${samples.length} (${(samples.length / reference.sampleRate).toFixed(4)} s at ${reference.sampleRate} Hz)\n`);

const started = Date.now();
const got = analyzeSamples({
  samples,
  audioId: reference.audioId,
  commonName: reference.commonName,
  filename: path.basename(AUDIO),
  sourceSampleRateHz: reference.source?.sampleRateHz ?? null,
  sourceChannels: reference.source?.channels ?? null,
});

let failures = 0;
function check(name, ok, detail) {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures += 1;
}
function relative(a, b) {
  return b === 0 ? Math.abs(a) : Math.abs(a - b) / Math.abs(b);
}

console.log("scalars");
for (const [name, a, b] of [
  ["pointCount", got.pointCount, reference.pointCount],
  ["pointsBeforeAmplitudeFilter", got.pointsBeforeAmplitudeFilter, reference.pointsBeforeAmplitudeFilter],
  ["amplitudeFilterThreshold", got.amplitudeFilterThreshold, reference.amplitudeFilterThreshold],
  ["samplingHopSeconds", got.samplingHopSeconds, reference.samplingHopSeconds],
  ["durationSeconds", got.durationSeconds, reference.durationSeconds],
  ["centroidMaxHz", got.centroidMaxHz, reference.centroidMaxHz],
  ["pcaExplainedVarianceTotal", got.pcaExplainedVarianceTotal, reference.pcaExplainedVarianceTotal],
  ["similarityEdges length", got.similarityEdges.length, reference.similarityEdges.length],
]) {
  const error = relative(a, b);
  check(name, error < SCALAR_TOLERANCE, `port=${a} node=${b} rel=${error.toExponential(2)}`);
}

console.log("\nper-point fields (worst relative error)");
if (got.pointCount !== reference.pointCount) {
  check("point-by-point comparison", false, "point counts differ, cannot align");
} else {
  for (const key of [
    "emissionTime",
    "amplitude",
    "amplitudeNorm",
    "dominantFrequencyHz",
    "colorT",
    "spectralCentroidHz",
    "centroidNorm",
    "spectralFlux",
    "spectralFluxNorm",
  ]) {
    let worst = 0;
    for (let i = 0; i < got.points.length; i += 1) {
      worst = Math.max(worst, relative(got.points[i][key], reference.points[i][key]));
    }
    check(key, worst < FIELD_TOLERANCE, worst.toExponential(2));
  }

  // A PCA eigenvector and its negation are both valid, so magnitudes are compared and the
  // sign pattern reported separately: it must be all-or-nothing per axis, never mixed.
  let worstPosition = 0;
  const flips = [0, 0, 0];
  for (const [i, point] of got.points.entries()) {
    for (let d = 0; d < 3; d += 1) {
      const a = point.position[d];
      const b = reference.points[i].position[d];
      worstPosition = Math.max(worstPosition, Math.abs(Math.abs(a) - Math.abs(b)) / Math.max(1e-9, Math.abs(b)));
      if (a * b < 0) flips[d] += 1;
    }
  }
  check("position magnitude", worstPosition < POSITION_TOLERANCE, worstPosition.toExponential(2));
  check(
    "position signs consistent per axis",
    flips.every((count) => count === 0 || count === got.pointCount),
    `flips per axis: ${flips.join(", ")} of ${got.pointCount}`,
  );

  const gotEdges = got.similarityEdges.map((edge) => edge.join(",")).sort().join(" ");
  const referenceEdges = reference.similarityEdges.map((edge) => edge.join(",")).sort().join(" ");
  check("similarityEdges identical", gotEdges === referenceEdges);

  const referenceTrack = reference.panels.centroidTrack;
  check(
    "centroidTrack identical",
    referenceTrack.length === got.centroidTrack.values.length &&
      referenceTrack.every((value, i) => value === got.centroidTrack.values[i]),
    `${got.centroidTrack.values.length} frames vs ${referenceTrack.length}`,
  );
}

console.log(`\nport ran in ${((Date.now() - started) / 1000).toFixed(2)} s`);
if (failures === 0) {
  console.log("PARITY OK -- the browser port matches the offline exporter.");
} else {
  console.log(`${failures} field(s) drifted. The browser port and tools/export_single_recording_dataset.js`);
  console.log("no longer agree -- reconcile them before shipping (see the 2026-09-10 amendment in");
  console.log("06_Technical_Architecture/Technical_Architecture.md).");
  process.exitCode = 1;
}
