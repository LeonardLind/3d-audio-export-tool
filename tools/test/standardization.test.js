"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const metrics = require("../lib/metrics");
const reducers = require("../lib/reducers");

function flattenRows(matrix) {
  return matrix.flatMap((row) => Array.from(row));
}

function assertSameNumbers(actual, expected, label) {
  assert.equal(actual.length, expected.length, `${label}: element count`);
  for (let i = 0; i < actual.length; i += 1) {
    assert.ok(Object.is(actual[i], expected[i]), `${label}: mismatch at flattened index ${i}: ${actual[i]} !== ${expected[i]}`);
  }
}

test("metrics and reducers standardization paths are bitwise-identical", () => {
  // Unequal, nontrivial column scales plus a constant column exercise population SD and
  // the zero-SD fallback. Decimal values make this a useful arithmetic-order check.
  const X = [
    [1.25, -120, 7, 3.5],
    [2.75, 40, 7, -2.25],
    [-0.5, 200, 7, 1.125],
    [4.125, -40, 7, 8.75],
    [3, 80, 7, -6.5],
  ];

  const metricRows = metrics.standardize(X);
  const reducerRows = reducers.standardize(X);
  const flatResult = reducers.standardizeFlat(X);
  const metricValues = flattenRows(metricRows);
  const reducerValues = flattenRows(reducerRows);
  const flatValues = Array.from(flatResult.x);

  assertSameNumbers(reducerValues, metricValues, "reducers.standardize vs metrics.standardize");
  assertSameNumbers(flatValues, metricValues, "reducers.standardizeFlat vs metrics.standardize");
  assert.ok(metricRows.every((row) => Object.is(row[2], 0)), "constant column standardizes to exact zero");
});

test("makeRankContext requires and records the C13 standardization opt-in", () => {
  const X = [
    [1, 10, 2],
    [2, 30, 2],
    [4, 20, 2],
    [8, 50, 2],
  ];
  const standardized = metrics.standardize(X);
  const implicit = metrics.makeRankContext(X);
  const explicit = metrics.makeRankContext(X, { standardize: true });
  const prestandardized = metrics.makeRankContext(standardized);

  assert.equal(implicit.standardized, false);
  assert.equal(explicit.standardized, true);
  assert.equal(prestandardized.standardized, false);
  assert.deepEqual(Array.from(explicit.order), Array.from(prestandardized.order));
  assert.deepEqual(Array.from(explicit.rank), Array.from(prestandardized.rank));
});
