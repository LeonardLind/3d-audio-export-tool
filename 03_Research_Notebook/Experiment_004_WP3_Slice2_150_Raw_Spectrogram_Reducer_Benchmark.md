# Experiment 004 - WP3 Slice-2 150-Row Raw Spectrogram Reducer Benchmark

**Date:** 2026-07-20  
**Work Package:** WP3  
**Related Decision Log ID(s):** D-004, D-010  
**Status:** Run - larger first-test reducer result recorded

## Question

Using the WP2-winning raw flattened spectrogram features from `manifest_slice2_birdnet_150.csv`, which reducer best preserves neighborhood structure: PCA, UMAP, or t-SNE?

## Method

**Dataset / subset used:** `manifest_slice2_birdnet_150.csv`, 150 rows.

**Feature representation:** raw flattened spectrograms.

**Input dimensionality:** 15677.

**Dimensionality-appropriate output rule:** use the PCA dimensionality required by raw spectrograms to retain at least 95% explained variance for this manifest. For the 150-row slice-2 manifest, that value was 106 dimensions, retaining 0.9515 cumulative explained variance.

**Reducers tested:** PCA, UMAP, t-SNE.

**Output dimensions:** 106 for all reducers.

**Primary metric:** trustworthiness, `k = 5`.

**Negative control:** seeded Gaussian random data with matched row count and feature dimensionality.

**Negative control threshold:** pass if real trustworthiness exceeds matched random-control trustworthiness by at least `0.02`.

## Results

| Reducer | Output dimensions | Real trustworthiness | Negative-control trustworthiness | Margin | Control pass? |
|---|---:|---:|---:|---:|---|
| PCA | 106 | 0.9838 | 0.9628 | 0.0210 | Pass |
| UMAP | 106 | 0.7617 | 0.6993 | 0.0624 | Pass |
| t-SNE | 106 | 0.4016 | 0.3434 | 0.0582 | Pass |

## Discussion

All three reducers passed the negative-control rule on this larger 150-row dataset. PCA remains the clear leader by real-data trustworthiness at `0.9838`.

PCA's negative-control margin is narrow, `0.0210`, only slightly above the required `0.02` threshold. That means PCA is eligible and highest-scoring, but this result should be watched closely as the dataset grows.

UMAP passed the control with a larger margin than PCA, but its real-data trustworthiness was much lower at `0.7617`. Since the decision rule ranks highest trustworthiness among candidates whose controls pass, UMAP does not win this run.

t-SNE passed the control but performed far below PCA and UMAP. Previous t-SNE runs also showed implementation instability, so it remains a weak candidate until retested with a more reliable implementation.

## Decision

**Carry PCA forward as the current WP3 reducer leader for raw spectrograms.**

Keep UMAP supported behind the swappable reducer setting. It passed the negative control in this larger run and may become more competitive with more data or tuned parameters, but it is not the current leader.

Do not lock the reducer permanently yet. This is stronger evidence than the 22-row run, but the project should keep the reducer step swappable until a broader benchmark confirms a stable winner.

## Reproducibility Notes

Runner: `node tools/run_experiment_002_wp3_reducer_benchmark.js --manifest=manifest_slice2_birdnet_150.csv`

Raw result artifact: `05_Benchmark_Results/experiment_002_wp3_reducer_manifest_slice2_birdnet_150_results.json`

Manifest: `manifest_slice2_birdnet_150.csv`

Rows: `150`

Raw spectrogram feature dimensions: `15677`

Reducer output dimensions: `106`

Trustworthiness `k`: `5`

Negative control seed base: `20260720`
