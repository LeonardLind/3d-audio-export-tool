// Tests for tools/lib/rng.js (Philox4x32-10, Amendment C01 / OD-1).
// Run: node --test tools/test/rng.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const rng = require("../lib/rng");

// Official Random123 known-answer vectors, "philox4x32 10" lines of
// https://raw.githubusercontent.com/DEShawResearch/random123/main/tests/kat_vectors
// (fetched 2026-09-29). Format: counter words 0-3, key words 0-1, expected output words 0-3.
const KAT = [
  ["00000000 00000000 00000000 00000000", "00000000 00000000", "6627e8d5 e169c58d bc57ac4c 9b00dbd8"],
  ["ffffffff ffffffff ffffffff ffffffff", "ffffffff ffffffff", "408f276d 41c83b0e a20bc7c6 6d5451fd"],
  ["243f6a88 85a308d3 13198a2e 03707344", "a4093822 299f31d0", "d16cfe09 94fdcceb 5001e420 24126ea1"],
];
const words = (text) => text.split(" ").map((hex) => parseInt(hex, 16));

// Kolmogorov-Smirnov statistic of a sample against a continuous CDF.
function ksStatistic(sample, cdf) {
  const sorted = Float64Array.from(sample).sort();
  const n = sorted.length;
  let d = 0;
  for (let i = 0; i < n; i++) {
    const f = cdf(sorted[i]);
    d = Math.max(d, (i + 1) / n - f, f - i / n);
  }
  return d;
}

// Standard normal CDF via the Abramowitz & Stegun 7.1.26 erf approximation (|error| < 1.5e-7).
function normalCdf(x) {
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-z * z);
  return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

// KS critical value at alpha = 0.001 for large n: 1.95 / sqrt(n).
const ksCritical = (n) => 1.95 / Math.sqrt(n);

test("known-answer vectors: philox4x32 10 matches Random123 exactly", () => {
  for (const [counter, key, expected] of KAT) {
    assert.deepEqual(Array.from(rng.philox4x32_10(words(counter), words(key))), words(expected), `counter ${counter}, key ${key}`);
  }
});

test("mulhi32 equals the exact high word of the 64-bit product", () => {
  const cases = [
    [0, 0],
    [0xffffffff, 0xffffffff],
    [0xd2511f53, 0x12345678],
    [0xcd9e8d57, 0xfedcba98],
    [0x80000000, 2],
    [65535, 65537],
  ];
  for (const [a, b] of cases) {
    const exact = Number((BigInt(a) * BigInt(b)) >> 32n);
    assert.equal(rng.mulhi32(a, b), exact, `${a} * ${b}`);
  }
});

test("a stream's first block is philox(counter 0, key (seed, subStream)); counter then advances by 1", () => {
  const stream = rng.createStream(20260720, 7);
  const first = Array.from({ length: 8 }, () => stream.nextUint32());
  const key = [20260720, 7];
  assert.deepEqual(first.slice(0, 4), Array.from(rng.philox4x32_10([0, 0, 0, 0], key)));
  assert.deepEqual(first.slice(4, 8), Array.from(rng.philox4x32_10([1, 0, 0, 0], key)));
  assert.equal(stream.wordsUsed(), 8);
});

test("counter carry: word 0 overflows into words 1 to 3", () => {
  const counter = Uint32Array.of(0xffffffff, 0xffffffff, 0xffffffff, 0);
  rng.incrementCounter(counter);
  assert.deepEqual(Array.from(counter), [0, 0, 0, 1]);
  const small = Uint32Array.of(5, 0, 0, 0);
  rng.incrementCounter(small);
  assert.deepEqual(Array.from(small), [6, 0, 0, 0]);
});

test("determinism: the same key gives the same draws, in a fresh stream", () => {
  const a = rng.createStream(21373720, 1);
  const b = rng.createStream(21373720, 1);
  for (let i = 0; i < 1000; i++) assert.equal(a.nextNormal(), b.nextNormal());
});

test("distinct keys give different streams (seed and subStream both matter)", () => {
  const draw = (seed, sub) => {
    const s = rng.createStream(seed, sub);
    return Array.from({ length: 64 }, () => s.nextUint32());
  };
  const base = draw(22275720, 0);
  assert.notDeepEqual(draw(22275721, 0), base);
  assert.notDeepEqual(draw(22275720, 1), base);
});

test("the legacy overlap case: seeds 22275720 and 21373720 no longer share a shifted stretch", () => {
  // Under synth.mulberry32 these two 'independent' seeds produced 22.2 s of identical white
  // noise, shifted by 171,472 samples (audit SEED-2, reproduced 2026-09-29). Under Philox
  // their word streams share no aligned 8-word window over the first 2^18 words.
  const n = 1 << 18;
  const a = rng.createStream(22275720, 0);
  const b = rng.createStream(21373720, 0);
  const seen = new Map();
  const wa = new Uint32Array(n);
  for (let i = 0; i < n; i++) wa[i] = a.nextUint32();
  for (let i = 0; i + 8 <= n; i += 1) {
    if (i % 4 === 0) seen.set(wa[i], i);
  }
  let collisions = 0;
  const wb = new Uint32Array(n);
  for (let i = 0; i < n; i++) wb[i] = b.nextUint32();
  for (let i = 0; i + 8 <= n; i++) {
    const start = seen.get(wb[i]);
    if (start === undefined || start + 8 > n) continue;
    let same = true;
    for (let k = 1; k < 8 && same; k++) same = wa[start + k] === wb[i + k];
    if (same) collisions++;
  }
  assert.equal(collisions, 0);
});

test("uniform doubles: in [0, 1), 53-bit construction, mean/SD and KS match U(0,1)", () => {
  const stream = rng.createStream(20260720, 0);
  const n = 200000;
  const values = new Float64Array(n);
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const u = stream.nextUniform();
    assert.ok(u >= 0 && u < 1);
    values[i] = u;
    sum += u;
    sumSq += u * u;
  }
  const mean = sum / n;
  const sd = Math.sqrt(sumSq / n - mean * mean);
  assert.ok(Math.abs(mean - 0.5) < 5 * Math.sqrt(1 / 12 / n), `mean ${mean}`);
  assert.ok(Math.abs(sd - Math.sqrt(1 / 12)) < 0.002, `sd ${sd}`);
  assert.ok(ksStatistic(values, (x) => x) < ksCritical(n));

  const check = rng.createStream(1, 2);
  const a = rng.createStream(1, 2).nextUint32();
  const second = rng.createStream(1, 2);
  second.nextUint32();
  const b = second.nextUint32();
  assert.equal(check.nextUniform(), ((a >>> 5) * 2 ** 26 + (b >>> 6)) / 2 ** 53);
});

test("normals: cosine-branch Box-Muller from two uniforms; mean/SD and KS match N(0,1)", () => {
  const stream = rng.createStream(20261720, 3);
  const n = 200000;
  const values = new Float64Array(n);
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const z = stream.nextNormal();
    values[i] = z;
    sum += z;
    sumSq += z * z;
  }
  const mean = sum / n;
  const sd = Math.sqrt(sumSq / n - mean * mean);
  assert.ok(Math.abs(mean) < 5 / Math.sqrt(n), `mean ${mean}`);
  assert.ok(Math.abs(sd - 1) < 0.01, `sd ${sd}`);
  assert.ok(ksStatistic(values, normalCdf) < ksCritical(n));

  const manual = rng.createStream(9, 9);
  const u1 = Math.max(manual.nextUniform(), 1e-12);
  const u2 = manual.nextUniform();
  assert.equal(rng.createStream(9, 9).nextNormal(), Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
  assert.equal(manual.wordsUsed(), 4);
});

test("derived draws: integer range, uniform range, phase, and Fisher-Yates use one uniform per step", () => {
  const stream = rng.createStream(5, 5);
  const ref = rng.createStream(5, 5);
  assert.equal(stream.nextInt(10), Math.floor(ref.nextUniform() * 10));
  assert.equal(stream.nextRange(2, 6), 2 + 4 * ref.nextUniform());
  assert.equal(stream.nextPhase(), 2 * Math.PI * ref.nextUniform());

  const items = [0, 1, 2, 3, 4, 5, 6, 7];
  const expected = items.slice();
  for (let i = expected.length - 1; i > 0; i--) {
    const j = Math.floor(ref.nextUniform() * (i + 1));
    [expected[i], expected[j]] = [expected[j], expected[i]];
  }
  assert.deepEqual(stream.shuffleInPlace(items), expected);
  assert.deepEqual([...items].sort((x, y) => x - y), [0, 1, 2, 3, 4, 5, 6, 7]);
});

test("no silent defaults: a missing or invalid seed or subStream is an error", () => {
  assert.throws(() => rng.createStream(), /seed must be an integer/);
  assert.throws(() => rng.createStream(1), /subStream must be an integer/);
  assert.throws(() => rng.createStream(-1, 0), /seed must be an integer/);
  assert.throws(() => rng.createStream(2 ** 32, 0), /seed must be an integer/);
  assert.throws(() => rng.createStream(1.5, 0), /seed must be an integer/);
  assert.throws(() => rng.createStream(1, 0).nextInt(0), /positive integer/);
});
