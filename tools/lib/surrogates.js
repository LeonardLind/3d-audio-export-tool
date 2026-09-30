// Shared phase-randomised surrogate for Experiments 007, 010 and 012.
// 007/012 use a zero-padded power-of-two DFT and truncate after inversion;
// 010 A2 uses the exact length-n DFT (with Bluestein for non-powers of two).
const { complexFft, complexIfft, nextPowerOfTwo } = require("./fft");
const { createStream } = require("./rng");

function phaseRandomizedSurrogate(signal, options = {}) {
  const { seed, stream, transform = "padded" } = options;
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("phaseRandomizedSurrogate: explicit uint32 seed required");
  if (transform !== "padded" && transform !== "exact") throw new Error("phaseRandomizedSurrogate: transform must be padded or exact");
  if (!signal || !Number.isSafeInteger(signal.length) || signal.length < 1) throw new RangeError("phaseRandomizedSurrogate: signal must have at least one sample");
  const subStream = options.subStream ?? stream?.subStream ?? 0;
  if (!Number.isInteger(subStream) || subStream < 0 || subStream > 0xffffffff) throw new Error("phaseRandomizedSurrogate: subStream must be uint32");
  const random = stream ?? createStream(seed, subStream);
  if (random.seed !== seed || random.subStream !== subStream || typeof random.nextPhase !== "function") {
    throw new Error("phaseRandomizedSurrogate: stream must have the requested Philox key and nextPhase");
  }
  const n = signal.length;
  const fftLength = transform === "padded" ? nextPowerOfTwo(n) : n;
  const input = new Float64Array(fftLength);
  for (let i = 0; i < n; i += 1) {
    if (!Number.isFinite(signal[i])) throw new TypeError(`phaseRandomizedSurrogate: non-finite sample at ${i}`);
    input[i] = signal[i];
  }
  const original = complexFft(input);
  const re = Float64Array.from(original.re);
  const im = new Float64Array(fftLength);
  const phaseCount = Math.ceil(fftLength / 2) - 1;
  for (let k = 1; k <= phaseCount; k += 1) {
    const magnitude = Math.hypot(original.re[k], original.im[k]);
    const phase = random.nextPhase();
    const r = magnitude * Math.cos(phase);
    const v = magnitude * Math.sin(phase);
    re[k] = r;
    im[k] = v;
    re[fftLength - k] = r;
    im[fftLength - k] = -v;
  }
  // A real signal's DC and even-length Nyquist bins are real. Keep their
  // original real values and force their round-off imaginary parts to zero.
  im[0] = 0;
  if (fftLength % 2 === 0) im[fftLength / 2] = 0;
  const reconstructed = complexIfft(re, im);
  return {
    samples: reconstructed.re.slice(0, n),
    spectrum: { re, im },
    originalLength: n,
    fftLength,
    transform,
    seed,
    subStream,
    phaseCount,
  };
}

module.exports = { phaseRandomizedSurrogate };
