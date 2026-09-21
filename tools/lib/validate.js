// Pre-export gate. The pipeline is happy to produce a structurally complete payload from
// audio that is silent, truncated, or all-background -- every array is present, the numbers
// are just meaningless. Once such a payload is written into app/public/data/ the app renders
// it without complaint (an empty graph, a NaN axis), and the failure surfaces as "the
// visualization looks wrong" far from its cause. So the export path checks the RESULT, not
// just that the run didn't throw, and refuses on errors.
//
// errors   -> the export is not usable; block it.
// warnings -> the export is usable but something about it is worth knowing before it ships.

// Spectral centroid is an amplitude-weighted mean over bins that stop at the analysis
// Nyquist, so it cannot legitimately exceed it. A small tolerance absorbs rounding.
const CENTROID_TOLERANCE = 1.02;
// Below this the per-recording PCA has barely separated anything and the 3D shape is
// mostly noise -- not wrong, but not worth shipping without a look.
const LOW_PCA_VARIANCE = 0.05;
// Under this the continuous sampler produces too few windows for the shape or the
// syllable statistics to mean much.
const SHORT_DURATION_SECONDS = 2;

function finiteCount(values) {
  let bad = 0;
  for (const value of values) if (!Number.isFinite(value)) bad += 1;
  return bad;
}

function validateExport(payload, { audioFileExists = true } = {}) {
  const errors = [];
  const warnings = [];
  const push = (list, message) => list.push(message);

  // --- audio loaded at all ---
  if (!audioFileExists) push(errors, "Audio file to be exported is missing or unreadable.");
  if (!Number.isFinite(payload.durationSeconds) || payload.durationSeconds <= 0) {
    push(errors, `Invalid recording duration: ${payload.durationSeconds}. Audio may have failed to decode.`);
  } else if (payload.durationSeconds < SHORT_DURATION_SECONDS) {
    push(warnings, `Recording is only ${payload.durationSeconds.toFixed(2)}s; syllable and repetition statistics will be weak.`);
  }

  // --- source metadata (needed for an honest frequency axis downstream) ---
  if (!payload.source) {
    push(warnings, "No source metadata (ffprobe probe failed): frequencyRange.maxHz falls back to the analysis Nyquist and may overstate the real band.");
  } else if (!Number.isFinite(payload.source.sampleRateHz) || payload.source.sampleRateHz <= 0) {
    push(errors, `Source sample rate is invalid: ${payload.source.sampleRateHz}.`);
  } else if (!payload.source.browserPlayable) {
    push(warnings, `Source container "${payload.source.extension}" is not reliably playable in a browser audio element, so the package also carries a transcoded playback copy and audioUrl points at it. The untouched source is kept alongside it.`);
  }

  // --- frequency range ---
  const range = payload.frequencyRange;
  if (!range || !Number.isFinite(range.maxHz) || range.maxHz <= 0) {
    push(errors, "frequencyRange.maxHz is missing or invalid; consumers cannot scale a frequency axis.");
  } else if (range.bandLimited) {
    push(warnings, `Source carries signal only to ${Math.round(range.sourceNyquistHz)} Hz but analysis ran at ${Math.round(range.analysisNyquistHz)} Hz Nyquist. frequencyRange.maxHz is clamped to the source; STFT bins above it are resampling artifacts.`);
  }

  // --- points / spectral centroid series ---
  if (!Array.isArray(payload.points) || payload.points.length === 0) {
    push(errors, "No points were produced. The recording may be silent or entirely below the amplitude filter.");
  } else {
    const centroids = payload.points.map((p) => p.spectralCentroidHz);
    const badCentroids = finiteCount(centroids);
    if (badCentroids > 0) push(errors, `${badCentroids} of ${centroids.length} points have a non-finite spectralCentroidHz.`);
    if (centroids.every((c) => c === 0)) push(errors, "Every point's spectral centroid is 0 Hz; the recording appears to contain no signal.");
    const ceiling = (range?.analysisNyquistHz ?? Infinity) * CENTROID_TOLERANCE;
    const overCeiling = centroids.filter((c) => c > ceiling).length;
    if (overCeiling > 0) push(errors, `${overCeiling} points have a spectral centroid above the analysis Nyquist, which is physically impossible.`);

    const badPositions = payload.points.filter((p) => !Array.isArray(p.position) || p.position.length !== 3 || finiteCount(p.position) > 0).length;
    if (badPositions > 0) push(errors, `${badPositions} points have a non-finite or malformed 3D position.`);
  }

  if (!Number.isFinite(payload.pcaExplainedVarianceTotal)) {
    push(errors, "pcaExplainedVarianceTotal is not a finite number; the reducer did not converge.");
  } else if (payload.pcaExplainedVarianceTotal < LOW_PCA_VARIANCE) {
    push(warnings, `PCA explains only ${(payload.pcaExplainedVarianceTotal * 100).toFixed(1)}% of variance; the 3D shape carries little structure.`);
  }

  // --- per-frame panel series (what the app scrubs against playback) ---
  const panels = payload.panels;
  if (!panels || !Array.isArray(panels.centroidTrack) || panels.centroidTrack.length === 0) {
    push(errors, "panels.centroidTrack is empty; there is no per-frame spectral centroid series to plot.");
  } else {
    const bad = finiteCount(panels.centroidTrack);
    if (bad > 0) push(errors, `${bad} of ${panels.centroidTrack.length} spectral-centroid frames are non-finite.`);
    if (!Number.isFinite(panels.hopSeconds) || panels.hopSeconds <= 0) {
      push(errors, `panels.hopSeconds is invalid (${panels.hopSeconds}); frame indices cannot be converted to timestamps.`);
    }
    if (!Array.isArray(panels.frames) || panels.frames.length !== panels.centroidTrack.length) {
      push(errors, "panels.frames and panels.centroidTrack have different lengths; the series are not aligned.");
    }
  }

  // --- supplementary analysis ---
  if (!payload.analysis) {
    push(warnings, "Supplementary analysis (pitch, syllables, ACI, indices) is missing.");
  } else if (payload.analysis.syllables?.count === 0) {
    push(warnings, "No syllables were segmented; the recording may be continuous noise rather than discrete calls.");
  }

  // --- identity / metadata ---
  if (!payload.audioId) push(errors, "audioId is missing; the export cannot be linked to its assets.");
  if (!payload.audioUrl) push(errors, "audioUrl is missing; the app would have nothing to play.");
  if (!payload.commonName) push(warnings, "No species/caption label was supplied for this recording.");
  if (payload.birdnetDetections === null) {
    push(warnings, "BirdNET classification did not run; species identification is absent from this export.");
  } else if (payload.birdnetDetections && payload.birdnetDetections.detections.length === 0) {
    push(warnings, "BirdNET ran but detected no species above its confidence floor.");
  }

  return { ok: errors.length === 0, errors, warnings };
}

module.exports = { validateExport };
