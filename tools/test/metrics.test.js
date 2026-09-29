"use strict";

// Tests for tools/lib/metrics.js. Run with: node --test tools/test/metrics.test.js
//
// There are three kinds of reference value:
//  1. ORACLE: functions copied verbatim from tools/run_experiment_001.js (lines 181-188 and
//     277-291 for mean/std/standardize, 352-406 for distances, ranks, trustworthiness and
//     controls). The shared module must match them bit-for-bit.
//  2. EXTERNAL: values computed on 2026-09-29 with scikit-learn 1.6.1, scipy 1.13.1,
//     numpy 2.0.2 and statsmodels 0.14.6 in a throwaway venv (these are NOT project
//     dependencies). The Python calls that produced each constant are written next to it,
//     so anyone can reproduce them.
//  3. BRUTE FORCE: exhaustive enumeration inside this file (all 2^n sign flips for the
//     Wilcoxon test, and every circular shift).

const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../lib/metrics");

// ---------------------------------------------------------------------------
// ORACLE: verbatim copies from tools/run_experiment_001.js
// ---------------------------------------------------------------------------
const oracle = (() => {
  function mean(values) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function std(values) {
    const avg = mean(values);
    return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
  }

  function standardize(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const means = new Array(cols).fill(0);
    const scales = new Array(cols).fill(0);

    for (let j = 0; j < cols; j += 1) {
      means[j] = mean(matrix.map((row) => row[j]));
      scales[j] = std(matrix.map((row) => row[j])) || 1;
    }

    return Array.from({ length: rows }, (_, i) =>
      Array.from({ length: cols }, (_, j) => (matrix[i][j] - means[j]) / scales[j]),
    );
  }

  function squaredDistance(a, b) {
    let total = 0;
    for (let i = 0; i < a.length; i += 1) total += (a[i] - b[i]) ** 2;
    return total;
  }

  function ranksByDistance(matrix) {
    return matrix.map((row, i) => {
      const distances = matrix
        .map((other, j) => ({ index: j, distance: i === j ? Infinity : squaredDistance(row, other) }))
        .sort((a, b) => a.distance - b.distance);

      const ranks = new Map();
      distances.forEach((item, rank) => ranks.set(item.index, rank + 1));
      return { nearest: distances.map((item) => item.index), ranks };
    });
  }

  function trustworthiness(original, embedded, k) {
    const n = original.length;
    const originalRanks = ranksByDistance(standardize(original));
    const embeddedRanks = ranksByDistance(embedded);
    let penalty = 0;

    for (let i = 0; i < n; i += 1) {
      const originalNeighbors = new Set(originalRanks[i].nearest.slice(0, k));
      const embeddedNeighbors = embeddedRanks[i].nearest.slice(0, k);
      for (const neighbor of embeddedNeighbors) {
        if (!originalNeighbors.has(neighbor)) {
          penalty += originalRanks[i].ranks.get(neighbor) - k;
        }
      }
    }

    return 1 - (2 / (n * k * (2 * n - 3 * k - 1))) * penalty;
  }

  function makeRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 2 ** 32;
    };
  }

  function randomNormal(random) {
    const u1 = Math.max(random(), 1e-12);
    const u2 = random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  function randomMatchedMatrix(matrix, seed) {
    const random = makeRandom(seed);
    return matrix.map((row) => row.map(() => randomNormal(random)));
  }

  return { standardize, squaredDistance, ranksByDistance, trustworthiness, makeRandom, randomNormal, randomMatchedMatrix };
})();

// ---------------------------------------------------------------------------
// Deterministic fixtures. These are identical to the generator used for the
// scikit-learn cross-check.
// ---------------------------------------------------------------------------
function structuredMatrix(n, d, seed) {
  const rnd = M.makeRandom(seed);
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    const t = i / n;
    const row = [];
    for (let j = 0; j < d; j += 1) row.push(Math.sin(2 * Math.PI * t * (1 + (j % 5))) * (1 + (j % 3)) + 0.3 * M.randomNormal(rnd));
    rows.push(row);
  }
  return rows;
}

function projectEmbedding(matrix, seed) {
  const rnd = M.makeRandom(seed);
  return matrix.map((r) => [r[0] + r[1 % r.length], r[2 % r.length] - r[3 % r.length], r[4 % r.length] + 0.5 * M.randomNormal(rnd)]);
}

function uniformMatrix(n, d, seed, { quantize } = {}) {
  const rnd = M.makeRandom(seed);
  return Array.from({ length: n }, () =>
    Array.from({ length: d }, () => {
      const v = rnd() * 10 - 5;
      return quantize ? Math.round(v) : v;
    }),
  );
}

// ---------------------------------------------------------------------------
// standardize / distances
// ---------------------------------------------------------------------------
test("standardize is bit-identical to the Experiment 001 oracle, including constant columns", () => {
  const X = structuredMatrix(37, 9, 5);
  for (const row of X) row[4] = 3.25; // constant column -> scale 1 -> all zeros
  const a = M.standardize(X);
  const b = oracle.standardize(X);
  for (let i = 0; i < X.length; i += 1) {
    for (let j = 0; j < X[0].length; j += 1) assert.equal(a[i][j], b[i][j]);
    assert.equal(a[i][4], 0);
  }
});

test("squaredDistanceMatrix is symmetric, has a zero diagonal and matches the oracle distance", () => {
  const X = uniformMatrix(20, 7, 3);
  const dm = M.squaredDistanceMatrix(X);
  for (let i = 0; i < 20; i += 1) {
    assert.equal(dm.data[i * 20 + i], 0);
    for (let j = 0; j < 20; j += 1) {
      assert.equal(dm.data[i * 20 + j], dm.data[j * 20 + i]);
      if (i !== j) assert.equal(dm.data[i * 20 + j], oracle.squaredDistance(X[i], X[j]));
    }
  }
});

test("makeRankContext reproduces the oracle's nearest order and ranks, including ties", () => {
  // Quantised values force many exact distance ties; the stable-sort tie order must match.
  for (const seed of [1, 2, 3]) {
    const X = uniformMatrix(30, 2, seed, { quantize: true });
    const ctx = M.makeRankContext(X);
    const ref = oracle.ranksByDistance(X);
    const n = X.length;
    for (let i = 0; i < n; i += 1) {
      const nearest = Array.from(ctx.order.subarray(i * (n - 1), (i + 1) * (n - 1)));
      assert.deepEqual(nearest, ref[i].nearest.slice(0, n - 1));
      for (let j = 0; j < n; j += 1) assert.equal(ctx.rank[i * n + j], ref[i].ranks.get(j));
    }
  }
});

// ---------------------------------------------------------------------------
// trustworthiness
// ---------------------------------------------------------------------------
test("trustworthiness equals the Experiment 001 oracle exactly on random, structured and tied matrices", () => {
  const cases = [
    [uniformMatrix(40, 12, 101), uniformMatrix(40, 3, 102), 5],
    [structuredMatrix(64, 30, 7), projectEmbedding(structuredMatrix(64, 30, 7), 8), 5],
    [uniformMatrix(50, 6, 103, { quantize: true }), uniformMatrix(50, 3, 104, { quantize: true }), 5],
    [uniformMatrix(33, 4, 105), uniformMatrix(33, 2, 106), 3],
    [structuredMatrix(90, 40, 9), projectEmbedding(structuredMatrix(90, 40, 9), 10), 10],
    [oracle.randomMatchedMatrix(uniformMatrix(45, 20, 1), 20260721), uniformMatrix(45, 3, 107), 5],
  ];
  for (const [X, Y, k] of cases) {
    assert.equal(M.trustworthiness(X, Y, k), oracle.trustworthiness(X, Y, k));
  }
});

test("trustworthiness via a reused RankContext equals the direct call", () => {
  const X = structuredMatrix(70, 25, 21);
  const ctx = M.makeRankContext(X, { standardize: true });
  for (let s = 0; s < 5; s += 1) {
    const Y = projectEmbedding(X, 200 + s);
    assert.equal(M.trustworthiness(ctx, Y, 5), M.trustworthiness(X, Y, 5));
    assert.equal(M.trustworthiness(ctx, M.makeRankContext(Y), 5), oracle.trustworthiness(X, Y, 5));
  }
  // A precomputed standardized distance matrix works too.
  const dm = M.squaredDistanceMatrix(X, { standardize: true });
  const Y = projectEmbedding(X, 300);
  assert.equal(M.trustworthiness(dm, Y, 5), oracle.trustworthiness(X, Y, 5));
});

test("trustworthiness and continuity match scikit-learn 1.6.1 exactly", () => {
  // Python (sklearn 1.6.1):
  //   Xs = StandardScaler().fit_transform(X)
  //   T = sklearn.manifold.trustworthiness(Xs, Y, n_neighbors=k)
  //   C = sklearn.manifold.trustworthiness(Y, Xs, n_neighbors=k)   # continuity = roles swapped
  // X = structuredMatrix(n, d, seed) and Y = projectEmbedding(X, seed + 100), both exported as JSON.
  const ref = [
    { n: 60, d: 20, seed: 11, k: 5, T: 0.8804487179487179, C: 0.9414102564102564 },
    { n: 100, d: 50, seed: 12, k: 5, T: 0.8823695652173913, C: 0.964304347826087 },
    { n: 40, d: 8, seed: 13, k: 3, T: 0.845952380952381, C: 0.9342857142857143 },
    { n: 80, d: 30, seed: 14, k: 10, T: 0.8568992248062015, C: 0.9081976744186047 },
  ];
  for (const r of ref) {
    const X = structuredMatrix(r.n, r.d, r.seed);
    const Y = projectEmbedding(X, r.seed + 100);
    assert.equal(M.trustworthiness(X, Y, r.k), r.T);
    assert.equal(M.continuity(X, Y, r.k), r.C);
  }
  // Negative-control style input: X = randomMatchedMatrix(structuredMatrix(50,12,1), 20260721), Y = projectEmbedding(X, 7)
  const R = M.randomMatchedMatrix(structuredMatrix(50, 12, 1), 20260721);
  const RY = projectEmbedding(R, 7);
  assert.equal(M.trustworthiness(R, RY, 5), 0.7385714285714285);
  assert.equal(M.continuity(R, RY, 5), 0.7932380952380953);
});

test("trustworthiness/continuity = 1 for an identical embedding (and for an isometry of the standardized space)", () => {
  const X = uniformMatrix(30, 3, 55);
  const Xs = M.standardize(X);
  assert.equal(M.trustworthiness(X, Xs, 5), 1);
  assert.equal(M.continuity(X, Xs, 5), 1);
  const shifted = Xs.map((r) => Array.from(r, (v) => 2 * v + 7)); // uniform scaling + shift preserves ranks
  assert.equal(M.trustworthiness(X, shifted, 4), 1);
  assert.equal(M.continuity(X, shifted, 4), 1);
});

test("trustworthiness and continuity on hand-computed tiny cases; continuity = trustworthiness with roles swapped", () => {
  // Distances are on a 1-D line, with n = 6, k = 1 and no standardisation, so the ranks
  // are easy to check by hand. Normaliser: 2 / (n k (2n - 3k - 1)) = 2 / 48.
  const opts = { standardizeOriginal: false };
  const orig = [[0], [1], [2], [3], [4], [5]];

  // Case A: point 5 is moved next to point 0 (embedded value -0.5).
  //   original NN (ties -> lower index): 0->1, 1->0, 2->1, 3->2, 4->3, 5->4
  //   embedded NN:                       0->5, 1->0, 2->1, 3->2, 4->3, 5->0
  //   T: i=0 gets j=5 with r_orig(0,5)=5 (+4); i=5 gets j=0 with r_orig(5,0)=5 (+4) -> penalty 8
  //   C: i=0 lost j=1, whose embedded rank around 0 is 2 (5 is first) (+1)
  //      i=5 lost j=4, whose embedded rank around 5 is 5 (0,1,2,3 come first) (+4) -> penalty 5
  const moved = [[0], [1], [2], [3], [4], [-0.5]];
  assert.equal(M.trustworthiness(orig, moved, 1, opts), 1 - (2 / 48) * 8);
  assert.equal(M.continuity(orig, moved, 1, opts), 1 - (2 / 48) * 5);

  // Case B: points 2 and 3 swap places (embedded values 0,1,3,2,4,5).
  //   embedded NN: 0->1, 1->0, 2->3 (tie with 4 -> lower index), 3->1 (tie with 2 -> lower index), 4->2, 5->4
  //   T: i=2 j=3 with r_orig(2,3)=2 (+1); i=3 j=1 with r_orig(3,1)=3 (order 2,4,1) (+2);
  //      i=4 j=2 with r_orig(4,2)=3 (order 3,5,2) (+2) -> penalty 5
  //   C: i=2 lost 1, whose embedded rank is 3 (order 3,4,1) (+2); i=3 lost 2, whose embedded rank is 2 (order 1,2) (+1);
  //      i=4 lost 3, whose embedded rank is 3 (order 2,5,3) (+2) -> penalty 5
  const swapped = [[0], [1], [3], [2], [4], [5]];
  assert.equal(M.trustworthiness(orig, swapped, 1, opts), 1 - (2 / 48) * 5);
  assert.equal(M.continuity(orig, swapped, 1, opts), 1 - (2 / 48) * 5);

  // Swapping roles: continuity(A,B) == trustworthiness(B,A) when neither side is standardised.
  const X = uniformMatrix(40, 5, 77);
  const Y = uniformMatrix(40, 2, 78);
  assert.equal(M.continuity(X, Y, 5, opts), M.trustworthiness(Y, X, 5, opts));
  assert.notEqual(M.continuity(X, Y, 5, opts), M.trustworthiness(X, Y, 5, opts));
});

test("trustworthiness: k validation and shape checks", () => {
  const X = uniformMatrix(10, 3, 1);
  const Y = uniformMatrix(10, 2, 2);
  assert.throws(() => M.trustworthiness(X, Y, 5), RangeError); // k >= n/2
  assert.throws(() => M.trustworthiness(X, Y, 10), RangeError); // k >= n
  assert.throws(() => M.trustworthiness(X, Y, 12), RangeError);
  assert.throws(() => M.trustworthiness(X, Y, 0), RangeError);
  assert.throws(() => M.trustworthiness(X, Y, 2.5), RangeError);
  assert.throws(() => M.continuity(X, Y, 5), RangeError);
  assert.doesNotThrow(() => M.trustworthiness(X, Y, 4));
  assert.throws(() => M.trustworthiness(X, uniformMatrix(9, 2, 2), 3), RangeError);
  const bad = uniformMatrix(10, 3, 1);
  bad[3][1] = NaN;
  assert.throws(() => M.trustworthiness(bad, Y, 3), TypeError);
  const ragged = uniformMatrix(10, 3, 1);
  ragged[2] = [1, 2];
  assert.throws(() => M.trustworthiness(ragged, Y, 3), TypeError);
  const ctx = M.makeRankContext(X, { standardize: true });
  assert.throws(() => M.trustworthiness(ctx, Y, 3, { standardizeOriginal: false }), Error);
});

test("a precomputed UNstandardized original space is rejected unless standardizeOriginal is false (review fix)", () => {
  // Before the fix, makeRankContext(X) (standardize defaults to false) or
  // squaredDistanceMatrix(X) passed as `original` silently scored the raw space, a
  // different number from trustworthiness(X, Y, k).
  const X = structuredMatrix(40, 10, 17);
  for (const row of X) row[0] *= 50; // unequal column scales, so standardising changes ranks
  const Y = projectEmbedding(X, 18);
  const rawCtx = M.makeRankContext(X);
  const rawDm = M.squaredDistanceMatrix(X);
  for (const fn of [M.trustworthiness, M.continuity]) {
    assert.throws(() => fn(rawCtx, Y, 5), /standardized=false/);
    assert.throws(() => fn(rawDm, Y, 5), /standardized=false/);
    assert.throws(() => fn(M.asDistanceMatrix(rawDm.data, 40), Y, 5), /standardized=false/);
    const off = { standardizeOriginal: false };
    assert.equal(fn(rawCtx, Y, 5, off), fn(X, Y, 5, off));
    assert.equal(fn(rawDm, Y, 5, off), fn(X, Y, 5, off));
  }
  assert.equal(M.trustworthiness(M.squaredDistanceMatrix(X, { standardize: true }), Y, 5), oracle.trustworthiness(X, Y, 5));
});

test("mean follows the NaN policy (review fix)", () => {
  assert.equal(M.mean([1, 2, 3, 6]), 3);
  assert.throws(() => M.mean([1, NaN]), TypeError);
  assert.equal(M.mean([1, NaN, 3], { dropNaN: true }), 2);
  assert.throws(() => M.mean([]), RangeError);
});

test("trustworthiness accepts typed-array rows", () => {
  const X = structuredMatrix(30, 10, 4);
  const Y = projectEmbedding(X, 5);
  const Xt = X.map((r) => Float64Array.from(r));
  const Yt = Y.map((r) => Float32Array.from(r).map((v) => v)); // Float32 changes values; compare against oracle on the same values
  assert.equal(M.trustworthiness(Xt, Yt, 4), oracle.trustworthiness(X, Yt.map((r) => Array.from(r)), 4));
});

// ---------------------------------------------------------------------------
// kNN + overlap
// ---------------------------------------------------------------------------
test("knn matches a brute-force stable-sort reference, with and without exclusion", () => {
  const X = uniformMatrix(25, 3, 9, { quantize: true });
  const times = X.map((_, i) => i * 0.25);
  const exclude = (i, j) => Math.abs(times[i] - times[j]) < 1.5;
  const { neighbors, distances } = M.knn(X, 3, { excludeWithin: exclude });
  for (let i = 0; i < X.length; i += 1) {
    const cands = [];
    for (let j = 0; j < X.length; j += 1) {
      if (i === j || exclude(i, j)) continue;
      cands.push({ index: j, distance: oracle.squaredDistance(X[i], X[j]) });
    }
    cands.sort((a, b) => a.distance - b.distance);
    assert.deepEqual(Array.from(neighbors[i]), cands.slice(0, 3).map((c) => c.index));
    assert.deepEqual(Array.from(distances[i]), cands.slice(0, 3).map((c) => c.distance));
  }
  const plain = M.knn(X, 4);
  const ref = oracle.ranksByDistance(X);
  for (let i = 0; i < X.length; i += 1) assert.deepEqual(Array.from(plain.neighbors[i]), ref[i].nearest.slice(0, 4));
});

test("knn returns short lists when exclusions leave fewer than k candidates, and k >= n returns everyone", () => {
  const X = [[0], [1], [2], [3]];
  const r = M.knn(X, 3, { excludeWithin: (i, j) => Math.abs(i - j) < 3 });
  assert.deepEqual(r.neighbors.map((a) => Array.from(a)), [[3], [], [], [0]]);
  const all = M.knn(X, 10);
  assert.deepEqual(all.neighbors.map((a) => Array.from(a)), [[1, 2, 3], [0, 2, 3], [1, 3, 0], [2, 1, 0]]);
  assert.throws(() => M.knn(X, 0), RangeError);
});

test("knn accepts a RankContext without distances", () => {
  const X = uniformMatrix(15, 2, 3);
  const ctx = M.makeRankContext(X, { keepDistances: false });
  const r = M.knn(ctx, 2);
  assert.equal(r.distances, null);
  assert.deepEqual(r.neighbors.map((a) => Array.from(a)), M.knn(X, 2).neighbors.map((a) => Array.from(a)));
});

test("neighborOverlap: recall@k and Jaccard hand cases", () => {
  const A = [[1, 2, 3], [0, 2], [], [9]];
  const B = [[1, 2, 4], [0, 2], [], [8]];
  const r = M.neighborOverlap(A, B);
  assert.deepEqual(Array.from(r.perPointRecall.subarray(0, 2)), [2 / 3, 1]);
  assert.ok(Number.isNaN(r.perPointRecall[2]));
  assert.equal(r.perPointRecall[3], 0);
  assert.equal(r.recallAtK, (2 / 3 + 1 + 0) / 3);
  assert.equal(r.perPointJaccard[0], 2 / 4);
  assert.equal(r.jaccard, (0.5 + 1 + 0) / 3);
  assert.deepEqual(r.counted, { recall: 3, jaccard: 3 });
  const k1 = M.neighborOverlap(A, B, { k: 1 });
  assert.equal(k1.recallAtK, (1 + 1 + 0) / 3);
  assert.throws(() => M.neighborOverlap(A, B.slice(0, 2)), RangeError);
});

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------
test("makeRandom and randomMatchedMatrix are exact ports and deterministic", () => {
  const a = M.makeRandom(20260720);
  const b = oracle.makeRandom(20260720);
  for (let i = 0; i < 1000; i += 1) assert.equal(a(), b());
  // Known first value: state = (1664525*20260720 + 1013904223) mod 2^32, divided by 2^32.
  const first = Number((1664525n * 20260720n + 1013904223n) % 2n ** 32n) / 2 ** 32;
  assert.equal(M.makeRandom(20260720)(), first);
  const shape = structuredMatrix(20, 11, 2);
  const r1 = M.randomMatchedMatrix(shape, 20260723);
  assert.deepEqual(r1, oracle.randomMatchedMatrix(shape, 20260723));
  assert.deepEqual(r1, M.randomMatchedMatrix(shape, 20260723));
  assert.notDeepEqual(r1, M.randomMatchedMatrix(shape, 20260724));
  // Typed-array rows give the same values (only the shape is used).
  assert.deepEqual(M.randomMatchedMatrix(shape.map((r) => Float64Array.from(r)), 20260723), r1);
});

test("columnPermutedMatrix keeps every column's multiset, is deterministic and leaves the input alone", () => {
  const X = structuredMatrix(40, 6, 3);
  const copy = X.map((r) => r.slice());
  const P = M.columnPermutedMatrix(X, 42);
  assert.deepEqual(X, copy);
  assert.deepEqual(P, M.columnPermutedMatrix(X, 42));
  assert.notDeepEqual(P, M.columnPermutedMatrix(X, 43));
  let moved = 0;
  for (let j = 0; j < 6; j += 1) {
    const before = X.map((r) => r[j]).sort((a, b) => a - b);
    const after = P.map((r) => r[j]).sort((a, b) => a - b);
    assert.deepEqual(after, before);
    for (let i = 0; i < 40; i += 1) if (P[i][j] !== X[i][j]) moved += 1;
  }
  assert.ok(moved > 200, `expected most cells to move, moved=${moved}`);
});

test("negative controls score lower than structured data (sanity, not a benchmark)", () => {
  const X = structuredMatrix(80, 20, 31);
  const Y = projectEmbedding(X, 32);
  const P = M.columnPermutedMatrix(X, 33);
  const PY = projectEmbedding(P, 32);
  assert.ok(M.trustworthiness(X, Y, 5) > M.trustworthiness(P, PY, 5));
});

// ---------------------------------------------------------------------------
// Correlation + nulls
// ---------------------------------------------------------------------------
test("pearson and spearman match scipy 1.13.1 (ties included)", () => {
  // scipy.stats.spearmanr(x, y).statistic / scipy.stats.pearsonr(x, y).statistic
  const x = [1, 2, 2, 3, 5, 5, 5, 8, 9, 10, 3, 1];
  const y = [2, 1, 4, 4, 6, 5, 7, 9, 8, 12, 3, 0];
  assert.ok(Math.abs(M.spearman(x, y) - 0.9468620919467722) < 1e-14);
  assert.ok(Math.abs(M.pearson(x, y) - 0.9452029568645977) < 1e-14);
});

test("pearson/spearman edge cases: perfect, constant, NaN policy", () => {
  assert.equal(M.pearson([1, 2, 3], [2, 4, 6]), 1);
  assert.equal(M.pearson([1, 2, 3], [3, 2, 1]), -1);
  assert.equal(M.spearman([1, 2, 3, 4], [1, 8, 27, 64]), 1);
  assert.ok(Number.isNaN(M.pearson([1, 1, 1], [1, 2, 3])));
  assert.ok(Number.isNaN(M.spearman([5, 5, 5], [1, 2, 3])));
  assert.ok(Number.isNaN(M.pearson([1], [2])));
  assert.throws(() => M.pearson([1, NaN, 3], [1, 2, 3]), TypeError);
  assert.throws(() => M.pearson([1, Infinity, 3], [1, 2, 3], { dropNaN: true }), TypeError);
  assert.throws(() => M.pearson([1, 2], [1, 2, 3]), RangeError);
  assert.equal(M.pearson([1, NaN, 2, 3], [2, 99, 4, 6], { dropNaN: true }), 1);
  assert.deepEqual(Array.from(M.averageRanks([10, 20, 20, 5])), [2, 3.5, 3.5, 1]);
});

test("circularShiftNull: exhaustive mode equals a brute-force rotation distribution", () => {
  const n = 60;
  const rnd = M.makeRandom(5);
  const x = Array.from({ length: n }, (_, i) => Math.sin(i / 4) + 0.2 * rnd());
  const y = x.map((v) => 0.8 * v + 0.3 * rnd());
  const minShift = 10;
  const res = M.circularShiftNull(x, y, { minShift, B: 1000 });
  assert.equal(res.mode, "exhaustive");
  assert.equal(res.admissibleShifts, n - 2 * minShift + 1);
  const observed = M.pearson(x, y);
  assert.equal(res.observed, observed);
  const nullVals = [];
  for (let s = minShift; s <= n - minShift; s += 1) nullVals.push(M.pearson(x, x.map((_, t) => y[(t + s) % n])));
  const extreme = nullVals.filter((v) => Math.abs(v) >= Math.abs(observed) * (1 - 1e-12)).length;
  assert.equal(res.count, nullVals.length);
  assert.equal(res.p, (1 + extreme) / (nullVals.length + 1));
  assert.equal(res.nullDistribution.count, nullVals.length);
  assert.equal(res.nullDistribution.max, Math.max(...nullVals));
});

test("circularShiftNull: random mode is seeded, spearman and custom statistics work, errors are raised", () => {
  const n = 400;
  const rnd = M.makeRandom(8);
  const x = Array.from({ length: n }, () => rnd());
  const y = Array.from({ length: n }, () => rnd());
  const a = M.circularShiftNull(x, y, { minShift: 5, B: 99, seed: 1 });
  const b = M.circularShiftNull(x, y, { minShift: 5, B: 99, seed: 1 });
  assert.equal(a.mode, "random");
  assert.deepEqual(a, b);
  assert.equal(a.count, 99);
  assert.ok(a.p > 0 && a.p <= 1);
  const s = M.circularShiftNull(x, y, { minShift: 150, statistic: "spearman" });
  assert.equal(s.observed, M.spearman(x, y));
  assert.equal(s.mode, "exhaustive");
  const c = M.circularShiftNull(x, y, { minShift: 150, statistic: function meanDiff(u, v) { return M.mean(u) - M.mean(v); } });
  assert.equal(c.statistic, "meanDiff");
  assert.throws(() => M.circularShiftNull(x, y, { minShift: 0 }), RangeError);
  assert.throws(() => M.circularShiftNull(x, y, { minShift: 201 }), RangeError);
  assert.throws(() => M.circularShiftNull(x, y.slice(1), { minShift: 5 }), RangeError);
  const withNaN = x.slice();
  withNaN[3] = NaN;
  assert.throws(() => M.circularShiftNull(withNaN, y, { minShift: 5 }), TypeError);
  assert.doesNotThrow(() => M.circularShiftNull(withNaN, y, { minShift: 150, dropNaN: true }));
  const constant = M.circularShiftNull(new Array(n).fill(1), y, { minShift: 150 });
  assert.ok(Number.isNaN(constant.observed) && Number.isNaN(constant.p));
  assert.equal(constant.nullDistribution, null);
});

test("circularShiftNull: a strongly locked pair gets the smallest possible p; independent noise does not", () => {
  const n = 200;
  // A sawtooth ramp. Every non-zero rotation breaks the linear relation. (A symmetric
  // triangle would NOT work here: rotating it by n/2 gives an exact r = -1.)
  const x = Array.from({ length: n }, (_, i) => i);
  const locked = M.circularShiftNull(x, x, { minShift: 20 });
  assert.equal(locked.p, 1 / (locked.count + 1));
  const rnd = M.makeRandom(99);
  const noise = Array.from({ length: n }, () => rnd());
  const free = M.circularShiftNull(x, noise, { minShift: 20 });
  assert.ok(free.p > 0.05, `p=${free.p}`);
});

test("holm matches statsmodels 0.14.6 multipletests(method='holm')", () => {
  const p = [0.01, 0.04, 0.03, 0.005, 0.2, 0.04];
  const expected = [0.05, 0.12, 0.12, 0.03, 0.2, 0.12];
  const got = M.holm(p);
  for (let i = 0; i < p.length; i += 1) assert.ok(Math.abs(got[i] - expected[i]) < 1e-15, `${i}: ${got[i]}`);
  assert.deepEqual(Array.from(M.holm([0.9, 0.8])), [1, 1]); // 2*0.8 -> capped at 1; monotone step-down lifts 0.9 to 1
  assert.deepEqual(Array.from(M.holm([0.01, 0.02, 0.03])), [0.03, 0.04, 0.04]); // 3*0.01, 2*0.02, max(0.04, 1*0.03)
  assert.deepEqual(Array.from(M.holm([])), []);
  assert.throws(() => M.holm([0.1, NaN]), TypeError);
  assert.throws(() => M.holm([1.2]), RangeError);
});

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------
test("quantile/median/iqr match numpy 2.0.2 (linear = type 7)", () => {
  // np.quantile(v, q); scipy.stats.iqr(v)
  const v = [3.1, -1.2, 7.7, 0.4, 2.2, 9.9, 5.5, -3.3, 4.4, 1.0];
  const qs = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
  const expected = [-3.3, -1.41, 0.55, 2.6500000000000004, 5.225, 7.919999999999999, 9.9];
  qs.forEach((q, i) => assert.ok(Math.abs(M.quantile(v, q) - expected[i]) < 1e-12, `q=${q}: ${M.quantile(v, q)}`));
  assert.ok(Math.abs(M.median(v) - 2.65) < 1e-12);
  assert.ok(Math.abs(M.iqr(v) - 4.675) < 1e-12);
  assert.equal(M.median([5]), 5);
  assert.equal(M.median([1, 3]), 2);
  assert.throws(() => M.median([]), RangeError);
  assert.throws(() => M.median([1, NaN]), TypeError);
  assert.equal(M.median([1, NaN, 3], { dropNaN: true }), 2);
  assert.throws(() => M.quantile([1, 2], 1.5), RangeError);
});

test("bootstrapCI: deterministic, brackets the estimate, reacts to seed and alpha", () => {
  const rnd = M.makeRandom(4);
  const v = Array.from({ length: 50 }, () => rnd() * 10);
  const a = M.bootstrapCI(v, { seed: 1 });
  assert.deepEqual(a, M.bootstrapCI(v, { seed: 1 }));
  assert.equal(a.B, 2000);
  assert.equal(a.alpha, 0.05);
  assert.equal(a.estimate, M.mean(v));
  assert.ok(a.lower < a.estimate && a.estimate < a.upper);
  assert.notDeepEqual(a, M.bootstrapCI(v, { seed: 2 }));
  const wide = M.bootstrapCI(v, { seed: 1, alpha: 0.01 });
  assert.ok(wide.lower <= a.lower && wide.upper >= a.upper);
  const med = M.bootstrapCI(v, { stat: "median", seed: 1, B: 500 });
  assert.equal(med.estimate, M.median(v));
  const constant = M.bootstrapCI([3, 3, 3, 3], { seed: 1, B: 100 });
  assert.deepEqual([constant.lower, constant.upper, constant.se], [3, 3, 0]);
  assert.throws(() => M.bootstrapCI([], {}), RangeError);
  assert.throws(() => M.bootstrapCI([1, 2], { alpha: 0 }), RangeError);
  assert.throws(() => M.bootstrapCI([1, NaN]), TypeError);
});

test("bootstrapCI: the percentile interval for a mean is close to the normal-theory interval (large n)", () => {
  // Sanity check only: for n = 400 uniform(0,1) data, the bootstrap SE should be within 10%
  // of s/sqrt(n).
  const rnd = M.makeRandom(12);
  const v = Array.from({ length: 400 }, () => rnd());
  const r = M.bootstrapCI(v, { seed: 3 });
  const s = Math.sqrt(v.reduce((acc, x) => acc + (x - M.mean(v)) ** 2, 0) / (v.length - 1));
  const se = s / Math.sqrt(v.length);
  assert.ok(Math.abs(r.se / se - 1) < 0.1, `bootstrap se ${r.se} vs analytic ${se}`);
});

test("pairedBootstrapCI resamples pairs together", () => {
  const rnd = M.makeRandom(6);
  const a = Array.from({ length: 40 }, () => rnd());
  const b = a.map((v) => v - 0.1); // a - b == 0.1 exactly per pair (up to rounding)
  const r = M.pairedBootstrapCI(a, b, { seed: 1, B: 500 });
  assert.ok(Math.abs(r.estimate - 0.1) < 1e-12);
  assert.ok(r.upper - r.lower < 1e-12, "a paired constant difference has a zero-width interval");
  const unpaired = M.bootstrapCI(a, { seed: 1, B: 500 });
  assert.ok(unpaired.upper - unpaired.lower > 0.05);
  const custom = M.pairedBootstrapCI(a, b, { seed: 1, B: 200, stat: (x, y) => M.pearson(x, y) });
  assert.ok(custom.estimate > 0.999);
  assert.throws(() => M.pairedBootstrapCI([1, 2], [1]), RangeError);
});

test("normalCdf and erfc match scipy 1.13.1", () => {
  const cdf = [
    [-8, 6.22096057427174e-16], [-5, 2.8665157187919344e-07], [-3, 0.001349898031630093],
    [-1.96, 0.024997895148220435], [-1, 0.15865525393145707], [-0.5, 0.3085375387259869], [0, 0.5],
    [0.5, 0.6914624612740131], [1, 0.8413447460685429], [1.959963984540054, 0.975], [3, 0.9986501019683699],
    [5, 0.9999997133484281],
  ];
  for (const [z, p] of cdf) assert.ok(Math.abs(M.normalCdf(z) - p) <= 1e-14 * Math.max(1e-300, p) + 1e-16, `Phi(${z})=${M.normalCdf(z)} vs ${p}`);
  const e = [
    [0, 1.0], [0.1, 0.8875370839817152], [0.5, 0.4795001221869535], [1, 0.15729920705028516],
    [2, 0.004677734981047266], [2.49, 0.00042928786773391303], [2.5, 0.0004069520174449589],
    [2.51, 0.0003857054817242799], [3, 2.2090496998585445e-05], [4, 1.541725790028002e-08],
    [6, 2.151973671249891e-17], [10, 2.0884875837625446e-45], [20, 5.395865611607902e-176], [26, 5.663192408856145e-296],
  ];
  for (const [x, v] of e) {
    const rel = Math.abs(M.erfc(x) - v) / v;
    // The series branch (x < 2.5) cancels in 1 - erf(x); allow 1e-12 relative error there, 1e-14 elsewhere.
    assert.ok(rel < (x < 2.5 ? 1e-12 : 1e-14), `erfc(${x})=${M.erfc(x)} vs ${v} rel=${rel}`);
  }
});

function bruteForceWilcoxonP(diffs) {
  const nz = diffs.filter((d) => d !== 0);
  const ranks = M.averageRanks(nz.map(Math.abs));
  const w = nz.reduce((s, d, i) => s + (d > 0 ? ranks[i] : 0), 0);
  const n = nz.length;
  let le = 0;
  let ge = 0;
  for (let mask = 0; mask < 1 << n; mask += 1) {
    let s = 0;
    for (let i = 0; i < n; i += 1) if (mask & (1 << i)) s += ranks[i];
    if (s <= w + 1e-9) le += 1;
    if (s >= w - 1e-9) ge += 1;
  }
  return Math.min(1, (2 * Math.min(le, ge)) / 2 ** n);
}

test("wilcoxonSignedRank exact: Fisher/Darwin corn data matches scipy docs (p = 0.041259765625)", () => {
  // scipy.stats.wilcoxon(corn) -> statistic 24.0, pvalue 0.041259765625 (exact); same as the
  // example in the scipy.stats.wilcoxon documentation.
  const corn = [6, 8, 14, 16, 23, 24, 28, 29, 41, -48, 49, 56, 60, -67, 75];
  const r = M.wilcoxonSignedRank(corn);
  assert.equal(r.method, "exact");
  assert.equal(r.statistic, 24);
  assert.equal(r.wMinus, 24);
  assert.equal(r.wPlus, 96);
  assert.equal(r.p, 0.041259765625);
  assert.equal(r.p, bruteForceWilcoxonP(corn));
  // Paired form: a - b gives the same differences.
  const b = corn.map((_, i) => 100 + i);
  const a = corn.map((d, i) => b[i] + d);
  assert.equal(M.wilcoxonSignedRank(a, b).p, 0.041259765625);
});

test("wilcoxonSignedRank normal approximation matches scipy 1.13.1 (with/without correction, ties, zeros)", () => {
  const corn = [6, 8, 14, 16, 23, 24, 28, 29, 41, -48, 49, 56, 60, -67, 75];
  // scipy.stats.wilcoxon(corn, method='approx') (correction=False)
  assert.ok(Math.abs(M.wilcoxonSignedRank(corn, null, { mode: "normal", correction: false }).p - 0.04088813291185591) < 1e-14);
  // scipy.stats.wilcoxon(corn, method='approx', correction=True)
  assert.ok(Math.abs(M.wilcoxonSignedRank(corn, null, { mode: "normal" }).p - 0.043772323763041174) < 1e-14);
  // 25 differences with several tie groups; auto picks the normal approximation because n > 20.
  const ties = [1, 2, 2, -3, 4, 4, 4, -5, 6, 7, -2, 8, 9, 1, 3, 3, -1, 10, 11, 12, 2, -4, 13, 5, 6];
  const t = M.wilcoxonSignedRank(ties);
  assert.equal(t.method, "normal");
  assert.equal(t.statistic, 44.5);
  assert.ok(Math.abs(t.p - 0.0015462381037074514) < 1e-14, `ties corr p=${t.p}`);
  assert.ok(Math.abs(M.wilcoxonSignedRank(ties, null, { correction: false }).p - 0.0014761370908613538) < 1e-14);
  // Zeros dropped (zero_method='wilcox'): scipy.stats.wilcoxon(z, method='approx', correction=True)
  const z = [0.5, 1.2, 3.3, 2.0, 0.0, 4.1, -0.7, 2.2, 1.9, 0.0, 3.0, -1.5, 2.7, 0.9, 1.1, 5.2, -0.3, 2.4, 1.8, 0.6, 3.9, -2.2];
  const zr = M.wilcoxonSignedRank(z, null, { mode: "normal" });
  assert.equal(zr.zeros, 2);
  assert.equal(zr.n, 20);
  assert.equal(zr.statistic, 25.5);
  assert.ok(Math.abs(zr.p - 0.003182495964600433) < 1e-14, `zeros p=${zr.p}`);
});

test("wilcoxonSignedRank exact with ties and zeros equals brute-force enumeration", () => {
  const cases = [
    [1, 2, 2, -3, 4, 4, 4, -5, 6, 7],
    [0, 1, -1, 2, -2, 2, 3, 0, 5, -5, 5, 6],
    [3, -1, 4, 1, -5, 9, 2, -6, 5, 3, -5, 8, 9, 7, -9, 3, 2, 3],
    [1, 1, 1, 1],
    [-2],
  ];
  for (const d of cases) {
    const r = M.wilcoxonSignedRank(d);
    assert.equal(r.method, "exact");
    assert.ok(Math.abs(r.p - bruteForceWilcoxonP(d)) < 1e-15, `${d}: ${r.p} vs ${bruteForceWilcoxonP(d)}`);
  }
  // Textbook boundary: n = 5, all positive -> W+ = 15, p = 2/32 = 0.0625.
  assert.equal(M.wilcoxonSignedRank([1, 2, 3, 4, 5]).p, 0.0625);
  // n = 6, all positive -> p = 2/64 = 0.03125.
  assert.equal(M.wilcoxonSignedRank([1, 2, 3, 4, 5, 6]).p, 0.03125);
});

test("wilcoxonSignedRank edge cases", () => {
  const zero = M.wilcoxonSignedRank([0, 0, 0]);
  assert.equal(zero.method, "degenerate");
  assert.equal(zero.p, 1);
  assert.throws(() => M.wilcoxonSignedRank([1, NaN, 2]), TypeError);
  assert.equal(M.wilcoxonSignedRank([1, NaN, 2], null, { dropNaN: true }).n, 2);
  assert.throws(() => M.wilcoxonSignedRank([1, 2], [1]), RangeError);
  assert.throws(() => M.wilcoxonSignedRank([1, 2], null, { mode: "bogus" }), TypeError);
});

// ---------------------------------------------------------------------------
// Performance at production scale (n = 700, d = 3078). This does not run by default because
// it takes a few seconds. Set METRICS_PERF=1 to run it.
// ---------------------------------------------------------------------------
test("perf: a RankContext at n=700, d=3078 is reused across 10 embeddings", { skip: !process.env.METRICS_PERF }, () => {
  const n = 700;
  const d = 3078;
  const rnd = M.makeRandom(1);
  const X = Array.from({ length: n }, () => Float64Array.from({ length: d }, () => rnd()));
  let t0 = process.hrtime.bigint();
  const ctx = M.makeRankContext(X, { standardize: true });
  const buildMs = Number(process.hrtime.bigint() - t0) / 1e6;
  t0 = process.hrtime.bigint();
  for (let s = 0; s < 10; s += 1) {
    const Y = Array.from({ length: n }, () => [rnd(), rnd(), rnd()]);
    const t = M.trustworthiness(ctx, Y, 5);
    assert.ok(t > 0 && t < 1);
  }
  const scoreMs = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(`[metrics perf] makeRankContext(700x3078, standardize) ${buildMs.toFixed(0)} ms; 10x trustworthiness ${scoreMs.toFixed(0)} ms`);
});
