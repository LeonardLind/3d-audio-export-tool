# Experiment 001 - Feature Set Benchmark Results

**Date run:** 2026-07-20  
**Dataset manifest:** `manifest_birdnet_first_test.csv`  
**Rows used:** 22  
**Segmentation:** fixed 1000 ms windows; for each manifest row, the analyzed window starts at `start_time` and ends at `start_time + 1.0`.  
**Reducer:** PCA to 3 components  
**Primary metric:** trustworthiness, `k = 5`  
**Negative control:** seeded Gaussian random data with matched row count and feature dimensionality for each candidate.  
**Negative control threshold:** pass if real trustworthiness exceeds matched random-control trustworthiness by at least `0.02`.  
**Random seed base:** `20260720`

## Results

| Feature type | Dimensions | Real trustworthiness | Negative-control trustworthiness | Margin | Control pass? | PCA explained variance, 3D |
|---|---:|---:|---:|---:|---|---:|
| MFCCs | 26 | 0.9721 | 0.8864 | 0.0857 | Pass | 0.8546 |
| Inherited 8-axis spectral descriptors | 8 | 0.9981 | 0.9377 | 0.0604 | Pass | 0.9810 |
| Raw flattened spectrograms | 15677 | 0.8344 | 0.7857 | 0.0487 | Pass | 0.2422 |

## Decision Rule Application

All candidates passed the mandatory negative control. The highest real-data trustworthiness score was the inherited 8-axis spectral descriptor set at `0.9981`.

No tie was triggered: MFCCs were `0.0260` below the leader, outside the pre-committed `0.02` tie band. Raw flattened spectrograms were also outside the tie band.

**Experiment 001 PCA-baseline leader:** inherited 8-axis spectral descriptors.

Per the pre-committed raw-spectrogram provisionality rule, the raw flattened spectrogram loss in this PCA-only pass is provisional and does not close D-010 until raw spectrograms receive the planned WP3 UMAP-based retest.

## Reproducibility

The run output was saved as `05_Benchmark_Results/experiment_001_results.json`.

The executable runner is `tools/run_experiment_001.js`. It uses `ffmpeg` to extract deterministic mono 16 kHz, 1000 ms windows and performs feature extraction, PCA, random controls, and trustworthiness scoring in Node.js.

Label-exclusion check: species/common-name/scientific-name labels remain manifest metadata only. The matrices passed into scaling, PCA fitting, and trustworthiness contain audio-derived numeric features only.

## Follow-Up: Dimensionality-Appropriate PCA

A second diagnostic run was performed with `tools/run_experiment_001.js --auto95`. Instead of forcing every feature type to 3 PCA components, this version uses the smallest component count that reaches at least `0.95` cumulative explained variance for each feature matrix. The same trustworthiness metric and matched random-data negative control were used.

Raw output: `05_Benchmark_Results/experiment_001_auto95_results.json`.

| Feature type | PCA components | Explained variance retained | Real trustworthiness | Negative-control trustworthiness | Margin | Control pass? |
|---|---:|---:|---:|---:|---:|---|
| MFCCs | 7 | 0.9614 | 0.9994 | 0.9929 | 0.0065 | Fail |
| Inherited 8-axis spectral descriptors | 3 | 0.9810 | 0.9981 | 0.9955 | 0.0026 | Fail |
| Raw flattened spectrograms | 20 | 0.9721 | 0.9955 | 0.8117 | 0.1838 | Pass |

Interpretation: retaining enough PCA dimensions to preserve approximately 95% variance makes the low-dimensional engineered-feature real scores nearly perfect, but it also makes their random controls nearly perfect. Under the mandatory `real - control >= 0.02` rule, MFCCs and the 8-axis descriptors fail this diagnostic variant. Raw flattened spectrograms pass the diagnostic variant, but this should not be treated as an adoption decision because the original pre-committed Experiment 001 reducer was the fixed 3D PCA baseline and the sample is very small.

## Manual Spot-Check

Six high-confidence manifest windows were extracted exactly as used by the benchmark and saved under `05_Benchmark_Results/spot_checks/` as 1-second WAV snippets with matching spectrogram PNGs.

| Index | Manifest row | Start | Visual spot-check |
|---:|---|---:|---|
| 1 | `1_2MM06956_20250415_113000`, Short-crested Flycatcher | 36.0 | Mostly diffuse background; no clear discrete bird syllable visible |
| 2 | `1_2MM06956_20250415_114500`, Short-crested Flycatcher | 30.0 | Mostly diffuse background; no clear discrete bird syllable visible |
| 3 | `1_2MM06956_20250415_114500`, Short-crested Flycatcher | 27.0 | Clear late-window tonal/stacked band around roughly 2-3 kHz |
| 4 | `1_2MM06956_20250415_113000`, Short-crested Flycatcher | 30.0 | Clear late-window rising/stepped low-kHz band |
| 5 | `1_2MM06956_20250415_113000`, Short-crested Flycatcher | 42.0 | Clear short tonal patch around roughly 2-3 kHz |
| 6 | `1_2MM06956_20250415_114000`, Olivaceous Woodcreeper | 3.0 | Clear multi-band low/mid-frequency tonal structure |

Spot-check conclusion: 4 of 6 inspected windows visibly contain plausible bird-vocalization energy; 2 of 6 do not show a clear discrete vocal element in the first 1000 ms slice. This supports treating Experiment 001 as a useful first signal but not a clean adoption-quality benchmark.

## Folder Note

At the start of the run, this workspace had `Info/Experiment_001_Feature_Set_Benchmark.md` but no `03_Research_Notebook/` folder. Because the requested path was `03_Research_Notebook/Experiment_001_Feature_Set_Benchmark.md`, that folder and filled run note were created. The `Info/` copy remains the original planning/source-context copy.

## D-010 Status

D-010 should not be updated to Adopted from this run. The result is a real first signal, but the dataset is small, the fixed-window spot-check is mixed, and the dimensionality-appropriate PCA diagnostic changes the negative-control picture.

## Experiment 002 - WP3 Raw Spectrogram Reducer Benchmark

Raw spectrograms were carried into WP3 and compared across PCA, UMAP, and t-SNE using the same 22-row manifest. The dimensionality-appropriate output size was set to 20 dimensions, matching the number of PCA components raw spectrograms needed to retain at least 95% explained variance in the Experiment 001 auto95 run.

Raw output: `05_Benchmark_Results/experiment_002_wp3_reducer_results.json`.

| Reducer | Output dimensions | Real trustworthiness | Negative-control trustworthiness | Margin | Control pass? |
|---|---:|---:|---:|---:|---|
| PCA | 20 | 0.9955 | 0.7240 | 0.2714 | Pass |
| UMAP | 20 | 0.5779 | 0.7312 | -0.1532 | Fail |
| t-SNE | 20 | 0.3760 | 0.3227 | 0.0532 | Pass |

WP3 result: PCA is the current raw-spectrogram reducer leader for this small first dataset. UMAP failed the mandatory negative-control rule in this run. t-SNE passed after the reducer-interface refactor but remained far below PCA and showed implementation instability, so it should be retested before drawing a strong conclusion. This should not close D-004 globally or D-010 as Adopted; it is still an early benchmark with only 22 fixed windows.

## Reducer Interface

The reducer step is now swappable through a single interface rather than separate builds. The shared implementation is `tools/lib/reducers.js`, and the default setting file is `tools/reducer_config.json`.

Supported reducer setting values:

| Setting | Reducer |
|---|---|
| `pca` | PCA |
| `umap` | UMAP |

Default config:

```json
{
  "method": "pca",
  "dimensions": 20
}
```

The setting can be changed to `umap` while keeping the rest of the pipeline unchanged. PCA remains the current default because it is the WP3 leader so far, but the interface deliberately keeps UMAP available until a larger dataset gives a clean winner.

## Experiment 003 - WP2 Slice-2 150-Row Feature Benchmark

Manifest: `manifest_slice2_birdnet_150.csv`  
Rows: `150`  
Fair method: PCA auto-95 with matched random negative controls.

| Feature type | PCA components | Real trustworthiness | Negative-control trustworthiness | Margin | Control pass? |
|---|---:|---:|---:|---:|---|
| MFCCs | 11 | 0.9978 | 0.9945 | 0.0034 | Fail |
| Inherited 8-axis spectral descriptors | 4 | 0.9925 | 1.0000 | -0.0075 | Fail |
| Raw flattened spectrograms | 106 | 0.9838 | 0.9162 | 0.0676 | Pass |

WP2 result: raw flattened spectrograms are the only feature representation to pass the fair negative-control rule on the 150-row slice-2 manifest.

Artifacts:

- `05_Benchmark_Results/experiment_001_manifest_slice2_birdnet_150_fixed3_results.json`
- `05_Benchmark_Results/experiment_001_manifest_slice2_birdnet_150_auto95_results.json`
- `03_Research_Notebook/Experiment_003_WP2_Slice2_150_Feature_Set_Benchmark.md`

## Experiment 004 - WP3 Slice-2 150-Row Reducer Benchmark

Feature representation: raw flattened spectrograms  
Rows: `150`  
Output dimensions: `106`, matching raw-spectrogram PCA auto-95 dimensionality for this manifest.

| Reducer | Output dimensions | Real trustworthiness | Negative-control trustworthiness | Margin | Control pass? |
|---|---:|---:|---:|---:|---|
| PCA | 106 | 0.9838 | 0.9628 | 0.0210 | Pass |
| UMAP | 106 | 0.7617 | 0.6993 | 0.0624 | Pass |
| t-SNE | 106 | 0.4016 | 0.3434 | 0.0582 | Pass |

WP3 result: all three reducers passed the negative-control rule, but PCA remains the trustworthiness leader and is carried forward. UMAP should remain available behind the swappable reducer setting until a broader benchmark locks the reducer decision.

Artifacts:

- `05_Benchmark_Results/experiment_002_wp3_reducer_manifest_slice2_birdnet_150_results.json`
- `03_Research_Notebook/Experiment_004_WP3_Slice2_150_Raw_Spectrogram_Reducer_Benchmark.md`

## Experiment 005 - Device/Location/Recording-Condition Fingerprint Test

Method: adopted raw flattened spectrograms + PCA.  
Failure criterion context: repeated recordings of the same individual/song should cluster more closely than recordings of different individuals.  
Actual test performed: two filename-derived recorder/deployment IDs from `Assets/slice_2_acoustic_data`, balanced to 31 recordings each. These are not confirmed individual birds.

| Metric | Value |
|---|---:|
| Rows | 62 |
| PCA components, auto-95 | 46 |
| PCA explained variance retained | 0.9506 |
| Embedding trustworthiness | 0.9674 |
| Same-ID mean distance | 155.9849 |
| Different-ID mean distance | 166.3827 |
| Mean distance delta, different minus same | 10.3978 |
| Same-ID median distance | 158.0205 |
| Different-ID median distance | 155.8340 |
| Nearest-neighbor same-ID rate | 0.6290 |
| Balanced nearest-neighbor baseline | 0.5000 |
| Permutation p-value | 0.0010 |

Result: device/location/recording-condition fingerprint detected. Same-ID clips are closer by mean distance and pass a shuffled-label permutation control, but the median distance goes slightly the other direction. This should not be described as individual-bird clustering until human-confirmed individual labels exist.

Artifacts:

- `05_Benchmark_Results/experiment_005_individual_clustering_results.json`
- `manifest_experiment_005_individual_validation.csv`
- `03_Research_Notebook/Experiment_005_Device_Location_Recording_Condition_Fingerprint_Test.md`

## Experiment 006 - Loudest 1s Window Selection WP2 Retest

Segmentation stopgap tested: instead of always analyzing the first 1000 ms of each BirdNET detection interval, scan the full `start_time` to `end_time` interval and select the loudest 1000 ms sub-window by RMS energy.

| Feature type | PCA components | Real trustworthiness | Negative-control trustworthiness | Margin | Control pass? |
|---|---:|---:|---:|---:|---|
| MFCCs | 13 | 0.9975 | 0.9945 | 0.0031 | Fail |
| Inherited 8-axis spectral descriptors | 5 | 0.9978 | 1.0000 | -0.0022 | Fail |
| Raw flattened spectrograms | 88 | 0.9809 | 0.9162 | 0.0648 | Pass |

Comparison to Experiment 003 fixed-first-second raw spectrogram score: `0.9838` -> `0.9809`, delta `-0.0028`. D-010 is unchanged: raw flattened spectrograms remain the only feature representation to pass the fair negative-control rule.

Manual spot-checks in `05_Benchmark_Results/spot_checks_exp006_loudest/` show visible bird-like acoustic structure in the inspected loudest-window picks. RMS selection is better than fixed-start selection, but it remains a stopgap because loud non-bird noise could still win in noisy clips.

Artifacts:

- `05_Benchmark_Results/experiment_006_loudest_window_wp2_results.json`
- `05_Benchmark_Results/experiment_006_loudest_windows.csv`
- `03_Research_Notebook/Experiment_006_Loudest_Window_WP2_Retest.md`
