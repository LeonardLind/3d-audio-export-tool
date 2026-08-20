# Experiment 001 - Feature Set Benchmark

**Date:** 2026-07-20  
**Work Package:** WP2  
**Related Decision Log ID(s):** D-010  
**Status:** Run - PCA-baseline result recorded

## Question

Which of the candidate feature-extraction strategies identified in WP1 - MFCCs, the inherited 8-axis spectral-descriptor set, or raw flattened spectrograms with no hand-designed features - best preserves real structure in this project's dataset, without relying on BirdNET-family embeddings?

BirdNET labels are used only to select the first-test dataset rows from `manifest_birdnet_first_test.csv`; labels are excluded from feature fitting, PCA, and metric scoring.

## Hypothesis

Based on WP1 literature findings: MFCCs are reported to outperform other engineered feature families specifically for birdsong. Raw spectrograms are a genuinely different strategy and may outperform both engineered options, at the cost of interpretability of any single axis. The inherited 8-axis set is treated as a candidate with no privileged status, per WP2.

Deferred: the from-scratch VAE embedding candidate is out of scope for Experiment 001 and reserved for Experiment 002.

## Method

**Dataset / subset used:** `manifest_birdnet_first_test.csv`, 22 BirdNET rows generated from `Assets/*.csv` using confidence `> 0.5`, excluding `perch`, and keeping only the highest-confidence guess per `audio_id/start_time/end_time` window.

**Segmentation unit for this experiment:** fixed-length windows of 1000 ms. For each manifest row, the analyzed audio begins at `start_time` and ends at `start_time + 1.0`.

**Feature candidates:**

| Candidate | Implementation |
|---|---|
| MFCCs | 13 MFCC coefficients summarized by mean and standard deviation across STFT frames, yielding 26 dimensions |
| Inherited 8-axis spectral descriptors | spectral centroid, spectral spread, spectral entropy, spectral crest, spectral slope, frequency modulation, amplitude modulation, tonality |
| Raw flattened spectrograms | log-magnitude STFT bins flattened directly, yielding 15677 dimensions |

**Procedure:** extract each candidate feature representation from the same 22 audio windows; standardize numeric features; run PCA to 3 components; compute trustworthiness using the original feature matrix and the PCA embedding.

**Primary metric:** trustworthiness of the PCA embedding.

**Trustworthiness neighborhood parameter:** `k = 5`.

**Negative control type used:** seeded Gaussian random data with matched row count and feature dimensionality, run through the same standardization, PCA, and trustworthiness pipeline for each candidate.

**Negative control random seed:** base seed `20260720`; candidate seeds `20260721`, `20260722`, and `20260723`.

**Negative control metric name:** trustworthiness.

**Negative control threshold:** pass if real-data trustworthiness exceeds matched random-control trustworthiness by at least `0.02`.

**Label-exposure risk step:** feature scaling, PCA fitting, and trustworthiness scoring.

**Label-exclusion verification:** labels were not passed into any fitting or scoring function. The runner retains labels only as manifest metadata; feature matrices contain audio-derived numeric values only.

**Known reducer limitation:** every candidate is run through PCA as the fixed baseline for an apples-to-apples first pass. A weak PCA result for raw spectrograms is not disqualifying on its own; raw spectrograms should receive a second UMAP-based pass in WP3 before being ruled out.

## Pre-Committed Decision Rule

**Primary metric:** trustworthiness of the PCA embedding, computed for each feature representation using the same neighborhood parameter and dataset subset.

**Winner rule:** among candidates whose negative control passes, the candidate with the highest trustworthiness score is the current PCA-baseline leader for Experiment 001.

**Raw-spectrogram provisionality rule:** if raw flattened spectrograms lose under this PCA-only pass, that result is provisional and does not close D-010 until raw spectrograms receive the planned UMAP-based retest in WP3.

**Minimum separation threshold:** if the top two candidates differ by less than 0.02 trustworthiness points, treat the result as a tie rather than a decisive ranking.

**Tie-breaker:** if candidates are tied within the 0.02 band, do not pick a feature-set winner from Experiment 001. Record the tie and carry both candidates forward to the next relevant benchmark.

**Disqualification rule:** any candidate whose negative control fails is disqualified regardless of its real-data score.

## Results

| Feature type | Dimensions | Real trustworthiness | Negative-control trustworthiness | Margin | Control pass? | PCA explained variance, 3D |
|---|---:|---:|---:|---:|---|---:|
| MFCCs | 26 | 0.9721 | 0.8864 | 0.0857 | Pass | 0.8546 |
| Inherited 8-axis spectral descriptors | 8 | 0.9981 | 0.9377 | 0.0604 | Pass | 0.9810 |
| Raw flattened spectrograms | 15677 | 0.8344 | 0.7857 | 0.0487 | Pass | 0.2422 |

All three candidates passed the mandatory negative control.

## Unexpected Observations

The inherited 8-axis descriptor set outperformed MFCCs in this small PCA baseline, despite the hypothesis giving MFCCs a literature-based expectation. This should be treated cautiously because the dataset has only 22 windows and was selected from BirdNET detections from a small number of recordings.

Raw flattened spectrograms had much lower 3D PCA explained variance than the engineered feature sets, which is consistent with the known reducer limitation: PCA may be a poor first reducer for this high-dimensional representation.

## Discussion

The inherited 8-axis spectral descriptor set produced the highest trustworthiness score, `0.9981`, and exceeded the MFCC score by `0.0260`, which is outside the pre-committed `0.02` tie band. Under the Experiment 001 decision rule, this makes it the PCA-baseline leader rather than a tie.

MFCCs also performed strongly, with trustworthiness `0.9721`, and passed the negative control with a margin of `0.0857`. The result does not reject MFCCs as a serious candidate; it only ranks them below the 8-axis descriptors for this PCA baseline.

Raw flattened spectrograms scored `0.8344`, passed the negative control, and lost this PCA-only pass. Per the raw-spectrogram provisionality rule, this is not enough to close D-010 against raw spectrograms. They should still receive the planned UMAP retest in WP3 before being ruled out.

## Decision

**Continue with the inherited 8-axis spectral descriptor set as the current PCA-baseline leader for Experiment 001.**

No candidates are disqualified, because all negative controls passed.

Carry forward:

- Inherited 8-axis spectral descriptors as the current leader.
- MFCCs as a still-viable comparator because performance was strong and the dataset is small.
- Raw flattened spectrograms for the planned WP3 UMAP retest; its PCA loss is provisional and does not close D-010.

## Reproducibility Notes

Runner: `tools/run_experiment_001.js`  
Raw result artifact: `05_Benchmark_Results/experiment_001_results.json`  
Dataset manifest: `manifest_birdnet_first_test.csv`  
Audio source directory: `Assets/`  
Sample extraction: `ffmpeg`, mono, 16 kHz, 1000 ms per row  
STFT: FFT size `512`, hop size `256`, Hamming window  
PCA components: `3`  
Trustworthiness `k`: `5`  
Negative control seed base: `20260720`

## Follow-Up Notes

**Folder status:** this workspace originally had the planning copy at `Info/Experiment_001_Feature_Set_Benchmark.md` but did not have a `03_Research_Notebook/` folder. This run-filled notebook file was created in `03_Research_Notebook/` to match the requested research-notebook structure; the `Info/` copy remains the original planning/source-context copy.

**Dimensionality-appropriate PCA diagnostic:** a second run used `tools/run_experiment_001.js --auto95`, choosing the smallest PCA component count that retained at least 95% explained variance per feature matrix. Results were saved to `05_Benchmark_Results/experiment_001_auto95_results.json`.

| Feature type | PCA components | Explained variance retained | Real trustworthiness | Negative-control trustworthiness | Margin | Control pass? |
|---|---:|---:|---:|---:|---:|---|
| MFCCs | 7 | 0.9614 | 0.9994 | 0.9929 | 0.0065 | Fail |
| Inherited 8-axis spectral descriptors | 3 | 0.9810 | 0.9981 | 0.9955 | 0.0026 | Fail |
| Raw flattened spectrograms | 20 | 0.9721 | 0.9955 | 0.8117 | 0.1838 | Pass |

Interpretation: once enough PCA dimensions are retained to preserve approximately 95% variance, MFCCs and the inherited 8-axis descriptors score highly on real data but also score highly on matched random data, so they fail the mandatory negative-control margin in this diagnostic variant. Raw flattened spectrograms pass this diagnostic variant, but this is not an adoption decision because the pre-committed Experiment 001 baseline was fixed 3D PCA and the dataset remains small.

**Manual spot-check:** six high-confidence 1-second benchmark windows were extracted to `05_Benchmark_Results/spot_checks/` with matching spectrogram PNGs. Four of six show plausible bird-vocalization energy; two appear mostly diffuse/background in the first 1000 ms slice. This reinforces that the run is a useful first signal, not a clean D-010-closing result.

**D-010 status:** do not update D-010 to Adopted from this run.
