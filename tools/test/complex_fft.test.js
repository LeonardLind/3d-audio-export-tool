const test = require("node:test");
const assert = require("node:assert/strict");
const { makeFft, complexFft, complexIfft, nextPowerOfTwo } = require("../lib/fft");

function signal(n) {
  return {
    re: Float64Array.from({ length: n }, (_, j) => Math.sin(j * 0.23) + 0.37 * Math.cos(j * j * 0.0017)),
    im: Float64Array.from({ length: n }, (_, j) => 0.45 * Math.sin(j * 0.13) - 0.2 * Math.cos(j * 0.037)),
  };
}

function directDft(re, im) {
  const n = re.length;
  const outRe = new Float64Array(n);
  const outIm = new Float64Array(n);
  for (let k = 0; k < n; k += 1) {
    for (let j = 0; j < n; j += 1) {
      const angle = -2 * Math.PI * j * k / n;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      outRe[k] += re[j] * c - im[j] * s;
      outIm[k] += re[j] * s + im[j] * c;
    }
  }
  return { re: outRe, im: outIm };
}

function maxComplexError(a, b) {
  let error = 0;
  let scale = 1;
  for (let k = 0; k < a.re.length; k += 1) {
    error = Math.max(error, Math.hypot(a.re[k] - b.re[k], a.im[k] - b.im[k]));
    scale = Math.max(scale, Math.hypot(b.re[k], b.im[k]));
  }
  return error / scale;
}

test("complex radix-2 and Bluestein round-trip to <= 1e-9", () => {
  for (const n of [1, 2, 3, 8, 97, 234, 256, 515, 556, 700, 1024]) {
    const input = signal(n);
    const forward = complexFft(input.re, input.im);
    const restored = complexIfft(forward.re, forward.im);
    assert.ok(maxComplexError(restored, input) <= 1e-9, `n=${n}`);
    assert.deepEqual(input, signal(n), `input mutated at n=${n}`);
  }
});

test("Bluestein matches independent direct O(n^2) complex DFT", () => {
  for (const n of [97, 234, 515, 556, 700]) {
    const input = signal(n);
    const fast = complexFft(input.re, input.im);
    const direct = directDft(input.re, input.im);
    assert.ok(maxComplexError(fast, direct) <= 1e-9, `n=${n}, relative error ${maxComplexError(fast, direct)}`);
  }
});

test("legacy real-frame magnitude API and buffer reuse stay unchanged", () => {
  const n = 512;
  const frame = signal(n).re;
  const fft = makeFft(n);
  const magnitudes = fft.magnitudes(frame);
  const complex = complexFft(frame);
  assert.equal(magnitudes.length, n / 2 + 1);
  for (let k = 0; k < magnitudes.length; k += 1) {
    assert.ok(Math.abs(magnitudes[k] - Math.hypot(complex.re[k], complex.im[k])) < 1e-9);
  }
  assert.equal(fft.magnitudes(frame), magnitudes);
  assert.throws(() => makeFft(97), /power of two/);
  assert.equal(nextPowerOfTwo(97), 128);
  assert.equal(nextPowerOfTwo(512), 512);
});
