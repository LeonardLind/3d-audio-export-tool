# Experiment 006 - Loudest 1s Window Selection WP2 Retest

**Date:** 2026-07-20  
**Work Package:** WP2 / Segmentation Stopgap  
**Related Decision Log ID(s):** D-009, D-010  
**Status:** Run - window-selection fix tested

## Question

Does replacing the fixed first-second extraction rule with a loudest-1-second sub-window rule improve the WP2 benchmark, and does it change the D-010 acoustic feature-set decision?

The issue being fixed: each manifest row comes from an original BirdNET detection interval, usually 3 seconds. Earlier runs analyzed only the first 1000 ms starting at `start_time`, but manual spot-checking showed that the bird sound is not always at the very start.

## Method

Dataset: `manifest_slice2_birdnet_150.csv`, 150 rows.

Old window rule: analyze `start_time` to `start_time + 1.0`.

New window rule: for each row, load the full detection interval from `start_time` to `end_time`, scan 1000 ms windows with a 100 ms hop, and select the sub-window with the highest RMS/amplitude energy.

Feature benchmark: same WP2 candidates as before.

- MFCCs
- Inherited 8-axis spectral descriptors
- Raw flattened spectrograms

Reducer: PCA auto-95, using the smallest component count that retains at least 95% explained variance for each feature matrix.

Primary metric: trustworthiness, `k = 5`.

Negative control: seeded Gaussian random data with matched row count and feature dimensionality.

Negative control threshold: pass if real trustworthiness exceeds matched random-control trustworthiness by at least `0.02`.

## Results

| Feature type | PCA components | Explained variance retained | Real trustworthiness | Negative-control trustworthiness | Margin | Control pass? |
|---|---:|---:|---:|---:|---:|---|
| MFCCs | 13 | 0.9569 | 0.9975 | 0.9945 | 0.0031 | Fail |
| Inherited 8-axis spectral descriptors | 5 | 0.9755 | 0.9978 | 1.0000 | -0.0022 | Fail |
| Raw flattened spectrograms | 88 | 0.9501 | 0.9809 | 0.9162 | 0.0648 | Pass |

## Comparison To Previous Fixed-Start Run

| Run | Raw spectrogram trustworthiness | Negative-control trustworthiness | Margin | PCA components |
|---|---:|---:|---:|---:|
| Experiment 003, fixed first second | 0.9838 | 0.9162 | 0.0676 | 106 |
| Experiment 006, loudest 1s sub-window | 0.9809 | 0.9162 | 0.0648 | 88 |

Trustworthiness changed by `-0.0028`, which is negligible relative to the decision rule. The loudest-window rule reduced the number of PCA components needed for raw spectrograms from 106 to 88 while preserving the D-010 result.

## Manual Spot-Check

Eight high-confidence loudest-window selections were extracted to `05_Benchmark_Results/spot_checks_exp006_loudest/`.

Inspected examples:

- `4_2MM06988_20250415_164500`, Cliff Flycatcher, selected offset 1.3 s: clear strong tonal bands.
- `4_2MM06988_20250417_165000`, Cliff Flycatcher, selected offset 1.2 s: clear call structure.
- `4_2MM06988_20250411_071000`, Cliff Flycatcher, selected offset 1.9 s: clear call structure.
- `4_2MM06988_20250411_071000`, Cliff Flycatcher, selected offset 0.0 s: clear call structure, indicating the rule keeps the first second when it is genuinely energetic.
- `4_2MM06988_20250405_093500`, Yellow-headed Caracara, selected offset 0.8 s: visible tonal components, though with broader background energy.

Manual conclusion: the loudest-window rule appears to select windows with visible bird-like acoustic structure in the inspected examples. It is an improvement over blindly taking the first second, but RMS alone can still select loud non-bird noise in noisy recordings.

## Discussion

The segmentation stopgap fix does not change the feature-set decision. MFCCs and inherited 8-axis descriptors still fail the negative-control rule because their matched random controls score nearly as high as or higher than the real data.

Raw flattened spectrograms remain the only candidate to pass the fair negative-control rule. The small drop in trustworthiness from 0.9838 to 0.9809 does not weaken the adoption decision; the result is effectively stable.

The main methodological benefit is qualitative and procedural: the selected windows better match the intended biological unit inside each BirdNET detection interval, and raw spectrograms require fewer PCA components to reach 95% explained variance.

## Decision

**Adopt the loudest-1-second sub-window rule as the current fixed-window segmentation stopgap.**

**No change to D-010:** raw flattened spectrograms remain the adopted acoustic feature set.

Keep D-009 open: this is still a stopgap, not a validated syllable/phrase segmentation method.

## Reproducibility Notes

Runner: `tools/run_experiment_006_loudest_window_wp2.js`

Result artifact: `05_Benchmark_Results/experiment_006_loudest_window_wp2_results.json`

Selected-window index: `05_Benchmark_Results/experiment_006_loudest_windows.csv`

Spot-check folder: `05_Benchmark_Results/spot_checks_exp006_loudest/`

Manifest: `manifest_slice2_birdnet_150.csv`

RMS scan hop: 100 ms

Window length: 1000 ms

Trustworthiness `k`: 5

Negative control seed base: `20260720`
