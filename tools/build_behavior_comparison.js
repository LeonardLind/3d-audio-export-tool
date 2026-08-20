// EXPERIMENTAL "Bird Vocalization Behavior Comparison" builder.
//
// Processes every recording in Assets/Multi-sample-Same-audio/, classifies each into one of
// four broad behavioural categories from its acoustics (tools/lib/behavior.js), places all
// recordings into ONE SHARED 3D feature space (a single PCA fit across the pooled windows of
// every recording -- this is the D-001 methodology: fit one shared model, THEN combine, so
// category shapes are actually comparable), and computes a covariance-ellipsoid "average
// shape" per category. Writes app/public/data/behavior_comparison.json for the app's
// Behavior mode.
//
// This is EXPLORATORY. Classifications are heuristic, not ground truth (see behavior.js).

const fs = require("fs");
const path = require("path");
const { extractContinuousWindows } = require("./export_single_recording_dataset");
const { reduceFeatures } = require("./lib/reducers");
const { summaryFeatures, classifyAll, covarianceEllipsoid, CATEGORIES } = require("./lib/behavior");

const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "Assets", "Multi-sample-Same-audio");
const MANIFEST = path.join(SRC_DIR, "manifest.json");
const OUT_JSON = path.join(ROOT, "app", "public", "data", "behavior_comparison.json");
const OUT_AUDIO_DIR = path.join(ROOT, "app", "public", "assets", "behavior");

const WINDOWS_PER_RECORDING = 30; // loudest N windows pooled per recording for the shared PCA
const POSITION_SPREAD = 6;

// Category colors -- single source of truth, read by the app so overview/compare/legend all
// agree. Distinct hues, reasonably colorblind-separable.
const CATEGORY_COLORS = {
  territorial: "#f0553a",
  courtship: "#c07cff",
  social: "#3ba7ff",
  alarm: "#ffd23d",
};

function main() {
  if (!fs.existsSync(MANIFEST)) {
    console.error(`Manifest not found: ${MANIFEST}. Run tools/download_xeno_canto.js first.`);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  fs.mkdirSync(OUT_AUDIO_DIR, { recursive: true });

  // 1. Extract windows + analysis for every recording.
  const recordings = [];
  const pooled = []; // { recIndex, rawFeature }
  manifest.forEach((entry, i) => {
    const audioPath = path.join(SRC_DIR, entry.file);
    if (!fs.existsSync(audioPath)) {
      console.warn(`  skip ${entry.file} (missing)`);
      return;
    }
    process.stdout.write(`  [${i + 1}/${manifest.length}] ${entry.file} ... `);
    const extracted = extractContinuousWindows(audioPath);
    const features = summaryFeatures(extracted);

    // Subsample the loudest WINDOWS_PER_RECORDING windows for the shared PCA pool.
    const sorted = extracted.windows.slice().sort((a, b) => b.amplitude - a.amplitude);
    const chosen = sorted.slice(0, WINDOWS_PER_RECORDING);
    const recIndex = recordings.length;
    for (const w of chosen) pooled.push({ recIndex, rawFeature: w.rawFeature });

    recordings.push({
      id: entry.file,
      xenoCantoId: entry.xenoCantoId,
      sourceUrl: entry.sourceUrl,
      recordist: entry.recordist,
      license: entry.license,
      xcType: entry.xcType || "unknown",
      audioUrl: `/assets/behavior/${entry.file}`,
      durationSeconds: extracted.durationSeconds,
      features,
      pooledCount: chosen.length,
    });
    fs.copyFileSync(audioPath, path.join(OUT_AUDIO_DIR, entry.file));
    console.log(`${extracted.windows.length} windows, ${chosen.length} pooled`);
  });

  // 2. ONE shared PCA across every recording's pooled windows -> comparable coordinates.
  console.log(`\nFitting shared PCA over ${pooled.length} pooled windows (${recordings.length} recordings)...`);
  const { embedding, details } = reduceFeatures(pooled.map((p) => p.rawFeature), { method: "pca", dimensions: 3 });

  // Scale the whole shared cloud once (uniform scale keeps categories comparable).
  let maxAbs = 1e-9;
  for (const e of embedding) for (const v of e) maxAbs = Math.max(maxAbs, Math.abs(v));
  const scale = POSITION_SPREAD / maxAbs;
  const scaled = embedding.map((e) => e.map((v) => v * scale));

  // 3. Split embedded points back per recording.
  recordings.forEach((rec) => (rec.points = []));
  pooled.forEach((p, i) => recordings[p.recIndex].points.push(scaled[i].map((v) => Number(v.toFixed(4)))));
  recordings.forEach((rec) => {
    rec.meanPos = [0, 1, 2].map((d) => rec.points.reduce((s, p) => s + p[d], 0) / Math.max(1, rec.points.length));
  });

  // 4. Classify every recording (acoustics only -- independent of the 3D shape above).
  const classifications = classifyAll(recordings.map((r) => r.features));
  recordings.forEach((rec, i) => Object.assign(rec, classifications[i]));

  // 5. Per-category aggregation + covariance-ellipsoid "average shape".
  const categories = CATEGORIES.map((cat) => {
    const members = recordings.filter((r) => r.category === cat.id);
    const points = members.flatMap((r) => r.points);
    const ellipsoid = covarianceEllipsoid(points);
    const centroid = ellipsoid ? ellipsoid.center : [0, 0, 0];
    let representativeId = null;
    let best = Infinity;
    for (const r of members) {
      const dist = Math.hypot(r.meanPos[0] - centroid[0], r.meanPos[1] - centroid[1], r.meanPos[2] - centroid[2]);
      if (dist < best) {
        best = dist;
        representativeId = r.id;
      }
    }
    return {
      id: cat.id,
      name: cat.name,
      color: CATEGORY_COLORS[cat.id],
      count: members.length,
      recordingIds: members.map((r) => r.id),
      centroid: centroid.map((v) => Number(v.toFixed(4))),
      ellipsoidMatrix: ellipsoid ? ellipsoid.matrix.map((v) => Number(v.toFixed(4))) : null,
      representativeId,
      meanConfidence: members.length ? Number((members.reduce((s, r) => s + r.confidence, 0) / members.length).toFixed(3)) : 0,
    };
  });

  // Strip the heavy per-window rawFeature; keep only what the app needs.
  const outRecordings = recordings.map((r) => ({
    id: r.id,
    xenoCantoId: r.xenoCantoId,
    sourceUrl: r.sourceUrl,
    recordist: r.recordist,
    license: r.license,
    xcType: r.xcType,
    audioUrl: r.audioUrl,
    durationSeconds: Number(r.durationSeconds.toFixed(2)),
    category: r.category,
    categoryName: r.categoryName,
    confidence: r.confidence,
    scores: r.scores,
    drivers: r.drivers,
    points: r.points,
    meanPos: r.meanPos.map((v) => Number(v.toFixed(4))),
    features: Object.fromEntries(Object.entries(r.features).map(([k, v]) => [k, Number(v.toFixed(4))])),
  }));

  const payload = {
    kind: "behavior-comparison",
    generatedFrom: "Assets/Multi-sample-Same-audio/",
    species: "Horornis acanthizoides (Yellowish-bellied Bush Warbler)",
    recordingCount: recordings.length,
    sharedPcaExplainedVariance: Number(details.explainedVarianceTotal.toFixed(4)),
    windowsPerRecording: WINDOWS_PER_RECORDING,
    framing:
      "EXPLORATORY. Behavioural categories are assigned by a transparent acoustic heuristic (not a trained model, no ground-truth labels); confidence is a softened softmax over 4 category scores. All recordings are the same species, so most are expected to fall in song-related categories. The 'xcType' field is the independent recordist-supplied tag, shown as a cross-check.",
    categories,
    recordings: outRecordings,
  };
  fs.writeFileSync(OUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`\nShared PCA explained variance (top 3): ${(details.explainedVarianceTotal * 100).toFixed(1)}%`);
  console.log("Category distribution (acoustic heuristic):");
  for (const c of categories) console.log(`  ${c.name}: ${c.count} (mean confidence ${c.meanConfidence})`);
  console.log("\nHeuristic vs. recordist XC type (cross-check):");
  for (const r of outRecordings) {
    console.log(`  ${r.id.padEnd(34)} -> ${r.categoryName.padEnd(28)} ${(r.confidence * 100).toFixed(0)}%   [XC: ${r.xcType}]`);
  }
  console.log(`\nWrote ${path.relative(ROOT, OUT_JSON)}`);
}

main();
