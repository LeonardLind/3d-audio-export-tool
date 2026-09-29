// Tests for tools/lib/synth.js: determinism, ground-truth timing, RMS promises, SNR.
// Run: node --test tools/test/synth.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const synth = require("../lib/synth");
const { stft, binFrequencies } = require("../export_single_recording_dataset");

const SR = 22050;
const ALTERNATIONS = [
  "pitchAlternation",
  "noisinessAlternation",
  "loudnessAlternation",
  "bandwidthAlternation",
  "brightnessAlternation",
];
const ALL = [...ALTERNATIONS, "motifSequence", "whiteNoise", "pinkNoise", "clickTrain"];

function rms(values, start, end) {
  return synth.rmsOf(values, start, end);
}

function relClose(actual, expected, tol, message) {
  assert.ok(Math.abs(actual - expected) <= tol * Math.abs(expected), `${message}: ${actual} vs ${expected}`);
}

// Mean STFT power per bin of a signal (pipeline's own STFT), for spectral ground truth.
function meanPowerSpectrum(samples) {
  const spectra = stft(samples);
  const power = new Float64Array(spectra[0].length);
  for (const spectrum of spectra) for (let k = 0; k < power.length; k += 1) power[k] += spectrum[k] ** 2 / spectra.length;
  return power;
}

function bandPower(power, freqs, lo, hi) {
  let sum = 0;
  let count = 0;
  for (let k = 0; k < power.length; k += 1) if (freqs[k] >= lo && freqs[k] < hi) { sum += power[k]; count += 1; }
  return { sum, perBin: sum / count };
}

test("every generator returns the shared contract", () => {
  for (const name of ALL) {
    const out = synth[name]({ seed: 3, durationSeconds: 4 });
    assert.ok(out.samples instanceof Float32Array, name);
    assert.ok(out.clean instanceof Float32Array, name);
    assert.equal(out.sampleRate, SR, name);
    assert.equal(out.samples.length, Math.round(4 * SR), name);
    assert.ok(out.segments.length > 0, name);
    assert.equal(out.params.generator, name);
    assert.equal(out.params.seed, 3);
    for (const segment of out.segments) {
      for (const key of ["start", "end", "label", "property"]) assert.ok(key in segment, `${name} segment.${key}`);
      assert.ok(Number.isFinite(out.samples[segment.startSample]), name);
    }
  }
});

test("deterministic: same params -> bit-identical, different seed -> different", () => {
  for (const name of ALL) {
    const a = synth[name]({ seed: 11, durationSeconds: 3 });
    const b = synth[name]({ seed: 11, durationSeconds: 3 });
    const c = synth[name]({ seed: 12, durationSeconds: 3 });
    assert.deepEqual(Buffer.from(a.samples.buffer), Buffer.from(b.samples.buffer), `${name} not deterministic`);
    assert.deepEqual(a.segments, b.segments, name);
    assert.notDeepEqual(Buffer.from(a.samples.buffer), Buffer.from(c.samples.buffer), `${name} ignores seed`);
  }
});

test("changing snrDb does not change the clean signal", () => {
  for (const name of [...ALTERNATIONS, "motifSequence", "clickTrain"]) {
    const a = synth[name]({ seed: 5, durationSeconds: 3, snrDb: 40 });
    const b = synth[name]({ seed: 5, durationSeconds: 3, snrDb: 10 });
    const c = synth[name]({ seed: 5, durationSeconds: 3, snrDb: null });
    assert.deepEqual(Buffer.from(a.clean.buffer), Buffer.from(b.clean.buffer), name);
    assert.deepEqual(Buffer.from(a.clean.buffer), Buffer.from(c.clean.buffer), name);
    assert.deepEqual(Buffer.from(c.samples.buffer), Buffer.from(c.clean.buffer), `${name}: snrDb=null must add nothing`);
  }
});

test("SNR is exact: 10*log10(P_signal in segments / P_background) == snrDb", () => {
  for (const name of [...ALTERNATIONS, "motifSequence", "clickTrain"]) {
    for (const snrDb of [0, 20, 40]) {
      const out = synth[name]({ seed: 2, durationSeconds: 4, snrDb });
      let ps = 0;
      let count = 0;
      for (const s of out.segments) {
        for (let i = s.startSample; i < s.startSample + s.lengthSamples; i += 1) { ps += out.clean[i] ** 2; count += 1; }
      }
      ps /= count;
      let pb = 0;
      for (let i = 0; i < out.samples.length; i += 1) pb += (out.samples[i] - out.clean[i]) ** 2;
      pb /= out.samples.length;
      const measured = 10 * Math.log10(ps / pb);
      assert.ok(Math.abs(measured - snrDb) < 0.01, `${name} snr ${snrDb}: measured ${measured}`);
    }
  }
});

test("segment timing: sample-exact, ordered, non-overlapping, silent gaps", () => {
  for (const name of [...ALTERNATIONS, "motifSequence", "clickTrain"]) {
    const out = synth[name]({ seed: 4, durationSeconds: 5, snrDb: null });
    let previousEnd = 0;
    const inside = new Uint8Array(out.clean.length);
    for (const s of out.segments) {
      assert.equal(s.start, s.startSample / SR, name);
      assert.equal(s.end, (s.startSample + s.lengthSamples) / SR, name);
      assert.ok(s.start >= previousEnd, `${name}: overlap at ${s.start}`);
      assert.ok(s.end <= 5, name);
      previousEnd = s.end;
      for (let i = s.startSample; i < s.startSample + s.lengthSamples; i += 1) inside[i] = 1;
      assert.ok(rms(out.clean, s.startSample, s.startSample + s.lengthSamples) > 0, `${name}: empty segment`);
    }
    for (let i = 0; i < out.clean.length; i += 1) if (!inside[i]) assert.equal(out.clean[i], 0, `${name}: signal outside segments at ${i}`);
  }
});

test("alternations: labels alternate A/B, burst length and gap as specified", () => {
  const out = synth.pitchAlternation({ seed: 1, durationSeconds: 5, toneSeconds: 0.3, gapSeconds: 0.2 });
  out.segments.forEach((s, i) => {
    assert.equal(s.label, i % 2 === 0 ? "low" : "high");
    assert.equal(s.lengthSamples, Math.round(0.3 * SR));
    if (i > 0) assert.ok(Math.abs(s.start - out.segments[i - 1].start - 0.5) <= 1 / SR);
  });
  const random = synth.pitchAlternation({ seed: 1, durationSeconds: 10, order: "random" });
  const counts = { low: 0, high: 0 };
  for (const s of random.segments) counts[s.label] += 1;
  assert.ok(Math.abs(counts.low - counts.high) <= 1, JSON.stringify(counts));
});

test("equal RMS where promised (clean signal, per segment)", () => {
  for (const name of ["pitchAlternation", "noisinessAlternation", "bandwidthAlternation", "brightnessAlternation"]) {
    const out = synth[name]({ seed: 9, durationSeconds: 5 });
    for (const s of out.segments) {
      relClose(rms(out.clean, s.startSample, s.startSample + s.lengthSamples), 0.1, 1e-5, `${name} ${s.label}`);
    }
  }
  const loud = synth.loudnessAlternation({ seed: 9, durationSeconds: 5, levelDifferenceDb: 12 });
  const levels = { loud: [], quiet: [] };
  for (const s of loud.segments) levels[s.label].push(rms(loud.clean, s.startSample, s.startSample + s.lengthSamples));
  const diffDb = 20 * Math.log10(levels.loud[0] / levels.quiet[0]);
  assert.ok(Math.abs(diffDb - 12) < 1e-4, `loudness diff ${diffDb} dB`);
  for (const v of levels.loud) relClose(v, 0.1, 1e-5, "loud");
  const motifs = synth.motifSequence({ seed: 9, durationSeconds: 10 });
  for (const s of motifs.segments) relClose(rms(motifs.clean, s.startSample, s.startSample + s.lengthSamples), s.targetRms, 1e-5, `motif ${s.label}`);
  for (const name of ["whiteNoise", "pinkNoise"]) relClose(rms(synth[name]({ seed: 9, durationSeconds: 3 }).samples), 0.1, 1e-5, name);
});

test("spectral ground truth: tones and bands sit where the params say", () => {
  const freqs = binFrequencies(SR);
  const binHz = SR / 1024;
  // Pure tones: the dominant bin of the burst matches the requested frequency within 1 bin.
  const pitch = synth.pitchAlternation({ seed: 1, durationSeconds: 3, snrDb: null });
  for (const s of pitch.segments) {
    const power = meanPowerSpectrum(pitch.clean.subarray(s.startSample, s.startSample + s.lengthSamples));
    let best = 0;
    for (let k = 1; k < power.length; k += 1) if (power[k] > power[best]) best = k;
    assert.ok(Math.abs(freqs[best] - s.value) <= binHz, `tone ${s.value} Hz -> peak ${freqs[best]} Hz`);
  }
  // Band noise: >= 99% of power inside the requested band (+-2 bins of Hamming leakage).
  const band = synth.bandwidthAlternation({ seed: 1, durationSeconds: 3, snrDb: null });
  for (const s of band.segments) {
    const power = meanPowerSpectrum(band.clean.subarray(s.startSample, s.startSample + s.lengthSamples));
    const total = power.reduce((a, b) => a + b, 0);
    const inBand = bandPower(power, freqs, 4000 - s.value / 2 - 2 * binHz, 4000 + s.value / 2 + 2 * binHz).sum;
    assert.ok(inBand / total > 0.99, `${s.label}: in-band fraction ${inBand / total}`);
  }
  // Brightness: the highpass state has more power above the cutoff than below, lowpass the reverse.
  const bright = synth.brightnessAlternation({ seed: 1, durationSeconds: 3, snrDb: null });
  for (const s of bright.segments) {
    const power = meanPowerSpectrum(bright.clean.subarray(s.startSample, s.startSample + s.lengthSamples));
    const below = bandPower(power, freqs, 0, 3000).sum;
    const above = bandPower(power, freqs, 3000, SR / 2 + 1).sum;
    if (s.label === "bright") assert.ok(above > 3 * below, `bright above/below ${above / below}`);
    else assert.ok(below > 3 * above, `dark below/above ${below / above}`);
  }
});

test("white noise is flat and pink noise falls ~3 dB/octave", () => {
  const freqs = binFrequencies(SR);
  const white = meanPowerSpectrum(synth.whiteNoise({ seed: 1, durationSeconds: 20 }).samples);
  const pink = meanPowerSpectrum(synth.pinkNoise({ seed: 1, durationSeconds: 20 }).samples);
  // Two bands 4 octaves apart: expected per-bin power ratio 1 (white) and 2^4 = 12.04 dB (pink).
  const ratioDb = (p) => 10 * Math.log10(bandPower(p, freqs, 250, 500).perBin / bandPower(p, freqs, 4000, 8000).perBin);
  assert.ok(Math.abs(ratioDb(white)) < 1, `white ratio ${ratioDb(white)} dB`);
  assert.ok(Math.abs(ratioDb(pink) - 12.04) < 1.5, `pink ratio ${ratioDb(pink)} dB`);
});

test("motifSequence: balanced seeded order, jitter within bounds, gaps within range", () => {
  const out = synth.motifSequence({ seed: 21, durationSeconds: 30 });
  const ids = Object.keys(synth.MOTIF_TYPES);
  const counts = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const s of out.segments) counts[s.label] += 1;
  const values = Object.values(counts);
  assert.ok(Math.max(...values) - Math.min(...values) <= 1, JSON.stringify(counts));
  assert.ok(out.segments.length >= 3 * ids.length, `only ${out.segments.length} motifs`);
  out.segments.forEach((s, i) => {
    const { pitchFactor, durationFactor, levelDb } = s.jitter;
    assert.ok(Math.abs(pitchFactor - 1) <= 0.03 && Math.abs(durationFactor - 1) <= 0.1 && Math.abs(levelDb) <= 3);
    assert.equal(s.lengthSamples, Math.round(synth.MOTIF_TYPES[s.label].baseSeconds * durationFactor * SR));
    if (i > 0) {
      const gap = s.start - out.segments[i - 1].end;
      assert.ok(gap >= 0.15 - 2 / SR && gap <= 0.4 + 2 / SR, `gap ${gap}`);
    }
  });
  const subset = synth.motifSequence({ seed: 21, durationSeconds: 10, motifs: ["whistle", "buzz"] });
  assert.ok(subset.segments.every((s) => s.label === "whistle" || s.label === "buzz"));
  assert.throws(() => synth.motifSequence({ motifs: ["nope"] }));
});

test("clickTrain: one click per known time, energy starts at the onset", () => {
  const out = synth.clickTrain({ seed: 1, durationSeconds: 3, clicksPerSecond: 4, snrDb: null });
  const expected = [];
  for (let t = 0.25; t + 0.002 <= 3; t += 0.25) expected.push(t);
  assert.equal(out.segments.length, expected.length);
  out.segments.forEach((s, i) => {
    assert.equal(s.startSample, Math.round(expected[i] * SR));
    relClose(rms(out.clean, s.startSample, s.startSample + s.lengthSamples), 0.3, 1e-5, "click rms");
  });
  const explicit = synth.clickTrain({ times: [0.5, 1.25, 2.0], durationSeconds: 3 });
  assert.deepEqual(explicit.segments.map((s) => s.value), [0.5, 1.25, 2.0]);
});

test("invalid parameters are rejected", () => {
  assert.throws(() => synth.pitchAlternation({ frequenciesHz: [4000, 2000] }));
  assert.throws(() => synth.bandwidthAlternation({ centreHz: 10000, wideBandwidthHz: 4000 }));
  assert.throws(() => synth.noisinessAlternation({ noiseFraction: 1 }));
  assert.throws(() => synth.whiteNoise({ seed: 1.5 }));
  assert.throws(() => synth.whiteNoise({ snrDb: Number.NaN }));
  assert.throws(() => synth.clickTrain({ times: [5], durationSeconds: 3 }));
  assert.throws(() => synth.clickTrain({ times: [-0.1], durationSeconds: 3 }));
  assert.throws(() => synth.clickTrain({ times: [1, 0.5], durationSeconds: 3 }));
  assert.throws(() => synth.clickTrain({ times: [1, 1.0005], durationSeconds: 3 }));
});
