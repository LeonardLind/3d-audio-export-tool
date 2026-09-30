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

// Complex DFT with the same unnormalised forward convention as makeFft:
// X[k] = sum_j x[j] exp(-2 pi i j k / n). The inverse divides by n.
// Power-of-two lengths use radix-2; all other lengths use Bluestein's chirp
// convolution, evaluated with a zero-padded radix-2 FFT (no signal truncation).
function validateComplex(real, imaginary) {
  const n = real?.length;
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError("complex FFT needs at least one sample");
  if (imaginary !== undefined && imaginary !== null && imaginary.length !== n) throw new RangeError("complex FFT real/imaginary length mismatch");
  return n;
}

function isPowerOfTwo(n) {
  return n > 0 && Number.isInteger(Math.log2(n));
}

function nextPowerOfTwo(n) {
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError("nextPowerOfTwo needs a positive safe integer");
  let power = 1;
  while (power < n) power *= 2;
  return power;
}

function radix2(real, imaginary) {
  const n = real.length;
  const re = Float64Array.from(real);
  const im = imaginary === undefined || imaginary === null ? new Float64Array(n) : Float64Array.from(imaginary);
  let j = 0;
  for (let i = 1; i < n; i += 1) {
    let bit = n / 2;
    while (j >= bit) {
      j -= bit;
      bit /= 2;
    }
    j += bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  const cos = new Float64Array(n / 2);
  const sin = new Float64Array(n / 2);
  for (let k = 0; k < n / 2; k += 1) {
    const angle = -2 * Math.PI * k / n;
    cos[k] = Math.cos(angle);
    sin[k] = Math.sin(angle);
  }
  for (let len = 2; len <= n; len *= 2) {
    const half = len / 2;
    const step = n / len;
    for (let base = 0; base < n; base += len) {
      for (let k = 0; k < half; k += 1) {
        const a = base + k;
        const b = a + half;
        const tw = k * step;
        const tr = re[b] * cos[tw] - im[b] * sin[tw];
        const ti = re[b] * sin[tw] + im[b] * cos[tw];
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
  return { re, im };
}

function bluestein(real, imaginary) {
  const n = real.length;
  const m = nextPowerOfTwo(2 * n - 1);
  const ar = new Float64Array(m);
  const ai = new Float64Array(m);
  const br = new Float64Array(m);
  const bi = new Float64Array(m);
  for (let j = 0; j < n; j += 1) {
    // Reducing the integer square modulo 2n keeps the angle bounded while
    // preserving exp(i*pi*j*j/n) exactly up to floating-point rounding.
    const angle = Math.PI * ((j * j) % (2 * n)) / n;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const xr = real[j];
    const xi = imaginary === undefined || imaginary === null ? 0 : imaginary[j];
    ar[j] = xr * c + xi * s;
    ai[j] = xi * c - xr * s;
    br[j] = c;
    bi[j] = s;
    if (j > 0) {
      br[m - j] = c;
      bi[m - j] = s;
    }
  }
  const a = radix2(ar, ai);
  const b = radix2(br, bi);
  const cr = new Float64Array(m);
  const ci = new Float64Array(m);
  for (let k = 0; k < m; k += 1) {
    cr[k] = a.re[k] * b.re[k] - a.im[k] * b.im[k];
    ci[k] = a.re[k] * b.im[k] + a.im[k] * b.re[k];
  }
  const convolution = inverseByConjugation(cr, ci);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let k = 0; k < n; k += 1) {
    const angle = Math.PI * ((k * k) % (2 * n)) / n;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    re[k] = convolution.re[k] * c + convolution.im[k] * s;
    im[k] = convolution.im[k] * c - convolution.re[k] * s;
  }
  return { re, im };
}

function inverseByConjugation(real, imaginary) {
  const n = real.length;
  const negativeImaginary = Float64Array.from(imaginary, (value) => -value);
  const transformed = radix2(real, negativeImaginary);
  for (let k = 0; k < n; k += 1) {
    transformed.re[k] /= n;
    transformed.im[k] = -transformed.im[k] / n;
  }
  return transformed;
}

function complexFft(real, imaginary) {
  const n = validateComplex(real, imaginary);
  return isPowerOfTwo(n) ? radix2(real, imaginary) : bluestein(real, imaginary);
}

function complexIfft(real, imaginary) {
  const n = validateComplex(real, imaginary);
  const negativeImaginary = imaginary === undefined || imaginary === null
    ? new Float64Array(n)
    : Float64Array.from(imaginary, (value) => -value);
  const transformed = complexFft(real, negativeImaginary);
  for (let k = 0; k < n; k += 1) {
    transformed.re[k] /= n;
    transformed.im[k] = -transformed.im[k] / n;
  }
  return transformed;
}

module.exports = { makeFft, complexFft, complexIfft, nextPowerOfTwo };
