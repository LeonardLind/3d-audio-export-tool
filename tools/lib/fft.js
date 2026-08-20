// Minimal iterative radix-2 Cooley-Tukey FFT for real-valued audio frames.
//
// The previous pipeline used a naive O(bins * N) DFT per frame, which is fine at
// FFT_SIZE=512 on a 15s clip but scales badly once you raise the resolution and point
// density (a 3-minute song at 1024-pt FFT would take tens of seconds). This brings each
// frame down to O(N log N). It stays entirely offline (Node) -- the browser still never
// runs an FFT, per 06_Technical_Architecture. Same magnitude convention as the DFT it
// replaces: magnitude[k] = sqrt(re^2 + im^2) for k in [0, N/2].
function makeFft(size) {
  if ((size & (size - 1)) !== 0) throw new Error(`FFT size must be a power of two, got ${size}`);
  const bits = Math.round(Math.log2(size));

  const cosTable = new Float64Array(size / 2);
  const sinTable = new Float64Array(size / 2);
  for (let i = 0; i < size / 2; i += 1) {
    cosTable[i] = Math.cos((-2 * Math.PI * i) / size);
    sinTable[i] = Math.sin((-2 * Math.PI * i) / size);
  }

  // Bit-reversal permutation table (decimation-in-time expects bit-reversed input order).
  const reversed = new Uint32Array(size);
  for (let i = 0; i < size; i += 1) {
    let x = i;
    let r = 0;
    for (let b = 0; b < bits; b += 1) {
      r = (r << 1) | (x & 1);
      x >>= 1;
    }
    reversed[i] = r;
  }

  const re = new Float64Array(size);
  const im = new Float64Array(size);
  const mag = new Float64Array(size / 2 + 1);

  // Returns a REUSED magnitude buffer -- copy it if you need to retain the values.
  function magnitudes(frame) {
    for (let i = 0; i < size; i += 1) {
      re[i] = frame[reversed[i]];
      im[i] = 0;
    }
    for (let len = 2; len <= size; len <<= 1) {
      const half = len >> 1;
      const step = size / len;
      for (let i = 0; i < size; i += len) {
        for (let j = 0, k = 0; j < half; j += 1, k += step) {
          const tRe = re[i + j + half] * cosTable[k] - im[i + j + half] * sinTable[k];
          const tIm = re[i + j + half] * sinTable[k] + im[i + j + half] * cosTable[k];
          re[i + j + half] = re[i + j] - tRe;
          im[i + j + half] = im[i + j] - tIm;
          re[i + j] += tRe;
          im[i + j] += tIm;
        }
      }
    }
    for (let k = 0; k <= size / 2; k += 1) {
      mag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
    }
    return mag;
  }

  return { size, magnitudes };
}

module.exports = { makeFft };
