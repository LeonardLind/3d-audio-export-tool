const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../lib/metrics");
const R = require("../lib/reducers");
const synth = require("../lib/synth");
const { createStream } = require("../lib/rng");

const key = 20260721;
const matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]];
const legacyStream = (seed) => ({ seed, nextUniform: M.makeRandom(seed) });

test("v2 controls change only the uniform source and follow C01 draw order", () => {
  assert.deepEqual(M.randomMatchedMatrix(matrix, key, { rng: "philox", stream: legacyStream(key) }), M.randomMatchedMatrix(matrix, key));
  assert.deepEqual(M.columnPermutedMatrix(matrix, key, { rng: "philox", stream: legacyStream(key) }), M.columnPermutedMatrix(matrix, key));

  const gStream = createStream(key, 0);
  M.randomMatchedMatrix(matrix, key, { rng: "philox", stream: gStream });
  assert.equal(gStream.wordsUsed(), matrix.length * matrix[0].length * 4);
  const pStream = createStream(key, 0);
  M.columnPermutedMatrix(matrix, key, { rng: "philox", stream: pStream });
  assert.equal(pStream.wordsUsed(), matrix[0].length * (matrix.length - 1) * 2);
  assert.deepEqual(M.randomMatchedMatrix(matrix, key, { rng: "philox" }), M.randomMatchedMatrix(matrix, key, { rng: "philox" }));
  assert.notDeepEqual(M.randomMatchedMatrix(matrix, key, { rng: "philox" }), M.randomMatchedMatrix(matrix, key));
});

test("v2 bootstrap and random circular null consume one uniform per index", () => {
  const values = [1, 2, 5, 9];
  const bStream = createStream(key, 0);
  const opts = { rng: "philox", seed: key, B: 12 };
  const a = M.bootstrapCI(values, { ...opts, stream: bStream });
  assert.deepEqual(a, M.bootstrapCI(values, opts));
  assert.equal(bStream.wordsUsed(), 12 * values.length * 2);
  assert.deepEqual(M.bootstrapCI(values, { ...opts, stream: legacyStream(key) }), M.bootstrapCI(values, { seed: key, B: 12 }));

  const pStream = createStream(key, 0);
  const paired = M.pairedBootstrapCI(values, [2, 3, 4, 5], { ...opts, stream: pStream });
  assert.deepEqual(paired, M.pairedBootstrapCI(values, [2, 3, 4, 5], opts));
  assert.equal(pStream.wordsUsed(), 12 * values.length * 2);
  assert.deepEqual(M.pairedBootstrapCI(values, [2, 3, 4, 5], { ...opts, stream: legacyStream(key) }), M.pairedBootstrapCI(values, [2, 3, 4, 5], { seed: key, B: 12 }));

  const x = Array.from({ length: 30 }, (_, i) => Math.sin(i * 0.7));
  const y = Array.from({ length: 30 }, (_, i) => Math.cos(i * 0.4));
  const nStream = createStream(key, 0);
  const nullOpts = { rng: "philox", seed: key, minShift: 4, B: 7 };
  const result = M.circularShiftNull(x, y, { ...nullOpts, stream: nStream });
  assert.equal(result.mode, "random");
  assert.deepEqual(result, M.circularShiftNull(x, y, nullOpts));
  assert.equal(nStream.wordsUsed(), 14);
  assert.deepEqual(M.circularShiftNull(x, y, { ...nullOpts, stream: legacyStream(key) }), M.circularShiftNull(x, y, { seed: key, minShift: 4, B: 7 }));
});

test("v2 reducers use Philox, report the governing seed, and reject overrides", () => {
  assert.equal(R.reduceRandomProjection(matrix, { seed: key, dimensions: 2 }).details.distribution,
    "N(0, 1/dimensions), 32-bit LCG + Box-Muller");
  const rp = R.reduceRandomProjection(matrix, { rng: "philox", seed: key, dimensions: 2 });
  assert.equal(rp.details.seed, key);
  assert.match(rp.details.distribution, /Philox/);
  assert.deepEqual(rp.embedding, R.reduceRandomProjection(matrix, { rng: "philox", seed: key, dimensions: 2 }).embedding);
  assert.notDeepEqual(rp.embedding, R.reduceRandomProjection(matrix, { seed: key, dimensions: 2 }).embedding);

  const umap = R.reduceUmap(matrix, { rng: "philox", seed: key, dimensions: 2, nEpochs: 20, nNeighbors: 2 });
  assert.equal(umap.details.seed, key);
  assert.match(umap.details.random, /Philox/);
  assert.deepEqual(umap.embedding, R.reduceUmap(matrix, { rng: "philox", seed: key, dimensions: 2, nEpochs: 20, nNeighbors: 2 }).embedding);
  const tsne = R.reduceTsne(matrix, { rng: "philox", seed: key, dimensions: 2, init: "random", nIter: 2, perplexity: 1 });
  assert.equal(tsne.details.seed, key);
  assert.deepEqual(tsne.embedding, R.reduceTsne(matrix, { rng: "philox", seed: key, dimensions: 2, init: "random", nIter: 2, perplexity: 1 }).embedding);
  const initStream = createStream(key, 0);
  R.reduceTsne(matrix, { rng: "philox", seed: key, stream: initStream, dimensions: 2, init: "random", nIter: 2, perplexity: 1 });
  assert.equal(initStream.wordsUsed(), matrix.length * 2 * 4);

  assert.throws(() => R.reduceFeatures(matrix, { method: "random-projection", rng: "philox" }), /explicit uint32 seed/);
  assert.deepEqual(R.reduceFeatures(matrix, { method: "pca", rng: "philox", dimensions: 2 }), R.reduceFeatures(matrix, { method: "pca", dimensions: 2 }));
  assert.throws(() => R.reduceFeatures(matrix, { method: "umap", rng: "philox", seed: key, dimensions: 2, umap: { seed: key + 1 } }), /conflicting namespaced seed/);
  assert.throws(() => R.reduceFeatures(matrix, { method: "umap", rng: "philox", seed: key, dimensions: 2, umap: { dimensions: 3 } }), /conflicting namespaced dimensions/);
  assert.equal(R.reduceFeatures(matrix, { method: "random-projection", rng: "philox", seed: key, dimensions: 2 }).details.seed, key);
  assert.throws(() => R.reduceTsne(matrix, { rng: "philox", seed: key, engine: "tsne-js" }), /legacy-only/);
});

test("v2 synth uses separate Philox signal and background streams; jitter has direct access", () => {
  const opts = { rng: "philox", seed: key, durationSeconds: 1, sampleRate: 8000 };
  const a = synth.clickTrain({ ...opts, snrDb: 12 });
  const b = synth.clickTrain({ ...opts, snrDb: 30 });
  assert.deepEqual(a.clean, b.clean);
  assert.notDeepEqual(a.samples, b.samples);
  assert.deepEqual(a.samples, synth.clickTrain({ ...opts, snrDb: 12 }).samples);
  assert.notDeepEqual(a.clean, synth.clickTrain({ ...opts, seed: key + 1, snrDb: 12 }).clean);
  const stream = createStream(key, 0);
  const jitter = synth.makePhiloxRng(key);
  assert.equal(jitter.uniform(), stream.nextUniform());
  assert.equal(jitter.gaussian(), stream.nextNormal());
  assert.throws(() => synth.clickTrain({ rng: "philox", durationSeconds: 1 }), /explicit uint32 seed/);
});

test("every synthetic generator accepts the v2 stream mode deterministically", () => {
  for (const name of Object.keys(synth.GENERATORS)) {
    const opts = { rng: "philox", seed: key, durationSeconds: 2 };
    const first = synth[name](opts);
    const second = synth[name](opts);
    assert.deepEqual(first.samples, second.samples, name);
    assert.throws(() => synth[name]({ rng: "philox", durationSeconds: 2 }), /explicit uint32 seed/, name);
  }
});

test("v2 rejects missing seeds, mismatched streams, and implicit legacy fallbacks", () => {
  assert.throws(() => M.randomMatchedMatrix(matrix, undefined, { rng: "philox" }), /explicit uint32 seed/);
  assert.throws(() => M.columnPermutedMatrix(matrix, key, { rng: "philox", stream: createStream(key + 1, 0) }), /stream seed differs/);
  assert.throws(() => M.bootstrapCI([1, 2], { rng: "philox" }), /explicit uint32 seed/);
  assert.throws(() => M.pairedBootstrapCI([1, 2], [2, 3], { rng: "philox" }), /explicit uint32 seed/);
  assert.throws(() => M.circularShiftNull([1, 2, 3], [2, 3, 1], { rng: "philox", minShift: 1 }), /explicit uint32 seed/);
  assert.throws(() => R.reduceRandomProjection(matrix, { rng: "philox" }), /explicit uint32 seed/);
  assert.throws(() => R.reduceUmap(matrix, { rng: "philox" }), /explicit uint32 seed/);
  assert.throws(() => R.reduceTsne(matrix, { rng: "philox", init: "random" }), /explicit uint32 seed/);
  assert.throws(() => M.randomMatchedMatrix(matrix, key, { stream: createStream(key, 0) }), /rng must be/);
});
