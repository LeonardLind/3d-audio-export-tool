"use strict";

/**
 * Shared, tested statistics for the v2.0 experiments and exporter.
 *
 * Everything that used to be copy-pasted into each tools/run_experiment_*.js runner lives
 * here once, with tests in tools/test/metrics.test.js.
 *
 * Conventions (read these before using the module):
 *
 * - A "matrix" is an array of rows (plain arrays or typed arrays), all the same length.
 * - Distances are squared Euclidean unless a function says otherwise. Neighbour order is
 *   ascending distance, and ties go to the LOWER index first. That is what the stable
 *   `Array.prototype.sort` gave in tools/run_experiment_001.js and in the exporter's
 *   buildSimilarityEdges.
 * - trustworthiness/continuity z-score the ORIGINAL space before ranking (population std,
 *   and a zero-std column is divided by 1). The EMBEDDED space is ranked as given. This is
 *   exactly what Experiments 001-006 did.
 * - Non-finite policy: NaN, +/-Infinity and non-numbers make every function throw a
 *   TypeError. The 1-D functions that take `opts.dropNaN: true` instead drop NaN entries
 *   (pairwise for two-sample functions). Infinity still throws. Matrices never drop values.
 * - Randomness: every random routine takes a `seed` and uses makeRandom (the same 32-bit
 *   LCG as Experiment 001). Same inputs + same seed = same output. If you leave the seed
 *   out, DEFAULT_SEED (the project's Experiment 001 base seed, 20260720) is used.
 * - Quantiles are "type 7" (linear interpolation between order statistics; the default in
 *   R and NumPy).
 */

/** Project base seed used by Experiment 001 (RANDOM_SEED in tools/run_experiment_001.js). */
const DEFAULT_SEED = 20260720;

const RANK_CONTEXT = Symbol.for("birdsong.metrics.RankContext");
const DISTANCE_MATRIX = Symbol.for("birdsong.metrics.DistanceMatrix");

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function assertFiniteNumber(value, where) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${where}: expected a finite number, got ${String(value)}`);
  }
}

/**
 * Check a matrix: it must be non-empty, rectangular and fully finite.
 * @param {ArrayLike<ArrayLike<number>>} matrix
 * @param {string} name used in error messages
 * @returns {{ n: number, d: number }}
 */
function validateMatrix(matrix, name = "matrix") {
  if (!matrix || typeof matrix.length !== "number" || matrix.length === 0) {
    throw new TypeError(`${name}: expected a non-empty array of rows`);
  }
  const n = matrix.length;
  const first = matrix[0];
  if (!first || typeof first.length !== "number" || first.length === 0) {
    throw new TypeError(`${name}: rows must be non-empty arrays`);
  }
  const d = first.length;
  for (let i = 0; i < n; i += 1) {
    const row = matrix[i];
    if (!row || row.length !== d) {
      throw new TypeError(`${name}: row ${i} has length ${row ? row.length : "n/a"}, expected ${d}`);
    }
    for (let j = 0; j < d; j += 1) {
      const v = row[j];
      if (typeof v !== "number" || !Number.isFinite(v)) {
        throw new TypeError(`${name}: non-finite value ${String(v)} at [${i}][${j}] (NaN is never dropped from matrices)`);
      }
    }
  }
  return { n, d };
}

/**
 * Turn a 1-D input into a Float64Array, following the module's NaN policy.
 * @param {ArrayLike<number>} values
 * @param {string} name
 * @param {{ dropNaN?: boolean }} [opts]
 * @returns {Float64Array}
 */
function toVector(values, name, opts = {}) {
  if (!values || typeof values.length !== "number") throw new TypeError(`${name}: expected an array`);
  const out = [];
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (typeof v === "number" && Number.isNaN(v) && opts.dropNaN) continue;
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new TypeError(`${name}: non-finite value ${String(v)} at index ${i} (pass { dropNaN: true } to drop NaN)`);
    }
    out.push(v);
  }
  return Float64Array.from(out);
}

/**
 * Turn two equal-length 1-D inputs into Float64Arrays. With dropNaN, a pair is removed
 * when EITHER side is NaN.
 * @returns {[Float64Array, Float64Array]}
 */
function toPairedVectors(x, y, name, opts = {}) {
  if (!x || !y || typeof x.length !== "number" || typeof y.length !== "number") {
    throw new TypeError(`${name}: expected two arrays`);
  }
  if (x.length !== y.length) throw new RangeError(`${name}: length mismatch ${x.length} vs ${y.length}`);
  const a = [];
  const b = [];
  for (let i = 0; i < x.length; i += 1) {
    const u = x[i];
    const v = y[i];
    if (opts.dropNaN && ((typeof u === "number" && Number.isNaN(u)) || (typeof v === "number" && Number.isNaN(v)))) continue;
    if (typeof u !== "number" || !Number.isFinite(u)) {
      throw new TypeError(`${name}: non-finite x value ${String(u)} at index ${i} (pass { dropNaN: true } to drop NaN)`);
    }
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new TypeError(`${name}: non-finite y value ${String(v)} at index ${i} (pass { dropNaN: true } to drop NaN)`);
    }
    a.push(u);
    b.push(v);
  }
  return [Float64Array.from(a), Float64Array.from(b)];
}

// ---------------------------------------------------------------------------
// Standardisation and distances (exact ports of run_experiment_001.js)
// ---------------------------------------------------------------------------

/**
 * Column z-scoring exactly as in tools/run_experiment_001.js `standardize`: population std
 * (divide by n), a column with std 0 is divided by 1, and the sums run in the same order,
 * so the results are bit-identical.
 * @param {ArrayLike<ArrayLike<number>>} matrix
 * @returns {Float64Array[]} a new matrix; the input is not changed
 */
function standardize(matrix) {
  const { n, d } = validateMatrix(matrix, "standardize");
  const means = new Float64Array(d);
  const scales = new Float64Array(d);
  for (let j = 0; j < d; j += 1) {
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += matrix[i][j];
    const avg = sum / n;
    let sq = 0;
    for (let i = 0; i < n; i += 1) sq += (matrix[i][j] - avg) ** 2;
    means[j] = avg;
    scales[j] = Math.sqrt(sq / n) || 1;
  }
  const out = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const row = new Float64Array(d);
    for (let j = 0; j < d; j += 1) row[j] = (matrix[i][j] - means[j]) / scales[j];
    out[i] = row;
  }
  return out;
}

/**
 * Squared Euclidean distance between two equal-length vectors. The sum runs in the same
 * order as run_experiment_001.js `squaredDistance`.
 * @param {ArrayLike<number>} a
 * @param {ArrayLike<number>} b
 * @returns {number}
 */
function squaredDistance(a, b) {
  let total = 0;
  for (let i = 0; i < a.length; i += 1) total += (a[i] - b[i]) ** 2;
  return total;
}

/**
 * All pairwise squared Euclidean distances, as a dense n x n Float64Array (row-major, zero
 * diagonal). Costs O(n^2 d). For n = 700 and d = 3078 this is about 7.5e8 multiply-adds
 * and uses 3.9 MB.
 * @param {ArrayLike<ArrayLike<number>>} matrix
 * @param {{ standardize?: boolean }} [opts] if standardize is true, z-score the columns first (see standardize)
 * @returns {{ n: number, data: Float64Array, standardized: boolean }}
 */
function squaredDistanceMatrix(matrix, opts = {}) {
  const doStandardize = Boolean(opts.standardize);
  const rows = doStandardize ? standardize(matrix) : matrix;
  const { n, d } = validateMatrix(rows, "squaredDistanceMatrix");
  // Copy into one flat buffer so the inner loop is cache-friendly.
  const flat = new Float64Array(n * d);
  for (let i = 0; i < n; i += 1) {
    const row = rows[i];
    for (let j = 0; j < d; j += 1) flat[i * d + j] = row[j];
  }
  const data = new Float64Array(n * n);
  for (let i = 0; i < n; i += 1) {
    const oi = i * d;
    for (let j = i + 1; j < n; j += 1) {
      const oj = j * d;
      let total = 0;
      for (let c = 0; c < d; c += 1) total += (flat[oi + c] - flat[oj + c]) ** 2;
      // (a-b)^2 === (b-a)^2 exactly in IEEE-754, so the matrix is exactly symmetric.
      data[i * n + j] = total;
      data[j * n + i] = total;
    }
  }
  const result = { n, data, standardized: doStandardize };
  Object.defineProperty(result, DISTANCE_MATRIX, { value: true });
  return result;
}

/**
 * Wrap an existing dense squared-distance buffer so the functions here accept it.
 * @param {Float64Array|number[]} data row-major n x n
 * @param {number} n
 * @param {{ standardized?: boolean }} [opts]
 * @returns {{ n: number, data: Float64Array, standardized: boolean }}
 */
function asDistanceMatrix(data, n, opts = {}) {
  if (!Number.isInteger(n) || n < 1 || !data || data.length !== n * n) {
    throw new RangeError("asDistanceMatrix: data must have length n*n");
  }
  const arr = data instanceof Float64Array ? data : Float64Array.from(data);
  for (let i = 0; i < arr.length; i += 1) {
    if (Number.isNaN(arr[i]) || arr[i] < 0) {
      throw new TypeError(`asDistanceMatrix: NaN or negative distance at flat index ${i}`);
    }
  }
  const result = { n, data: arr, standardized: Boolean(opts.standardized) };
  Object.defineProperty(result, DISTANCE_MATRIX, { value: true });
  return result;
}

function isDistanceMatrix(x) {
  return Boolean(x && x[DISTANCE_MATRIX]);
}

function isRankContext(x) {
  return Boolean(x && x[RANK_CONTEXT]);
}

/**
 * Build the neighbour-rank structure once so it can be reused across many embeddings.
 *
 * For each point i: `order[i*(n-1) .. ]` lists the other points by ascending distance (ties
 * go to the lower index), and `rank[i*n + j]` is j's 1-based position in that list. The
 * point itself gets rank n (last), matching the old ranksByDistance, which gave self a
 * distance of Infinity.
 *
 * Reuse example: `const ctx = makeRankContext(features, { standardize: true });` then call
 * `trustworthiness(ctx, embedding, 5)` for every embedding. The O(n^2 d) work happens once.
 *
 * @param {ArrayLike<ArrayLike<number>> | {n:number,data:Float64Array}} input a point matrix, or a distance matrix from squaredDistanceMatrix/asDistanceMatrix
 * @param {{ standardize?: boolean, keepDistances?: boolean }} [opts] standardize applies only to a point matrix (default false). keepDistances defaults to true.
 * @returns {{ n:number, order:Int32Array, rank:Int32Array, distances:(Float64Array|null), standardized:boolean }}
 */
function makeRankContext(input, opts = {}) {
  if (isRankContext(input)) return input;
  let dm;
  if (isDistanceMatrix(input)) {
    if (opts.standardize !== undefined && Boolean(opts.standardize) !== input.standardized) {
      throw new Error("makeRankContext: standardize option conflicts with the supplied distance matrix");
    }
    dm = input;
  } else {
    dm = squaredDistanceMatrix(input, { standardize: Boolean(opts.standardize) });
  }
  const { n, data } = dm;
  const m = n - 1;
  const order = new Int32Array(n * Math.max(m, 0));
  const rank = new Int32Array(n * n);
  const idx = new Array(m);
  for (let i = 0; i < n; i += 1) {
    const base = i * n;
    let w = 0;
    for (let j = 0; j < n; j += 1) if (j !== i) idx[w++] = j;
    idx.sort((a, b) => {
      const diff = data[base + a] - data[base + b];
      return diff !== 0 && !Number.isNaN(diff) ? diff : a - b;
    });
    for (let r = 0; r < m; r += 1) {
      order[i * m + r] = idx[r];
      rank[base + idx[r]] = r + 1;
    }
    rank[base + i] = n;
  }
  const ctx = {
    n,
    order,
    rank,
    distances: opts.keepDistances === false ? null : data,
    standardized: dm.standardized,
  };
  Object.defineProperty(ctx, RANK_CONTEXT, { value: true });
  return ctx;
}

function checkK(k, n, fn) {
  if (!Number.isInteger(k) || k < 1) throw new RangeError(`${fn}: k must be a positive integer, got ${k}`);
  if (!(k < n / 2)) {
    // Venna & Kaski's normalising constant 2/(n k (2n - 3k - 1)) is only the maximum-penalty
    // bound when k < n/2 (scikit-learn enforces the same condition).
    throw new RangeError(`${fn}: k must satisfy k < n/2 (k=${k}, n=${n})`);
  }
}

function contextsFor(original, embedded, opts, fn) {
  const standardizeOriginal = opts.standardizeOriginal === undefined ? true : Boolean(opts.standardizeOriginal);
  let orig;
  if (isRankContext(original) || isDistanceMatrix(original)) {
    // A precomputed original space must say it was built the way this call expects. The
    // default expectation is standardized (the Experiment 001 convention), so passing
    // makeRankContext(X) (standardize defaults to false there) or squaredDistanceMatrix(X)
    // without opts.standardizeOriginal = false throws instead of silently scoring the raw,
    // unstandardized space (on the Bluethroat smoke clip that silently changed T(5) from
    // 0.7916 to 0.8181).
    if (original.standardized !== standardizeOriginal) {
      throw new Error(
        `${fn}: precomputed original space has standardized=${original.standardized} but standardizeOriginal=${standardizeOriginal}` +
          " (build it with makeRankContext(X, { standardize: true }) or pass { standardizeOriginal: false })",
      );
    }
    orig = isRankContext(original) ? original : makeRankContext(original);
  } else {
    orig = makeRankContext(original, { standardize: standardizeOriginal, keepDistances: false });
  }
  const emb = isRankContext(embedded) || isDistanceMatrix(embedded)
    ? makeRankContext(embedded)
    : makeRankContext(embedded, { standardize: false, keepDistances: false });
  if (orig.n !== emb.n) throw new RangeError(`${fn}: original has ${orig.n} rows, embedded has ${emb.n}`);
  return { orig, emb };
}

/**
 * Trustworthiness T(k) (Venna & Kaski 2001). This is an exact port of
 * tools/run_experiment_001.js `trustworthiness`, the primary metric of Experiments 001-006.
 *
 *   T(k) = 1 - 2 / (n k (2n - 3k - 1)) * sum_i sum_{j in U_i} (r(i,j) - k)
 *
 * U_i holds the k nearest neighbours of i in the EMBEDDING that are not among its k nearest
 * in the ORIGINAL space. r(i,j) is j's rank around i in the original space.
 *
 * The original space is z-scored before ranking (set opts.standardizeOriginal = false to
 * skip that). The embedding is ranked as given.
 *
 * @param {ArrayLike<ArrayLike<number>> | object} original a point matrix, a distance matrix, or a RankContext (reuse one via makeRankContext(original, { standardize: true }))
 * @param {ArrayLike<ArrayLike<number>> | object} embedded a point matrix, a distance matrix, or a RankContext
 * @param {number} k an integer with 1 <= k < n/2 (throws RangeError otherwise)
 * @param {{ standardizeOriginal?: boolean }} [opts]
 * @returns {number} a value in [0, 1] (can be slightly negative only if the embedding is worse than the worst-case bound)
 */
function trustworthiness(original, embedded, k, opts = {}) {
  const { orig, emb } = contextsFor(original, embedded, opts, "trustworthiness");
  const n = orig.n;
  checkK(k, n, "trustworthiness");
  const m = n - 1;
  let penalty = 0;
  for (let i = 0; i < n; i += 1) {
    const base = i * n;
    for (let r = 0; r < k; r += 1) {
      const j = emb.order[i * m + r];
      const rOrig = orig.rank[base + j];
      if (rOrig > k) penalty += rOrig - k;
    }
  }
  return 1 - (2 / (n * k * (2 * n - 3 * k - 1))) * penalty;
}

/**
 * Continuity C(k) (Venna & Kaski 2001), the counterpart of trustworthiness. It penalises
 * ORIGINAL-space neighbours that are missing from the embedding neighbourhood, weighted by
 * how far out they rank in the EMBEDDING:
 *
 *   C(k) = 1 - 2 / (n k (2n - 3k - 1)) * sum_i sum_{j in V_i} (rhat(i,j) - k)
 *
 * It uses the same normalising constant, the same k < n/2 rule and the same standardisation
 * as trustworthiness (original z-scored, embedding as given).
 *
 * @param {ArrayLike<ArrayLike<number>> | object} original
 * @param {ArrayLike<ArrayLike<number>> | object} embedded
 * @param {number} k
 * @param {{ standardizeOriginal?: boolean }} [opts]
 * @returns {number}
 */
function continuity(original, embedded, k, opts = {}) {
  const { orig, emb } = contextsFor(original, embedded, opts, "continuity");
  const n = orig.n;
  checkK(k, n, "continuity");
  const m = n - 1;
  let penalty = 0;
  for (let i = 0; i < n; i += 1) {
    const base = i * n;
    for (let r = 0; r < k; r += 1) {
      const j = orig.order[i * m + r];
      const rEmb = emb.rank[base + j];
      if (rEmb > k) penalty += rEmb - k;
    }
  }
  return 1 - (2 / (n * k * (2 * n - 3 * k - 1))) * penalty;
}

// ---------------------------------------------------------------------------
// kNN utilities
// ---------------------------------------------------------------------------

/**
 * k nearest neighbours of every point, with optional exclusion of candidates.
 *
 * Neighbours are sorted by ascending distance, and ties go to the lower index. That is the
 * same order as the exporter's buildSimilarityEdges, which sorted with a stable sort over j
 * ascending. If fewer than k candidates are left after exclusions, the list is shorter. It
 * is not padded.
 *
 * The exporter excludes candidates less than 1.5 s apart. To do the same, pass
 * `{ excludeWithin: (i, j) => Math.abs(t[i] - t[j]) < 1.5 }`.
 *
 * @param {ArrayLike<ArrayLike<number>> | object} input a point matrix (ranked as given, no standardisation), a distance matrix, or a RankContext
 * @param {number} k a positive integer
 * @param {{ excludeWithin?: (i:number, j:number) => boolean }} [opts] excludeWithin returns true to exclude candidate j for point i
 * @returns {{ neighbors: Int32Array[], distances: (Float64Array[]|null) }} distances are squared Euclidean, or null if the RankContext was built with keepDistances=false
 */
function knn(input, k, opts = {}) {
  if (!Number.isInteger(k) || k < 1) throw new RangeError(`knn: k must be a positive integer, got ${k}`);
  const ctx = makeRankContext(input);
  const { n, order, distances } = ctx;
  const m = n - 1;
  const exclude = typeof opts.excludeWithin === "function" ? opts.excludeWithin : null;
  const neighbors = new Array(n);
  const dists = distances ? new Array(n) : null;
  for (let i = 0; i < n; i += 1) {
    const picked = [];
    for (let r = 0; r < m && picked.length < k; r += 1) {
      const j = order[i * m + r];
      if (exclude && exclude(i, j)) continue;
      picked.push(j);
    }
    neighbors[i] = Int32Array.from(picked);
    if (dists) dists[i] = Float64Array.from(picked, (j) => distances[i * n + j]);
  }
  return { neighbors, distances: dists };
}

/**
 * Per-point and mean neighbour-set overlap between two neighbour lists (for example, kNN in
 * the original space vs kNN in an embedding, or the edges of two exports).
 *
 * - recallAtK_i = |A_i ∩ B_i| / |B_i|. B is the reference. Points whose B_i is empty are
 *   left out of the mean.
 * - jaccard_i = |A_i ∩ B_i| / |A_i ∪ B_i|. Points where both lists are empty are left out.
 *
 * Only set membership counts. The order within a list is ignored.
 *
 * @param {ArrayLike<ArrayLike<number>>} listsA candidate neighbour lists, one per point
 * @param {ArrayLike<ArrayLike<number>>} listsB reference neighbour lists, one per point
 * @param {{ k?: number }} [opts] if k is given, only the first k entries of each list are used
 * @returns {{ recallAtK: number, jaccard: number, perPointRecall: Float64Array, perPointJaccard: Float64Array, counted: { recall: number, jaccard: number } }} per-point values are NaN where a point was left out; a mean with no points counted is NaN
 */
function neighborOverlap(listsA, listsB, opts = {}) {
  if (!listsA || !listsB || listsA.length !== listsB.length) {
    throw new RangeError("neighborOverlap: both inputs must have one list per point");
  }
  const n = listsA.length;
  const limit = opts.k === undefined ? Infinity : opts.k;
  if (limit !== Infinity && (!Number.isInteger(limit) || limit < 1)) throw new RangeError("neighborOverlap: k must be a positive integer");
  const perPointRecall = new Float64Array(n);
  const perPointJaccard = new Float64Array(n);
  let recallSum = 0;
  let recallCount = 0;
  let jacSum = 0;
  let jacCount = 0;
  for (let i = 0; i < n; i += 1) {
    const a = new Set(Array.from(listsA[i]).slice(0, limit));
    const b = new Set(Array.from(listsB[i]).slice(0, limit));
    let inter = 0;
    for (const v of a) if (b.has(v)) inter += 1;
    const union = a.size + b.size - inter;
    if (b.size > 0) {
      perPointRecall[i] = inter / b.size;
      recallSum += perPointRecall[i];
      recallCount += 1;
    } else perPointRecall[i] = NaN;
    if (union > 0) {
      perPointJaccard[i] = inter / union;
      jacSum += perPointJaccard[i];
      jacCount += 1;
    } else perPointJaccard[i] = NaN;
  }
  return {
    recallAtK: recallCount ? recallSum / recallCount : NaN,
    jaccard: jacCount ? jacSum / jacCount : NaN,
    perPointRecall,
    perPointJaccard,
    counted: { recall: recallCount, jaccard: jacCount },
  };
}

// ---------------------------------------------------------------------------
// Controls (exact ports of run_experiment_001.js)
// ---------------------------------------------------------------------------

/**
 * Seeded 32-bit LCG (Numerical Recipes constants 1664525 / 1013904223). This is an exact
 * port of run_experiment_001.js `makeRandom`, and it returns values in [0, 1).
 * @param {number} seed coerced with >>> 0
 * @returns {() => number}
 */
function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/**
 * One standard normal draw by Box-Muller (cosine branch; each call uses two uniforms). This
 * is an exact port of run_experiment_001.js `randomNormal`.
 * @param {() => number} random
 * @returns {number}
 */
function randomNormal(random) {
  const u1 = Math.max(random(), 1e-12);
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * The Experiment 001 negative control: i.i.d. N(0,1) data with the same shape as `matrix`,
 * filled row-major. This is an exact port of run_experiment_001.js `randomMatchedMatrix`.
 * Only the shape of `matrix` is used; its values are ignored.
 * @param {ArrayLike<ArrayLike<number>>} matrix
 * @param {number} seed
 * @returns {number[][]}
 */
function randomMatchedMatrix(matrix, seed) {
  const random = makeRandom(seed);
  return Array.from(matrix, (row) => Array.from(row, () => randomNormal(random)));
}

/**
 * A stronger negative control. Each column is shuffled on its own (Fisher-Yates, columns
 * processed in order 0..d-1, all from one makeRandom(seed) stream). Every column keeps its
 * exact marginal distribution, but the joint (row-wise) structure between features is
 * destroyed.
 * @param {ArrayLike<ArrayLike<number>>} matrix
 * @param {number} seed
 * @returns {number[][]} a new matrix; the input is not changed
 */
function columnPermutedMatrix(matrix, seed) {
  const { n, d } = validateMatrix(matrix, "columnPermutedMatrix");
  const out = Array.from(matrix, (row) => Array.from(row));
  const random = makeRandom(seed);
  for (let j = 0; j < d; j += 1) {
    for (let i = n - 1; i > 0; i -= 1) {
      const r = Math.floor(random() * (i + 1));
      const tmp = out[i][j];
      out[i][j] = out[r][j];
      out[r][j] = tmp;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Correlation and nulls
// ---------------------------------------------------------------------------

function pearsonCore(x, y) {
  const n = x.length;
  if (n < 2) return NaN;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i += 1) {
    mx += x[i];
    my += y[i];
  }
  mx /= n;
  my /= n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return NaN;
  const r = sxy / Math.sqrt(sxx * syy);
  return r > 1 ? 1 : r < -1 ? -1 : r;
}

/**
 * Pearson product-moment correlation (two-pass, clamped to [-1, 1]).
 * Returns NaN if fewer than 2 pairs are left or either input has zero variance (the
 * correlation is undefined there). NaN inputs throw unless opts.dropNaN, which drops pairs.
 * @param {ArrayLike<number>} x
 * @param {ArrayLike<number>} y
 * @param {{ dropNaN?: boolean }} [opts]
 * @returns {number}
 */
function pearson(x, y, opts = {}) {
  const [a, b] = toPairedVectors(x, y, "pearson", opts);
  return pearsonCore(a, b);
}

/**
 * 1-based ranks where tied values get the average of the ranks they span (the "average" /
 * "mid-rank" method).
 * @param {ArrayLike<number>} values
 * @param {{ dropNaN?: boolean }} [opts]
 * @returns {Float64Array}
 */
function averageRanks(values, opts = {}) {
  const v = toVector(values, "averageRanks", opts);
  return averageRanksCore(v);
}

function averageRanksCore(v) {
  const n = v.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => v[a] - v[b] || a - b);
  const ranks = new Float64Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && v[idx[j + 1]] === v[idx[i]]) j += 1;
    const avg = (i + j) / 2 + 1;
    for (let t = i; t <= j; t += 1) ranks[idx[t]] = avg;
    i = j + 1;
  }
  return ranks;
}

/**
 * Spearman rank correlation: Pearson on average ranks, which handles ties correctly.
 * Returns NaN when undefined (see pearson).
 * @param {ArrayLike<number>} x
 * @param {ArrayLike<number>} y
 * @param {{ dropNaN?: boolean }} [opts]
 * @returns {number}
 */
function spearman(x, y, opts = {}) {
  const [a, b] = toPairedVectors(x, y, "spearman", opts);
  return pearsonCore(averageRanksCore(a), averageRanksCore(b));
}

/**
 * Summary of a sample (for example, a null distribution).
 * @param {ArrayLike<number>} values
 * @returns {{ count:number, mean:number, sd:number, min:number, q025:number, median:number, q975:number, max:number }} sd is the sample sd (n - 1)
 */
function summarize(values) {
  const v = toVector(values, "summarize");
  const n = v.length;
  if (n === 0) throw new RangeError("summarize: empty input");
  let s = 0;
  for (let i = 0; i < n; i += 1) s += v[i];
  const mu = s / n;
  let ss = 0;
  for (let i = 0; i < n; i += 1) ss += (v[i] - mu) ** 2;
  const sorted = Float64Array.from(v).sort();
  return {
    count: n,
    mean: mu,
    sd: n > 1 ? Math.sqrt(ss / (n - 1)) : 0,
    min: sorted[0],
    q025: quantileSorted(sorted, 0.025),
    median: quantileSorted(sorted, 0.5),
    q975: quantileSorted(sorted, 0.975),
    max: sorted[n - 1],
  };
}

/**
 * Circular-shift (rotation) permutation null for the association between two time series.
 * It keeps each series' autocorrelation and breaks their alignment. Use it for
 * point-by-point series from one recording, because neighbouring windows are not
 * independent.
 *
 * y is rotated by s: y_s[t] = y[(t + s) mod n]. Allowed shifts are
 * s in [minShift, n - minShift], so the rotation moves at least minShift samples in both
 * directions. minShift is in SAMPLES (points). The caller converts seconds to points.
 *
 * If there are at most B allowed shifts (M = n - 2*minShift + 1 <= B), every one of them is
 * used, which is the exact rotation distribution ("exhaustive"). Otherwise B shifts are
 * drawn uniformly with replacement from makeRandom(seed) ("random").
 *
 * Two-sided p = (1 + #{ |T_null| >= |T_obs| }) / (count + 1). That assumes the statistic is
 * centred at 0, as a correlation is. A relative tolerance of 1e-12 makes the comparison
 * inclusive, so floating-point near-ties do not make p look smaller than it is.
 *
 * With dropNaN, y is rotated on the full series and NaN pairs are dropped for each shift.
 * If the observed statistic is NaN (zero variance), p is NaN and nullDistribution is null.
 *
 * @param {ArrayLike<number>} x
 * @param {ArrayLike<number>} y
 * @param {{ statistic?: 'pearson'|'spearman'|((x:Float64Array,y:Float64Array)=>number), minShift: number, B?: number, seed?: number, dropNaN?: boolean }} opts B defaults to 1999
 * @returns {{ observed:number, p:number, mode:'exhaustive'|'random', count:number, admissibleShifts:number, minShift:number, statistic:string, nullDistribution:(object|null) }}
 */
function circularShiftNull(x, y, opts = {}) {
  const { minShift, B = 1999, seed = DEFAULT_SEED, dropNaN = false } = opts;
  const statistic = opts.statistic === undefined ? "pearson" : opts.statistic;
  if (x.length !== y.length) throw new RangeError("circularShiftNull: length mismatch");
  const n = x.length;
  if (!Number.isInteger(minShift) || minShift < 1) throw new RangeError("circularShiftNull: minShift must be an integer >= 1 (in samples)");
  if (!Number.isInteger(B) || B < 1) throw new RangeError("circularShiftNull: B must be a positive integer");
  const admissible = n - 2 * minShift + 1;
  if (admissible < 1) throw new RangeError(`circularShiftNull: no admissible shifts (n=${n}, minShift=${minShift})`);

  // Validate (throws on NaN unless dropNaN; Infinity always throws).
  toPairedVectors(x, y, "circularShiftNull", { dropNaN });
  const xs = Float64Array.from(x);
  const ys = Float64Array.from(y);

  let statFn;
  let statName;
  if (statistic === "pearson") {
    statFn = pearsonCore;
    statName = "pearson";
  } else if (statistic === "spearman") {
    statFn = (a, b) => pearsonCore(averageRanksCore(a), averageRanksCore(b));
    statName = "spearman";
  } else if (typeof statistic === "function") {
    statFn = statistic;
    statName = statistic.name || "custom";
  } else {
    throw new TypeError("circularShiftNull: statistic must be 'pearson', 'spearman' or a function");
  }

  const evalAt = (s) => {
    const a = [];
    const b = [];
    for (let t = 0; t < n; t += 1) {
      const u = xs[t];
      const v = ys[(t + s) % n];
      if (Number.isNaN(u) || Number.isNaN(v)) continue;
      a.push(u);
      b.push(v);
    }
    return statFn(Float64Array.from(a), Float64Array.from(b));
  };

  const observed = evalAt(0);
  const mode = admissible <= B ? "exhaustive" : "random";
  if (Number.isNaN(observed)) {
    return { observed, p: NaN, mode, count: 0, admissibleShifts: admissible, minShift, statistic: statName, nullDistribution: null };
  }
  const shifts = [];
  if (mode === "exhaustive") {
    for (let s = minShift; s <= n - minShift; s += 1) shifts.push(s);
  } else {
    const random = makeRandom(seed);
    for (let b = 0; b < B; b += 1) shifts.push(minShift + Math.floor(random() * admissible));
  }
  const nullValues = [];
  const threshold = Math.abs(observed) * (1 - 1e-12);
  let extreme = 0;
  for (const s of shifts) {
    const t = evalAt(s);
    if (Number.isNaN(t)) continue;
    nullValues.push(t);
    if (Math.abs(t) >= threshold) extreme += 1;
  }
  const count = nullValues.length;
  return {
    observed,
    p: (1 + extreme) / (count + 1),
    mode,
    count,
    admissibleShifts: admissible,
    minShift,
    statistic: statName,
    nullDistribution: count ? summarize(nullValues) : null,
  };
}

/**
 * Holm (1979) step-down adjustment for multiple comparisons, controlling the family-wise
 * error rate. It returns adjusted p-values in the input order, each capped at 1 and made
 * monotone.
 * @param {ArrayLike<number>} pValues each in [0, 1]; NaN throws
 * @returns {Float64Array}
 */
function holm(pValues) {
  const p = toVector(pValues, "holm");
  const m = p.length;
  for (let i = 0; i < m; i += 1) {
    if (p[i] < 0 || p[i] > 1) throw new RangeError(`holm: p-value out of [0,1] at index ${i}`);
  }
  const idx = Array.from({ length: m }, (_, i) => i).sort((a, b) => p[a] - p[b] || a - b);
  const adjusted = new Float64Array(m);
  let running = 0;
  for (let r = 0; r < m; r += 1) {
    const i = idx[r];
    const value = Math.min(1, (m - r) * p[i]);
    running = Math.max(running, value);
    adjusted[i] = running;
  }
  return adjusted;
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

function quantileSorted(sorted, q) {
  const n = sorted.length;
  if (n === 1) return sorted[0];
  const h = (n - 1) * q;
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, n - 1);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

/**
 * Type-7 quantile (linear interpolation between order statistics: h = (n-1)q).
 * @param {ArrayLike<number>} values
 * @param {number} q in [0, 1]
 * @param {{ dropNaN?: boolean }} [opts]
 * @returns {number}
 */
function quantile(values, q, opts = {}) {
  assertFiniteNumber(q, "quantile q");
  if (q < 0 || q > 1) throw new RangeError("quantile: q must be in [0, 1]");
  const v = toVector(values, "quantile", opts);
  if (v.length === 0) throw new RangeError("quantile: empty input");
  return quantileSorted(v.sort(), q);
}

/**
 * Median (type-7 quantile at 0.5, the usual mid-point average for even n).
 * @param {ArrayLike<number>} values
 * @param {{ dropNaN?: boolean }} [opts]
 * @returns {number}
 */
function median(values, opts = {}) {
  return quantile(values, 0.5, opts);
}

/**
 * Interquartile range: Q3 - Q1, both type 7.
 * @param {ArrayLike<number>} values
 * @param {{ dropNaN?: boolean }} [opts]
 * @returns {number}
 */
function iqr(values, opts = {}) {
  const v = toVector(values, "iqr", opts);
  if (v.length === 0) throw new RangeError("iqr: empty input");
  v.sort();
  return quantileSorted(v, 0.75) - quantileSorted(v, 0.25);
}

function meanCore(values) {
  let s = 0;
  for (let i = 0; i < values.length; i += 1) s += values[i];
  return s / values.length;
}

/**
 * Arithmetic mean, following the module's NaN policy (throws on NaN/Infinity unless
 * opts.dropNaN; throws RangeError on empty input).
 * @param {ArrayLike<number>} values
 * @param {{ dropNaN?: boolean }} [opts]
 * @returns {number}
 */
function mean(values, opts = {}) {
  const v = toVector(values, "mean", opts);
  if (v.length === 0) throw new RangeError("mean: empty input");
  return meanCore(v);
}

function resolveStat(stat, fn) {
  if (stat === undefined || stat === "mean") return meanCore;
  if (stat === "median") return (v) => quantileSorted(Float64Array.from(v).sort(), 0.5);
  if (typeof stat === "function") return stat;
  throw new TypeError(`${fn}: stat must be 'mean', 'median' or a function`);
}

function percentileInterval(boot, alpha) {
  const sorted = Float64Array.from(boot).sort();
  let s = 0;
  for (let i = 0; i < sorted.length; i += 1) s += sorted[i];
  const mu = s / sorted.length;
  let ss = 0;
  for (let i = 0; i < sorted.length; i += 1) ss += (sorted[i] - mu) ** 2;
  return {
    lower: quantileSorted(sorted, alpha / 2),
    upper: quantileSorted(sorted, 1 - alpha / 2),
    se: sorted.length > 1 ? Math.sqrt(ss / (sorted.length - 1)) : 0,
  };
}

function checkBootstrapOpts(B, alpha, fn) {
  if (!Number.isInteger(B) || B < 1) throw new RangeError(`${fn}: B must be a positive integer`);
  assertFiniteNumber(alpha, `${fn} alpha`);
  if (!(alpha > 0 && alpha < 1)) throw new RangeError(`${fn}: alpha must be in (0, 1)`);
}

/**
 * Percentile bootstrap confidence interval (resample with replacement, B times, from
 * makeRandom(seed)). The interval is the type-7 alpha/2 and 1-alpha/2 quantiles of the
 * bootstrap distribution. Note that percentile intervals can under-cover for very small n.
 * @param {ArrayLike<number>} values
 * @param {{ stat?: 'mean'|'median'|((sample:Float64Array)=>number), B?: number, alpha?: number, seed?: number, dropNaN?: boolean }} [opts] defaults: stat 'mean', B 2000, alpha 0.05, seed DEFAULT_SEED
 * @returns {{ estimate:number, lower:number, upper:number, se:number, B:number, alpha:number, seed:number, n:number, method:'percentile' }}
 */
function bootstrapCI(values, opts = {}) {
  const { B = 2000, alpha = 0.05, seed = DEFAULT_SEED } = opts;
  checkBootstrapOpts(B, alpha, "bootstrapCI");
  const v = toVector(values, "bootstrapCI", opts);
  const n = v.length;
  if (n === 0) throw new RangeError("bootstrapCI: empty input");
  const statFn = resolveStat(opts.stat, "bootstrapCI");
  const random = makeRandom(seed);
  const boot = new Float64Array(B);
  const sample = new Float64Array(n);
  for (let b = 0; b < B; b += 1) {
    for (let i = 0; i < n; i += 1) sample[i] = v[Math.floor(random() * n)];
    boot[b] = statFn(sample);
  }
  return { estimate: statFn(v), ...percentileInterval(boot, alpha), B, alpha, seed, n, method: "percentile" };
}

/**
 * Paired percentile bootstrap. Pair indices are resampled together, so the correlation
 * between a[i] and b[i] is kept. By default the statistic is applied to the differences
 * a - b (stat 'mean' or 'median'). A function stat receives (aSample, bSample) instead.
 * @param {ArrayLike<number>} a
 * @param {ArrayLike<number>} b
 * @param {{ stat?: 'mean'|'median'|((a:Float64Array,b:Float64Array)=>number), B?: number, alpha?: number, seed?: number, dropNaN?: boolean }} [opts]
 * @returns {{ estimate:number, lower:number, upper:number, se:number, B:number, alpha:number, seed:number, n:number, method:'paired-percentile' }}
 */
function pairedBootstrapCI(a, b, opts = {}) {
  const { B = 2000, alpha = 0.05, seed = DEFAULT_SEED } = opts;
  checkBootstrapOpts(B, alpha, "pairedBootstrapCI");
  const [x, y] = toPairedVectors(a, b, "pairedBootstrapCI", opts);
  const n = x.length;
  if (n === 0) throw new RangeError("pairedBootstrapCI: empty input");
  let statFn;
  if (typeof opts.stat === "function") {
    statFn = opts.stat;
  } else {
    const inner = resolveStat(opts.stat, "pairedBootstrapCI");
    statFn = (xa, ya) => inner(Float64Array.from(xa, (v, i) => v - ya[i]));
  }
  const random = makeRandom(seed);
  const boot = new Float64Array(B);
  const sa = new Float64Array(n);
  const sb = new Float64Array(n);
  for (let r = 0; r < B; r += 1) {
    for (let i = 0; i < n; i += 1) {
      const j = Math.floor(random() * n);
      sa[i] = x[j];
      sb[i] = y[j];
    }
    boot[r] = statFn(sa, sb);
  }
  return { estimate: statFn(x, y), ...percentileInterval(boot, alpha), B, alpha, seed, n, method: "paired-percentile" };
}

/**
 * Complementary error function. Relative error vs scipy 1.13.1 (checked in tests) is below
 * 1e-14 for x >= 2.5 and below 1e-12 for 0 <= x < 2.5, where 1 - erf(x) cancels (worst near
 * x = 2.5). It uses the all-positive series
 * erf(x) = 2/sqrt(pi) e^{-x^2} sum 2^k x^{2k+1} / (2k+1)!! for x < 2.5, and a continued
 * fraction (modified Lentz) for erfc when x >= 2.5.
 * @param {number} x
 * @returns {number}
 */
function erfc(x) {
  assertFiniteNumber(x, "erfc");
  if (x < 0) return 2 - erfc(-x);
  if (x < 2.5) {
    let term = x;
    let sum = x;
    const x2 = x * x;
    for (let k = 1; k < 200; k += 1) {
      term *= (2 * x2) / (2 * k + 1);
      sum += term;
      if (term < sum * 1e-17) break;
    }
    return 1 - (2 / Math.sqrt(Math.PI)) * Math.exp(-x2) * sum;
  }
  // erfc(x) = e^{-x^2}/sqrt(pi) * 1/(x + (1/2)/(x + 1/(x + (3/2)/(x + 2/(x + ...)))))
  const tiny = 1e-300;
  let f = x;
  let C = x;
  let D = 0;
  for (let k = 1; k < 500; k += 1) {
    const ak = k / 2;
    D = x + ak * D;
    if (Math.abs(D) < tiny) D = tiny;
    C = x + ak / C;
    if (Math.abs(C) < tiny) C = tiny;
    D = 1 / D;
    const delta = C * D;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return Math.exp(-x * x) / Math.sqrt(Math.PI) / f;
}

/**
 * Standard normal CDF Phi(z) = erfc(-z / sqrt 2) / 2.
 * @param {number} z
 * @returns {number}
 */
function normalCdf(z) {
  return 0.5 * erfc(-z / Math.SQRT2);
}

/**
 * Wilcoxon signed-rank test on paired samples (b omitted or null = one-sample test of a
 * against 0).
 *
 * - Zero differences are dropped (Wilcox's method, the scipy default). Ties among |d| get
 *   average ranks.
 * - W+ is the sum of the ranks of positive differences. statistic = min(W+, W-).
 * - Exact (mode 'auto' when n <= 20, or mode 'exact' for any n up to 1000): uses the
 *   permutation distribution of W+ over all 2^n sign assignments. It is computed by dynamic
 *   programming over doubled ranks (always integers), so it stays exact with ties as well.
 *   It is conditional on the observed tie pattern. Two-sided p = min(1, 2 min(P(W+<=w),
 *   P(W+>=w))).
 * - Normal approximation (mode 'auto' when n > 20, or mode 'normal'): mean n(n+1)/4,
 *   variance n(n+1)(2n+1)/24 - sum(t^3 - t)/48 over tie groups. The continuity correction
 *   is 0.5 toward the mean (opts.correction, default true). p = 2 Phi(-|z|).
 * - If every difference is zero (n = 0), there is no evidence either way: p = 1 and method
 *   is 'degenerate'.
 *
 * @param {ArrayLike<number>} a
 * @param {ArrayLike<number>|null} [b]
 * @param {{ mode?: 'auto'|'exact'|'normal', correction?: boolean, dropNaN?: boolean }} [opts]
 * @returns {{ n:number, zeros:number, wPlus:number, wMinus:number, statistic:number, z:(number|null), p:number, method:'exact'|'normal'|'degenerate', tieGroups:number }}
 */
function wilcoxonSignedRank(a, b = null, opts = {}) {
  const mode = opts.mode || "auto";
  if (mode !== "auto" && mode !== "exact" && mode !== "normal") throw new TypeError("wilcoxonSignedRank: mode must be auto|exact|normal");
  const correction = opts.correction === undefined ? true : Boolean(opts.correction);
  let diffs;
  if (b === null || b === undefined) {
    diffs = toVector(a, "wilcoxonSignedRank", opts);
  } else {
    const [x, y] = toPairedVectors(a, b, "wilcoxonSignedRank", opts);
    diffs = Float64Array.from(x, (v, i) => v - y[i]);
  }
  const nonZero = [];
  let zeros = 0;
  for (const d of diffs) {
    if (d === 0) zeros += 1;
    else nonZero.push(d);
  }
  const n = nonZero.length;
  if (n === 0) {
    return { n: 0, zeros, wPlus: 0, wMinus: 0, statistic: 0, z: null, p: 1, method: "degenerate", tieGroups: 0 };
  }
  const absRanks = averageRanksCore(Float64Array.from(nonZero, Math.abs));
  let wPlus = 0;
  for (let i = 0; i < n; i += 1) if (nonZero[i] > 0) wPlus += absRanks[i];
  const total = (n * (n + 1)) / 2;
  const wMinus = total - wPlus;

  // Tie groups among |d|.
  const sortedAbs = Float64Array.from(nonZero, Math.abs).sort();
  let tieTerm = 0;
  let tieGroups = 0;
  for (let i = 0; i < n; ) {
    let j = i;
    while (j + 1 < n && sortedAbs[j + 1] === sortedAbs[i]) j += 1;
    const t = j - i + 1;
    if (t > 1) {
      tieTerm += t ** 3 - t;
      tieGroups += 1;
    }
    i = j + 1;
  }

  const useExact = mode === "exact" || (mode === "auto" && n <= 20);
  if (useExact) {
    if (n > 1000) throw new RangeError("wilcoxonSignedRank: exact mode supports n <= 1000");
    // Doubled ranks are integers even with average-rank ties.
    const r2 = Array.from(absRanks, (r) => Math.round(2 * r));
    const maxSum = r2.reduce((s, v) => s + v, 0);
    let dist = new Float64Array(maxSum + 1);
    dist[0] = 1;
    let reach = 0;
    for (const r of r2) {
      const next = Float64Array.from(dist);
      for (let s = 0; s <= reach; s += 1) if (dist[s]) next[s + r] += dist[s];
      reach += r;
      dist = next;
    }
    const w2 = Math.round(2 * wPlus);
    let le = 0;
    let ge = 0;
    let all = 0;
    for (let s = 0; s <= maxSum; s += 1) {
      all += dist[s];
      if (s <= w2) le += dist[s];
      if (s >= w2) ge += dist[s];
    }
    const p = Math.min(1, (2 * Math.min(le, ge)) / all);
    return { n, zeros, wPlus, wMinus, statistic: Math.min(wPlus, wMinus), z: null, p, method: "exact", tieGroups };
  }
  const mu = total / 2;
  const variance = (n * (n + 1) * (2 * n + 1)) / 24 - tieTerm / 48;
  let d = wPlus - mu;
  if (correction) d = Math.sign(d) * Math.max(0, Math.abs(d) - 0.5);
  const z = variance > 0 ? d / Math.sqrt(variance) : 0;
  const p = Math.min(1, 2 * normalCdf(-Math.abs(z)));
  return { n, zeros, wPlus, wMinus, statistic: Math.min(wPlus, wMinus), z, p, method: "normal", tieGroups };
}

module.exports = {
  DEFAULT_SEED,
  // validation / basics
  validateMatrix,
  standardize,
  squaredDistance,
  squaredDistanceMatrix,
  asDistanceMatrix,
  isDistanceMatrix,
  makeRankContext,
  isRankContext,
  // embedding quality
  trustworthiness,
  continuity,
  // kNN
  knn,
  neighborOverlap,
  // controls
  makeRandom,
  randomNormal,
  randomMatchedMatrix,
  columnPermutedMatrix,
  // correlation + nulls
  pearson,
  spearman,
  averageRanks,
  circularShiftNull,
  holm,
  // summaries
  mean,
  median,
  quantile,
  iqr,
  summarize,
  bootstrapCI,
  pairedBootstrapCI,
  wilcoxonSignedRank,
  erfc,
  normalCdf,
};
