# Experiment 001 — Feature Set Benchmark

**Date:**
**Work Package:** WP2
**Related Decision Log ID(s):** D-010
**Status:** Planned

⸻

## Question

Which of the candidate feature-extraction strategies identified in WP1 — MFCCs, the inherited 8-axis spectral-descriptor set, or raw flattened spectrograms with no hand-designed features — best preserves real structure in this project's dataset, without relying on BirdNET-family embeddings (excluded per the label-circularity risk in v0.5)?

## Hypothesis

Based on WP1 literature findings: MFCCs are reported to outperform other engineered feature families specifically for birdsong. Raw spectrograms (Sainburg/Thomas et al. approach) are a genuinely different strategy and may outperform both engineered options, at the cost of interpretability of any single axis. The inherited 8-axis set is treated as a candidate with no privileged status, per WP2.

**Deferred:** the from-scratch VAE embedding candidate (listed in v0.5's WP2 plan) is explicitly deferred to Experiment 002. Rationale: it requires training a model from scratch, which adds failure modes before the basic MFCC/spectral-descriptor/raw-spectrogram comparison loop is even proven. Get the simpler pipeline working first.

## Method

* **Dataset / subset used:** [fill in — which portion of the 100+ recordings, balanced across species/individuals where possible per WP4 open items]
* **Segmentation unit for this experiment:** fixed-length windows of 1000 ms, with overlap/windowing parameters to be recorded in Reproducibility Notes — chosen as a stopgap, not a resolution of D-009. Full segmentation (syllable/phrase) is deferred to a later experiment once D-009 closes.
* **Deferred candidate:** from-scratch VAE embedding is out of scope for Experiment 001 and reserved for Experiment 002, after the simpler benchmark loop is working.
* **Procedure:** extract each candidate feature representation from the same audio subset; hold the embedding/reduction step constant (fix to one method, e.g. PCA, purely to isolate the feature-set variable — this is not the D-004 embedding decision, keep them separate)
* **Metrics used to evaluate:** Information Preservation metrics per candidate (explained variance / reconstruction error / trustworthiness / continuity / neighborhood preservation as applicable)
* **Negative control type used:** [fill in — e.g. synthetic random data with matched dimensionality, shuffled windows, or another specified control]
* **Negative control random seed:** [fill in before run]
* **Negative control metric name:** [fill in before run]
* **Negative control numeric result:** [fill in after run]
* **Negative control threshold:** [fill in before run]
* **Negative control pass/fail:** [fill in after run]
* **Label-exposure risk step:** [fill in — identify which fitting step could have seen labels, e.g. feature scaling, PCA fitting, model selection, plotting/coloring]
* **Label-exclusion verification:** [fill in — e.g. "labels not passed as a variable anywhere in the fitting function — verified by code inspection on [date]"]
* **Known reducer limitation:** every candidate is run through PCA as the fixed baseline for an apples-to-apples first pass. This may unfairly penalize raw flattened spectrograms, whose published precedent uses UMAP rather than PCA. A weak PCA result for raw spectrograms is not disqualifying on its own; raw spectrograms should receive a second UMAP-based pass in WP3 before being ruled out.

## Pre-Committed Decision Rule

* **Primary metric:** trustworthiness of the PCA embedding, computed for each feature representation using the same neighborhood parameter and dataset subset.
* **Winner rule:** among candidates whose negative control passes, the candidate with the highest trustworthiness score is the current PCA-baseline leader for Experiment 001.
* **Raw-spectrogram provisionality rule:** if raw flattened spectrograms lose under this PCA-only pass, that result is provisional and does not close D-010 until raw spectrograms receive the planned UMAP-based retest in WP3.
* **Minimum separation threshold:** if the top two candidates differ by less than 0.02 trustworthiness points, treat the result as a tie rather than a decisive ranking. Rationale: 0.02 is a conservative practical margin chosen before the run to avoid treating tiny metric differences as substantive evidence.
* **Tie-breaker:** if candidates are tied within the 0.02 band, do not pick a feature-set winner from Experiment 001. Record the tie and carry both candidates forward to the next relevant benchmark.
* **Disqualification rule:** any candidate whose negative control fails is disqualified regardless of its real-data score.

## Expected Outcome

A result ranking the candidates by Information Preservation, with the negative control confirming none of them manufacture structure from noise. Per v0.4 Failure Criteria: if the negative control fails for a candidate, that candidate is disqualified regardless of how good its "real data" score looks.

⸻

## Results

*(to be filled in once run)*

## Unexpected Observations

*(to be filled in)*

## Discussion

*(to be filled in)*

## Decision

*(Continue / Reject / Needs more testing — updates D-010 in the Decision Log)*

## Reproducibility Notes

*(to be filled in — dataset subset, code/library versions, random seed)*
