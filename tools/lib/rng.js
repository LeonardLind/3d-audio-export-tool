// Counter-based random numbers for every v2 governing stream (Amendment C01, owner decision
// OD-1, 2026-09-29).
//
// Philox4x32-10 (Salmon, Moraes, Dror & Shaw 2011, "Parallel random numbers: as easy as
// 1, 2, 3", SC11, DOI 10.1145/2063384.2063405). A stream is identified by the key
// (k0, k1) = (seed, subStream). Its 128-bit counter starts at 0 and increases by 1 per
// 4-word output block (word 0 least significant, carry into words 1 to 3). Distinct keys
// give distinct streams that are not segments of one shared cycle, and one stream cannot
// wrap (2^128 blocks). This replaces the legacy generators (metrics.makeRandom, a 2^32-cycle
// LCG, and synth.mulberry32) for v2 results: their streams were shown to overlap.
//
// Verified against the official Random123 known-answer vectors in tools/test/rng.test.js
// (https://raw.githubusercontent.com/DEShawResearch/random123/main/tests/kat_vectors).

const PHILOX_M0 = 0xd2511f53;
const PHILOX_M1 = 0xcd9e8d57;
const PHILOX_W0 = 0x9e3779b9;
const PHILOX_W1 = 0xbb67ae85;
const ROUNDS = 10;
const UINT32_MAX = 0xffffffff;

/**
 * High 32 bits of the exact 64-bit product of two uint32 values. Doubles cannot hold the
 * full product, so it is built from 16-bit halves (every partial product fits in 2^32).
 * @param {number} a uint32
 * @param {number} b uint32
 * @returns {number} uint32
 */
function mulhi32(a, b) {
  const al = a & 0xffff;
  const ah = a >>> 16;
  const bl = b & 0xffff;
  const bh = b >>> 16;
  const lowLow = al * bl;
  const lowHigh = al * bh;
  const highLow = ah * bl;
  const mid = (lowLow >>> 16) + (lowHigh & 0xffff) + (highLow & 0xffff);
  return (ah * bh + (lowHigh >>> 16) + (highLow >>> 16) + Math.floor(mid / 65536)) >>> 0;
}

/**
 * One Philox4x32-10 block: 4 output words for a 4-word counter and a 2-word key. Both
 * inputs are left unchanged.
 * @param {ArrayLike<number>} counter 4 uint32 words, word 0 least significant
 * @param {ArrayLike<number>} key 2 uint32 words
 * @returns {Uint32Array} 4 uint32 words
 */
function philox4x32_10(counter, key) {
  let c0 = counter[0] >>> 0;
  let c1 = counter[1] >>> 0;
  let c2 = counter[2] >>> 0;
  let c3 = counter[3] >>> 0;
  let k0 = key[0] >>> 0;
  let k1 = key[1] >>> 0;
  for (let round = 0; round < ROUNDS; round++) {
    if (round > 0) {
      k0 = (k0 + PHILOX_W0) >>> 0;
      k1 = (k1 + PHILOX_W1) >>> 0;
    }
    const hi0 = mulhi32(PHILOX_M0, c0);
    const lo0 = Math.imul(PHILOX_M0, c0) >>> 0;
    const hi1 = mulhi32(PHILOX_M1, c2);
    const lo1 = Math.imul(PHILOX_M1, c2) >>> 0;
    c0 = (hi1 ^ c1 ^ k0) >>> 0;
    c1 = lo1;
    c2 = (hi0 ^ c3 ^ k1) >>> 0;
    c3 = lo0;
  }
  return Uint32Array.of(c0, c1, c2, c3);
}

/**
 * Adds 1 to a 128-bit counter in place (word 0 least significant, carry upwards).
 * @param {Uint32Array} counter
 */
function incrementCounter(counter) {
  for (let word = 0; word < 4; word++) {
    counter[word] = (counter[word] + 1) >>> 0;
    if (counter[word] !== 0) return;
  }
}

function assertUint32(value, name) {
  if (!Number.isInteger(value) || value < 0 || value > UINT32_MAX) {
    throw new Error(`rng: ${name} must be an integer in [0, 2^32 - 1] (got ${value}); v2 streams have no default seed`);
  }
}

/**
 * A Philox4x32-10 stream for key (seed, subStream), counter starting at 0. Both key parts
 * are required: omitting either is an error, so no stream can fall back to a silent default.
 *
 * Draw rules (Amendment C01 (3)-(7)): words are used in order; a uniform double takes two
 * words; a normal takes two uniforms (Box-Muller cosine branch, u1 clamped to >= 1e-12);
 * integer / range / phase draws and the Fisher-Yates shuffle each take one uniform per step.
 * @param {number} seed uint32, the value from the experiment's seed table
 * @param {number} subStream uint32 index within that seed's purpose
 */
function createStream(seed, subStream) {
  assertUint32(seed, "seed");
  assertUint32(subStream, "subStream");
  const key = Uint32Array.of(seed, subStream);
  const counter = new Uint32Array(4);
  let block = philox4x32_10(counter, key);
  let wordIndex = 0;
  let wordsUsed = 0;

  function nextUint32() {
    if (wordIndex === 4) {
      incrementCounter(counter);
      block = philox4x32_10(counter, key);
      wordIndex = 0;
    }
    wordsUsed++;
    return block[wordIndex++];
  }

  /** Uniform double in [0, 1) with 53 random bits: ((a >>> 5) * 2^26 + (b >>> 6)) / 2^53. */
  function nextUniform() {
    const a = nextUint32();
    const b = nextUint32();
    return ((a >>> 5) * 67108864 + (b >>> 6)) / 9007199254740992;
  }

  /** Standard normal, Box-Muller cosine branch; the sine value is not used. */
  function nextNormal() {
    const u1 = Math.max(nextUniform(), 1e-12);
    const u2 = nextUniform();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /** Integer in [0, m): floor(u * m). */
  function nextInt(m) {
    if (!Number.isInteger(m) || m < 1) throw new Error(`rng: nextInt needs a positive integer m (got ${m})`);
    return Math.floor(nextUniform() * m);
  }

  /** Uniform on [lo, hi): lo + (hi - lo) * u. */
  function nextRange(lo, hi) {
    return lo + (hi - lo) * nextUniform();
  }

  /** Uniform phase on [0, 2 pi). */
  function nextPhase() {
    return 2 * Math.PI * nextUniform();
  }

  /** Fisher-Yates in place: for i = m - 1 down to 1, swap item i with item floor(u * (i + 1)). */
  function shuffleInPlace(items) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(nextUniform() * (i + 1));
      const held = items[i];
      items[i] = items[j];
      items[j] = held;
    }
    return items;
  }

  return {
    seed,
    subStream,
    nextUint32,
    nextUniform,
    nextNormal,
    nextInt,
    nextRange,
    nextPhase,
    shuffleInPlace,
    /** Number of 32-bit words consumed so far (for logging draw counts). */
    wordsUsed: () => wordsUsed,
  };
}

module.exports = { philox4x32_10, createStream, incrementCounter, mulhi32 };
