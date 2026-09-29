// Tests for tools/lib/window_descriptors.js. Every signal is a seeded synthetic control from
// tools/lib/synth.js run through the SHIPPED front end (computeContinuousFrontEnd), so these
// check the descriptors exactly as v2.0 will compute them on real recordings.
// Run: node --test tools/test/window_descriptors.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const synth = require("../lib/synth");
const wd = require("../lib/window_descriptors");
const {
  computeContinuousFrontEnd,
  frameCentroid,
  FFT_SIZE,
  HOP_SIZE,
} = require("../export_single_recording_dataset");

const SR = 22050;

function run(signal) {
  const frontEnd = computeContinuousFrontEnd({ samples: signal.samples, sampleRate: signal.sampleRate });
  const rows = wd.descriptorsFromFrontEnd(frontEnd, { which: "all" });
  const labels = wd.labelWindowsBySegments(rows, signal.segments);
  const byLabel = {};
  rows.forEach((row, i) => {
    if (labels[i]) (byLabel[labels[i]] ??= []).push(row);
  });
  return { frontEnd, rows, labels, byLabel };
}

function meanOf(rows, key) {
  const values = rows.map((row) => row[key]).filter((value) => value !== null);
  assert.ok(values.length > 0, `no values for ${key}`);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Every labelled window of state A is below every labelled window of state B (full
// separation, stronger than comparing means).
function assertSeparated(byLabel, lowLabel, highLabel, key) {
  const lows = byLabel[lowLabel].map((row) => row[key]);
  const highs = byLabel[highLabel].map((row) => row[key]);
  assert.ok(lows.length >= 5 && highs.length >= 5, `too few windows for ${key}`);
  assert.ok(Math.max(...lows) < Math.min(...highs), `${key}: ${lowLabel} max ${Math.max(...lows)} !< ${highLabel} min ${Math.min(...highs)}`);
}

test("alignment: one row per point, windows start at emissionTime and span the exact audio", () => {
  const signal = synth.motifSequence({ seed: 7, durationSeconds: 12 });
  const frontEnd = computeContinuousFrontEnd({ samples: signal.samples, sampleRate: SR });
  const rows = wd.descriptorsFromFrontEnd(frontEnd);
  assert.equal(rows.length, frontEnd.rawPoints.length);
  assert.equal(frontEnd.framesPerPoint, 6);
  const span = ((6 - 1) * HOP_SIZE + FFT_SIZE) / SR; // 3584 samples = 0.16254 s
  rows.forEach((row, i) => {
    const point = frontEnd.rawPoints[i];
    assert.equal(row.emissionTime, point.emissionTime);
    assert.equal(row.startFrame * frontEnd.frameHopSeconds, point.emissionTime);
    assert.equal(row.endFrame - row.startFrame, 6);
    assert.ok(Math.abs(row.endTime - row.startTime - span) < 1e-12);
    // The pipeline's own per-point flux is the mean of the same frame slice -> identical.
    assert.equal(row.flux, point.spectralFlux);
    // The pipeline's per-point centroid uses frameCentroid (different summation order of
    // the same formula) -> equal to floating-point precision.
    assert.ok(Math.abs(row.centroidHz - point.spectralCentroidHz) <= 1e-9 * point.spectralCentroidHz);
  });
  // Recomputing a window by hand from frameCentroid gives the same value.
  const row = rows[Math.floor(rows.length / 2)];
  const freqs = frontEnd.freqs;
  let manual = 0;
  for (let t = row.startFrame; t < row.endFrame; t += 1) manual += frameCentroid(frontEnd.spectra[t], freqs) / 6;
  assert.ok(Math.abs(manual - row.centroidHz) < 1e-6);
  // The standalone path gives identical rows for the same points.
  const standalone = wd.descriptorsFromSamples({ samples: signal.samples, sampleRate: SR, points: frontEnd.rawPoints, framesPerPoint: 6 });
  assert.deepEqual(standalone, rows);
});

test("windows over a gap vs inside a burst: ground-truth labels land on the right windows", () => {
  const signal = synth.loudnessAlternation({ seed: 1, durationSeconds: 6, levelDifferenceDb: 12 });
  const { byLabel, rows, labels } = run(signal);
  // Every labelled window really lies inside its segment in time.
  rows.forEach((row, i) => {
    if (!labels[i]) return;
    const segment = signal.segments.find((s) => s.label === labels[i] && row.startTime >= s.start - 1e-9 && row.endTime <= s.end + 1e-9);
    assert.ok(segment, `window at ${row.startTime} not inside a ${labels[i]} segment`);
  });
  // Loudness: 12 dB apart by construction; the window RMS aggregate recovers it within 0.5 dB
  // at 40 dB SNR.
  const diffDb = 20 * Math.log10(meanOf(byLabel.loud, "rms") / meanOf(byLabel.quiet, "rms"));
  assert.ok(Math.abs(diffDb - 12) < 0.5, `rms difference ${diffDb} dB`);
  assertSeparated(byLabel, "quiet", "loud", "rms");
});

test("brightness: higher tone -> higher centroid/roll-off; zcr ~ 2f/sampleRate", () => {
  const { byLabel } = run(synth.pitchAlternation({ seed: 1, durationSeconds: 8, frequenciesHz: [2000, 4000] }));
  assertSeparated(byLabel, "low", "high", "centroidHz");
  assertSeparated(byLabel, "low", "high", "rolloffHz");
  assert.ok(Math.abs(meanOf(byLabel.low, "zcr") - (2 * 2000) / SR) < 0.002);
  assert.ok(Math.abs(meanOf(byLabel.high, "zcr") - (2 * 4000) / SR) < 0.002);
  // Equal RMS by construction -> equal window rms (within 1%).
  const ratio = meanOf(byLabel.low, "rms") / meanOf(byLabel.high, "rms");
  assert.ok(Math.abs(ratio - 1) < 0.01, `rms ratio ${ratio}`);
});

test("brightness: highpass- vs lowpass-weighted noise -> higher centroid, roll-off, slope", () => {
  for (const snrDb of [null, 40, 20]) {
    const { byLabel } = run(synth.brightnessAlternation({ seed: 2, durationSeconds: 8, snrDb }));
    assertSeparated(byLabel, "dark", "bright", "centroidHz");
    assertSeparated(byLabel, "dark", "bright", "rolloffHz");
    assertSeparated(byLabel, "dark", "bright", "slope");
  }
});

test("pitch: harmonic tones 1 kHz vs 2 kHz -> pitchHz within 3% of truth", () => {
  const { byLabel } = run(synth.pitchAlternation({ seed: 1, durationSeconds: 8, frequenciesHz: [1000, 2000], harmonics: [1, 0.5, 0.25] }));
  for (const [label, truth] of [["low", 1000], ["high", 2000]]) {
    for (const row of byLabel[label]) {
      assert.ok(row.pitchHz !== null, `${label}: unvoiced window`);
      assert.ok(Math.abs(row.pitchHz - truth) <= 0.03 * truth, `${label}: ${row.pitchHz} Hz vs ${truth}`);
    }
  }
  assertSeparated(byLabel, "low", "high", "centroidHz");
});

// Characterisation of a KNOWN LIMITATION of the existing HPS estimator (tools/lib/analysis.js),
// recorded as evidence for DESCRIPTOR_FAMILIES.pitch.caveats. If the estimator is improved
// these assertions will fail -- update the caveat text together with this test.
test("LIMITATION: HPS pitch on pure tones returns sub-harmonics; noise reads as voiced", () => {
  const pure = run(synth.pitchAlternation({ seed: 1, durationSeconds: 8, frequenciesHz: [1000, 2000], snrDb: null }));
  const lowPitch = meanOf(pure.byLabel.low, "pitchHz");
  const highPitch = meanOf(pure.byLabel.high, "pitchHz");
  assert.ok(Math.abs(lowPitch - 1000) > 0.3 * 1000, `pure 1 kHz read as ${lowPitch}`);
  assert.ok(Math.abs(highPitch - 2000) > 0.3 * 2000, `pure 2 kHz read as ${highPitch}`);
  // ...and those wrong pitches are reported as fully voiced (non-null pitchHz is no guarantee).
  assert.ok(meanOf(pure.byLabel.low, "voicedFraction") >= 0.99);
  assert.ok(meanOf(pure.byLabel.high, "voicedFraction") >= 0.99);
  const noisy = run(synth.noisinessAlternation({ seed: 1, durationSeconds: 8 }));
  assert.ok(meanOf(noisy.byLabel.noisy, "voicedFraction") > meanOf(noisy.byLabel.tonal, "voicedFraction"));
  assert.equal(wd.DESCRIPTOR_FAMILIES.pitch.validatedForLabelling, false);
});

test("noisiness: tone + broadband noise vs pure tone at equal RMS -> higher flatness and entropy, lower crest", () => {
  for (const snrDb of [null, 40, 20]) {
    const { byLabel } = run(synth.noisinessAlternation({ seed: 3, durationSeconds: 8, snrDb }));
    assertSeparated(byLabel, "tonal", "noisy", "flatness");
    assertSeparated(byLabel, "tonal", "noisy", "entropy");
    assertSeparated(byLabel, "noisy", "tonal", "crest");
    const ratio = meanOf(byLabel.tonal, "rms") / meanOf(byLabel.noisy, "rms");
    assert.ok(Math.abs(ratio - 1) < 0.01, `rms ratio ${ratio}`);
  }
});

test("width: 4000 Hz vs 200 Hz band noise (same centre, equal RMS) -> higher bandwidthHz", () => {
  for (const snrDb of [null, 40]) {
    const { byLabel } = run(synth.bandwidthAlternation({ seed: 4, durationSeconds: 8, snrDb }));
    assertSeparated(byLabel, "narrow", "wide", "bandwidthHz");
    // Same centre frequency -> centroid differs far less than bandwidth does.
    const centroidGap = Math.abs(meanOf(byLabel.wide, "centroidHz") - meanOf(byLabel.narrow, "centroidHz"));
    const widthGap = meanOf(byLabel.wide, "bandwidthHz") - meanOf(byLabel.narrow, "bandwidthHz");
    assert.ok(centroidGap < widthGap, `centroid gap ${centroidGap} vs width gap ${widthGap}`);
  }
});

// Characterisation of a KNOWN LIMITATION, evidence for DESCRIPTOR_FAMILIES.width.caveats.
test("LIMITATION: bandwidth ordering reverses at 30 and 20 dB SNR (noise floor dominates)", () => {
  for (const snrDb of [30, 20]) {
    const { byLabel } = run(synth.bandwidthAlternation({ seed: 4, durationSeconds: 8, snrDb }));
    assert.ok(meanOf(byLabel.narrow, "bandwidthHz") > meanOf(byLabel.wide, "bandwidthHz"), `snr ${snrDb}`);
  }
});

// Characterisation of a KNOWN LIMITATION, evidence for DESCRIPTOR_FAMILIES.brightness.caveats.
test("LIMITATION: background noise pulls the centroid of a pure 2 kHz tone upward", () => {
  const centroidAt = (snrDb) =>
    meanOf(run(synth.pitchAlternation({ seed: 1, durationSeconds: 8, frequenciesHz: [2000, 4000], snrDb })).byLabel.low, "centroidHz");
  const clean = centroidAt(null);
  const at40 = centroidAt(40);
  const at20 = centroidAt(20);
  assert.ok(Math.abs(clean - 2000) < 150, `clean ${clean}`);
  assert.ok(at40 > clean + 200, `40 dB ${at40} vs clean ${clean}`);
  assert.ok(at20 > 1.5 * clean, `20 dB ${at20} vs clean ${clean}`);
});

test("flatness of stationary white noise matches the Rayleigh expectation (~0.846), not 1", () => {
  const { rows } = run(synth.whiteNoise({ seed: 1, durationSeconds: 8 }));
  const expected = (2 * Math.exp(-0.5772156649015329 / 2)) / Math.sqrt(Math.PI);
  assert.ok(Math.abs(meanOf(rows, "flatness") - expected) < 0.01, `flatness ${meanOf(rows, "flatness")} vs ${expected}`);
});

test("change: FM trill has higher freqMod than a steady whistle; onsets raise ampMod and flux", () => {
  const { byLabel } = run(synth.motifSequence({ seed: 5, durationSeconds: 30, motifs: ["whistle", "trill"] }));
  assertSeparated(byLabel, "whistle", "trill", "freqMod");
  // Onset windows (straddling a burst start) vs fully-inside windows of the same bursts.
  const signal = synth.pitchAlternation({ seed: 1, durationSeconds: 8, snrDb: null });
  const { rows, labels } = run(signal);
  const onsets = rows.filter((row) => signal.segments.some((s) => row.startTime < s.start && row.endTime > s.start + 0.05));
  const steady = rows.filter((_, i) => labels[i] !== null);
  assert.ok(onsets.length >= 5);
  assert.ok(meanOf(onsets, "ampMod") > 5 * meanOf(steady, "ampMod"), `ampMod onset ${meanOf(onsets, "ampMod")} vs steady ${meanOf(steady, "ampMod")}`);
  assert.ok(meanOf(onsets, "flux") > 5 * meanOf(steady, "flux"));
});

test("negative control: stationary white noise gives nearly constant descriptors", () => {
  const { rows } = run(synth.whiteNoise({ seed: 1, durationSeconds: 8 }));
  for (const key of ["centroidHz", "flatness", "entropy", "rms"]) {
    const values = rows.map((row) => row[key]);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
    assert.ok(sd / Math.abs(mean) < 0.05, `${key} coefficient of variation ${sd / mean}`);
  }
});

test("family metadata: every labelling descriptor in exactly one family, units + plain names present, zcr excluded", () => {
  const seen = new Map();
  for (const [family, spec] of Object.entries(wd.DESCRIPTOR_FAMILIES)) {
    assert.ok(spec.name && spec.plain && spec.higher && spec.lower, family);
    for (const [key, descriptor] of Object.entries(spec.descriptors)) {
      assert.ok(!seen.has(key), `${key} in two families`);
      seen.set(key, family);
      assert.ok(descriptor.unit && descriptor.name && descriptor.definition, `${family}.${key}`);
    }
  }
  assert.deepEqual(Object.keys(wd.DESCRIPTOR_FAMILIES), ["brightness", "noisiness", "loudness", "width", "pitch", "peakiness", "tilt", "change"]);
  const expectedLabelling = wd.DESCRIPTOR_KEYS.filter((key) => key !== "zcr" && key !== "voicedFraction");
  assert.deepEqual([...seen.keys()].sort(), expectedLabelling.sort());
  assert.ok(wd.EXCLUDED_FROM_LABELLING.zcr.reason.length > 20);
  assert.ok(!seen.has("zcr"));
  assert.deepEqual(wd.FAMILY_OF, Object.fromEntries(seen));
});

test("out-of-range windows are rejected", () => {
  const signal = synth.whiteNoise({ seed: 1, durationSeconds: 2 });
  const frontEnd = computeContinuousFrontEnd({ samples: signal.samples, sampleRate: SR });
  assert.throws(() =>
    wd.computeWindowDescriptors({ ...frontEnd, points: [{ startFrame: frontEnd.spectra.length - 2 }] }),
  );
});
