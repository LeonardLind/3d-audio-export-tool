# Experiment 002 - WP3 Raw Spectrogram Reducer Benchmark

**Date:** 2026-07-20  
**Work Package:** WP3  
**Related Decision Log ID(s):** D-004, D-010  
**Status:** Run - raw-spectrogram reducer result recorded

## Question

Given WP2's fair-test result that raw flattened spectrograms were the only feature representation to pass the dimensionality-appropriate negative-control check, which reducer best preserves raw-spectrogram neighborhood structure: PCA, UMAP, or t-SNE?

## Method

**Dataset / subset used:** `manifest_birdnet_first_test.csv`, 22 rows.

**Feature representation:** raw flattened spectrograms from Experiment 001. Each row is a fixed 1000 ms audio window starting at the manifest `start_time`, converted to log-magnitude STFT bins.

**Input dimensionality:** 15677.

**Dimensionality-appropriate output rule:** use the PCA dimensionality required by raw spectrograms to retain at least 95% explained variance in Experiment 001 auto95. That value was 20 dimensions, retaining 0.9721 cumulative explained variance. PCA, UMAP, and t-SNE were therefore all compared at 20 output dimensions.

**Reducers tested:**

| Reducer | Parameters |
|---|---|
| PCA | 20 components |
| UMAP | `nComponents = 20`, `nNeighbors = 5`, `minDist = 0.1`, `spread = 1.0` |
| t-SNE | `dim = 20`, `perplexity = 5`, `earlyExaggeration = 4.0`, `learningRate = 100.0`, `nIter = 1000` |

**Primary metric:** trustworthiness, `k = 5`.

**Negative control type used:** seeded Gaussian random data with matched row count and feature dimensionality, passed through the same reducer and trustworthiness pipeline.

**Negative control threshold:** pass if real-data trustworthiness exceeds matched random-control trustworthiness by at least `0.02`.

**Label-exclusion verification:** labels remain manifest metadata only. Reducer inputs and trustworthiness scoring use raw spectrogram numeric features only.

## Results

| Reducer | Output dimensions | Real trustworthiness | Negative-control trustworthiness | Margin | Control pass? |
|---|---:|---:|---:|---:|---|
| PCA | 20 | 0.9955 | 0.7240 | 0.2714 | Pass |
| UMAP | 20 | 0.5779 | 0.7312 | -0.1532 | Fail |
| t-SNE | 20 | 0.3760 | 0.3227 | 0.0532 | Pass |

## Unexpected Observations

UMAP and t-SNE both performed worse on real raw-spectrogram data than on matched random data under this specific 20-dimensional, 22-row test. That is a strong warning against assuming nonlinear reducers will automatically improve this dataset.

t-SNE reported only 3 iterations from the installed `tsne-js` runner despite `nIter = 1000` being passed, and its result changed when the WP3 script was refactored even though PCA and UMAP remained stable. The output is still recorded because it is the actual result from the current run, but t-SNE should be retested with an alternate implementation before treating it as a stable reducer candidate.

## Discussion

PCA is the only reducer that passed the mandatory negative control in this WP3 run. Its real-data trustworthiness was `0.9955`, with a control margin of `0.2714`, well above the required `0.02`.

UMAP failed the negative control because its real-data trustworthiness, `0.5779`, was lower than its matched random-control score, `0.7312`.

t-SNE passed the negative control in the current run, with real-data trustworthiness `0.3760` versus matched random-control score `0.3227`. However, it remains far below PCA and its implementation behavior is unstable enough that it should not be treated as a clean winner or rejection from this pass.

Under the pre-committed negative-control logic, PCA and t-SNE are eligible in the current run, while UMAP is not. PCA has the highest real-data trustworthiness by a wide margin and is therefore the WP3 raw-spectrogram reducer leader for this small first dataset.

## Decision

**Carry PCA forward as the current raw-spectrogram reducer leader for WP3.**

Do not close D-004 globally from this run. The dataset is only 22 one-second windows, the manual spot-check from Experiment 001 showed mixed window quality, and the t-SNE implementation needs confirmation with a second library or environment.

Do not update D-010 to Adopted solely from this run. The combined WP2/WP3 signal currently favors raw spectrograms plus PCA, but it remains an early benchmark signal rather than a clean production decision.

## Reproducibility Notes

Runner: `tools/run_experiment_002_wp3_reducer_benchmark.js`

Raw result artifact: `05_Benchmark_Results/experiment_002_wp3_reducer_results.json`

Dataset manifest: `manifest_birdnet_first_test.csv`

Audio source directory: `Assets/`

Sample extraction: `ffmpeg`, mono, 16 kHz, 1000 ms per row

STFT: FFT size `512`, hop size `256`, Hamming window

Raw spectrogram feature dimensions: `15677`

Reducer output dimensions: `20`

Trustworthiness `k`: `5`

Negative control seed base: `20260720`

Node dependencies added for this run: `umap-js@1.4.0`, `tsne-js@1.0.3`

Note: `npm install` reported vulnerabilities in transitive dependencies. This runner is local research code, not a deployed service, but dependency hygiene should be revisited if these libraries become part of a maintained application.
