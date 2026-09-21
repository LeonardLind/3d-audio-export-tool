// The general-purpose entry point: any audio file in, one self-contained asset package out.
//
// The existing exporters each hardcode their own subject -- export_single_recording_dataset
// takes a project audio ID and expects a matching BirdNET detections CSV under Assets/,
// diagnose_external_recording pins one Xeno-canto file, and export_sample_recording writes
// to the fixed dataset id "sample" so a second run overwrites the first. All three are
// useful as-is and are left alone; none of them answers "generate assets for THIS file I
// just recorded." That is this script's job.
//
// It reuses runContinuousSamplingPipeline verbatim -- the scientific processing here is
// identical to what the project already ships. What it adds is the surrounding workflow:
// probe the source, derive an id, run BirdNET, VALIDATE the result before writing anything,
// and emit a deterministic package (analysis JSON + the audio it describes + a machine-
// readable index) that a backend upload or another developer can consume without having to
// read this file first.
//
// Usage:
//   node tools/generate_acoustic_assets.js <audio-file> [options]
//
//   --id=<slug>            Asset/dataset id. Default: slug of the filename.
//   --label=<text>         Human label for the app's Audio Source Switch.
//   --species=<name>       Species / caption for this recording (commonName).
//   --analysis-rate=<hz>   STFT sample rate. Default 22050 (see DEFAULT_ANALYSIS_SAMPLE_RATE).
//   --profile=full|app     full (default) keeps everything, for the local viewer. app ships
//                          only what the production XP Acoustics screen reads, minified.
//   --out=<dir>            Package directory. Default: output/<id>.
//   --no-birdnet           Skip species classification (much faster; no model download).
//   --publish              Also install into app/ so the viewer can open it immediately.
//   --force                Write the package even if validation reports errors.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { runContinuousSamplingPipeline } = require("./export_single_recording_dataset");
const { probeAudioSource } = require("./lib/audio_source");
const { validateExport } = require("./lib/validate");
const { upsertDataset } = require("./lib/manifest");

const ROOT = path.resolve(__dirname, "..");
// Bumped only when the shape of acoustic-analysis.json changes in a way a consumer must
// react to. Consumers should refuse a major version they do not know.
const CONTRACT_VERSION = 1;
const ANALYSIS_FILENAME = "acoustic-analysis.json";
const INDEX_FILENAME = "asset-package.json";

// Export profiles.
//
//   full - everything the pipeline computes, pretty-printed. What the local BirdSong viewer
//          in app/ needs: its Sandbox gallery reads analysis.pitch/syllables/aci/indices and
//          its panels read frames/chroma/descriptors.
//   app  - only the fields the production XP Acoustics screen actually reads, minified.
//
// The production screen (revx-greencubes, XPAcousticsScreen) fetches a clip's analysis JSON
// lazily from a signed S3 URL, so payload size is a page-load cost there in a way it is not
// for the local viewer reading off disk. Verified against that screen: from `panels` it reads
// only centroidTrack, hopSeconds and nyquistHz -- never frames, chroma, freqHz or descriptors
// -- and it does not touch the `analysis` block at all. Those unread fields are ~70% of the
// payload, so shipping them costs the frontend a multi-megabyte download it never opens.
const PROFILES = ["full", "app"];

// Panel fields the production screen reads. Everything else in `panels` is local-viewer only.
const APP_PANEL_FIELDS = ["hopSeconds", "nyquistHz", "centroidTrack"];

// Trims a payload to the `app` profile. Returns a new object; the original is untouched so a
// caller can still write the full version from the same run.
function toAppProfile(payload) {
  const trimmed = { ...payload };
  // Supplementary bioacoustics (pitch, syllables, ACI, self-similarity, soundscape indices).
  // Read by the local Sandbox gallery, not by the production screen. selfSimilarity alone is
  // an O(n^2) matrix.
  delete trimmed.analysis;
  if (payload.panels) {
    trimmed.panels = {};
    for (const field of APP_PANEL_FIELDS) {
      if (payload.panels[field] !== undefined) trimmed.panels[field] = payload.panels[field];
    }
  }
  trimmed.profile = "app";
  return trimmed;
}

// Asset ids end up in filenames, URLs and manifest keys, so they stay ASCII. Accented letters
// are folded to their base letter first (NFD splits "å" into "a" + combining ring, which the
// diacritic strip then removes) -- without that step a Swedish filename like "fågelsång.wav"
// would come out as "f_gels_ng" rather than "fagelsang".
function slug(text) {
  return (
    text
      .replace(/\.[^.]+$/, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || "recording"
  );
}

// Mirrors slugifyBirdName() in the production screen's shared module, so the folder segment
// this package suggests is the one the upload form would produce for the same name.
function slugifyBirdName(birdName) {
  return String(birdName)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/_{2,}/g, "_");
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const [key, ...rest] = arg.slice(2).split("=");
      flags[key] = rest.length ? rest.join("=") : true;
    } else positional.push(arg);
  }
  return { positional, flags };
}

// A browser audio element has to be able to play whatever the app is handed. When the source
// container is one browsers do not reliably decode (FLAC, WMA), the package carries an extra
// transcoded copy AND the untouched source: the source stays because it is the scientific
// record, the copy exists only so a human can press play. Formats browsers do handle are
// shipped as-is -- no transcode, no generation loss, one file.
function writePlaybackCopy(sourcePath, outDir, format) {
  const target = path.join(outDir, `playback.${format}`);
  execFileSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", "-i", sourcePath, "-vn", "-b:a", "192k", target],
    { maxBuffer: 1024 * 1024 * 16 },
  );
  return path.basename(target);
}

async function generate({
  audioPath,
  id,
  label,
  species,
  analysisSampleRate,
  outDir,
  runBirdnet = true,
  onProgress = () => {},
}) {
  onProgress("probe", `Reading ${path.basename(audioPath)}`);
  const source = probeAudioSource(audioPath);

  const assetId = id || slug(source.filename);
  const packageDir = outDir || path.join(ROOT, "output", assetId);

  // Browser-unplayable sources get a playback copy; everything else is served verbatim.
  const playbackFormat = source.browserPlayable ? null : "mp3";
  const audioFilename = source.filename;

  onProgress("analyze", "Running acoustic analysis (STFT, descriptors, PCA)");
  const payload = runContinuousSamplingPipeline({
    audioId: assetId,
    audioPath,
    commonName: species || label || source.filename,
    generatedFrom: path.relative(ROOT, audioPath).replace(/\\/g, "/"),
    // What the app will fetch. Points at the playback copy when one exists, since that is
    // the file a human can actually hear; the source stays in the package either way.
    audioUrl: `/assets/${playbackFormat ? `${assetId}_playback.${playbackFormat}` : audioFilename}`,
    analysisSampleRate,
    source,
  });

  payload.contractVersion = CONTRACT_VERSION;
  payload.generatedAt = new Date().toISOString();

  if (runBirdnet) {
    onProgress("birdnet", "Classifying species with BirdNET (official ONNX weights)");
    try {
      const { classifyRecording } = require("./lib/birdnet");
      payload.birdnetDetections = await classifyRecording(audioPath);
    } catch (err) {
      onProgress("birdnet", `BirdNET unavailable, continuing without it: ${err.message}`);
      payload.birdnetDetections = null;
    }
  } else {
    payload.birdnetDetections = null;
  }

  onProgress("validate", "Validating results");
  const validation = validateExport(payload, { audioFileExists: fs.existsSync(audioPath) });

  return { payload, validation, assetId, packageDir, audioFilename, playbackFormat, source };
}

// Writes the package only after validation has been consulted by the caller. Deterministic
// layout, flat, no nesting -- readable with a directory listing, and uploadable by walking
// the index's `files` list.
function writePackage({
  payload,
  validation,
  assetId,
  packageDir,
  audioPath,
  audioFilename,
  playbackFormat,
  profile = "full",
  species,
}) {
  fs.mkdirSync(packageDir, { recursive: true });

  const analysisPath = path.join(packageDir, ANALYSIS_FILENAME);
  // `app` is minified as well as trimmed: this file is fetched over the network by the
  // production screen, where two-space indentation is roughly half the bytes on the wire.
  const exported = profile === "app" ? toAppProfile(payload) : payload;
  const serialized = profile === "app" ? JSON.stringify(exported) : `${JSON.stringify(exported, null, 2)}\n`;
  fs.writeFileSync(analysisPath, serialized, "utf8");
  fs.copyFileSync(audioPath, path.join(packageDir, audioFilename));

  let playbackFilename = null;
  if (playbackFormat) playbackFilename = writePlaybackCopy(audioPath, packageDir, playbackFormat);

  const index = {
    contractVersion: CONTRACT_VERSION,
    assetId,
    generatedAt: payload.generatedAt,
    // The file a human should hear. Equals sourceAudio unless the source container is not
    // browser-playable, in which case a transcoded copy sits beside the untouched source.
    playbackAudio: playbackFilename ?? audioFilename,
    sourceAudio: audioFilename,
    analysis: ANALYSIS_FILENAME,
    recording: {
      durationSeconds: payload.durationSeconds,
      sourceSampleRateHz: payload.source?.sampleRateHz ?? null,
      analysisSampleRateHz: payload.analysisSampleRateHz,
      frequencyRange: payload.frequencyRange,
    },
    species: {
      label: payload.commonName,
      // Identification is BirdNET's, run on this audio. Everything authoritative about a
      // species -- taxon ids, IUCN status, verification state -- belongs to whatever system
      // owns the species record, not to an acoustic export, so it is deliberately absent.
      birdnetTop: payload.birdnetDetections?.detections?.[0] ?? null,
    },
    validation,
    profile,
    analysisBytes: Buffer.byteLength(serialized),
    // Where these two files go in the production bucket, and the row fields that point at
    // them. The generator cannot know clientId/xpId -- the upload form supplies those -- so
    // it emits the folder segment it CAN derive plus the key pattern to fill in. Matches
    // acousticsFolderKey()/slugifyBirdName() in the XP Acoustics screen's shared module.
    upload: {
      keyPattern: `public/<clientId>/acoustics/<xpId>/${slugifyBirdName(species || payload.commonName || assetId)}/<filename>`,
      // The shape of one entry in the row's additional_information_field `sounds` array.
      // Both values are S3 keys; the screen signs them on demand. Species identification,
      // IUCN status and verification are fields of that row, not of this export.
      soundEntry: {
        audioUrl: `<folder>/${playbackFilename ?? audioFilename}`,
        analysisJsonUrl: `<folder>/${ANALYSIS_FILENAME}`,
      },
    },
    files: [ANALYSIS_FILENAME, audioFilename, playbackFilename].filter(Boolean),
  };
  fs.writeFileSync(path.join(packageDir, INDEX_FILENAME), `${JSON.stringify(index, null, 2)}\n`, "utf8");
  return { index, analysisPath };
}

// Installs a written package into the viewer: audio into app/public/assets/, analysis into
// app/public/data/, plus a manifest entry so it appears in the Audio Source Switch. Uses the
// same tools/lib/manifest.js registry every other exporter writes to.
function publishToApp({ payload, assetId, packageDir, label, audioFilename, playbackFormat }) {
  const dataDir = path.join(ROOT, "app", "public", "data");
  const assetsDir = path.join(ROOT, "app", "public", "assets");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });

  const servedName = playbackFormat ? `${assetId}_playback.${playbackFormat}` : audioFilename;
  const packagedName = playbackFormat ? `playback.${playbackFormat}` : audioFilename;
  fs.copyFileSync(path.join(packageDir, packagedName), path.join(assetsDir, servedName));

  const datasetPath = `/data/dataset_${assetId}.json`;
  fs.writeFileSync(path.join(dataDir, `dataset_${assetId}.json`), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  upsertDataset({
    id: assetId,
    label: label || `Generated — ${payload.commonName}`,
    kind: "field",
    path: datasetPath,
    durationSeconds: payload.durationSeconds,
  });
  return { datasetPath, servedName };
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const audioArg = positional[0];
  if (!audioArg) {
    console.error("Usage: node tools/generate_acoustic_assets.js <audio-file> [--id=] [--label=] [--species=]");
    console.error("       [--analysis-rate=22050] [--out=dir] [--no-birdnet] [--publish] [--force]");
    process.exit(1);
  }
  const audioPath = path.resolve(audioArg);

  const result = await generate({
    audioPath,
    id: typeof flags.id === "string" ? flags.id : undefined,
    label: typeof flags.label === "string" ? flags.label : undefined,
    species: typeof flags.species === "string" ? flags.species : undefined,
    analysisSampleRate: flags["analysis-rate"] ? Number(flags["analysis-rate"]) : undefined,
    outDir: typeof flags.out === "string" ? path.resolve(flags.out) : undefined,
    runBirdnet: !flags["no-birdnet"],
    onProgress: (stage, message) => console.log(`[${stage}] ${message}`),
  });

  const { payload, validation } = result;
  for (const warning of validation.warnings) console.warn(`  warning: ${warning}`);
  for (const error of validation.errors) console.error(`  ERROR: ${error}`);

  if (!validation.ok && !flags.force) {
    console.error("\nValidation failed; nothing was written. Re-run with --force to export anyway.");
    process.exit(2);
  }

  const profile = typeof flags.profile === "string" ? flags.profile : "full";
  if (!PROFILES.includes(profile)) {
    console.error(`Unknown --profile "${profile}". Expected one of: ${PROFILES.join(", ")}`);
    process.exit(1);
  }
  if (profile === "app" && flags.publish) {
    console.warn(
      "  warning: --profile=app omits the fields the local viewer's Sandbox and spectrogram panels read;\n" +
        "           the published dataset will load but those panels will be empty. Use --profile=full for the viewer.",
    );
  }

  const { index } = writePackage({
    ...result,
    audioPath,
    profile,
    species: typeof flags.species === "string" ? flags.species : undefined,
  });
  console.log(`\nPackage written to ${path.relative(ROOT, result.packageDir)} (profile: ${profile})`);
  for (const file of index.files) console.log(`  ${file}`);
  console.log(`  analysis JSON: ${(index.analysisBytes / 1024).toFixed(0)} KB`);
  console.log(
    `\n${payload.pointCount} points · ${payload.durationSeconds.toFixed(2)}s · ` +
      `analysis ${payload.analysisSampleRateHz} Hz · usable band 0-${Math.round(payload.frequencyRange.maxHz)} Hz · ` +
      `PCA variance ${(payload.pcaExplainedVarianceTotal * 100).toFixed(1)}%`,
  );

  if (flags.publish) {
    const published = publishToApp({
      ...result,
      label: typeof flags.label === "string" ? flags.label : undefined,
    });
    console.log(`Published to the viewer as ${published.datasetPath} (audio: /assets/${published.servedName})`);
  }
}

module.exports = {
  generate,
  writePackage,
  publishToApp,
  slug,
  slugifyBirdName,
  toAppProfile,
  PROFILES,
  CONTRACT_VERSION,
  ANALYSIS_FILENAME,
  INDEX_FILENAME,
};

if (require.main === module) main();
