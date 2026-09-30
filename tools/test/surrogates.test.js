const test = require("node:test");
const assert = require("node:assert/strict");
const { complexFft, complexIfft } = require("../lib/fft");
const { createStream } = require("../lib/rng");
const { phaseRandomizedSurrogate } = require("../lib/surrogates");

function signal(n) {
  return Float64Array.from({ length: n }, (_, j) => Math.sin(j * 0.31) + 0.2 * Math.cos(j * j * 0.006));
}

function checkSpectrum(input, result) {
  const padded = new Float64Array(result.fftLength);
  padded.set(input);
  const original = complexFft(padded);
  const spectrum = result.spectrum;
  let maxMagnitude = 1;
  let worst = 0;
  for (let k = 0; k < result.fftLength; k += 1) {
    const before = Math.hypot(original.re[k], original.im[k]);
    const after = Math.hypot(spectrum.re[k], spectrum.im[k]);
    maxMagnitude = Math.max(maxMagnitude, before);
    worst = Math.max(worst, Math.abs(after - before));
  }
  assert.ok(worst / maxMagnitude <= 1e-9, `relative magnitude error ${worst / maxMagnitude}`);
  assert.equal(spectrum.re[0], original.re[0]);
  assert.equal(spectrum.im[0], 0);
  if (result.fftLength % 2 === 0) {
    assert.equal(spectrum.re[result.fftLength / 2], original.re[result.fftLength / 2]);
    assert.equal(spectrum.im[result.fftLength / 2], 0);
  }
  for (let k = 1; k <= result.phaseCount; k += 1) {
    assert.equal(spectrum.re[result.fftLength - k], spectrum.re[k]);
    assert.equal(spectrum.im[result.fftLength - k], -spectrum.im[k]);
  }
  const full = complexIfft(spectrum.re, spectrum.im);
  for (let j = 0; j < result.fftLength; j += 1) assert.ok(Math.abs(full.im[j]) <= 1e-9);
  assert.deepEqual(result.samples, full.re.slice(0, input.length));
}

test("padded 007/012 surrogate preserves its full padded spectrum and truncates only after inverse", () => {
  const input = signal(234);
  const stream = createStream(20260721, 0);
  const result = phaseRandomizedSurrogate(input, { seed: 20260721, stream });
  assert.equal(result.transform, "padded");
  assert.equal(result.fftLength, 256);
  assert.equal(result.samples.length, 234);
  assert.equal(result.phaseCount, 127);
  assert.equal(stream.wordsUsed(), 2 * result.phaseCount);
  checkSpectrum(input, result);
});

test("exact 010 surrogate handles odd and even lengths without padding", () => {
  for (const n of [97, 234, 515, 556, 700]) {
    const input = signal(n);
    const result = phaseRandomizedSurrogate(input, { seed: 20260721, subStream: 10001, transform: "exact" });
    assert.equal(result.fftLength, n);
    assert.equal(result.phaseCount, Math.ceil(n / 2) - 1);
    checkSpectrum(input, result);
  }
});

test("phase draws use ascending bins and the requested Philox key", () => {
  const seed = 20260721;
  const subStream = 10001;
  const input = signal(97);
  const result = phaseRandomizedSurrogate(input, { seed, subStream, transform: "exact" });
  const expected = createStream(seed, subStream);
  for (let k = 1; k <= result.phaseCount; k += 1) {
    const phase = expected.nextPhase();
    const magnitude = Math.hypot(result.spectrum.re[k], result.spectrum.im[k]);
    assert.ok(Math.abs(result.spectrum.re[k] - magnitude * Math.cos(phase)) <= 1e-12);
    assert.ok(Math.abs(result.spectrum.im[k] - magnitude * Math.sin(phase)) <= 1e-12);
  }
  assert.deepEqual(result.samples, phaseRandomizedSurrogate(input, { seed, subStream, transform: "exact" }).samples);
  assert.notDeepEqual(result.samples, phaseRandomizedSurrogate(input, { seed: seed + 1, subStream, transform: "exact" }).samples);
  assert.notDeepEqual(result.samples, phaseRandomizedSurrogate(input, { seed, subStream: subStream + 1, transform: "exact" }).samples);
});

test("surrogate rejects missing seeds, conflicting streams and invalid input", () => {
  const input = signal(20);
  assert.throws(() => phaseRandomizedSurrogate(input), /explicit uint32 seed/);
  assert.throws(() => phaseRandomizedSurrogate(input, { seed: 3, stream: createStream(4, 0) }), /requested Philox key/);
  assert.throws(() => phaseRandomizedSurrogate(input, { seed: 3, subStream: 2, stream: createStream(3, 1) }), /requested Philox key/);
  assert.throws(() => phaseRandomizedSurrogate(input, { seed: 3, transform: "unknown" }), /transform/);
  assert.throws(() => phaseRandomizedSurrogate([], { seed: 3 }), /at least one sample/);
  assert.throws(() => phaseRandomizedSurrogate([1, NaN], { seed: 3 }), /non-finite sample/);
});
