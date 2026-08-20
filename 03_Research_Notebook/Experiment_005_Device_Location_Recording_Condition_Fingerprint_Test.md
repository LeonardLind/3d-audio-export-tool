# Experiment 005 - Device/Location/Recording-Condition Fingerprint Test

**Date:** 2026-07-20  
**Work Package:** Validation / Failure Criteria  
**Related Decision Log ID(s):** D-004, D-010  
**Status:** Run - device/location fingerprint check recorded

## Question

Using the adopted method, raw flattened spectrograms plus PCA, do clips from the same recorder/deployment ID cluster closer together than clips from different recorder/deployment IDs?

This is **not** an individual-bird validation test. The tested IDs, `4_2MM06988` and `1_2MM06956`, are recorder/deployment identifiers inferred from filenames, not confirmed individual birds.

This test is tied directly to the v0.4 Failure Criteria:

> Repeated recordings of the same individual/song do not cluster together more closely than recordings of different individuals.

Because no individual-bird ground truth currently exists, this run is only a proxy/adjacent test: it checks whether the adopted method produces stable device/location/recording-condition fingerprints, and it flags the risk that recording conditions may explain manifold structure.

## Dataset

Source: `Assets/slice_2_acoustic_data`

Only two usable recorder/deployment IDs were available under the downloaded/S3 prefix:

| Recorder/deployment ID | Eligible recordings |
|---|---:|
| `4_2MM06988` | 2018 |
| `1_2MM06956` | 31 |

The test was balanced to the smaller group: 31 recordings per ID, 62 rows total.

Manifest: `manifest_experiment_005_individual_validation.csv`

Selection rule:

- BirdNET rows only.
- Confidence `> 0.5`.
- Require local matching WAV.
- Use one best high-confidence clip per recording, to avoid measuring within-recording similarity.
- Balance IDs by recording count.

## Method

Feature representation: raw flattened spectrograms.

Reducer: PCA, using auto-95 dimensionality.

PCA components: 46.

PCA explained variance retained: 0.9506.

Trustworthiness `k`: 5.

Embedding trustworthiness: 0.9674.

Distance test:

- Compute pairwise Euclidean distances in the PCA embedding.
- Split pairs into same-ID and different-ID pairs.
- Compare mean and median distances.
- Run a label-shuffle permutation control with 1000 permutations.
- Also report nearest-neighbor same-ID rate.

## Results

| Metric | Value |
|---|---:|
| Rows | 62 |
| Same-ID pairs | 930 |
| Different-ID pairs | 961 |
| Same-ID mean distance | 155.9849 |
| Different-ID mean distance | 166.3827 |
| Mean distance delta, different minus same | 10.3978 |
| Mean distance ratio, same / different | 0.9375 |
| Same-ID median distance | 158.0205 |
| Different-ID median distance | 155.8340 |
| Median distance delta, different minus same | -2.1865 |
| Nearest-neighbor same-ID rate | 0.6290 |
| Balanced nearest-neighbor baseline | 0.5000 |
| Permutation p-value, mean delta >= observed | 0.0010 |

## Discussion

The mean-distance result shows a recorder/deployment fingerprint: same-ID clips are closer on average than different-ID clips by 10.3978 embedding-distance units, and the label-shuffle permutation test gives `p = 0.0010`.

The nearest-neighbor same-ID rate is also above the balanced baseline: 0.6290 vs 0.5000.

However, the median-distance result does not support the same conclusion. Same-ID median distance is slightly larger than different-ID median distance. This suggests the signal is present but not uniformly distributed; some same-ID clips remain far apart, or some different-ID clips are acoustically similar.

Important caveat: the available labels are recorder/deployment IDs inferred from filenames, not independently verified biological individual identities. This test should be interpreted as evidence that device/location/recording-condition structure is present in the manifold, not evidence that individual birds cluster correctly.

## Decision

**Device/location fingerprint detected; individual-bird validation remains untested.**

The adopted raw-spectrogram + PCA method separates the two recorder/deployment IDs by mean distance more strongly than shuffled-label controls.

This does not close the individual-bird validation question. It should be rerun with:

- More than two IDs.
- Independently verified biological individual labels.
- More balanced recording counts.
- Controls for species, recorder/site, microphone, and recording condition.

## Reproducibility Notes

Runner: `tools/run_experiment_005_individual_clustering.js`

Result artifact: `05_Benchmark_Results/experiment_005_individual_clustering_results.json`

Validation manifest: `manifest_experiment_005_individual_validation.csv`

Random seed base: `20260720`

Permutation count: `1000`
