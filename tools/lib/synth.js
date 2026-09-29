// Deterministic, seeded synthetic test signals WITH GROUND TRUTH (v2.0).
//
// Why this exists: v2.0 wants to say things about real recordings ("front-to-back mostly
// means noisiness", "these two moments sound alike"). A claim like that is only testable
// on a signal where the answer is known in advance. Every generator here builds such a
// signal: it varies ONE named acoustic property between labelled segments (or, for the
// negative controls, varies nothing at all) and returns the segment timing as ground truth.
// These signals can be run through the SHIPPED pipeline unchanged via
// runContinuousSamplingPipelineOnSamples / computeContinuousFrontEnd in
// tools/export_single_recording_dataset.js.
//
// Contract, shared by every generator:
//   input   { seed, durationSeconds, snrDb, sampleRate, ...generator-specific }
//   output  { samples: Float32Array,     // clean signal + background noise, mono
//             clean:   Float32Array,     // the signal before background noise was added
//             sampleRate,
//             segments: [{ start, end, label, property, value, ... }],  // seconds
//             params }                   // every resolved parameter, incl. defaults
//
// Definitions (so numbers derived from these signals can be stated precisely):
//   - Segment timing is exact to the sample: start = startSample / sampleRate,
//     end = (startSample + lengthSamples) / sampleRate.
//   - "Equal RMS" means each segment's CLEAN samples (envelope included) are scaled so that
//     sqrt(mean(x^2)) over the segment equals the target exactly (up to float32 rounding).
//   - snrDb: background noise is white Gaussian noise over the whole file, scaled so that
//     10*log10(P_signal / P_background) = snrDb exactly, where P_signal is the mean clean
//     power over the samples inside segments and P_background the mean background power
//     over the whole file. snrDb = null (or Infinity) adds no background. The background
//     uses its own random stream, so changing snrDb never changes the signal itself.
//   - Determinism: same params -> bit-identical output (mulberry32 PRNG + Box-Muller; no
//     Math.random, no time dependence).
//
// Nothing in this file is a claim about birds. The motif shapes in motifSequence are
// simplified caricatures of common passerine note types (whistle, trill, buzz, two-note,
// upsweep) chosen to be spectro-temporally distinct; they are test fixtures, not models.

const DEFAULTS = {
  seed: 1,
  durationSeconds: 10,
  snrDb: 40,
  sampleRate: 22050,
  rms: 0.1,
};

// --- random numbers ---------------------------------------------------------------------

// mulberry32: small, fast, well-distributed 32-bit PRNG. Returns floats in [0, 1).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seed) {
  const uniform = mulberry32(seed);
  let spare = null;
  function gaussian() {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    let u = 0;
    while (u <= 1e-300) u = uniform();
    const v = uniform();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }
  return {
    uniform,
    gaussian,
    range: (lo, hi) => lo + (hi - lo) * uniform(),
  };
}

// Independent streams from one user seed (signal jitter vs background noise).
const STREAM_SIGNAL = 0x51a7;
const STREAM_BACKGROUND = 0xb6c3;
function streamSeed(seed, stream) {
  return (Math.imul((seed >>> 0) ^ 0x9e3779b9, 0x85ebca6b) ^ stream) >>> 0;
}

// --- small DSP helpers ------------------------------------------------------------------

function rmsOf(values, start = 0, end = values.length) {
  let energy = 0;
  for (let i = start; i < end; i += 1) energy += values[i] * values[i];
  return end > start ? Math.sqrt(energy / (end - start)) : 0;
}

function scaleToRms(values, targetRms) {
  const current = rmsOf(values);
  const gain = current > 0 ? targetRms / current : 0;
  for (let i = 0; i < values.length; i += 1) values[i] *= gain;
  return values;
}

// Raised-cosine attack/release so bursts do not start with a broadband step (which would
// itself change noisiness/flux and confound the property under test).
function applyRamps(values, rampSamples) {
  const n = values.length;
  const ramp = Math.min(rampSamples, Math.floor(n / 2));
  for (let i = 0; i < ramp; i += 1) {
    const g = 0.5 - 0.5 * Math.cos((Math.PI * i) / ramp);
    values[i] *= g;
    values[n - 1 - i] *= g;
  }
  return values;
}

function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

// In-place iterative radix-2 complex FFT. inverse=true computes the unscaled inverse; the
// caller divides by N. Only used to spectrally shape noise.
function fftInPlace(re, im, inverse) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (sign * 2 * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let j = 0; j < len / 2; j += 1) {
        const aRe = re[i + j];
        const aIm = im[i + j];
        const bRe = re[i + j + len / 2] * curRe - im[i + j + len / 2] * curIm;
        const bIm = re[i + j + len / 2] * curIm + im[i + j + len / 2] * curRe;
        re[i + j] = aRe + bRe;
        im[i + j] = aIm + bIm;
        re[i + j + len / 2] = aRe - bRe;
        im[i + j + len / 2] = aIm - bIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

// Gaussian noise of `length` samples whose amplitude spectrum is multiplied by
// weight(frequencyHz). Shaping is done on a power-of-two buffer (circular), then truncated,
// then scaled to unit RMS. weight is symmetric in |f|, so the output is real.
function shapedNoise(rng, length, sampleRate, weight) {
  const n = nextPow2(Math.max(2, length));
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i += 1) re[i] = rng.gaussian();
  fftInPlace(re, im, false);
  for (let k = 0; k < n; k += 1) {
    const f = (Math.min(k, n - k) * sampleRate) / n;
    const w = weight(f);
    re[k] *= w;
    im[k] *= w;
  }
  fftInPlace(re, im, true);
  const out = new Float64Array(length);
  for (let i = 0; i < length; i += 1) out[i] = re[i] / n;
  return scaleToRms(out, 1);
}

function bandWeight(loHz, hiHz) {
  return (f) => (f >= loHz && f <= hiHz ? 1 : 0);
}

// Tone with an arbitrary instantaneous-frequency function (Hz at time t seconds) and
// optional harmonics (relative amplitudes of harmonics 1..n; any partial at or above
// Nyquist is omitted rather than aliased). Phase is accumulated so FM/chirps stay smooth.
function toneWithFrequency(length, sampleRate, frequencyAt, harmonics = [1], startPhase = 0) {
  const out = new Float64Array(length);
  const nyquist = sampleRate / 2;
  let phase = startPhase;
  for (let i = 0; i < length; i += 1) {
    const f = frequencyAt(i / sampleRate);
    let value = 0;
    for (let h = 0; h < harmonics.length; h += 1) {
      if ((h + 1) * f >= nyquist) break;
      value += harmonics[h] * Math.sin((h + 1) * phase);
    }
    out[i] = value;
    phase += (2 * Math.PI * f) / sampleRate;
  }
  return out;
}

function dbToGain(db) {
  return 10 ** (db / 20);
}

function resolveCommon(options, extraDefaults) {
  const given = Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined));
  const params = { ...DEFAULTS, ...extraDefaults, ...given };
  if (!Number.isInteger(params.seed)) throw new Error(`seed must be an integer, got ${params.seed}`);
  if (!(params.durationSeconds > 0)) throw new Error("durationSeconds must be > 0");
  if (!(params.sampleRate > 0)) throw new Error("sampleRate must be > 0");
  if (params.snrDb !== null && params.snrDb !== Infinity && !Number.isFinite(params.snrDb)) {
    throw new Error("snrDb must be a finite number, null or Infinity");
  }
  return params;
}

function checkBand(loHz, hiHz, sampleRate, what) {
  if (!(loHz >= 0 && hiHz > loHz && hiHz <= sampleRate / 2)) {
    throw new Error(`${what}: band ${loHz}-${hiHz} Hz must lie within 0-${sampleRate / 2} Hz`);
  }
}

// Writes `burst` into `clean` at startSample and returns the exact segment record.
function place(clean, burst, startSample, sampleRate, segmentFields) {
  for (let i = 0; i < burst.length && startSample + i < clean.length; i += 1) clean[startSample + i] += burst[i];
  const lengthSamples = Math.min(burst.length, clean.length - startSample);
  // Built by explicit assignment, not `{ start, ..., ...segmentFields }`: with the spread
  // literal, segment.start/end were intermittently overwritten by a LATER segment's value
  // (identical inputs, different output) on Node v24.21.0 under CPU load -- 2 of 180
  // stress runs, 0 of 180 with NODE_OPTIONS=--no-maglev. Suspected V8 Maglev bug, not
  // isolated further. finish() also re-checks every segment against its integer samples.
  const segment = {};
  segment.start = startSample / sampleRate;
  segment.end = (startSample + lengthSamples) / sampleRate;
  segment.startSample = startSample;
  segment.lengthSamples = lengthSamples;
  for (const key of Object.keys(segmentFields)) segment[key] = segmentFields[key];
  return segment;
}

// Integrity check: segment times must equal their integer sample positions exactly. Guards
// the ground truth against the intermittent corruption described in place().
function assertSegmentTiming(segments, sampleRate) {
  for (const segment of segments) {
    const start = segment.startSample / sampleRate;
    const end = (segment.startSample + segment.lengthSamples) / sampleRate;
    if (segment.start !== start || segment.end !== end) {
      throw new Error(
        `synth: segment timing corrupted (start ${segment.start} != ${start} or end ${segment.end} != ${end}); refusing to return wrong ground truth`,
      );
    }
  }
}

// Adds background noise at the requested SNR and packages the result.
function finish(clean64, params, segments, { backgroundApplicable = true } = {}) {
  assertSegmentTiming(segments, params.sampleRate);
  const n = clean64.length;
  const background = new Float64Array(n);
  let signalPower = 0;
  let inside = 0;
  for (const segment of segments) {
    for (let i = segment.startSample; i < segment.startSample + segment.lengthSamples; i += 1) {
      signalPower += clean64[i] * clean64[i];
      inside += 1;
    }
  }
  signalPower = inside > 0 ? signalPower / inside : 0;

  let backgroundRms = 0;
  const addBackground = backgroundApplicable && params.snrDb !== null && params.snrDb !== Infinity;
  if (addBackground && signalPower > 0) {
    const rng = makeRng(streamSeed(params.seed, STREAM_BACKGROUND));
    for (let i = 0; i < n; i += 1) background[i] = rng.gaussian();
    backgroundRms = Math.sqrt(signalPower / 10 ** (params.snrDb / 10));
    scaleToRms(background, backgroundRms);
  }

  const samples = new Float32Array(n);
  const clean = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    clean[i] = clean64[i];
    samples[i] = clean64[i] + background[i];
  }
  return {
    samples,
    clean,
    sampleRate: params.sampleRate,
    segments,
    params: {
      ...params,
      backgroundApplied: addBackground && signalPower > 0,
      backgroundType: addBackground ? "white-gaussian" : null,
      signalPowerInSegments: signalPower,
      backgroundRms,
    },
  };
}

// Shared layout for the two-state alternation generators: bursts of toneSeconds separated
// by gapSeconds, starting at leadSeconds, labelled A/B in alternating (default) or seeded
// random balanced order. makeBurst(state, lengthSamples, rng) returns a Float64Array.
function alternation(params, states, makeBurst) {
  const { sampleRate, durationSeconds, toneSeconds, gapSeconds, leadSeconds, rampSeconds } = params;
  const total = Math.round(durationSeconds * sampleRate);
  const clean = new Float64Array(total);
  const rng = makeRng(streamSeed(params.seed, STREAM_SIGNAL));
  const burstSamples = Math.round(toneSeconds * sampleRate);
  const rampSamples = Math.round(rampSeconds * sampleRate);

  const starts = [];
  for (let t = leadSeconds; t + toneSeconds <= durationSeconds - leadSeconds + 1e-9; t += toneSeconds + gapSeconds) {
    starts.push(Math.round(t * sampleRate));
  }
  let order = starts.map((_, i) => i % 2);
  if (params.order === "random") order = balancedShuffle(starts.length, 2, rng);

  const segments = starts.map((startSample, i) => {
    const state = states[order[i]];
    const burst = makeBurst(state, burstSamples, rng);
    applyRamps(burst, rampSamples);
    scaleToRms(burst, state.rms);
    return place(clean, burst, startSample, sampleRate, {
      label: state.label,
      property: params.property,
      value: state.value,
      targetRms: state.rms,
    });
  });
  return finish(clean, params, segments);
}

// Sequence of `count` items over `k` classes, as balanced as possible, seeded order.
function balancedShuffle(count, k, rng) {
  const out = [];
  while (out.length < count) {
    const block = Array.from({ length: k }, (_, i) => i);
    for (let i = block.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng.uniform() * (i + 1));
      [block[i], block[j]] = [block[j], block[i]];
    }
    out.push(...block);
  }
  return out.slice(0, count);
}

const ALTERNATION_DEFAULTS = {
  toneSeconds: 0.3,
  gapSeconds: 0.2,
  leadSeconds: 0.25,
  rampSeconds: 0.01,
  order: "alternate",
};

// (1) Pitch: tone bursts alternating between two fundamentals, equal RMS, same envelope.
// harmonics = relative amplitudes of harmonics 1..n (default [1] = pure tone). NOTE for
// users of the project's HPS pitch tracker (tools/lib/analysis.js): at 22050 Hz / 1024-FFT
// its search tops out at bin floor(513/3) = 171 = ~3682 Hz, and a pure tone gives HPS no
// harmonics to reinforce -- use f0 < ~3.6 kHz with harmonics when testing pitchHz.
function pitchAlternation(options = {}) {
  const params = resolveCommon(options, {
    ...ALTERNATION_DEFAULTS,
    generator: "pitchAlternation",
    property: "pitch",
    frequenciesHz: [2000, 4000],
    harmonics: [1],
  });
  const [lowHz, highHz] = params.frequenciesHz;
  if (!(highHz > lowHz && highHz < params.sampleRate / 2)) throw new Error("frequenciesHz must be [low, high] below Nyquist");
  const states = [
    { label: "low", value: lowHz, rms: params.rms },
    { label: "high", value: highHz, rms: params.rms },
  ];
  return alternation(params, states, (state, length) =>
    toneWithFrequency(length, params.sampleRate, () => state.value, params.harmonics),
  );
}

// (2) Noisiness: pure tone vs tone + broadband (0-Nyquist white) noise, equal total RMS.
// noiseFraction = share of the noisy burst's power that is noise (before exact RMS scaling).
function noisinessAlternation(options = {}) {
  const params = resolveCommon(options, {
    ...ALTERNATION_DEFAULTS,
    generator: "noisinessAlternation",
    property: "noisiness",
    toneHz: 3000,
    noiseFraction: 0.5,
  });
  if (!(params.noiseFraction > 0 && params.noiseFraction < 1)) throw new Error("noiseFraction must be in (0, 1)");
  const states = [
    { label: "tonal", value: 0, rms: params.rms },
    { label: "noisy", value: params.noiseFraction, rms: params.rms },
  ];
  return alternation(params, states, (state, length, rng) => {
    const tone = scaleToRms(toneWithFrequency(length, params.sampleRate, () => params.toneHz), 1);
    if (state.value === 0) return tone;
    const noise = shapedNoise(rng, length, params.sampleRate, () => 1);
    const toneGain = Math.sqrt(1 - state.value);
    const noiseGain = Math.sqrt(state.value);
    const out = new Float64Array(length);
    for (let i = 0; i < length; i += 1) out[i] = toneGain * tone[i] + noiseGain * noise[i];
    return out;
  });
}

// (3) Loudness: the same tone at two levels, levelDifferenceDb apart ("loud" = rms).
function loudnessAlternation(options = {}) {
  const params = resolveCommon(options, {
    ...ALTERNATION_DEFAULTS,
    generator: "loudnessAlternation",
    property: "loudness",
    toneHz: 3000,
    levelDifferenceDb: 12,
  });
  const quietRms = params.rms * dbToGain(-params.levelDifferenceDb);
  const states = [
    { label: "loud", value: 20 * Math.log10(params.rms), rms: params.rms },
    { label: "quiet", value: 20 * Math.log10(quietRms), rms: quietRms },
  ];
  return alternation(params, states, (state, length) => toneWithFrequency(length, params.sampleRate, () => params.toneHz));
}

// (4) Bandwidth: narrow vs wide band-limited noise, same centre frequency, equal RMS.
function bandwidthAlternation(options = {}) {
  const params = resolveCommon(options, {
    ...ALTERNATION_DEFAULTS,
    generator: "bandwidthAlternation",
    property: "bandwidth",
    centreHz: 4000,
    narrowBandwidthHz: 200,
    wideBandwidthHz: 4000,
  });
  const { centreHz, narrowBandwidthHz, wideBandwidthHz, sampleRate } = params;
  checkBand(centreHz - wideBandwidthHz / 2, centreHz + wideBandwidthHz / 2, sampleRate, "bandwidthAlternation wide");
  checkBand(centreHz - narrowBandwidthHz / 2, centreHz + narrowBandwidthHz / 2, sampleRate, "bandwidthAlternation narrow");
  const states = [
    { label: "narrow", value: narrowBandwidthHz, rms: params.rms },
    { label: "wide", value: wideBandwidthHz, rms: params.rms },
  ];
  return alternation(params, states, (state, length, rng) =>
    shapedNoise(rng, length, sampleRate, bandWeight(centreHz - state.value / 2, centreHz + state.value / 2)),
  );
}

// (5) Brightness: lowpass- vs highpass-weighted noise (2nd-order Butterworth magnitude
// responses at cutoffHz, energy below minHz removed), equal RMS.
function brightnessAlternation(options = {}) {
  const params = resolveCommon(options, {
    ...ALTERNATION_DEFAULTS,
    generator: "brightnessAlternation",
    property: "brightness",
    cutoffHz: 3000,
    minHz: 50,
  });
  const { cutoffHz, minHz, sampleRate } = params;
  checkBand(minHz, cutoffHz, sampleRate, "brightnessAlternation");
  const lowpass = (f) => (f < minHz ? 0 : 1 / Math.sqrt(1 + (f / cutoffHz) ** 4));
  const highpass = (f) => (f < minHz ? 0 : (f / cutoffHz) ** 2 / Math.sqrt(1 + (f / cutoffHz) ** 4));
  const states = [
    { label: "dark", value: "lowpass", rms: params.rms, weight: lowpass },
    { label: "bright", value: "highpass", rms: params.rms, weight: highpass },
  ];
  return alternation(params, states, (state, length, rng) => shapedNoise(rng, length, sampleRate, state.weight));
}

// (6) Motif sequence: K motif types with per-instance jitter, seeded balanced random order.
// Every instance is scaled to the same nominal RMS (then jittered by levelJitterDb), so the
// motif type is not confounded with loudness.
const MOTIF_TYPES = {
  whistle: {
    description: "steady pure tone",
    baseSeconds: 0.25,
    render: (length, sr, p) => toneWithFrequency(length, sr, () => 3000 * p),
  },
  trill: {
    description: "sinusoidal FM trill (carrier 3500 Hz, depth +-700 Hz, 20 Hz rate)",
    baseSeconds: 0.35,
    render: (length, sr, p) => toneWithFrequency(length, sr, (t) => 3500 * p + 700 * p * Math.sin(2 * Math.PI * 20 * t)),
  },
  buzz: {
    description: "band noise 3750-6250 Hz (centre 5000 Hz)",
    baseSeconds: 0.3,
    render: (length, sr, p, rng) => shapedNoise(rng, length, sr, bandWeight(3750 * p, 6250 * p)),
  },
  twoNote: {
    description: "2500 Hz note then 4000 Hz note, 30 ms apart",
    baseSeconds: 0.35,
    render: (length, sr, p) => {
      const out = new Float64Array(length);
      const gap = Math.round(0.03 * sr);
      const half = Math.floor((length - gap) / 2);
      const ramp = Math.round(0.01 * sr);
      const a = applyRamps(toneWithFrequency(half, sr, () => 2500 * p), ramp);
      const b = applyRamps(toneWithFrequency(length - gap - half, sr, () => 4000 * p), ramp);
      out.set(a, 0);
      out.set(b, half + gap);
      return out;
    },
  },
  upsweep: {
    description: "linear chirp 2000 -> 5000 Hz",
    baseSeconds: 0.3,
    render: (length, sr, p) => {
      const seconds = length / sr;
      return toneWithFrequency(length, sr, (t) => (2000 + (3000 * t) / seconds) * p);
    },
  },
};

function motifSequence(options = {}) {
  const params = resolveCommon(options, {
    generator: "motifSequence",
    property: "motif",
    motifs: Object.keys(MOTIF_TYPES),
    pitchJitter: 0.03,
    durationJitter: 0.1,
    levelJitterDb: 3,
    gapSecondsRange: [0.15, 0.4],
    leadSeconds: 0.25,
    rampSeconds: 0.01,
  });
  for (const id of params.motifs) if (!MOTIF_TYPES[id]) throw new Error(`Unknown motif type: ${id}`);
  const { sampleRate, durationSeconds } = params;
  const total = Math.round(durationSeconds * sampleRate);
  const clean = new Float64Array(total);
  const rng = makeRng(streamSeed(params.seed, STREAM_SIGNAL));
  const rampSamples = Math.round(params.rampSeconds * sampleRate);

  const segments = [];
  let t = params.leadSeconds;
  let block = [];
  for (;;) {
    if (block.length === 0) block = balancedShuffle(params.motifs.length, params.motifs.length, rng);
    const id = params.motifs[block.shift()];
    const type = MOTIF_TYPES[id];
    const pitchFactor = 1 + rng.range(-params.pitchJitter, params.pitchJitter);
    const durationFactor = 1 + rng.range(-params.durationJitter, params.durationJitter);
    const levelDb = rng.range(-params.levelJitterDb, params.levelJitterDb);
    const gapSeconds = rng.range(params.gapSecondsRange[0], params.gapSecondsRange[1]);
    const length = Math.round(type.baseSeconds * durationFactor * sampleRate);
    const startSample = Math.round(t * sampleRate);
    if (startSample + length > total - Math.round(params.leadSeconds * sampleRate)) break;
    const burst = applyRamps(type.render(length, sampleRate, pitchFactor, rng), rampSamples);
    const targetRms = params.rms * dbToGain(levelDb);
    scaleToRms(burst, targetRms);
    segments.push(place(clean, burst, startSample, sampleRate, {
      label: id,
      property: "motif",
      value: id,
      targetRms,
      jitter: { pitchFactor, durationFactor, levelDb },
    }));
    t = (startSample + length) / sampleRate + gapSeconds;
  }
  const result = finish(clean, params, segments);
  result.params.motifDescriptions = Object.fromEntries(params.motifs.map((id) => [id, MOTIF_TYPES[id].description]));
  return result;
}

// (7) Stationary noise negative controls. There is no structure to find: one segment spans
// the whole file. snrDb does not apply (the noise IS the signal) and is ignored.
function stationaryNoise(options, generator, weightFactory) {
  const params = resolveCommon(options, { generator, property: "none", minHz: 20 });
  const total = Math.round(params.durationSeconds * params.sampleRate);
  const rng = makeRng(streamSeed(params.seed, STREAM_SIGNAL));
  const noise = shapedNoise(rng, total, params.sampleRate, weightFactory(params));
  scaleToRms(noise, params.rms);
  const segments = [{ start: 0, end: total / params.sampleRate, startSample: 0, lengthSamples: total, label: generator === "whiteNoise" ? "white" : "pink", property: "none", value: null, targetRms: params.rms }];
  return finish(noise, params, segments, { backgroundApplicable: false });
}

function whiteNoise(options = {}) {
  return stationaryNoise(options, "whiteNoise", () => () => 1);
}

// Pink = power spectral density proportional to 1/f (amplitude 1/sqrt(f)) above minHz.
function pinkNoise(options = {}) {
  return stationaryNoise(options, "pinkNoise", ({ minHz }) => (f) => (f < minHz ? 0 : 1 / Math.sqrt(f)));
}

// (8) Click train: short Hann-windowed broadband noise clicks at known onset times
// (every 1/clicksPerSecond from leadSeconds, or an explicit `times` array in seconds).
function clickTrain(options = {}) {
  const params = resolveCommon(options, {
    generator: "clickTrain",
    property: "onset",
    clicksPerSecond: 4,
    times: null,
    clickSeconds: 0.002,
    rms: 0.3,
    leadSeconds: 0.25,
  });
  const { sampleRate, durationSeconds } = params;
  const total = Math.round(durationSeconds * sampleRate);
  const clean = new Float64Array(total);
  const rng = makeRng(streamSeed(params.seed, STREAM_SIGNAL));
  const length = Math.max(2, Math.round(params.clickSeconds * sampleRate));
  let times = params.times;
  if (!times) {
    times = [];
    for (let t = params.leadSeconds; t + params.clickSeconds <= durationSeconds; t += 1 / params.clicksPerSecond) times.push(t);
  }
  // Explicit times must be ascending, non-overlapping and fully inside the file; otherwise a
  // click would be truncated (breaking the RMS promise), produce a negative-length segment,
  // or index before sample 0 (NaN signal power -> NaN background).
  let previousEnd = 0;
  for (const time of times) {
    const startSample = Math.round(time * sampleRate);
    if (!(Number.isFinite(time) && startSample >= previousEnd && startSample + length <= total)) {
      throw new Error(`clickTrain: click at ${time} s must be ascending, non-overlapping and within 0-${durationSeconds} s`);
    }
    previousEnd = startSample + length;
  }
  const segments = times.map((time) => {
    const burst = new Float64Array(length);
    for (let i = 0; i < length; i += 1) {
      burst[i] = rng.gaussian() * (0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 0.5)) / length));
    }
    scaleToRms(burst, params.rms);
    return place(clean, burst, Math.round(time * sampleRate), sampleRate, {
      label: "click",
      property: "onset",
      value: time,
      targetRms: params.rms,
    });
  });
  return finish(clean, params, segments);
}

const GENERATORS = {
  pitchAlternation,
  noisinessAlternation,
  loudnessAlternation,
  bandwidthAlternation,
  brightnessAlternation,
  motifSequence,
  whiteNoise,
  pinkNoise,
  clickTrain,
};

module.exports = {
  ...GENERATORS,
  GENERATORS,
  MOTIF_TYPES,
  DEFAULTS,
  mulberry32,
  makeRng,
  rmsOf,
  shapedNoise,
};
