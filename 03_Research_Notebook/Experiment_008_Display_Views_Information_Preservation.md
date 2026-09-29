# Experiment 008 — Information Preservation of Each Displayed View (the X / Y / Z Toggles), Production Regime

**Date:** 2026-09-29 (pre-registration written, and revised the same day after an internal critique; run date to be filled in at run time)
**Work Package:** WP3 (Embedding Benchmark), Information Preservation Reporting (`01_Master_Framework/v0.4_Final.md`, Open Decisions), v2.0 track
**Related Decision Log ID(s):** D-004 (PCA), D-006 (negative controls), D-010 (raw spectrograms), D-005 (Rule 001), D-008 (no individual-bird claims), D-011 (Rule 002: benchmark plan before implementation). Proposed new ID: **D-015: per-view information-preservation reporting and the per-recording "weak view" flag for the X/Y/Z toggles** (provisional). Experiment 007 has already proposed D-014 for the display reducer. IDs are assigned only when results come in, and the order may change if another v2 experiment closes first.
**Status:** Pre-registered, not yet run

**Scientific Hierarchy level:** Frame (`01_Master_Framework/v0.4_Final.md`, Scientific Hierarchy). Each point is a 0.15 s nominal window (actual span 0.1625 s) of 6 consecutive STFT frames. Nothing is segmented, so no point is a syllable, phrase or acoustic event, and no result here may be described at those levels. Every fit is within one recording (Level 1, Individual Recording); nothing here speaks to cross-recording comparison views.

**D-008 scope line:** this experiment makes **no individual-bird claims and no cross-recording claims**. A recording is not treated as one bird, and nothing here says that two recordings, or two birds, are similar or different.

**Regime disclosure for D-004 and D-010:** the evidence behind D-004 (PCA) and D-010 (raw spectrograms) came from other regimes: Experiments 001–004, with 22 and 150 rows of 1 s windows pooled across recordings, FFT 512, 15677 dims. This experiment does **not** re-validate either decision. Reducer choice under the production regime is Experiment 007's question. 008 takes PCA as given and measures what each displayed view of it preserves.

⸻

## Question

**Under the production regime (PR), and within single recordings, does each view the v2 viewer can display — {PC1}, {PC2}, {PC3}, {PC1,PC2}, {PC1,PC3}, {PC2,PC3}, {PC1,PC2,PC3} — preserve local neighbourhood structure beyond chance, and how much of the feature variance does it carry?**

Three sub-questions, each with a real "no" available:

1. **Corpus level:** does each of the 7 views beat a matched-Gaussian control by at least 0.02 trustworthiness (paired CI lower bound)? A view can pass, fail or be inconclusive (see the Pre-Committed Decision Rule).
2. **Explained-variance claim:** what is the actual distribution of 3D explained variance under PR across the corpus? `06_Technical_Architecture/Technical_Architecture.md` (amendment of 2026-07-21, "Transparency note", ~line 118) says the top-3 PCA components explain "typically a few percent". A smoke run on one Bluethroat clip gave 30.0% (see "Why this experiment exists"). The claim may be supported, contradicted, or left undecided by the data.
3. **Per-recording flag:** a cheap per-recording check ("this view is weak for this recording") is intended to run at export time for every future export. Is that flag stable (split-half agreement), and is it fast enough (< 10 s per recording at n = 700)? Either can fail.

### Why this experiment exists (evidence gap)

- **The viewer is gaining views that have no evidence.** v2.0 adds X / Y / Z axis toggles:
  - 1 axis gives a line (a 1D view);
  - 2 axes give a 2D scatter;
  - 3 axes give the existing 3D cloud.
  - Core Philosophy: "Every visual element should represent measurable information." Each of the 7 views is a separate display claim and needs its own measured number.
- **Information Preservation Reporting is required for every reduction** (v0.4, Open Decisions): "Every dimensionality reduction method used must be accompanied by a quantitative measure of how much information was preserved and how much was discarded." For PCA that means explained variance, and the framework also names trustworthiness and continuity. A 1D or 2D view is a further reduction of the 3D one, so it needs its own numbers.
- **The explained-variance claim in the docs was written for a different regime.**
  - The 2026-07-21 amendment describes a 0.5 s window, a ~0.15 s hop, a ~7,967-dimension feature and ~400 points, and says "typically a few percent" with no measured distribution behind the word "typically".
  - The shipped PR is different: 0.15 s nominal windows, 3078 dims, at most 700 windows before the amplitude filter.
  - **Smoke value (verified by the author of this pre-registration on 2026-09-29, not a result):** on `Assets/smoke/Luscinia_svecica_song.ogg` through the PR front end (`readFullAudio` + `computeContinuousFrontEnd` from `tools/export_single_recording_dataset.js`, then production `pca(X, 3)` from `tools/lib/reducers.js`): 292 windows before the amplitude filter, n = 234 after it; explained-variance ratios 0.1616, 0.0813, 0.0566; total **0.2995**. All three components converged. This is one clip and is only the motivation for measuring the distribution. It is never reported as a result.
  - Earlier figures, all in other regimes, so they are priors only:
    - Experiment 001 (22 rows, 1 s windows, 15677 dims, pooled across recordings): raw-spectrogram 3D EV **0.2422**.
    - Experiment 001 slice-2 fixed-3 (`05_Benchmark_Results/experiment_001_manifest_slice2_birdnet_150_fixed3_results.json`, 150 rows, same front end): raw 3D EV **0.2272** (ratios 0.1016, 0.0671, 0.0584); matched-Gaussian control 3D EV **0.0239**; T(k=5) 0.6865 vs control 0.6203.
- **Relation to Experiment 007** (`03_Research_Notebook/Experiment_007_Reducer_Rebenchmark_Production_Regime.md`, pre-registered):
  - 007 compares reducers (PCA, UMAP, t-SNE, random projection). Its "PCA axis subsets" check gives each of the 7 subsets a corpus-level pass or fail against the matched-Gaussian **and** column-permuted controls.
  - 008 does **not** compare reducers. It adds what 007 does not cover:
    - explained variance per view and its corpus distribution (sub-question 2);
    - the per-recording flag, its stability and its cost (sub-question 3);
    - the exact numbers the viewer will show for each view;
    - the overlap-regime and recording-condition stratifications of those numbers.
  - The two experiments share the PR definition, the seed scheme (offset +1 = matched Gaussian, +2 = column-permuted) and the trustworthiness port. For a given recording and view they must therefore produce **identical** T_real and T_G values. This is cross-checked, and a mismatch suspends verdicts (see Additional pre-registered checks).

### Production regime (PR), definition used by this experiment

What `tools/export_single_recording_dataset.js` does today (constants read from the file on 2026-09-29):

- **Decoding:** mono at 22050 Hz (`DEFAULT_ANALYSIS_SAMPLE_RATE`), via `readFullAudio` (ffmpeg from `tools/lib/ffbin.js`).
- **STFT:** Hamming window 1024 (`FFT_SIZE`), hop 512 (`HOP_SIZE`, ≈ 23.2 ms).
- **Points:** windows of 6 consecutive frames (`round(POINT_WINDOW_SECONDS / frameHop)` with `POINT_WINDOW_SECONDS` = 0.15), every 2 frames at the base hop (`round(POINT_HOP_SECONDS / frameHop)` with `POINT_HOP_SECONDS` = 0.05, i.e. ≈ 0.046 s).
  - Nominal length is 0.15 s. The actual span is (6 − 1)·512 + 1024 = 3584 samples = 0.1625 s.
  - The hop widens (`pointHopFrames = max(2, ceil(frames / MAX_POINTS))`, `MAX_POINTS` = 700) so that a recording yields at most 700 windows **before** the amplitude filter.
  - **Consequence for window overlap (this varies across recordings):** with hop h frames, adjacent windows share max(0, 6 − h) of their 6 frames. h = 2 (4 of 6 frames shared) holds only while frames ≤ 1400, i.e. up to roughly 32.5 s of audio. Longer recordings get h ≥ 3. From about 81 s (frames > 3500), h ≥ 6 and adjacent windows share no whole frame; from h ≥ 7 they share no audio sample at all. For example, a 120 s clip has about 5168 frames, so h = 8. Overlap is therefore confounded with recording length. The exact h is logged per recording (`pointHopFrames` is returned by `computeContinuousFrontEnd`). *Manifest metadata, not a result:* by `durationSeconds` in `manifest_v2_corpus.json`, 17 of the 60 evidence recordings are longer than 32.5 s and 2 are longer than 81.3 s (maximum 104.2 s). The run-time h values govern.
- **Feature:** frame-major 6 × 513 log1p magnitude (`rawSpectrogramFeatures`), 3078 dims.
- **Amplitude filter:** the quietest 20% of windows by RMS are dropped (`AMPLITUDE_FILTER_PERCENTILE` = 0.2). The threshold is the sorted RMS at index `floor(0.2·(N − 1))`, and windows at or above it are kept, so after the filter n ≤ about 560 in practice (ties can keep more). The exact n is logged per recording.
- **Reduction:** per-recording z-scoring (population SD; a zero-SD column is divided by 1) and PCA to 3 components with the production `pca()` in `tools/lib/reducers.js`.
  - *Code inspection, 2026-09-29:* `pca()` is Gram-matrix power iteration from the deterministic start vector sin((i+1)(c+1)), iterated until relative residual < `PCA_TOLERANCE` = 1e-10 or `PCA_MAX_ITERATIONS` = 5000 (`tools/lib/reducers.js`, constants at lines 35–36, loop at lines ~176–188), with Hotelling deflation. With a fixed component count it also probes the next eigenvalue (λ₄ here) by a further power iteration. That probe does not change the returned embedding, because it runs after the 3 components are stored. Experiment 007's Method describes "100 iterations per component". That does not match the current code, and is noted here for 007's owner; 008 uses the code as it is at run time and logs its git blob hash.
- **Display positions:** `position = embedding[0..2] × POSITION_SPREAD / max|embedding|` (`POSITION_SPREAD` = 6). This is one uniform scale over all three axes, so it does not change any neighbour rank. T and C computed on the raw PCA scores therefore equal T and C on the exported positions.
- **Similarity edges:** k = 3 nearest neighbours in the 3D PCA positions, excluding candidates less than 1.5 s apart (`buildSimilarityEdges`).
- **Axis mapping assumed:** X = PC1, Y = PC2, Z = PC3, as the current exporter writes `position`. If the v2 viewer maps the toggles differently, the view labels are remapped and nothing is recomputed.

The runner must obtain the feature matrix **through the production code path** (`readFullAudio` + `computeContinuousFrontEnd` exported by `tools/export_single_recording_dataset.js`), not through a re-implementation.

## Hypothesis

Each of these can turn out to be wrong. Nothing in `04_Literature/Literature_Database.md` measures per-axis neighbourhood preservation for frame-level, within-recording birdsong windows, so there is no literature prior for H1, H4 or H5.

- **H1 (views beat chance):** every one of the 7 views passes the corpus-level rule (paired CI lower bound of mean(T_real − T_G) ≥ 0.02).
  - Basis: a single prior in another regime (Experiment 001 slice-2 fixed-3: margin 0.0662 at 3D, one value, no CI).
  - Competing expectation, held as equally plausible: a single axis keeps only a small share of the variance, so the 1D views ({PC1}, {PC2}, {PC3}) may not beat their control by 0.02.
  - Falsified for any view whose verdict is "fail" or "inconclusive".
- **H2 (the "few percent" claim does not hold under PR):** the median 3D explained variance EV₃ across the corpus is above 0.10, with the 95% bootstrap CI of the median entirely above 0.10.
  - Basis: the smoke value 0.2995 (one clip) and Experiment 001's 0.2422 and 0.2272 (other regimes).
  - Falsified if the CI of the median lies entirely at or below 0.10 (the claim is supported), or if it straddles 0.10 (the claim is undecided).
- **H3 (real variance is concentrated beyond chance):** for every view, the real explained-variance share exceeds the matched-Gaussian share for the same component indices (paired CI lower bound of mean(EV_real − EV_G) > 0).
  - Basis: adjacent frequency bins are correlated, and at the base hop adjacent windows share 4 of 6 frames, which correlates the real columns; G's columns are independent.
  - This is expected almost by construction. It is reported so that the "keeps X%" number always has a chance reference next to it, not because it is informative on its own. EV_G can be biased when a control component does not converge (see Convergence), so H3 is descriptive only.
- **H4 (the per-recording flag is stable):** for every view, split-half agreement of the "weak for this recording" flag has a 95% bootstrap CI lower bound ≥ 0.80.
  - No strong prior. Each half has about n/2 points, and T depends on n, so the check is deliberately conservative.
- **H5 (the flag is cheap):** the complete export-time computation, computed directly (definition in Method), takes < 10 s per recording at n = 700 on the run machine.
  - **Expectation, stated honestly: at risk. Fallback F1 is likely to be needed.** F1 is therefore timed on every call as well, as the expected shipping path (see Timing definition).
  - Basis, operation count:
    - Rank context of X (squared-distance matrix at n = 700, d = 3078): about 7.5e8 multiply-adds (the `metrics.squaredDistanceMatrix` documentation), plus sorting.
    - Gram matrix of G_exp: n²d/2 ≈ 7.5e8 multiply-adds.
    - **Power iteration on G_exp, the dominant cost:** each iteration is one n × n matrix–vector product (4.9e5 multiply-adds at n = 700). G_exp is i.i.d. Gaussian, so its top sample eigenvalues are nearly equal, and power iteration converges slowly or reaches the 5000-iteration cap.
  - Basis, scratch measurement (author of this revision, 2026-09-29; control only, no real data; motivation, not a result): `pca(G_exp, 3)` with G_exp = `metrics.randomMatchedMatrix` of shape 700 × 3078 and seed 20260720 + 990 (EXPORT_CONTROL_SEED).
    - PC1 converged after 1616 iterations; PC2 reached the 5000 cap unconverged (relative residual 1.23e-9); PC3 converged after 2607 iterations. The λ₄ probe iterations are not logged by `pca()`.
    - That is 9223 iterations, about 4.5e9 multiply-adds, roughly 6× the Gram matrix cost.
    - These iteration counts are deterministic (fixed seed and fixed start vector). An independent critic scratch run on the same code reported the same three counts.
    - The wall-clock time in this scratch run was 32.8 s on an 8-core Apple M2 under a 1-minute load average of 44.3 (other agents were running concurrently). That time is **not** a valid timing and is not used; it is recorded only to show why the Timing definition now includes a load check.
  - The real wall-clock time is **unknown** until measured under the Timing definition.

## Method

* **Dataset / subset used:** `manifest_v2_corpus.json` (see `03_Research_Notebook/Corpus_v2.md`).
  - As built on 2026-09-29, `Corpus_v2.md` records **60 evidence recordings** from 12 species (5 per species, 49 distinct observers, 1,514.8 s in total, median duration 19.6 s, range 5–120 s by the selection rule), plus **2 Wikimedia Commons Bluethroat demo files** that are listed separately and "are not part of the evidence set".
  - The runner reads the final counts from the manifest at run time and logs them with the manifest's SHA-256. If they differ from the numbers above, the run-time numbers govern and the difference is noted in Unexpected Observations.
  - This is a **new corpus**. Results are new experiments, not reproductions of Experiments 001–006.
  - **Primary analysis set:** the evidence recordings. **Demo files:** analysed with exactly the same procedure and reported per file in a separate `demo` block, because they are what product users see. They are **not** included in the corpus-level aggregation or decision. A sensitivity aggregation with them included is also reported.
  - Recording index `r` = the 0-based position of the recording in `manifest_v2_corpus.json`, fixed before any exclusion, so that seeds never shift. Demo files take the indices they have in the manifest's demo list, offset by 900 (r = 900, 901), so their seeds cannot collide with evidence seeds.
  - **Pre-stated exclusion rule (the same as Experiment 007, so the two can be paired):** a recording is excluded from all analyses if it fails to decode, or if it yields fewer than **100** points after the amplitude filter. Every exclusion is logged with its reason in `exclusions[]`. There are no silent drops. Clips shorter than about 6 s are expected to be at risk (Corpus_v2.md, "Short recordings").
  - `Assets/smoke/Luscinia_svecica_song.ogg` (the same bytes as the demo file `Luscinia_svecica_song.ogg`, per Corpus_v2.md) is used for runner smoke tests. Smoke-test numbers are never reported as results. The file's reported numbers come only from its demo-list entry.
* **Procedure:** per analysed recording r:
  1. **Front end:** PR front end → X (n × 3078) after the amplitude filter, with each row's `emissionTime` t and start-frame index. Also keep the windows before the filter (`allContinuousPoints`), which are used for the SNR proxy and the timing stress test only. Log `pointHopFrames` h and the overlap fraction f = max(0, (6 − h)/6).
  2. **PCA:** production `pca(X, 3)` → scores S (n × 3), ratios ρ₁, ρ₂, ρ₃, eigenvalues λ₁…λ₃, probed λ₄, and per-component convergence diagnostics.
  3. **Views:** for each view V (the 7 non-empty subsets of {1, 2, 3}), E_V = the columns V of S, unscaled.
  4. **Real metrics per view:**
     - EV_V = Σ_{c ∈ V} ρ_c;
     - T(k=5) and C(k=5) with original space X (z-scored inside `metrics.trustworthiness` / `continuity`) and embedding E_V;
     - T and C at k = 10 (sensitivity);
     - the overlap-excluded T_span(k=5) and the edge-gap T_gap1.5(k=5) (secondary, see Metrics).
     - The original-space rank context is built **once** per recording (`metrics.makeRankContext(X, { standardize: true })`) and reused for all views and k.
  5. **Controls:** build G (offset +1) and P (offset +2) from X (see the controls table). Run production `pca(·, 3)` on each and take the **same component indices** V. Compute EV, T, C, T_span and T_gap1.5 exactly as for X, with the control matrix as its own original space and the real rows' timestamps.
  6. **Per-recording flag:** run the export-time function on X (definition below) with the fixed export-time control seed, and record its output and its wall-clock time, both computed directly and through F1.
  7. **Split-half:** run the split-half stability analysis (below).
  8. **Recording-condition covariates:** compute the label-free SNR proxy (see Confounds).
  9. **Aggregate and decide:** aggregate across recordings and apply the Pre-Committed Decision Rule. The rule is implemented in code, so verdicts are computed and not chosen by hand.

  **Views evaluated**

  | View id | Axes toggled (assumed mapping) | Components | Type |
  |---|---|---|---|
  | `x` | X | PC1 | 1D line |
  | `y` | Y | PC2 | 1D line |
  | `z` | Z | PC3 | 1D line |
  | `xy` | X, Y | PC1, PC2 | 2D scatter |
  | `xz` | X, Z | PC1, PC3 | 2D scatter |
  | `yz` | Y, Z | PC2, PC3 | 2D scatter |
  | `xyz` | X, Y, Z | PC1, PC2, PC3 | 3D cloud |

  **What a "view" is, for this experiment:** the displayed coordinates are exactly the chosen PCA score columns, with one uniform scale factor.
  - A 1D view is the points placed on one line by their PC score, with no other displayed coordinate.
  - If the viewer adds anything that changes neighbour ranks, the measured numbers do not describe that view. Examples: jitter or time on a second axis in the 1D view, independent per-axis rescaling (for example stretching each axis to fill the screen), or a different axis mapping.
  - In that case the metric must be recomputed on the coordinates actually displayed, or the viewer must use one uniform scale. This is a pre-stated **requirement on the viewer**, not something this experiment can test.

  **Export-time per-recording flag: definition (proposed module `tools/lib/view_preservation.js`, not yet written, owner to be assigned)**

  This is the exact computation that will ship. The runner calls the **same function** the exporter will call, so this experiment validates the shipped code and not a copy of it.
  - **Input:** the feature matrix X after the amplitude filter, and the production `pca(X, 3)` result, which the exporter already computes.
  - **Steps:**
    1. Build the original-space rank context of X (z-scored).
    2. For each of the 7 views: EV_V, T(k=5) and C(k=5) of E_V.
    3. G_exp = `metrics.randomMatchedMatrix(X, EXPORT_CONTROL_SEED)` with **EXPORT_CONTROL_SEED = 20260720 + 990**. The seed is fixed and independent of the corpus index, because an export has no corpus index.
    4. Production `pca(G_exp, 3, { probeNextEigenvalue: false })`, then T_G(k=5) for the same 7 component subsets, with G_exp's own z-scored rank context. The λ₄ probe is switched off for the control only, because the control's eigen-gap is not used. This must not change the embedding: a unit test asserts that the embedding with and without the probe is bitwise identical.
    5. margin_V = T_V − T_G,V.
    6. **weak_V = (margin_V < 0.02).**
  - **Output per view:** `{ view, components, explainedVarianceShare, trustworthinessK5, continuityK5, controlTrustworthinessK5, marginK5, weakForThisRecording, controlSeed, controlConverged, n }`, plus `k`, the method string (`"direct"` or `"lookup-F1"`), the module's git blob hash, and the evidence pointer ("Experiment 008").
  - **Consequence of the fixed seed:** `metrics.randomMatchedMatrix` uses only the shape of its input, not its values (verified by code inspection: `tools/lib/metrics.js`, lines 522–525, `Array.from(matrix, (row) => Array.from(row, () => randomNormal(random)))`). So G_exp depends only on (n, 3078, EXPORT_CONTROL_SEED), and T_G,V is a deterministic function of n alone for d = 3078. This is what makes fallback F1 (below) exact. The F1 exactness check tests this directly.
  - **Determinism check:** the function is run twice on the first analysed recording, and the two outputs must be byte-identical (JSON SHA-256).
  - **Timing definition.** The wall-clock time of steps 1–6 is measured with `process.hrtime.bigint()`. It is the **incremental** cost, because the front end and `pca(X, 3)` are already paid by the exporter; the time of `pca(X, 3)` is logged separately, and so is the total. Every timed call is measured in **two variants**: *direct* (steps 1–6 as written) and *F1* (steps 3–4 replaced by the lookup; see rule 4). F1 is expected to be the shipping path (H5).
    - *Per recording:* one timed call per analysed recording, per variant.
    - *Stress test at n = 700:* take the analysed recording with the most audio frames and recompute its windows **at the base 2-frame hop** (`buildContinuousPoints` with `pointHopFrames` = 2; no cap, no filter). Take the first 700 windows as a 700 × 3078 matrix of real PR features and run `pca(·, 3)` plus the flag function: 1 warm-up and 5 timed repeats, per variant.
      - The stress matrix is used **only** for timing. Its T and flag values are never reported.
      - If no analysed recording yields ≥ 700 windows at the base hop (≥ 32.6 s of audio), the stress matrix is instead built by concatenating the base-hop windows of the longest recordings in manifest order until 700 rows are reached, and this is logged.
    - *Load check (added after the scratch measurement in H5):* before each timed block the runner reads `os.loadavg()[0]`. A block is timed only if the 1-minute load average is below 0.5 × the core count. Otherwise the runner waits and re-checks every 60 s for up to 30 min. If the machine is still loaded, the block is timed anyway and marked `underLoad: true`. A timing marked `underLoad` cannot pass rule 4 (see rule 4).
    - The machine is logged: `os.cpus()[0].model`, core count, `os.totalmem()`, platform, Node version, and the load average before each timed block. Peak RSS (`process.memoryUsage().rss`) is logged too.

  **Split-half stability of the flag (per recording, per view)**

  - **Blocks:** block b = floor(t / 2.0 s), with t = the window's `emissionTime` (its start).
  - **Boundary guard (extra rigor):** a window whose span [t, t + 0.1625 s) crosses a block boundary is dropped from both halves. No audio sample is then shared between the halves, although adjacent windows inside a block still share frames when h < 6.
  - **Halves:** half A = windows in even blocks; half B = windows in odd blocks. Both are taken from the **same** X rows (the front end and amplitude filter are not rerun), so the halves are subsets of the displayed recording.
  - **Eligibility:** each half must have ≥ **50** points; otherwise the recording is excluded from the split-half analysis and logged. With 50 points, k = 5 satisfies k < n/2 by a wide margin.
  - **Per half:** z-score and production `pca(·, 3)` fitted on that half alone. The views are the same component indices of the half's own PCA. EV, T(k=5), and a matched-Gaussian control of the half's shape with seed offset **+11** (A) or **+12** (B).
    - Using a different control seed per half is deliberate and conservative: it puts control-draw variability into the agreement estimate.
    - The agreement is also recomputed with EXPORT_CONTROL_SEED for both halves (this is what ships), and reported as secondary. Because G_exp depends only on n, these export-seed half controls are taken from the F1 table when the half's n is within 100–700 (bitwise identical by construction; see the F1 exactness check) and computed directly otherwise.
  - **Flag per half:** weak_{A,V} = margin_{A,V} < 0.02, and likewise for B.
  - **Reported per view, over eligible recordings (the agreement rate is always reported, whatever the decision rule concludes):**
    - *agreement rate* = the proportion of recordings with weak_A = weak_B, with a 95% percentile bootstrap CI over recordings (B = 2000, seed 20260720 + 703);
    - Cohen's κ (reported as "undefined" when either half's flag is constant across recordings), and the prevalence of "weak" in each half and in the full-recording flags;
    - agreement of each half's flag with the full-recording flag (descriptive);
    - Spearman ρ across recordings between margin_A and margin_B, and the median |margin_A − margin_B|.
  - **Component-identity caveat (descriptive, extra rigor):** when two eigenvalues are close, the halves' PC2 and PC3 can be different directions under the same index. The eigen-gap ratios λ₂/λ₁, λ₃/λ₂ and λ₄/λ₃ (from `pca()` `nextEigenvalueRatio`) are logged for the full recording and each half. Agreement is also reported stratified by whether any ratio exceeds **0.9**. That cut-off is a project choice made here with no literature basis; it is descriptive only and does not change any verdict.

  **Control-draw variability of the export-time control (extra rigor)**

  The per-recording flag compares against one control draw. To know how noisy one draw is:
  - For n ∈ {100, 200, 300, 400, 500, 600, 700} and d = 3078, compute T_G,V(k=5) for 20 seeds, 20260720 + 600 + s with s = 0 … 19, through the same PCA (probe off) and views.
  - Report, per n and view, the mean, the SD, the range, and the number of non-converged components.
  - If the SD exceeds **0.01** (half the 0.02 margin) for some view, at any tested n inside the observed corpus n range (rounded out to the grid), that view's single-draw flag is labelled **"control-noise-limited"**. The pre-stated alternative is then computed and reported for every recording: the control value is the **mean** T_G over the 5 fixed seeds 20260720 + 990 … 994. This alternative becomes the export-time definition for that view (see the decision rule).
  - If compute subsetting is triggered (see Compute plan), the grid is reduced to n ∈ {100, 300, 500, 700} with all 20 seeds, and this is disclosed next to the result.

* **Metrics used to evaluate:**
  - **Primary: trustworthiness T at k = 5.** `tools/lib/metrics.js` `trustworthiness`, documented as an exact port of `trustworthiness()` in `tools/run_experiment_001.js`:

    T(k) = 1 − (2 / (n·k·(2n − 3k − 1))) · Σᵢ Σ_{j ∈ Uᵢ(k)} (r(i,j) − k)

    - Uᵢ(k) = the embedded k-NN of i that are not among its original-space k-NN.
    - r(i,j) = the rank of j in i's original-space neighbour ordering, where 1 is the nearest.
    - Original space: the z-scored matrix, squared Euclidean distance. Embedded space: squared Euclidean, ranked as given.
    - Ties go to the lower row index. Valid for k < n/2.
    - In a 1D view exact distance ties are possible in principle (identical scores). They are resolved by the same lower-index rule, and the runner logs the number of tied embedded pairs per 1D view.
    - The runner asserts at start-up that `metrics.trustworthiness` equals the Experiment 001 port to ≤ 1e-12 on a fixed fixture, as Experiment 007 requires.
    - **This T includes overlap-trivial neighbours.** Temporal neighbours that share audio are counted like any other neighbour. The viewer's "neighbourhood trust" is this T.
  - **Secondary: continuity C at k = 5** (`metrics.continuity`; same formula with the two spaces swapped).
  - **Sensitivity: T and C at k = 10.**
  - **Secondary, non-governing: overlap-excluded trustworthiness T_span(k=5).** This is Experiment 007's gap-excluded T_gap formula (007, Metrics), with the gap set to the window span instead of 1.5 s.
    - For each i, the candidates are restricted to Eᵢ = { j : windows i and j share no audio sample }, i.e. |startFrameᵢ − startFrameⱼ| · 512 ≥ 3584, i.e. |Δ start frame| ≥ 7, equivalent to |tᵢ − tⱼ| ≥ 0.1625 s. The comparison is made on integer frame indices so that floating-point time rounding cannot move the boundary.
    - With mᵢ = |Eᵢ|: T_span = 1 − (1/n′) Σᵢ pᵢ / (k(2mᵢ − 3k + 1)/2), where pᵢ is the usual penalty inside Eᵢ. Points with mᵢ < 2k are skipped and counted; n′ = the number of points kept.
    - At h ≥ 7 no pair is excluded, so T_span = T exactly; the runner asserts this.
    - Control matrices inherit the real rows' frame indices.
    - Also reported: **T_gap1.5(k=5)**, the same function with 007's 1.5 s gap, for direct comparison with 007's values.
    - Implementation: one shared function (proposed `metrics.gapExcludedTrustworthiness`, not yet written; to be shared with 007's runner). If 007's implementation exists at run time, 008 uses it. A unit test must show that gap 0 equals the standard T to ≤ 1e-12.
    - Why it exists: T_span shows how much of each view's T and margin comes from windows that literally share audio. It is not shown in the viewer by this experiment.
  - **Explained-variance share** EV_V = Σ_{c ∈ V} λ_c / tr(Σ). Here tr(Σ) is the total variance of the z-scored matrix (`pca().totalVariance`) and λ_c the production eigenvalues. EV is additive over components, so EV_xy = EV_x + EV_y exactly; T is not additive.
    - Reported for real data and for G, together with EV_real − EV_G.
    - "Variation" in the viewer text means exactly this: the variance of the z-scored 3078-dimensional log-magnitude feature matrix, with every column weighted equally. It is **not** a share of "the sound" or of "the information".
  - **Explained-variance distribution (sub-question 2):** for EV₃ = EV_xyz, and also EV₁ and EV₂ = EV_xy:
    - every per-recording value;
    - median, Q1, Q3 (type 7), minimum, maximum;
    - the 95% percentile bootstrap CI of the median (B = 2000, seed 20260720 + 702);
    - the fraction of recordings with EV₃ ≤ 0.10, and with EV₃ ≤ 0.05, each with its bootstrap CI;
    - Spearman ρ between EV₃ and n, and between EV₃ and the overlap fraction f, across recordings (descriptive: short clips have fewer points, long clips have less overlap).
  - **d95 (reference, non-governing):** the smallest component count with cumulative EV ≥ 0.95 (`pca(X, null)`).
    - *Source:* if Experiment 007's results JSON exists at run time, d95 is taken from it, because 007 computes it as its auto-95 reference on the same X. 008 recomputes d95 on the first 2 analysed recordings as a cross-check; any difference is a 007/008 mismatch (see Additional checks). If 007's JSON does not exist, 008 computes d95 itself, subject to the Compute plan.
    - *Approximation:* `pca(X, null)` can compute many components, each up to 5000 iterations, and later components have small eigen-gaps. The number of non-converged components among the d95 components is always reported next to d95. If any is non-converged, d95 is marked **"approximate"**. d95 enters no verdict.
  - **Convergence (every PCA, real and control):**
    - Logged for **every** PCA in the run — X, G, P, G_exp, both halves, G_A, G_B, the export-seed half controls, the control-draw grid, the F1 table and d95: per component `iterations`, `relativeResidual`, `converged` and `scoreReconstructionError`.
    - The count of non-converged components is reported **per control type** (G, P, G_exp, G_A/G_B, grid, F1 table) and per component index.
    - *Real X:* a recording where any of components 1–3 of `pca(X, 3)` did not converge (relative residual ≥ 1e-10 after 5000 iterations) is flagged and kept. Every verdict is recomputed without flagged recordings, and any change is reported. The same applies to the halves' own real PCAs in the split-half analysis.
    - *Controls: non-convergence is expected and does not exclude a recording.* The pre-registration scratch run (H5) already shows PC2 of G_exp at n = 700 reaching the cap. Why T_G stays a valid null when a control component has not converged:
      1. The control is defined procedurally, as "the production `pca(·, 3)` code path applied to a structureless matrix of the same shape". The real matrix goes through the identical code path, iteration cap included. A capped control component is part of that definition, not a departure from it.
      2. An i.i.d. N(0, 1) matrix has an identity population covariance, so its distribution is unchanged by any rotation of its columns and no direction carries structure. The near-equal top sample eigenvalues are what slows the iteration. An unconverged iterate is still a direction inside that near-degenerate top subspace, computed from G alone and independent of X. Its T is therefore still the T of a data-independent reduction of structureless data.
      3. The size of the effect is measured, not assumed. *Convergence sensitivity:* for G_exp at n = 700, and for every control-draw grid entry at n = 700, the PCA is rerun with `maxIterations` = 50000. The change in T_G,V for every view is reported, along with whether convergence was reached. This is non-governing.
    - *EV_G caveat:* the Rayleigh quotient of an unconverged iterate is at most the top eigenvalue of the matrix being iterated. EV_G for a non-converged component can therefore be biased (typically low), and EV_real − EV_G biased accordingly. EV_G values from non-converged components are marked **"approximate"** in the JSON and in any table. No verdict uses EV_G.
  - **Aggregation across recordings:** every per-recording value is written to the JSON. For each quantity and view the JSON also gives the median, the IQR (Q1 and Q3) and a 95% percentile bootstrap CI of the median (B = 2000).
  - **Paired comparisons** use per-recording differences Δᵣ:
    - `metrics.pairedBootstrapCI` (paired percentile, B = 2000, seed 20260720 + 702). The **governing statistic is the mean of Δᵣ**, as in Experiment 007. The CI of the median of Δᵣ is reported as a sensitivity check.
    - Two-sided Wilcoxon signed-rank (`metrics.wilcoxonSignedRank`, mode `auto`). Its method (exact or normal) and zero count are recorded.
    - Holm correction (`metrics.holm`) over two pre-defined families:
      - *primary family:* the 7 tests T_real vs T_G at k = 5, one per view;
      - *secondary family:* all k = 10, continuity, T_span, T_gap1.5, column-permuted, EV_real vs EV_G, and demo-inclusive tests.
    - Wilcoxon and Holm are corroboration. **The decision rule uses the bootstrap CIs only.** A CI pass whose Holm-adjusted p is ≥ 0.05 is flagged "fragile" in Discussion.
    - **Observer-cluster bootstrap (sensitivity, non-governing):** the 60 evidence recordings come from 49 observers (Corpus_v2.md), so recordings are not fully independent. Every rule 1 CI and the rule 2 CI of the median EV₃ are recomputed with a cluster bootstrap that resamples observers with replacement and includes all recordings of each drawn observer (B = 2000, seed 20260720 + 705). The observer id is the manifest field `recordistLogin` (falling back to `recordist` if it is missing; logged). Observer id is not a taxon label, so Rule 001 is not touched. It is read only by the aggregation stage. Any verdict that changes between the ordinary and the cluster bootstrap is listed in Discussion. The ordinary paired bootstrap governs, as pre-registered. The cluster bootstrap is not in `tools/lib/metrics.js` today; it is implemented in the runner (or added to `metrics.js`) with its own unit test.
  - **Stratification by overlap regime (descriptive, pre-stated):** the per-view margin (T_real − T_G, k = 5), T_real, T_span_real, EV₃ and the full-recording flag prevalence are reported per stratum of h: **h = 2** (f = 0.667), **h ∈ 3–5** (f = 0.5–0.167), **h ≥ 6** (f = 0). For each stratum: the count, every per-recording value, and, if the stratum has ≥ 5 recordings, the median and IQR. No inferential test is made across strata, and no verdict depends on them. Spearman ρ of each view's margin and T against f across recordings is reported, with the note that f is heavily tied (most recordings are expected to have h = 2).
  - **Confounds (recording condition, SNR, background) — descriptive, pre-stated:**
    - SNR, background species and noise (other birds, people, traffic, wind; Corpus_v2.md "Known biases and limits"), recording device, codec and gain are **uncontrolled**. Any of them can shape the feature matrix and therefore EV₃, T, the margin and the flag. For example, a loud stationary background can concentrate variance, or yield "not weak" flags, for reasons that have nothing to do with the focal bird.
    - Prior evidence in this project: Experiment 005 found a device/location/recording-condition fingerprint in the adopted method's embedding (`03_Research_Notebook/Experiment_005_Device_Location_Recording_Condition_Fingerprint_Test.md`; same-ID clips closer than different-ID clips by 10.3978 embedding-distance units on average, label-shuffle permutation p = 0.0010; the median-distance comparison did not show the same effect). Recording condition can dominate structure.
    - **Label-free SNR proxy per recording:** snr_proxy_dB = 20·log₁₀(Q₀.₉ / Q₀.₁) of the window RMS `amplitude` over `allContinuousPoints` (before the amplitude filter), type-7 quantiles. If Q₀.₁ = 0 the value is +∞, ranked highest, and logged. This is a project-defined proxy, not a measured SNR: it assumes loud windows carry the focal signal, and it cannot tell a loud background from the bird.
    - Also logged per recording (metadata, not fitted): source codec, source sample rate, channel count.
    - Reported: Spearman ρ between snr_proxy_dB and EV₃, and between snr_proxy_dB and each view's margin, across evidence recordings, each with a 95% bootstrap CI (seed 20260720 + 702). Descriptive only; no verdict depends on them.
    - **Statement fixed in advance:** no result of this experiment can be attributed to the bird rather than to the recording. The numbers describe the recording as captured.

* **Negative control type used:** every control goes through the same z-scoring, the same production `pca(·, 3)`, the same component indices and the same metrics as the real matrix.

  | Control | Construction | Preserves | Destroys | Seed offset | Role |
  |---|---|---|---|---|---|
  | **Matched Gaussian** (G) | Exact port of Exp 001 `randomMatchedMatrix` (`metrics.randomMatchedMatrix`): `makeRandom(seed)` LCG (1664525, 1013904223, mod 2³²), Box–Muller cosine branch with u₁ clamped to ≥ 1e-12, one draw per cell in row-major order, same n × 3078 as X | shape only | everything else, including the window-overlap autocorrelation | **+1** | **Governs the corpus-level rule** |
  | **Column-permuted** (P), extra rigor | Each of the 3078 columns of X independently permuted across rows (Fisher–Yates, same LCG), `metrics.columnPermutedMatrix` | each feature's marginal distribution | cross-feature and temporal (overlap) structure | **+2** | Reported (secondary family). Governs view labels jointly with Experiment 007 (see decision rule) |
  | **Export-time Gaussian** (G_exp) | As G, with fixed seed EXPORT_CONTROL_SEED = 20260720 + 990; PCA with the λ₄ probe off | shape only | everything else | fixed, not per-recording | **Governs the per-recording flag** |
  | **Split-half Gaussian** (G_A, G_B) | As G, with the shape of each half | shape only | everything else | **+11** (A), **+12** (B) | Split-half stability |

  Neither G nor P models the temporal autocorrelation that window overlap creates. That is why T_span and the overlap stratification are reported (see Metrics).

  **Synthetic pipeline checks (extra rigor).** These use `tools/lib/synth.js`, 30 s each at 22050 Hz, run through `computeContinuousFrontEnd` and the export-time flag function. Generator parameters other than those given here are the synth.js `DEFAULTS` and per-generator defaults; every resolved parameter (`params`) is written to the JSON. At 30 s the frame count is below 1400, so these signals are all in the h = 2 stratum; h is logged.
  - *Known structure:* `motifSequence` at SNR 30, 15 and 6 dB (seeds 20260720 + 801, 802, 803).
    - Expectation: at 30 dB the `xyz` view is **not** flagged weak.
    - **If `xyz` is flagged weak on the 30 dB motif sequence, the flag computation is declared suspect, and no real-data flag result is interpreted until this is resolved.**
  - *Overlap diagnostic:* `whiteNoise` and `pinkNoise` (seeds 20260720 + 804, 805).
    - Experiment 007 H3 predicts that stationary noise pushed through PR can beat a structureless matrix, because at the base hop adjacent windows share 4 of 6 frames.
    - If the noise signals are **not** flagged weak, that is direct evidence that "not weak" means only "better than a structureless matrix of the same shape", and not "structure in the bird's song". The viewer text must then respect this (see the decision rule). This outcome is not a failure of the experiment.
    - T_span is reported for the noise signals too, to show how much of their T comes from shared audio.

* **Negative control random seed:** base 20260720. Per recording r: seed = 20260720 + 1000·r + offset.

  | Offset / seed | Use |
  |---|---|
  | +1 | matched-Gaussian matrix G (full recording) |
  | +2 | column permutation P (full recording) |
  | +11 | matched Gaussian for split-half A |
  | +12 | matched Gaussian for split-half B |
  | 20260720 + 600 … 619 (corpus-level) | control-draw variability study |
  | 20260720 + 702 (corpus-level) | every ordinary bootstrap CI on recording-level quantities (including the Spearman CIs). The same seed is used for every CI, so equal-length comparisons share resample index sets |
  | 20260720 + 703 (corpus-level) | split-half agreement bootstrap |
  | 20260720 + 704 (corpus-level) | the compute subset draw (used only if subsetting is triggered) |
  | 20260720 + 705 (corpus-level) | the observer-cluster bootstrap |
  | 20260720 + 801 … 805 (corpus-level) | synthetic signals |
  | 20260720 + 990 (fixed) | EXPORT_CONTROL_SEED (G_exp, and every F1 table entry) |
  | 20260720 + 990 … 994 (fixed) | the 5-seed alternative control (only if a view is control-noise-limited) |

  - Demo files use r = 900 and 901. Evidence indices r ≤ 999 with offsets ≤ 12, so per-recording seeds are 20260720 + 1000·r + {1, 2, 11, 12}. None of these equals a corpus-level seed (600–619, 702–705, 801–805, 990–994), because those are not ≡ 1, 2, 11 or 12 (mod 1000).
  - The runner asserts that all seeds are unique and writes the full seed table to the JSON.
  - The 5-seed alternative deliberately reuses EXPORT_CONTROL_SEED as its first member, so that it extends the single-draw control rather than replacing it.
* **Negative control metric name:** trustworthiness, k = 5. At corpus level this is the paired difference T_real − T_G per recording; per recording it is the single-value margin T_real − T_G_exp.
* **Negative control numeric result:** Pending run.
* **Negative control threshold:**
  - *Corpus level (governs each view's verdict):* 95% paired-bootstrap CI lower bound of mean(T_real − T_G) **≥ 0.02** for a pass (non-pass outcomes are split into fail and inconclusive; see the decision rule).
  - *Per recording (governs the flag):* margin T_real − T_G_exp **< 0.02** ⇒ "weak for this recording". This is the Experiment 001 single-value rule.
* **Negative control pass/fail:** Pending run.
* **Label-exposure risk step:** z-scoring, PCA fitting, control construction, split-half assignment and metric scoring could see labels if the runner passed them. None of them needs species or taxon labels. This experiment makes **no** use of species labels, not even afterwards for inspection. The split-half assignment uses only `emissionTime`. The compute subset draw (if triggered) uses only the recording index. The observer id is read only by the aggregation stage, for the cluster bootstrap sensitivity; it is not a taxon label and never reaches any fitting step.
* **Label-exclusion verification:**
  1. Code inspection before the run, dated in Reproducibility Notes. Only the audio path, recording id, source URL, licence and technical metadata fields (codec, sample rate, channels) may be read by the analysis stage. `recordistLogin` / `recordist` may be read only by the aggregation stage's cluster bootstrap. Taxon fields are copied into the JSON metadata only by the reporting stage.
  2. **Label-invariance test (extra rigor, the same as Experiment 007):** the first analysed recording is run twice, once with every taxon and label field in an in-memory copy of the manifest replaced by `"REDACTED"`. The SHA-256 of the two per-recording result objects (metadata excluded) must be identical, and the result is logged.

### Additional pre-registered checks (extra rigor)

- **Production parity:** on the smoke recording, the runner's `pca(X, 3)` scores must equal the exporter's exported `position` values to ≤ 1e-9 relative, after `POSITION_SPREAD / max|·|` is undone. The runner's EV₃ must equal the exporter's `pcaExplainedVarianceTotal` to ≤ 1e-12. If either fails, the run stops, because it would mean the experiment is not measuring what ships.
- **Rank invariance under the display scale:** on the smoke recording, T and C for every view must be identical (to 0) between raw scores and exported positions. This confirms the "one uniform scale" argument above.
- **Probe-off invariance:** on the smoke recording and on G_exp at the smoke recording's n, `pca(·, 3)` with and without `probeNextEigenvalue` must give bitwise-identical embeddings.
- **Cross-experiment consistency with Experiment 007:** if Experiment 007's results JSON exists when 008 runs, T_real and T_G at k = 5 for the 7 PCA subsets must match 007's values exactly, for every recording both experiments analysed; so must d95 on the recordings where 008 recomputes it, and T_gap1.5 where 007 reports it per subset.
  - **Any mismatch suspends the joint labelling rule and 008's rule 1 verdicts** until the cause is found, fixed and documented in both notebooks. While suspended, the viewer shows only the measured numbers (rule 5) with no verdict label and no per-recording flag. Neither experiment's numbers are silently preferred.
  - A mismatch is plausible in advance: 007's Method text says "100 iterations per component", while the code runs to a 1e-10 tolerance or 5000 iterations (verified in `tools/lib/reducers.js`, lines 35–36 and ~176–188). If 007's runner follows its text rather than the code, its PCA values will differ.
- **Fallback F1 exactness (run whether or not F1 is needed):** this tests that G_exp, and hence T_G_exp, depends only on the shape.
  - For every distinct n in the analysed corpus (full recordings and the halves used with the export seed), a **separate Node process** (`child_process.spawnSync(process.execPath, …)`) builds the lookup value from a dummy **all-zeros n × 3078 matrix**: `randomMatchedMatrix(zeros, EXPORT_CONTROL_SEED)`, `pca(·, 3, { probeNextEigenvalue: false })`, and T_G,V(k=5) for the 7 views.
  - The main process computes T_G_exp,V from the **real X** at the same n through the export-time function.
  - The two sets of values are compared **bitwise** (the IEEE-754 bit patterns, via `Float64Array` → hex), not to a tolerance. Any difference fails the check, and F1 cannot ship until it is resolved.
  - The shape-only property itself is verified by code inspection (`tools/lib/metrics.js`, `randomMatchedMatrix`, lines 522–525); this check verifies it end to end through the PCA and the metric.

### Compute plan and pre-stated subsetting (no silent caps)

- **Default:** everything runs on every analysed recording.
- **Per-recording cost, stated in advance:**
  - PCAs: `pca(X, 3)`; `pca(G, 3)`; `pca(P, 3)`; `pca(G_exp, 3)` (direct variant); the two halves' own PCAs; `pca(G_A, 3)` and `pca(G_B, 3)`; the export-seed half controls (from the F1 table where n is in range); and `pca(X, null)` for d95 if 007's value is not available. That is 8 to 10 PCAs at sizes ≤ n, plus d95.
  - Rank contexts (one squared-distance matrix and sort each) for X, G, P, G_exp and each half and half control.
  - T and C for 7 views × 2 values of k against X, G and P; T for G_exp; T_span and T_gap1.5 for 7 views against X, G and P.
  - The control PCAs are expected to dominate, for the reason given under H5 (slow power iteration on isotropic data). Every PCA and T/C call is timed and logged.
  - `pca(X, null)` computes components until cumulative EV ≥ 0.95, each with up to 5000 iterations. Its cost is **unknown** and may be much larger than `pca(X, 3)`; this is why d95 is taken from 007 when available.
- **One-off costs:**
  - *F1 table:* 601 PCAs of G_exp (n = 100 … 700) plus their T values. The cost per PCA scales roughly with n² (Gram matrix and power iterations are both n²-proportional at fixed d), so the total is about Σ_{n=100}^{700} (n/700)² ≈ **233 ×** the direct n = 700 control cost. It can be up to about 1.6 × that if every component at every n hits the 5000 cap (the n = 700 scratch run used 9223 of a possible 15000 iterations). This is an estimate from the operation count; the runner measures it.
  - *Control-draw grid:* 140 PCAs, about 20 × Σ_{grid}(n/700)² ≈ **57 ×** the n = 700 control cost.
  - *Convergence sensitivity:* 21 PCAs at n = 700 with up to 50000 iterations each (G_exp plus the 20 grid seeds).
- **Projection:** the runner first runs the cheap front end on every recording to obtain each n_r. It then times the complete per-recording procedure on the first 2 analysed recordings, projects the total by scaling each recording's cost with n_r², adds the one-off costs (measured on their first entries and scaled the same way), and logs the projection.
- **If the projection exceeds 24 h on the run machine** (the same threshold as Experiment 007), then only these non-governing extras are reduced:
  - d95 (when 008 must compute it) and the export-seed split-half secondary analysis run on a fixed seeded subset of m = max(12, ⌈N/4⌉) recordings, N being the number of analysed recordings. The subset is drawn uniformly without replacement (Fisher–Yates, `makeRandom(20260720 + 704)`) **without using labels**.
  - The control-draw grid is reduced to n ∈ {100, 300, 500, 700}, keeping all 20 seeds.
  - The convergence sensitivity is reduced to G_exp at n = 700 only.
  - Everything that feeds rules 1–4 (X, G, the flag function, the +11/+12 split-half, the F1 table and the timing) is never subset. P, continuity, k = 10 and T_span are never subset either.
- **If even the governing part projects above 48 h,** the run stops and the project owner decides. There is no ad-hoc cap.
- **Within-recording point subsampling is forbidden,** because it would change the regime.
- The JSON field `compute_subsetting` records the projection, whether subsetting happened, and the subset's recording IDs.

## Pre-Committed Decision Rule

Defined before any data are seen. It is applied mechanically by the runner, and the results JSON stores both the computed verdicts and the inputs to each verdict. No threshold below is weaker than in the original specification: the pass threshold (CI lower bound ≥ 0.02), the per-recording flag (margin < 0.02), the 10 s timing limit and the 0.10 EV cut-off are unchanged. The additions only split non-pass outcomes and add reporting.

**1. Corpus-level view verdict (per view V, evidence recordings only).**
- CI = [L, U], the 95% percentile paired bootstrap (B = 2000, seed 20260720 + 702) of the **mean** per-recording difference T_real(V) − T_G(V) at k = 5.
- Three mutually exclusive outcomes:

  | Outcome | Condition | Viewer label (exact text, passed to Experiment 011) | Triggers |
  |---|---|---|---|
  | **pass** | L ≥ 0.02 | none | — |
  | **inconclusive** | L < 0.02 ≤ U | "below the pre-committed margin (inconclusive)" | "Needs more testing" for that view; escalated to the owner; the per-recording flag for that view is not shipped (see Disqualification). Not Failure Criterion 1. The threshold is not adjusted; a re-test on a larger corpus would be a new pre-registered experiment |
  | **fail** | U < 0.02 | "not shown to beat a random matrix by the 0.02 margin" | v0.4 Failure Criterion 1 ("Random or shuffled data produces manifolds with structure similar to real data") **for that view**, and a documented methodology review. The threshold is not adjusted |

- **The phrase "not better than random" is used only if U ≤ 0** (a fail whose CI lies entirely at or below zero). In that case the label is "not better than a random matrix of the same size". It is never used for an inconclusive view, or for a fail with U > 0.
- **Descriptive only:** whether L > 0 is reported for every view (`ci_lower_above_zero`). It is not a verdict and not a viewer label; Experiment 011 may use it only if 011 pre-registers that use.
- A non-pass label applies whenever the view is displayed, for every recording, whatever that recording's own flag says.
- **Joint labelling with Experiment 007 (the stricter outcome applies):** 007 tests each PCA subset against G and P. For labelling only, the same three-way split is applied to each of 007's two CIs (read from 007's results JSON); this does not change 007's own verdicts. Outcomes are ordered fail < inconclusive < pass, and the viewer label is the worst of 008-G, 007-G and 007-P. A pass in 008 never overrides a non-pass in 007. When the worst outcome comes from P, "a random matrix" in the label text is replaced by "a column-shuffled copy of the features"; if G and P tie for worst, both are named.
- **Suspension:** any 007/008 mismatch (Additional checks) suspends this rule and the joint labelling until it is resolved and documented.
- **Views are not ranked against each other by this experiment.** No statement such as "xy preserves more than xz" may be made from these results. If a comparison between views is ever displayed, it needs its own pre-registered paired difference per recording with a paired bootstrap CI, and differences with CI lower bound below 0.02 are treated as a tie (the Experiment 001 tie band).

**2. Explained-variance claim (sub-question 2).** "Typically a few percent" is operationalised, before the data are seen, as **median EV₃ ≤ 0.10**. The 0.10 cut-off is a project choice made here to turn "a few percent" into a testable statement; it has no literature basis. It **governs**. A sensitivity verdict with cut-off **0.05** is also computed and always reported next to it; it is non-governing.

| 95% bootstrap CI of median EV₃ | Governing verdict (cut-off 0.10) | Sensitivity verdict (cut-off 0.05) |
|---|---|---|
| upper bound ≤ cut-off | **Supported under PR** | Supported under PR at 0.05 |
| lower bound > cut-off | **Contradicted under PR** | Contradicted under PR at 0.05 |
| otherwise | **Undecided under PR** | Undecided under PR at 0.05 |

The observer-cluster bootstrap version of both verdicts is also reported (non-governing).

In every case, the "typically a few percent" sentence must be replaced by the measured median, IQR and range of EV₃, with a pointer to this experiment. That edit is a follow-up done by the owner of `06_Technical_Architecture/Technical_Architecture.md`, not by this experiment. The claim is **not** tested under the regime it was written for (0.5 s windows, ~7,967 dims), because that regime is no longer shipped. The replacement text must say so.

**3. Per-recording flag: what ships.**
- **Informative flag (prevalence condition, pre-stated):** among the split-half-eligible recordings, a view's flag is **informative** only if the prevalence of "weak" in the full-recording flags is between **0.10 and 0.90** inclusive **and** Cohen's κ between the halves is defined. The 0.10 / 0.90 bounds are a project choice made here with no literature basis: outside them, agreement is close to 1 by construction and says little about stability.
- **Stable view:** a view's per-recording flag is **"stable"** if its split-half agreement CI lower bound is ≥ **0.80**. The 0.80 is a project choice made here with no literature basis (the specification asked only that the agreement rate be reported, and it is always reported); it means that at least 4 in 5 recordings give the same flag from two disjoint halves.
- Outcomes:
  - **Stable and informative, and the view passed rule 1:** the viewer may show "weak for this recording" whenever weak_V is true.
  - **Stable but uninformative** (agreement passes, prevalence condition fails): reported as such. The binary flag is **not** shipped for that view, because its stability was not really tested. The viewer shows only the measured numbers (rule 5) and the corpus-level verdict.
  - **Unstable view:** the viewer does **not** show a binary per-recording flag for that view. It shows only the measured numbers and the corpus-level verdict. The instability is escalated to the owner.
- **Control-noise-limited view:** if a view is control-noise-limited (SD > 0.01, see Method), the export-time control for that view becomes the 5-seed mean, and stability and prevalence are re-evaluated with that definition. Both versions are reported.
- **Suspect flag computation:** if the 30 dB motif positive control flags `xyz` weak, no flag is shipped until this is resolved.

**4. Timing.**
- The export-time computation is **fast enough** in a variant (direct or F1) if both:
  - the median of the 5 timed repeats at n = 700 is < **10 s**; and
  - the maximum single-call time over all analysed recordings is < **10 s**,
  - on the logged run machine, with **no** timing in that variant marked `underLoad`. A variant with any `underLoad` timing is "not assessed" and treated as not fast enough.
- **What ships, applied in order:**
  - **Direct**, if the direct variant is fast enough.
  - **F1 (exact)**, otherwise: steps 3–4 of the flag function (G_exp, its PCA and its T) are replaced with a lookup table of T_G_exp,V(k=5) for every n from 100 to 700 and all 7 views. H5 expects this path.
    - This is exact, because G_exp depends only on (n, 3078, EXPORT_CONTROL_SEED). It is verified bitwise by the F1 exactness check (separate process, all-zeros input).
    - The table is generated once by a script (`tools/lib/view_preservation.js` build step), stored with the git blob hashes of `metrics.js` and `reducers.js`, the PR constants and the per-entry convergence diagnostics, and regenerated whenever any of these change.
    - The range 100–700 covers every exportable n under PR: the window count before the filter is floor((frames − 6) / hop) + 1 with hop ≥ frames / 700, which is < 701, and the filter only removes windows. Any n outside the table (for example n < 100 in a future export) is computed directly and logged.
    - F1 is fast enough only if the F1 variant passes the same two conditions above.
  - **F2 (deferred)**, if F1 is also not fast enough: the flag is computed in a separate offline step after export (same function, same fields). The export carries `viewPreservation: { status: "deferred" }` until that step has run. The viewer shows "not yet measured" for that recording and never shows an unmeasured number or label.

**5. What the viewer will SAY (fixed here; the plain-language wording is fixed in Experiment 011).**
- For each view, the viewer states **only measured numbers from that recording's export**, and always all three of the following together:
  - **"keeps X% of the variation"**: X = EV_V × 100, rounded to the nearest integer, shown as "<1%" if EV_V < 0.005;
  - **"neighbourhood trust T"**: T(k=5), 2 decimals;
  - **the random-matrix reference and the margin**: T_G_exp,V (the recording's own control T, 2 decimals) and margin_V = T − T_G_exp (2 decimals, signed). A bare T cannot be read without its reference: a structureless matrix of the same size already scores well above 0 on this regime. (*Pre-registration scratch value, control only, not a result:* at n = 700 the 7 views of G_exp scored T between 0.52 and 0.56. The runner recomputes these as F1 table entries.)
- Plus, where rules 1 and 3 allow it:
  - the corpus-level non-pass label from rule 1, in its exact text;
  - the per-recording "weak for this recording" flag.
- **The viewer's T includes overlap-trivial neighbours** (moments that share audio with each other). The tooltip must say so. This is passed to Experiment 011 together with the exact label strings in rule 1. T_span is not shown by the viewer unless Experiment 011 pre-registers its display.
- **Nothing else is stated.** In particular:
  - no claim of "bird-specific" or "song" structure, unless Experiment 007's surrogate gate allows it;
  - no claim that a higher T means biologically similar neighbours;
  - no attribution of any number to the bird rather than to the recording;
  - no ranking of views against each other (rule 1);
  - no qualitative adjectives ("good", "reliable") that are not defined in Experiment 011.
- The exact sentences, the tooltip that defines "variation", "neighbourhood trust" and "random-matrix reference", and any rounding display rules beyond the above belong to Experiment 011. 011 may make the wording plainer, but it may not add claims beyond these measured numbers and verdicts.
- **If the synthetic white or pink noise is not flagged weak** (see Method), the viewer text must not imply that "not weak" means anything beyond "better than a structureless random matrix of the same size". This is also passed to Experiment 011.

**Sensitivity, reported and not governing:**
- Every corpus-level verdict is recomputed with T(k=10), with the median-of-differences CI, without recordings whose real PCA did not converge, with the demo files included, and with the observer-cluster bootstrap. Any verdict that changes is listed in Discussion. The k = 5 mean-difference verdict on the evidence recordings, with the ordinary paired bootstrap, governs.
- Every flag stability result is recomputed with EXPORT_CONTROL_SEED for both halves.
- Rule 2 is also reported at the 0.05 cut-off.

**Disqualification:** a view that does not pass rule 1 (fail or inconclusive) cannot be shown with a "weak / not weak" per-recording flag, because it already carries a corpus-level non-pass label. Its measured numbers (EV, T, control T, margin) are still shown, per Information Preservation Reporting.

## Expected Outcome

- **Support:**
  - all 7 views pass rule 1;
  - every view's flag is stable and informative (rule 3);
  - the timing passes (rule 4), in either variant;
  - the 30 dB positive control is not flagged weak in `xyz`;
  - all parity and consistency checks pass.
  - The viewer then shows, per view and per recording, "keeps X% of the variation", "neighbourhood trust T" with its random-matrix reference and margin, plus the flag.
- **Partial support:**
  - some views (plausibly the 1D ones) are inconclusive or fail rule 1 and carry the rule 1 labels; or
  - some flags are unstable or stable-but-uninformative, and only the numbers are shown; or
  - the timing needs F1 (expected, H5) or F2.
  - Each of these is a legitimate, reportable result, not a failed experiment.
- **Needs more testing:** the `xyz` view is **inconclusive** under rule 1. The product's main view then carries the inconclusive label and the case is escalated. It is not a Failure Criterion 1 trigger, because the data neither establish nor rule out the margin.
- **Explained variance:** the median EV₃ and its CI settle the documentation claim under PR as supported, contradicted or undecided (rule 2). The prior (H2) expects "contradicted", but any of the three is accepted.
- **Failure (v0.4 Failure Criteria):**
  - the `xyz` view **fails** rule 1 (U < 0.02). The shipped 3D cloud is then not shown to beat a matched structureless matrix at the pre-committed margin, which is Failure Criterion 1 for the product's main view, and a documented methodology review follows;
  - the positive control is flagged weak in `xyz`. The flag computation is suspect;
  - the label-invariance test fails. Rule 001 has been violated, and the run is void;
  - the production parity check fails. The experiment is not measuring what ships, and the run stops.
- **Suspended (not a result):** a 007/008 mismatch suspends rule 1 until resolved.

⸻

## Results

Pending run. The results will be written to `05_Benchmark_Results/v2/experiment_008_display_views_information_preservation.json`. Tables here will link to that file and not duplicate it.

Planned top-level JSON structure (the runner may add fields but not remove these):
- `experiment`, `status`, `run_started_at`, `run_finished_at`;
- `environment`: Node version, machine, ffmpeg version, git commit, dirty flag, diff SHA-256, blob hashes of the used modules;
- `manifest`: path, SHA-256, counts;
- `pr_constants`: as used;
- `seeds`: the full table;
- `compute_subsetting`: projection, whether triggered, subset IDs;
- `exclusions[]`, `split_half_exclusions[]`;
- `recordings[]`: per recording, n, h (`pointHopFrames`), overlap fraction f, snr_proxy_dB, codec / sample rate / channels, d95 (with source and non-converged count), convergence for every PCA, eigen-gaps, and per view the real / G / P values of EV, T, C at k = 5 and 10, T_span and T_gap1.5, the export-time flag output (direct and F1), the split-half values, and the timing;
- `demo[]`: the same fields for the demo files;
- `synthetic[]`: the synthetic signals;
- `control_draw_variability`, including the convergence sensitivity;
- `convergence_summary`: non-converged counts per control type and component index;
- `aggregates`: per view and quantity, median, IQR and CI;
- `paired_tests`: CIs, Wilcoxon, Holm, observer-cluster CIs;
- `overlap_strata`: per stratum and view;
- `confounds`: SNR-proxy and overlap Spearman correlations with CIs;
- `ev_distribution`: rule 2 inputs and verdicts at 0.10 (governing) and 0.05 (sensitivity);
- `split_half`: agreement, κ, prevalence, informative/stable status, stratified results;
- `timing`: per recording and stress test, per variant, load averages, `underLoad` flags, machine;
- `checks`: parity, rank invariance, probe-off invariance, 007 consistency, F1 exactness, determinism, label invariance, t-port equivalence, T_span = T at h ≥ 7;
- `verdicts`: the rule 1–4 outputs with their inputs, including `ci_lower_above_zero`, the joint 007/008 label, and any suspension.

## Unexpected Observations

Pending run.

## Discussion

Pending run.

Limitations pre-stated now, so they are not discovered after the fact:
- **Scope of the results:**
  - Results apply to the PR front end, within-recording PCA fits, the assumed X/Y/Z = PC1/PC2/PC3 mapping, and views drawn with one uniform scale.
  - They do not apply to cross-recording shared embeddings, other reducers, or views that add jitter, time or per-axis rescaling.
  - No individual-bird or cross-recording claim follows from them (D-008).
  - They do not re-validate D-004 or D-010, whose evidence came from other regimes (see header).
- **What the numbers mean:**
  - Trustworthiness measures whether a view's neighbours were also neighbours in the 3078-dim feature space. It does not measure biological meaning.
  - Explained variance measures the share of z-scored feature variance, in which every log-magnitude bin weighs the same. It is not a share of "the sound".
- **Window-overlap confound (Experiment 007 H3), which varies with recording length:**
  - Adjacent windows share max(0, 6 − h) of 6 frames: 4 of 6 at h = 2 (recordings up to roughly 32.5 s), fewer at h = 3–5, none at h ≥ 6 (roughly > 81 s). Original-space neighbours are therefore likely to be temporal neighbours in short recordings and less so in long ones.
  - These overlap-trivial neighbours can inflate T and the margin, and by different amounts in different recordings. Neither G nor P models this autocorrelation. Passing G shows only "better than a structureless matrix of the same shape".
  - This experiment reports T_span (overlap-excluded) and the overlap-stratified results to show the size of the effect, but they are descriptive and do not change any verdict. The viewer's T includes overlap-trivial neighbours, and the viewer text must say so (rule 5).
  - The surrogate analyses that address whether the structure is song-specific belong to Experiment 007 and are not repeated here.
- **Recording-condition confound:** SNR, background species and noise, device, codec and gain are uncontrolled, and Experiment 005 showed that recording condition can dominate embedding structure in this project. The SNR proxy and metadata correlations are descriptive. No result can be attributed to the bird rather than the recording.
- **Non-independence of recordings:** 60 recordings from 49 observers; the ordinary bootstrap treats recordings as independent. The observer-cluster bootstrap is the sensitivity check. Recordings from the same site but different observers are not accounted for.
- **Similarity edges in reduced views:** the edges are computed in 3D. If they are drawn in a 1D or 2D view, they show 3D neighbours, not the displayed view's neighbours. This experiment does not evaluate edges in reduced views. The viewer should hide them there, or label them as 3D-derived; that is a viewer decision to be settled separately.
- **Split-half caveat:** halves have about n/2 points and are fitted separately, so agreement is estimated at a smaller n than the displayed recording. The estimate is conservative in that respect. It also cannot separate data variability from component-identity swaps when eigenvalues are close; the eigen-gap stratification is only descriptive.
- **Control convergence:** control PCAs are expected not to converge in some components (isotropic data). The argument that T_G stays a valid null, and its measured sensitivity, are given in Method. EV_G from non-converged components is approximate.
- **Timing is machine-specific.** The 10 s threshold is judged on the logged run machine. On slower machines the result is not guaranteed; F1 reduces the machine dependence.
- **Corpus limits:**
  - The corpus is small (12 species, 5 recordings each) and was curated for licence clarity.
  - Device, codec and observer are uneven across species (Corpus_v2.md, "Known biases and limits"). That matters less here, because no species comparison is made, but it limits how far the EV distribution generalises to other recording sources.
  - The h ≥ 6 stratum is expected to be very small (2 recordings by manifest duration), so it gives per-recording values only.

## Decision

Pending run. The decision will be applied mechanically from the Pre-Committed Decision Rule.
- **Decision log:** it feeds the proposed **D-015** (per-view information-preservation reporting and the per-recording weak-view flag). It also provides the measured EV₃ distribution that replaces the "typically a few percent" sentence in `06_Technical_Architecture/Technical_Architecture.md`. D-004 and D-010 are not changed by this experiment; reducer choice belongs to Experiment 007 / D-014. D-008 is respected (no individual-bird claims).
- **Exporter:** `tools/lib/view_preservation.js` and a `viewPreservation` block in every single-recording export (method `"direct"` or `"lookup-F1"`, or `status: "deferred"` under F2).
- **Viewer:** per-view "keeps X% of the variation", "neighbourhood trust T", the random-matrix reference and margin, the rule 1 labels, and the per-recording flag where it is allowed. The wording comes from Experiment 011.

## Reproducibility Notes

- **Runner:** `tools/experiments/run_experiment_008_display_views_information_preservation.js` (not yet written).
- **Results:** `05_Benchmark_Results/v2/experiment_008_display_views_information_preservation.json` (not yet produced).
- **Export-time module:** `tools/lib/view_preservation.js` (not yet written). The runner and the exporter call the same function.
- **Manifest:** `manifest_v2_corpus.json`. Its SHA-256, recording count, species count and per-recording source URL and licence are logged in the JSON.
- **PR constants** are read from `tools/export_single_recording_dataset.js`, not re-typed: 22050 Hz, FFT 1024, hop 512, Hamming window, 6 frames per point, base point hop 2 frames, `MAX_POINTS` 700, amplitude filter 0.2, `POSITION_SPREAD` 6, similarity k 3, gap 1.5 s. The runner logs the values it actually used. The PCA constants `PCA_TOLERANCE` 1e-10 and `PCA_MAX_ITERATIONS` 5000 are read from `tools/lib/reducers.js`.
- **Experiment-specific constants:** k = 5 (primary), k = 10 (sensitivity); margin 0.02; split-half block length 2.0 s with the boundary guard; minimum half size 50; stability threshold 0.80; informative-flag prevalence bounds 0.10–0.90; control-noise SD threshold 0.01; EV claim cut-off 0.10 (governing) and 0.05 (sensitivity); timing threshold 10 s; stress n = 700; 1 warm-up and 5 timed repeats; load-check threshold 0.5 × cores, re-check every 60 s for up to 30 min; eigen-gap stratification cut-off 0.9 (descriptive); minimum points per recording 100; T_span exclusion |Δ start frame| ≤ 6; overlap strata h = 2, 3–5, ≥ 6; minimum stratum size for summaries 5; convergence-sensitivity cap 50000 iterations; compute-plan thresholds 24 h (subset extras) and 48 h (stop); subset size max(12, ⌈N/4⌉).
- **Environment:**
  - Node (v24.x; exact version logged).
  - ffmpeg/ffprobe **only** via `tools/lib/ffbin.js` (`FFMPEG`, `FFPROBE`; version via `ffmpegVersion()` logged).
  - The git commit hash and a dirty-tree flag. If the tree is dirty, the SHA-256 of `git diff` is logged.
  - The git blob hashes of `tools/lib/metrics.js`, `tools/lib/reducers.js`, `tools/lib/view_preservation.js`, `tools/lib/synth.js` and `tools/export_single_recording_dataset.js`.
- **Seeds:** the full table in Method, written to the JSON. Base 20260720.
- **Statistics:** `tools/lib/metrics.js` (percentile bootstrap, paired bootstrap, Wilcoxon, Holm, Spearman, type-7 quantiles). B = 2000, α = 0.05. The observer-cluster bootstrap and `gapExcludedTrustworthiness` are not in `metrics.js` as of 2026-09-29 and must be added (or implemented in the runner) with unit tests before the run.
- **Smoke verification of the 30.0% figure (2026-09-29):** a scratch script outside the repo called `readFullAudio` (22050 Hz) and `computeContinuousFrontEnd` on `Assets/smoke/Luscinia_svecica_song.ogg`, then `pca(X, 3)`, giving n = 234 and EV₃ = 0.29952. It is recorded only to document where the motivating number came from.
- **Scratch measurement of the export-time control (2026-09-29, revision author):** a scratch script outside the repo built `metrics.randomMatchedMatrix` of a 700 × 3078 all-zeros matrix with seed 20260720 + 990, ran `pca(·, 3)` (λ₄ probe on), `makeRankContext(·, { standardize: true })` and `trustworthiness(·, ·, 5)` for the 7 views. Iterations 1616 / 5000 (not converged, relative residual 1.23e-9) / 2607; explained-variance ratios 0.00310, 0.00306, 0.00306; T for x, y, z, xy, xz, yz, xyz = 0.5306, 0.5267, 0.5217, 0.5460, 0.5395, 0.5457, 0.5620. Wall-clock 32.8 s for the PCA on an 8-core Apple M2 under a 1-minute load average of 44.3, therefore not a valid timing. Control data only; no real recording was involved. It is recorded only to document the basis of H5 and the rule 5 remark, and is never reported as a result.
- **Label-exclusion code inspection:** date and inspector to be recorded here at run time.
- **Unit tests** (in `tools/test/`) that must pass before the run:
  - `view_preservation.test.js`:
    - determinism;
    - EV additivity;
    - T of the `xyz` view equals `metrics.trustworthiness` called directly;
    - a fixture where one view is known to be weak and another is not;
    - the F1 lookup value built in a separate process from an all-zeros matrix equals the direct value from a non-zero matrix of the same shape, bitwise;
    - the flag is `margin < 0.02` exactly at the boundary (margin = 0.02 is **not** weak);
    - probe-off `pca` gives a bitwise-identical embedding to probe-on.
  - T/C port equivalence (shared with Experiment 007).
  - `gapExcludedTrustworthiness`: gap 0 equals standard T to ≤ 1e-12; with no excluded pairs it equals T exactly.
  - Observer-cluster bootstrap: deterministic for a fixed seed; with every recording in its own cluster its resampling distribution matches the ordinary bootstrap's on a fixture (same RNG consumption, or a documented tolerance).
  - Split-half assignment: boundary-crossing windows dropped; no audio sample shared between halves.
  - SNR proxy: a fixture with known quantiles; the Q₀.₁ = 0 case returns +∞.
  - Rule 1 classifier: the three outcomes at their boundaries (L = 0.02 is pass; U = 0.02 with L < 0.02 is inconclusive; U < 0.02 is fail; the "not better than random" text only when U ≤ 0).
  - Seed uniqueness.
- **Revision note (2026-09-29):** revised before any run, after an internal critique. Changes: rule 1 split into pass / inconclusive / fail with exact label texts; control-PCA convergence logging and validity argument; H5 basis corrected to include power iteration, with F1 timed as the expected path and a load check; overlap-regime logging, stratification and T_span; recording-condition confound paragraph with the SNR proxy and the Exp 005 citation; compute plan with subsetting of non-governing extras only; d95 from 007 where available and marked approximate when non-converged; control T and margin always shown next to T; observer-cluster bootstrap sensitivity; no ranking of views; informative-flag prevalence condition; 0.05 EV sensitivity; 007/008 mismatch suspends verdicts; D-008 line and D-004/D-010 regime disclosure; F1 exactness check rebuilt as a separate-process, all-zeros, bitwise test. No pre-registered threshold was loosened.
