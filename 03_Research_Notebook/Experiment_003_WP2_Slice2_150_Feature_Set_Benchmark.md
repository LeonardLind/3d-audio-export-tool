# Experiment 003 - WP2 Slice-2 150-Row Feature Set Benchmark

**Date:** 2026-07-20  
**Work Package:** WP2  
**Related Decision Log ID(s):** D-010  
**Status:** Run - larger first-test result recorded

## Question

Using a capped 150-row manifest from `Assets/slice_2_acoustic_data`, which feature representation survives the same fair negative-control benchmark: MFCCs, inherited 8-axis spectral descriptors, or raw flattened spectrograms?

## Method

**Dataset / subset used:** `manifest_slice2_birdnet_150.csv`, capped at 150 rows.

Manifest rules:

- Use only per-recording `output/*.csv` files under `Assets/slice_2_acoustic_data`.
- Keep `birdnet` rows only.
- Keep confidence `> 0.5` only.
- If multiple guesses exist for the same `audio_id/start_time/end_time`, keep the highest-confidence row.
- Require a local `.wav` file with matching basename.
- Sort by confidence descending and cap at 150 rows for this first bigger test.

Builder: `tools/build_manifest_slice2.js`

**Segmentation:** fixed 1000 ms windows starting at manifest `start_time`.

**Feature candidates:** MFCCs, inherited 8-axis spectral descriptors, raw flattened spectrograms.

**Fair dimensionality method:** PCA auto-95: use the smallest PCA component count that retains at least 95% cumulative explained variance per feature matrix.

**Primary metric:** trustworthiness, `k = 5`.

**Negative control:** seeded Gaussian random data with matched row count and feature dimensionality.

**Negative control threshold:** pass if real trustworthiness exceeds matched random-control trustworthiness by at least `0.02`.

## Results

| Feature type | Input dimensions | PCA components | Explained variance retained | Real trustworthiness | Negative-control trustworthiness | Margin | Control pass? |
|---|---:|---:|---:|---:|---:|---:|---|
| MFCCs | 26 | 11 | 0.9547 | 0.9978 | 0.9945 | 0.0034 | Fail |
| Inherited 8-axis spectral descriptors | 8 | 4 | 0.9585 | 0.9925 | 1.0000 | -0.0075 | Fail |
| Raw flattened spectrograms | 15677 | 106 | 0.9515 | 0.9838 | 0.9162 | 0.0676 | Pass |

## Discussion

The fair auto-95 benchmark again favors raw flattened spectrograms. MFCCs and the inherited 8-axis descriptors both produced very high real-data trustworthiness, but their matched random controls were also extremely high. Under the mandatory negative-control rule, neither is eligible.

Raw flattened spectrograms are the only candidate to pass the negative control, with real trustworthiness `0.9838` and a margin of `0.0676`.

## Decision

**Carry raw flattened spectrograms forward as the WP2 feature representation for the next larger benchmark stage.**

This is stronger than the 22-row first signal because it repeats on 150 rows, but it should still be treated as benchmark evidence rather than a permanent production lock until broader data coverage is tested.

## Reproducibility Notes

Manifest builder: `tools/build_manifest_slice2.js`

Manifest: `manifest_slice2_birdnet_150.csv`

Fixed-3D reference result: `05_Benchmark_Results/experiment_001_manifest_slice2_birdnet_150_fixed3_results.json`

Fair auto-95 result: `05_Benchmark_Results/experiment_001_manifest_slice2_birdnet_150_auto95_results.json`

Runner: `node tools/run_experiment_001.js --manifest=manifest_slice2_birdnet_150.csv --auto95`

Rows: `150`

Trustworthiness `k`: `5`

Negative control seed base: `20260720`
