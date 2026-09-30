# Experiment 008 — Information Preservation of Each Displayed View (the X / Y / Z Toggles), Production Regime

**Date:** 2026-09-29 (pre-registration written, and revised the same day after an internal critique; pre-run consistency amendments added the same day, before any run; dated additions to the amendments made on 2026-09-30, before any run; run date to be filled in at run time)
**Work Package:** WP3 (Embedding Benchmark), Information Preservation Reporting (`01_Master_Framework/v0.4_Final.md`, Open Decisions), v2.0 track
**Related Decision Log ID(s):** D-004 (PCA), D-006 (negative controls), D-010 (raw spectrograms), D-005 (Rule 001), D-008 (no individual-bird claims), D-011 (Rule 002: benchmark plan before implementation). Proposed new ID: **D-015: per-view information-preservation reporting and the per-recording "weak view" flag for the X/Y/Z toggles** (provisional). Experiment 007 has already proposed D-014 for the display reducer. IDs are assigned only when results come in, and the order may change if another v2 experiment closes first. *[Superseded by Amendment C07, 2026-09-29.]*
**Status:** Pre-registered; consistency-amended 2026-09-29, with dated additions on 2026-09-30 (see "Pre-run consistency amendments"); not yet run; not yet frozen (Amendment C02). No corpus run, and no run of any arm whose output enters a verdict or gate, may start before the freeze.

**Scientific Hierarchy level:** Frame (`01_Master_Framework/v0.4_Final.md`, Scientific Hierarchy). Each point is a 0.15 s nominal window (actual span 0.1625 s) of 6 consecutive STFT frames. Nothing is segmented, so no point is a syllable, phrase or acoustic event, and no result here may be described at those levels. Every fit is within one recording (Level 1, Individual Recording); nothing here speaks to cross-recording comparison views.

**D-008 scope line:** this experiment makes **no individual-bird claims and no cross-recording claims**. A recording is not treated as one bird, and nothing here says that two recordings, or two birds, are similar or different.

**Regime disclosure for D-004 and D-010:** the evidence behind D-004 (PCA) and D-010 (raw spectrograms) came from other regimes: Experiments 001–004, with 22 and 150 rows of 1 s windows pooled across recordings, FFT 512, 15677 dims. *[Superseded by Amendment C28, 2026-09-29.]* This experiment does **not** re-validate either decision. Reducer choice under the production regime is Experiment 007's question. 008 takes PCA as given and measures what each displayed view of it preserves.

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
  - **Smoke value (verified by the author of this pre-registration on 2026-09-29, not a result):** on `Assets/smoke/Luscinia_svecica_song.ogg` through the PR front end (`readFullAudio` + `computeContinuousFrontEnd` from `tools/export_single_recording_dataset.js`, then production `pca(X, 3)` from `tools/lib/reducers.js`): 292 windows before the amplitude filter, n = 234 after it; explained-variance ratios 0.1616, 0.0813, 0.0566; total **0.2995**. All three components converged. This is one clip and is only the motivation for measuring the distribution. It is never reported as a result. *[Clarified by Amendment C17, 2026-09-29.]*
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
  - *Code inspection, 2026-09-29:* `pca()` is Gram-matrix power iteration from the deterministic start vector sin((i+1)(c+1)), iterated until relative residual < `PCA_TOLERANCE` = 1e-10 or `PCA_MAX_ITERATIONS` = 5000 (`tools/lib/reducers.js`, constants at lines 35–36, loop at lines ~176–188), with Hotelling deflation. With a fixed component count it also probes the next eigenvalue (λ₄ here) by a further power iteration. That probe does not change the returned embedding, because it runs after the 3 components are stored. Experiment 007's Method describes "100 iterations per component". That does not match the current code, and is noted here for 007's owner *[Superseded by Amendment C28, 2026-09-29.]*; 008 uses the code as it is at run time and logs its git blob hash.
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
  - Basis, scratch measurement (author of this revision, 2026-09-29; control only, no real data; motivation, not a result): `pca(G_exp, 3)` with G_exp = `metrics.randomMatchedMatrix` of shape 700 × 3078 and seed 20260720 + 990 (EXPORT_CONTROL_SEED). *[Clarified by Amendment C01, 2026-09-29.]*
    - PC1 converged after 1616 iterations; PC2 reached the 5000 cap unconverged (relative residual 1.23e-9); PC3 converged after 2607 iterations. The λ₄ probe iterations are not logged by `pca()`.
    - That is 9223 iterations, about 4.5e9 multiply-adds, roughly 6× the Gram matrix cost.
    - These iteration counts are deterministic (fixed seed and fixed start vector). An independent critic scratch run on the same code reported the same three counts.
    - The wall-clock time in this scratch run was 32.8 s on an 8-core Apple M2 under a 1-minute load average of 44.3 (other agents were running concurrently). That time is **not** a valid timing and is not used; it is recorded only to show why the Timing definition now includes a load check.
  - The real wall-clock time is **unknown** until measured under the Timing definition.

## Method

* **Dataset / subset used:** `manifest_v2_corpus.json` (see `03_Research_Notebook/Corpus_v2.md`).
  - As built on 2026-09-29, `Corpus_v2.md` records **60 evidence recordings** from 12 species (5 per species, 49 distinct observers, 1,514.8 s in total, median duration 19.6 s, range 5–120 s by the selection rule), plus **2 Wikimedia Commons Bluethroat demo files** that are listed separately and "are not part of the evidence set".
  - The runner reads the final counts from the manifest at run time and logs them with the manifest's SHA-256. If they differ from the numbers above, the run-time numbers govern and the difference is noted in Unexpected Observations. *[Clarified by Amendment C17, 2026-09-29.]*
  - This is a **new corpus**. Results are new experiments, not reproductions of Experiments 001–006.
  - **Primary analysis set:** the evidence recordings. **Demo files:** analysed with exactly the same procedure and reported per file in a separate `demo` block, because they are what product users see. They are **not** included in the corpus-level aggregation or decision. A sensitivity aggregation with them included is also reported.
  - Recording index `r` = the 0-based position of the recording in `manifest_v2_corpus.json`, fixed before any exclusion, so that seeds never shift. Demo files take the indices they have in the manifest's demo list, offset by 900 (r = 900, 901), so their seeds cannot collide with evidence seeds. *[Clarified by Amendment C08, 2026-09-29.]*
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
    3. G_exp = `metrics.randomMatchedMatrix(X, EXPORT_CONTROL_SEED)` *[Superseded by Amendment C01, 2026-09-29.]* with **EXPORT_CONTROL_SEED = 20260720 + 990**. The seed is fixed and independent of the corpus index, because an export has no corpus index.
    4. Production `pca(G_exp, 3, { probeNextEigenvalue: false })`, then T_G(k=5) for the same 7 component subsets, with G_exp's own z-scored rank context. The λ₄ probe is switched off for the control only, because the control's eigen-gap is not used. This must not change the embedding: a unit test asserts that the embedding with and without the probe is bitwise identical.
    5. margin_V = T_V − T_G,V.
    6. **weak_V = (margin_V < 0.02).**
  - **Output per view:** `{ view, components, explainedVarianceShare, trustworthinessK5, continuityK5, controlTrustworthinessK5, marginK5, weakForThisRecording, controlSeed, controlConverged, n }`, plus `k`, the method string (`"direct"` or `"lookup-F1"`), the module's git blob hash, and the evidence pointer ("Experiment 008").
  - **Consequence of the fixed seed:** `metrics.randomMatchedMatrix` uses only the shape of its input, not its values (verified by code inspection: `tools/lib/metrics.js`, lines 522–525 *[Superseded by Amendment C28, 2026-09-29.]*, `Array.from(matrix, (row) => Array.from(row, () => randomNormal(random)))`). So G_exp depends only on (n, 3078, EXPORT_CONTROL_SEED), and T_G,V is a deterministic function of n alone for d = 3078. This is what makes fallback F1 (below) exact. The F1 exactness check tests this directly.
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
  - **Component-identity caveat (descriptive, extra rigor):** when two eigenvalues are close, the halves' PC2 and PC3 can be different directions under the same index. The eigen-gap ratios λ₂/λ₁, λ₃/λ₂ and λ₄/λ₃ (from `pca()` `nextEigenvalueRatio`) *[Superseded by Amendment C16, 2026-09-29.]* are logged for the full recording and each half. Agreement is also reported stratified by whether any ratio exceeds **0.9**. That cut-off is a project choice made here with no literature basis; it is descriptive only and does not change any verdict.

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
    - For each i, the candidates are restricted to Eᵢ = { j : windows i and j share no audio sample } *[Superseded by Amendment C10, 2026-09-29.]*, i.e. |startFrameᵢ − startFrameⱼ| · 512 ≥ 3584, i.e. |Δ start frame| ≥ 7, equivalent to |tᵢ − tⱼ| ≥ 0.1625 s. The comparison is made on integer frame indices so that floating-point time rounding cannot move the boundary.
    - With mᵢ = |Eᵢ|: T_span = 1 − (1/n′) Σᵢ pᵢ / (k(2mᵢ − 3k + 1)/2), where pᵢ is the usual penalty inside Eᵢ. Points with mᵢ < 2k are skipped and counted; n′ = the number of points kept.
    - At h ≥ 7 no pair is excluded, so T_span = T exactly; the runner asserts this.
    - Control matrices inherit the real rows' frame indices.
    - Also reported: **T_gap1.5(k=5)**, the same function with 007's 1.5 s gap, for direct comparison with 007's values.
    - Implementation: one shared function (proposed `metrics.gapExcludedTrustworthiness`, not yet written; to be shared with 007's runner). If 007's implementation exists at run time, 008 uses it. *[Superseded by Amendment C10, 2026-09-29.]* *[Superseded by Amendment C11, 2026-09-29.]* A unit test must show that gap 0 equals the standard T to ≤ 1e-12.
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
  - **d95 (reference, non-governing):** the smallest component count with cumulative EV ≥ 0.95 (`pca(X, null)`). *[Superseded by Amendment C06, 2026-09-29.]*
    - *Source:* if Experiment 007's results JSON exists at run time, d95 is taken from it, because 007 computes it as its auto-95 reference on the same X. 008 recomputes d95 on the first 2 analysed recordings as a cross-check; any difference is a 007/008 mismatch (see Additional checks). If 007's JSON does not exist, 008 computes d95 itself, subject to the Compute plan. *[Superseded by Amendment C06, 2026-09-29.]*
    - *Approximation:* `pca(X, null)` can compute many components, each up to 5000 iterations, and later components have small eigen-gaps. The number of non-converged components among the d95 components is always reported next to d95. If any is non-converged, d95 is marked **"approximate"**. *[Superseded by Amendment C06, 2026-09-29.]* d95 enters no verdict.
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
    - **Observer-cluster bootstrap (sensitivity, non-governing):** the 60 evidence recordings come from 49 observers (Corpus_v2.md), so recordings are not fully independent. Every rule 1 CI and the rule 2 CI of the median EV₃ are recomputed with a cluster bootstrap that resamples observers with replacement and includes all recordings of each drawn observer (B = 2000, seed 20260720 + 705). The observer id is the manifest field `recordistLogin` (falling back to `recordist` if it is missing; logged). Observer id is not a taxon label, so Rule 001 is not touched. It is read only by the aggregation stage. Any verdict that changes between the ordinary and the cluster bootstrap is listed in Discussion. The ordinary paired bootstrap governs, as pre-registered. The cluster bootstrap is not in `tools/lib/metrics.js` today; it is implemented in the runner (or added to `metrics.js`) with its own unit test. *[Superseded by Amendment C11, 2026-09-29.]*
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
  | **Matched Gaussian** (G) | Exact port of Exp 001 `randomMatchedMatrix` (`metrics.randomMatchedMatrix`): `makeRandom(seed)` LCG (1664525, 1013904223, mod 2³²) *[Superseded by Amendment C01, 2026-09-29.]*, Box–Muller cosine branch with u₁ clamped to ≥ 1e-12, one draw per cell in row-major order, same n × 3078 as X | shape only | everything else, including the window-overlap autocorrelation | **+1** | **Governs the corpus-level rule** |
  | **Column-permuted** (P), extra rigor | Each of the 3078 columns of X independently permuted across rows (Fisher–Yates, same LCG) *[Superseded by Amendment C01, 2026-09-29.]*, `metrics.columnPermutedMatrix` | each feature's marginal distribution | cross-feature and temporal (overlap) structure | **+2** | Reported (secondary family). Governs view labels jointly with Experiment 007 (see decision rule) |
  | **Export-time Gaussian** (G_exp) | As G *[Superseded by Amendment C01, 2026-09-29.]*, with fixed seed EXPORT_CONTROL_SEED = 20260720 + 990; PCA with the λ₄ probe off | shape only | everything else | fixed, not per-recording | **Governs the per-recording flag** |
  | **Split-half Gaussian** (G_A, G_B) | As G *[Superseded by Amendment C01, 2026-09-29.]*, with the shape of each half | shape only | everything else | **+11** (A), **+12** (B) | Split-half stability |

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

  - Demo files use r = 900 and 901. Evidence indices r ≤ 999 with offsets ≤ 12, so per-recording seeds are 20260720 + 1000·r + {1, 2, 11, 12}. None of these equals a corpus-level seed (600–619, 702–705, 801–805, 990–994), because those are not ≡ 1, 2, 11 or 12 (mod 1000). *[Clarified by Amendment C08, 2026-09-29.]*
  - The runner asserts that all seeds are unique *[Superseded by Amendment C01, 2026-09-29.]* and writes the full seed table to the JSON.
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
- **Cross-experiment consistency with Experiment 007:** if Experiment 007's results JSON exists when 008 runs *[Superseded by Amendment C14, 2026-09-29.]*, T_real and T_G at k = 5 for the 7 PCA subsets must match 007's values exactly, for every recording both experiments analysed; so must d95 on the recordings where 008 recomputes it, and T_gap1.5 where 007 reports it per subset.
  - **Any mismatch suspends the joint labelling rule and 008's rule 1 verdicts** until the cause is found, fixed and documented in both notebooks. While suspended, the viewer shows only the measured numbers (rule 5) with no verdict label *[Superseded by Amendment C03, 2026-09-29.]* and no per-recording flag. Neither experiment's numbers are silently preferred.
  - A mismatch is plausible in advance: 007's Method text says "100 iterations per component", while the code runs to a 1e-10 tolerance or 5000 iterations (verified in `tools/lib/reducers.js`, lines 35–36 and ~176–188). If 007's runner follows its text rather than the code, its PCA values will differ. *[Superseded by Amendment C28, 2026-09-29.]*
- **Fallback F1 exactness (run whether or not F1 is needed):** this tests that G_exp, and hence T_G_exp, depends only on the shape.
  - For every distinct n in the analysed corpus (full recordings and the halves used with the export seed), a **separate Node process** (`child_process.spawnSync(process.execPath, …)`) builds the lookup value from a dummy **all-zeros n × 3078 matrix**: `randomMatchedMatrix(zeros, EXPORT_CONTROL_SEED)`, `pca(·, 3, { probeNextEigenvalue: false })`, and T_G,V(k=5) for the 7 views.
  - The main process computes T_G_exp,V from the **real X** at the same n through the export-time function.
  - The two sets of values are compared **bitwise** (the IEEE-754 bit patterns, via `Float64Array` → hex), not to a tolerance. Any difference fails the check, and F1 cannot ship until it is resolved.
  - The shape-only property itself is verified by code inspection (`tools/lib/metrics.js`, `randomMatchedMatrix`, lines 522–525) *[Superseded by Amendment C28, 2026-09-29.]*; this check verifies it end to end through the PCA and the metric.

### Compute plan and pre-stated subsetting (no silent caps)

- **Default:** everything runs on every analysed recording.
- **Per-recording cost, stated in advance:**
  - PCAs: `pca(X, 3)`; `pca(G, 3)`; `pca(P, 3)`; `pca(G_exp, 3)` (direct variant); the two halves' own PCAs; `pca(G_A, 3)` and `pca(G_B, 3)`; the export-seed half controls (from the F1 table where n is in range); and `pca(X, null)` for d95 if 007's value is not available *[Superseded by Amendment C06, 2026-09-29.]*. That is 8 to 10 PCAs at sizes ≤ n, plus d95.
  - Rank contexts (one squared-distance matrix and sort each) for X, G, P, G_exp and each half and half control.
  - T and C for 7 views × 2 values of k against X, G and P; T for G_exp; T_span and T_gap1.5 for 7 views against X, G and P.
  - The control PCAs are expected to dominate, for the reason given under H5 (slow power iteration on isotropic data). Every PCA and T/C call is timed and logged.
  - `pca(X, null)` computes components until cumulative EV ≥ 0.95, each with up to 5000 iterations. Its cost is **unknown** and may be much larger than `pca(X, 3)`; this is why d95 is taken from 007 when available. *[Superseded by Amendment C06, 2026-09-29.]*
- **One-off costs:**
  - *F1 table:* 601 PCAs of G_exp (n = 100 … 700) plus their T values. The cost per PCA scales roughly with n² (Gram matrix and power iterations are both n²-proportional at fixed d), so the total is about Σ_{n=100}^{700} (n/700)² ≈ **233 ×** the direct n = 700 control cost. It can be up to about 1.6 × that if every component at every n hits the 5000 cap (the n = 700 scratch run used 9223 of a possible 15000 iterations). This is an estimate from the operation count; the runner measures it.
  - *Control-draw grid:* 140 PCAs, about 20 × Σ_{grid}(n/700)² ≈ **57 ×** the n = 700 control cost.
  - *Convergence sensitivity:* 21 PCAs at n = 700 with up to 50000 iterations each (G_exp plus the 20 grid seeds).
- **Projection:** the runner first runs the cheap front end on every recording to obtain each n_r. It then times the complete per-recording procedure on the first 2 analysed recordings, projects the total by scaling each recording's cost with n_r², adds the one-off costs (measured on their first entries and scaled the same way), and logs the projection.
- **If the projection exceeds 24 h on the run machine** (the same threshold as Experiment 007), then only these non-governing extras are reduced:
  - d95 (when 008 must compute it) and the export-seed split-half secondary analysis run on a fixed seeded subset of m = max(12, ⌈N/4⌉) recordings, N being the number of analysed recordings. The subset is drawn uniformly without replacement (Fisher–Yates, `makeRandom(20260720 + 704)` *[Superseded by Amendment C01, 2026-09-29.]*) **without using labels**.
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

  | Outcome | Condition | Viewer label (exact text, passed to Experiment 011) *[Clarified by Amendment C03, 2026-09-29.]* *[Clarified by Amendment C20, 2026-09-29.]* | Triggers |
  |---|---|---|---|
  | **pass** | L ≥ 0.02 | none | — |
  | **inconclusive** | L < 0.02 ≤ U | "below the pre-committed margin (inconclusive)" | "Needs more testing" for that view; escalated to the owner; the per-recording flag for that view is not shipped (see Disqualification). Not Failure Criterion 1. The threshold is not adjusted; a re-test on a larger corpus would be a new pre-registered experiment |
  | **fail** | U < 0.02 | "not shown to beat a random matrix by the 0.02 margin" | v0.4 Failure Criterion 1 ("Random or shuffled data produces manifolds with structure similar to real data") **for that view**, and a documented methodology review. The threshold is not adjusted |

- **The phrase "not better than random" is used only if U ≤ 0** (a fail whose CI lies entirely at or below zero). In that case the label is "not better than a random matrix of the same size". It is never used for an inconclusive view, or for a fail with U > 0.
- **Descriptive only:** whether L > 0 is reported for every view (`ci_lower_above_zero`). It is not a verdict and not a viewer label; Experiment 011 may use it only if 011 pre-registers that use.
- A non-pass label applies whenever the view is displayed, for every recording, whatever that recording's own flag says.
- **Joint labelling with Experiment 007 (the stricter outcome applies):** 007 tests each PCA subset against G and P. For labelling only, the same three-way split is applied to each of 007's two CIs (read from 007's results JSON) *[Superseded by Amendment C03, 2026-09-29.]*; this does not change 007's own verdicts. Outcomes are ordered fail < inconclusive < pass, and the viewer label is the worst of 008-G, 007-G and 007-P. A pass in 008 never overrides a non-pass in 007. When the worst outcome comes from P, "a random matrix" in the label text is replaced by "a column-shuffled copy of the features"; if G and P tie for worst, both are named.
- **Suspension:** any 007/008 mismatch (Additional checks) suspends this rule and the joint labelling until it is resolved and documented.
- **Views are not ranked against each other by this experiment.** No statement such as "xy preserves more than xz" may be made from these results. If a comparison between views is ever displayed, it needs its own pre-registered paired difference per recording with a paired bootstrap CI, and differences with CI lower bound below 0.02 are treated as a tie (the Experiment 001 tie band) *[Superseded by Amendment C28, 2026-09-29.]*.

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
  - **Stable and informative, and the view passed rule 1:** *[Superseded by Amendment C03, 2026-09-29.]* the viewer may show "weak for this recording" whenever weak_V is true.
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
  - **F2 (deferred)**, if F1 is also not fast enough: the flag is computed in a separate offline step after export (same function, same fields). The export carries `viewPreservation: { status: "deferred" }` until that step has run. The viewer shows "not yet measured" for that recording and never shows an unmeasured number or label. *[Clarified by Amendment C20, 2026-09-30.]*

**5. What the viewer will SAY (fixed here; the plain-language wording is fixed in Experiment 011).**
- For each view, the viewer states **only measured numbers from that recording's export**, and always all three of the following together:
  - **"keeps X% of the variation"**: X = EV_V × 100, rounded to the nearest integer, shown as "<1%" if EV_V < 0.005 *[Superseded by Amendment C25, 2026-09-29.]*;
  - **"neighbourhood trust T"**: T(k=5), 2 decimals *[Superseded by Amendment C25, 2026-09-29.]*;
  - **the random-matrix reference and the margin**: T_G_exp,V (the recording's own control T, 2 decimals) and margin_V = T − T_G_exp (2 decimals, signed) *[Superseded by Amendment C25, 2026-09-29.]*. A bare T cannot be read without its reference: a structureless matrix of the same size already scores well above 0 on this regime. (*Pre-registration scratch value, control only, not a result:* at n = 700 the 7 views of G_exp scored T between 0.52 and 0.56. The runner recomputes these as F1 table entries.) *[Clarified by Amendment C01, 2026-09-29.]*
- Plus, where rules 1 and 3 allow it:
  - the corpus-level non-pass label from rule 1, in its exact text;
  - the per-recording "weak for this recording" flag.
- **The viewer's T includes overlap-trivial neighbours** (moments that share audio with each other). The tooltip must say so. This is passed to Experiment 011 together with the exact label strings in rule 1. T_span is not shown by the viewer unless Experiment 011 pre-registers its display.
- **Nothing else is stated.** In particular:
  - no claim of "bird-specific" or "song" structure, unless Experiment 007's surrogate gate allows it *[Superseded by Amendment C28, 2026-09-29.]*;
  - no claim that a higher T means biologically similar neighbours;
  - no attribution of any number to the bird rather than to the recording;
  - no ranking of views against each other (rule 1);
  - no qualitative adjectives ("good", "reliable") that are not defined in Experiment 011.
- The exact sentences, the tooltip that defines "variation", "neighbourhood trust" and "random-matrix reference", and any rounding display rules beyond the above belong to Experiment 011. 011 may make the wording plainer, but it may not add claims beyond these measured numbers and verdicts. *[Clarified by Amendment C20, 2026-09-29.]*
- **If the synthetic white or pink noise is not flagged weak** (see Method), the viewer text must not imply that "not weak" means anything beyond "better than a structureless random matrix of the same size". This is also passed to Experiment 011.

**Sensitivity, reported and not governing:**
- Every corpus-level verdict is recomputed with T(k=10), with the median-of-differences CI, without recordings whose real PCA did not converge, with the demo files included, and with the observer-cluster bootstrap. Any verdict that changes is listed in Discussion. The k = 5 mean-difference verdict on the evidence recordings, with the ordinary paired bootstrap, governs.
- Every flag stability result is recomputed with EXPORT_CONTROL_SEED for both halves.
- Rule 2 is also reported at the 0.05 cut-off.

**Disqualification:** a view that does not pass rule 1 *[Superseded by Amendment C03, 2026-09-29.]* (fail or inconclusive) cannot be shown with a "weak / not weak" per-recording flag, because it already carries a corpus-level non-pass label. Its measured numbers (EV, T, control T, margin) are still shown, per Information Preservation Reporting.

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

## Pre-run consistency amendments (2026-09-29)

These amendments were made on 2026-09-29, before any run and before the freeze, after an independent 12-agent audit of Experiments 007–012. They change no pass/fail threshold, B value, statistic or seed value. Amendment IDs are shared across the six notebooks: an amendment with the same ID has the same Change text in each. Detail that applies only to this notebook follows the shared text, as a "note for 008". References of the form 008:n (and 007:n, 010:n and so on) point to the notebooks as they stood before these amendments; in this notebook, lines above this section keep their numbers, because the markers are inline. The original pre-registered text is kept. Each superseded passage carries the marker "*[Superseded by Amendment Cnn, 2026-09-29.]*", and a passage that an amendment only clarifies or adds to carries "*[Clarified by Amendment Cnn, 2026-09-29.]*". A marker names one amendment; a passage touched by several amendments carries one marker per amendment. Owner decisions OD-1, OD-2 and OD-3 were made by Leonard Lind (project owner) on 2026-09-29, in a working session with Claude Code in chat on the Windows PC. Amendment C06 is a strict default that stays in force until the owner decides.

Amendments cited here but recorded in other notebooks of the set. C04 (human review of description text, per language), named in C20 (1), C24 (evidence statuses that fail closed), named in C25 (1), and C26 (S2b facts, gate and payload source), named in C03 (7), are recorded only in the notebook of Experiment 011 (`03_Research_Notebook/Experiment_011_Description_Claims_Audit.md`). C05 (ffmpeg reference binary for Part A), named in C20 (3), is recorded only in the notebook of Experiment 012 (`03_Research_Notebook/Experiment_012_Compare_Mode_Timing_and_Grid_Sensitivity.md`). The amendments that these four subsections cite in turn (C02, C03, C14 and C24) are recorded here or are on this list. Their text is not repeated here. This notebook's freeze does not cover other notebooks, so the note on external amendment texts under C02 makes the freeze sidecar hash these subsections.

A passage that an amendment only extends (adding seeds, constructions or checks while the original words stay in force) carries "*[Supplemented by Amendment Cnn, 2026-09-29.]*" (definition added 2026-09-30). Dated additions (2026-09-30, before any run and before the freeze). Some amendments carry a line "Addition (2026-09-30, before any run)" after their Change text and notes. An addition with the same amendment ID has the same text in every notebook that records the amendment. A marker dated 2026-09-30 points to such an addition. Owner decisions OD-6, OD-7 and OD-8 were taken by Leonard Lind (project owner) on 2026-09-30, in a working session with Claude Code in chat. The additions change no threshold, B value, statistic or seed value.

### Amendment C01 (2026-09-29, before any run): Random numbers for every governing stream: Philox4x32-10

- **Why:** SEED-1 (seeds), SEED-2, SEED-3, SEED-6, SEED-7, SEED-8, SEED-11 and the seeds-lens missed items (MISSED-seeds-1, MISSED-seeds-2, MISSED-seeds-4): the legacy generators (32-bit LCG makeRandom, mulberry32) have one short cycle, so different seeds were shown to give overlapping, shifted copies of the same random numbers (009 calibration, 010 noise and backgrounds, 007/008/009/012 controls), and several draws named no generator at all.
- **Change:** Amendment C01 (OD-1). (1) Generator. Every random draw that feeds a v2 result comes from Philox4x32-10 (Salmon, Moraes, Dror & Shaw 2011, "Parallel random numbers: as easy as 1, 2, 3", SC11, DOI 10.1145/2063384.2063405), implemented in tools/lib/rng.js. This covers negative controls (matched Gaussian, column permutation, label shuffles), surrogates (phase-randomised, AAFT, frame shuffles), calibration matrices and graphs, every bootstrap (ordinary, paired, observer-cluster), chance and null draws, compute-subset draws, random offsets, random projections, synthetic signals and their noise, backgrounds and jitter, decoy and packet draws, and the seeds of stochastic reducers where the library accepts a random function. (2) Key and counter. A stream is identified by the key (k0, k1) = (seed, subStream). seed = the value already given in this notebook's seed table (a 32-bit unsigned integer; no seed value changes). subStream = a 32-bit unsigned index, 0 unless the C01 note of this notebook assigns another value. The 128-bit counter starts at 0 and increases by 1 for each 4-word output block (word 0 is the least significant, with carry into words 1 to 3). Distinct (seed, subStream) keys give distinct streams that are not segments of one shared cycle, and one stream cannot wrap (2^128 blocks). (3) Consumption. A stream's 32-bit words are used in order: block 0 words 0 to 3, then block 1 words 0 to 3, and so on. Each draw takes the next unused words. When a notebook uses one seed for several fits or calls (for example the same reducer seed for X, G, P, S and F, or the same bootstrap seed for every CI), each fit or call starts a fresh stream with that key at counter 0, exactly as the legacy makeRandom(seed) restarted per call. (4) Uniform double in [0, 1): take the next two words a, then b; u = ((a >>> 5) * 2^26 + (b >>> 6)) / 2^53. (5) Standard normal: take the next two uniforms u1, then u2; u1 = max(u1, 1e-12); z = sqrt(-2 ln u1) * cos(2 pi u2) (Box-Muller cosine branch; the sine value is not used). Matrices of normals are filled row-major, as metrics.randomMatchedMatrix does, unless this notebook states another order. (6) Derived draws: integer in [0, m) = floor(u * m); uniform on [lo, hi) = lo + (hi - lo) * u; uniform phase = 2 pi u; Fisher-Yates shuffle of m items: for i = m - 1 down to 1, swap item i with item floor(u * (i + 1)); a column-permuted matrix shuffles columns in order 0 to d - 1 from one stream, as metrics.columnPermutedMatrix does. (7) Bootstraps: resample index = floor(u * n), for resamples b = 1 to B in order and positions i = 1 to n within each; each CI call starts a fresh stream from (bootstrap seed, 0), so comparisons of equal length that share a seed still share resample index sets, as pre-registered. (8) Constructions are unchanged apart from the uniform source: G is i.i.d. N(0,1) of the same shape by (5), row-major; P is per-column Fisher-Yates by (6). (9) Synthetic signals (tools/lib/synth.js, v2 mode): the signal stream uses key (seed, 0) and the background stream key (seed, 1); normals by (5), uniforms by (4). (10) Legacy generators. metrics.makeRandom (the Experiment 001 LCG) and synth.mulberry32 stay in the code only to reproduce pre-v2 results (for example the unit test that metrics.randomMatchedMatrix equals the Experiment 001 function). No v2 runner may use them for any governing stream. (11) No silent default seeds. In a v2 runner, a call that omits a seed is an error: synth DEFAULTS seed 1, reducers `seed ?? 0` and metrics DEFAULT_SEED may not be used. Deterministic reducers (pca) are called through pca() directly, or reduceFeatures asserts that no seed is consumed; no seed is invented for them. In reduceFeatures, a namespaced seed or dimensions value that differs from the top-level value is an error. For every UMAP, random-projection and random-initialised t-SNE run, the runner asserts that the returned details.seed equals the seed-table value. (12) Tests that must pass before the run: rng.js reproduces the official Random123 known-answer vectors for philox4x32 10 (https://raw.githubusercontent.com/DEShawResearch/random123/main/tests/kat_vectors), for example key 00000000 00000000 with counter 0 gives 6627e8d5 e169c58d bc57ac4c 9b00dbd8; determinism for a fixed key; the v2 matched-Gaussian and column-permutation constructors, given the legacy LCG as their uniform source, reproduce the Experiment 001 functions bit for bit (so only the source changed); the seed-uniqueness test also asserts that every (seed, subStream) key this experiment uses is distinct, so streams cannot overlap by construction, and that no legacy generator is reachable from the v2 governing code. (13) Unchanged: every pass/fail threshold, every B value, every statistic, every seed value and every seed offset. Numbers quoted in this notebook from pre-registration scratch runs that used the legacy generators are planning figures only; the runner regenerates them with Philox.
  - C01 note for 008. subStream is 0 for every seed, except that the synthetic signals (seeds 20260720 + 801 to 805) use synth v2 mode, so their background streams use subStream 1, as C01 (9) states. G_exp uses key (20260720 + 990, 0); the 5-seed alternative uses keys (20260720 + 990 ... 994, 0). The shape-only property stated at 008:154 still holds for the C01 constructor, so fallback F1 stays exact and the separate-process, all-zeros, bitwise F1 check (008:309-313) is unchanged. The scratch values at 008:92-95, 008:399 and 008:528 (G_exp iteration counts, ratios 0.00310 / 0.00306 / 0.00306, T 0.52 to 0.56) were produced with the legacy LCG stream; they do not describe the v2 G_exp and stay planning facts; the runner recomputes them as F1 table entries. The control-draw grid seeds 20260720 + 600 ... 619 are 20 distinct keys, so their streams cannot overlap (the legacy-LCG overlap between seeds +600 and +611 no longer applies).
  - C01 note for 008, OD-6 (2026-09-30, before any run). 008 fits production pca() on X, G, P, G_exp, the halves and every other control with no seed, and its production parity check (008:303) runs the exporter, which calls reduceFeatures with method "pca" and no seed. The test of part (b) of the addition below is on this notebook's list of unit tests that must pass before the run (Reproducibility Notes), next to the probe-off invariance test.
  - C01 note for 008, compute-subset draw (2026-09-30, before any run). The +704 draw (008:330) is made only if subsetting is triggered, once, from a fresh stream with key (20260720 + 704, 0). The list is the N analysed recordings in ascending recording index r. One Fisher-Yates shuffle of that list is drawn by C01 (6). The subset is the recordings at positions 0 to m - 1 of the shuffled list, with m = max(12, ⌈N/4⌉). The same subset serves d95 and the export-seed split-half secondary analysis. The runner writes the shuffled list and the subset to compute_subsetting.
- **Addition (2026-09-30, before any run):** Amendment C01 (OD-6). (a) Owner decision OD-6: PCA is called without a seed. Deterministic PCA draws no random numbers, so pca() and reduceFeatures with method "pca" are called with no seed, and no seed is invented for them. This is an explicit, owner-approved exception to the rule of (11) that a call which omits a seed is an error. It applies only to deterministic PCA; for every other call, omitting a seed stays an error. (b) A test is added to (12). It must pass before the run of every experiment of this set, because each one fits PCA through pca() or through the exporter path. On a fixed fixture, the test calls pca() and reduceFeatures with method "pca" with no seed and with at least two different explicit seed values. It asserts that every embedding and every details object is bitwise identical across these calls, and that no random stream (Philox or legacy) is created or read during them. A PCA call that consumes a random number is an error. (c) The legacy generators of (10) also include tools/lib/reducers.js makeRandom, a 32-bit LCG that reducers.js exports. Like the other two, it stays in the code only to reproduce pre-v2 results; no v2 runner may use it for any governing stream, and the test of (12) that no legacy generator is reachable from the v2 governing code covers it. (d) Strictness: (a) confirms the treatment of deterministic PCA already stated in (11), and (b) and (c) only add tests; no threshold, B value, statistic or seed value changes.
- **Supersedes:**
  - 008:149 (export-time flag definition, step 3): "G_exp = `metrics.randomMatchedMatrix(X, EXPORT_CONTROL_SEED)`" (now the C01 constructor; the seed is unchanged).
  - 008:254 (controls table, row G): "`makeRandom(seed)` LCG (1664525, 1013904223, mod 2³²)".
  - 008:255 (controls table, row P): "(Fisher–Yates, same LCG)".
  - 008:256-257 (controls table, rows G_exp and G_A / G_B): "As G" (G_exp, G_A and G_B are now drawn from Philox).
  - 008:330 (compute plan, subset draw): "`makeRandom(20260720 + 704)`".
  - 008:288 (seed notes): "The runner asserts that all seeds are unique" (extended to keys).
  - 008:545 (unit tests): "Seed uniqueness." (extended).
- **Strictness:** Implements owner decision OD-1: it only changes where the uniform numbers come from, makes independence true by construction, forbids silent seeds and adds tests; no threshold, B, statistic or seed value changes.
- **Owner approval:** OD-1, Leonard Lind (project owner), 2026-09-29, working session with Claude Code in chat on the Windows PC. OD-6 (the addition of 2026-09-30), Leonard Lind (project owner), 2026-09-30, working session with Claude Code in chat.

### Amendment C02 (2026-09-29, before any run): Freeze of pre-registration, runner and code before the first run

- **Why:** FRZ-1, FRZ-2, FRZ-3, APPR-08, MISSED-ids-3, MISSED-ids-6 and MISSED-approvals-5: only 007 had a freeze, its span left out shared libraries and pre-registered text, run-time fields sat inside the hashed span, and nothing checked hashes against a stored reference. A later verification of these amendments found that the Results and Decision lines and 009's label-exclusion line were not covered by the anchor wording, and that nothing limited what an appended block may contain.
- **Change:** Amendment C02 (OD-2). (1) What is frozen. Before this experiment's first real (corpus) run, the project owner freezes: (a) its pre-registration; (b) its runner or runners; (c) every repo module under tools/ in each runner's require graph (for example tools/lib/reducers.js, metrics.js, synth.js, rng.js, window_descriptors.js, fft.js, tools/export_single_recording_dataset.js and any new tools/lib module) and every repo data or config file the runner reads; plus the resolved name, version and integrity (from package-lock.json) of each third-party package the runner loads (not the whole lockfile), and the SHA-256, version string, platform and architecture of the ffmpeg and ffprobe binaries the runner resolves through tools/lib/ffbin.js. (2) Extent of the pre-registration (stricter reading, see Strictness). OD-2 names the notebook up to the line "## Results"; because its exclusions name fields that also lie after that line, the whole notebook file is frozen, except only: the **Date:** line; the **Status:** line; the blocks appended directly below the append anchors listed under (7); the value fields of the Freeze record; and the dated, append-only Deviations list. Nothing else may change after the freeze. Stricter than OD-2's minimum: any arm whose output enters a verdict or gate (synthetic, calibration, fixture or corpus) also waits for the freeze; unit tests and smoke tests on the smoke file may run before it. (3) How it is recorded. The freeze is a commit the owner approves. It adds tools/experiments/exp0NN_freeze.json (NN = this experiment) holding: owner, date, the freeze commit, the SHA-256 of the canonical frozen notebook text, the append anchors as (7) lists them, the git blob hash of each frozen file, the package list with name, version and integrity, the ffmpeg/ffprobe binary records, and the experiment-specific references below. Canonical text: the notebook's UTF-8 content with CRLF normalised to LF, split into lines, with the excluded lines and every appended block removed, joined with LF. (4) What the runner does. At start-up the runner computes all of these values, writes them to the results JSON (preregistration.hashes), and refuses to run on any mismatch with the sidecar or on any uncommitted change to a frozen file. Only an explicit override flag lets it run; the whole output is then marked "exploratory, not pre-registered" and may never feed a verdict, a Decision Log row, an evidence block or any viewer or exported text. (5) The commit that adds the results JSON must have the freeze commit as an ancestor (git merge-base --is-ancestor); otherwise the result is void. (6) Any change after the freeze is a dated entry in the Deviations list, with what changed, why, and whether results had been seen; the original text is kept. (7) Append anchors. The anchors are exactly these lines, and no others: (i) every line that begins with "Pending run." (this includes the lines that read only "Pending run.", the first line under "## Results" and the first line under "## Decision"); (ii) every line that ends with "Pending run." (in these notebooks, the "Negative control numeric result" and "Negative control pass/fail" lines); (iii) the "Label-exclusion code inspection" line of Reproducibility Notes (007:467, 008:529, 009:492, 010:552, 011:467, 012:592), named here because its wording differs between the notebooks. No other line is an anchor, whatever its wording; the "run date to be filled in at run time" on the **Date:** line is covered by the Date-line exclusion. Each notebook's C02 note lists its anchors. The sidecar lists every anchor of this notebook explicitly, each by its exact text, its order among lines with the same text, and its line number in the notebook file at the freeze commit. An anchor line itself is never edited; run-time values and results are written only in the block appended directly below it. An appended block is the run of lines inserted between a listed anchor and the frozen line that followed it at the freeze; pre-registered text that follows an anchor in the same section (for example a planned JSON layout, pre-stated limitations or the Decision bullets) stays frozen. Any other added, removed or changed line outside the excluded lines of (2), and any difference between the notebook's anchors and the sidecar's list, is a change to the frozen text: a mismatch under (4), and a dated entry under (6). An appended block may hold only run-time values and records (measured values, counts, verdicts and decisions produced by the pre-committed rules, the discussion of the results, dates, names, file paths and hashes), never rule text: no new or changed threshold, gate, method, seed, definition, decision rule or visitor-facing string. Rule text in an appended block is a change to the frozen text under (6). At start-up the runner writes each anchor, with the SHA-256 of the block appended below it at that time (UTF-8, LF line ends; the SHA-256 of the empty string when nothing is appended), to the results JSON (preregistration.appendedBlocks).
  - C02 note for 008. Sidecar: tools/experiments/exp008_freeze.json. The F1 lookup table file, if the runner loads one, is a frozen data file. The Freeze record value fields and the Deviations list are in the subsection "Freeze record" at the end of Reproducibility Notes. Append anchors of this notebook under C02 (7), numbered as in fec9d2d: 008:291 and 008:295 (the "Negative control numeric result" and "Negative control pass/fail" fields); 008:447 (Results), 008:474 (Unexpected Observations), 008:478 (Discussion) and 008:507 (Decision), each beginning with "Pending run."; and 008:529 (Label-exclusion code inspection). Results, the decision and the inspection record are appended below these lines; the lines themselves stay as written.
  - C02 note for 008, external amendment texts. The amendments that this section's introduction lists as recorded in other notebooks are not part of this notebook's canonical text, so under (3) alone a later change to them would not change this experiment's hashes. The sidecar therefore also holds, for each listed amendment and for each notebook of Experiments 007–012 that records it, that notebook's path and the SHA-256 of the amendment's subsection there, computed from the freeze commit. A subsection is the lines from the line that begins "### Amendment Cnn " up to, not including, the next line that begins with "### " or "## ", with CRLF normalised to LF, joined with LF. The list is closed under citation: any ID of the form C followed by two digits that appears inside a hashed subsection, heads an amendment subsection in one of the six notebooks and is not recorded in this notebook is hashed too, repeated until no new ID appears. An amendment that this notebook records itself is covered by this notebook's canonical text, because its Change text is the same in every notebook. At start-up the runner computes these hashes from the current files, writes them to preregistration.hashes and refuses to run on any mismatch, as (4) states. It also refuses to run if a line of this notebook from "## Pre-run consistency amendments (2026-09-29)" up to "## Results" names an ID of the form C followed by two digits that is neither recorded in this notebook nor hashed in the sidecar. A change to a hashed subsection after this experiment's freeze is a mismatch under (4) and a dated entry in this notebook's Deviations list under (6). For 008 the hashed subsections are, as the notebooks stand on 2026-09-29: C04, C24 and C26 in Experiment 011's notebook, and C05 in Experiment 012's notebook.
- **Addition (2026-09-30, before any run):** Amendment C02 (OD-8). (a) Two-commit freeze. Under (3), the freeze commit adds a sidecar that records the freeze commit, that is, its own hash; a commit cannot contain its own hash. Owner decision OD-8 replaces this one recording step with two commits, both approved by the owner. Commit 1, the input freeze commit, contains this notebook, the runner or runners and every frozen code, data and config file of (1), each in its frozen form. Commit 2 has commit 1 as its only parent. It adds tools/experiments/exp0NN_freeze.json, which records the full hash of commit 1 and every value that (3) lists, each computed from commit 1. Commit 2 changes no line of any frozen file, except the value fields of this notebook's Freeze record, which (2) excludes from the frozen text. In (3), (4) and (5), and in every note of this set that names the freeze commit, the freeze commit now means commit 1. The commit that adds the results JSON must have commit 2 as an ancestor, and so commit 1 as well. Where a sidecar holds more than one freeze record (for example one per audit run in Experiment 011), each record has its own commit 1 and commit 2, and each commit 2 only appends its own record. (b) Start-up checks, in addition to (4). The runner refuses to run unless all of these hold: commit 1 is an ancestor of HEAD (git merge-base --is-ancestor); the freeze record in the sidecar at HEAD is unchanged from the version its commit 2 added, and it names commit 1; every frozen file other than this notebook is byte-identical at HEAD to its version in commit 1, with the git blob hash that the sidecar records; the canonical text of this notebook at HEAD, as (3) defines it, has the SHA-256 that the sidecar records, which is that of its canonical text in commit 1 (the notebook is compared by its canonical text because (2) lets its excluded lines change after the freeze); every other hash in the sidecar matches; and the working tree has no staged, unstaged or untracked change to any frozen file or to the sidecar. No check of (3) to (7) is removed. (c) New freeze after a deviation. After a freeze, any change recorded in the Deviations list under (6) needs a new owner-approved freeze, made by the same two-commit procedure, before any governing run. The new freeze record names the Deviations entries it covers. At start-up the runner refuses to run if the Deviations list holds an entry that no freeze record names; with the override flag of (4), its output stays exploratory. A recorded deviation never lets a run with mismatching hashes count as pre-registered. (d) Strictness: (a) makes (3) possible to carry out without dropping any recorded value, and (b) and (c) only add checks.
- **Supersedes:**
  - 008:6 (header): the Status line "**Status:** Pre-registered, not yet run" (no freeze was defined). The Status line itself has been updated to the current state; the Date and Status lines lie outside the frozen text under C02 (2).
  - 008:523-524 (Reproducibility Notes, Environment): "The git commit hash and a dirty-tree flag. If the tree is dirty, the SHA-256 of `git diff` is logged." and "The git blob hashes of `tools/lib/metrics.js`, `tools/lib/reducers.js`, `tools/lib/view_preservation.js`, `tools/lib/synth.js` and `tools/export_single_recording_dataset.js`." (these were logged only; they are now checked against the sidecar, and a mismatch stops the run).
- **Strictness:** Implements owner decision OD-2 and only adds checks; where OD-2's wording could be read two ways, the wider frozen set and the earlier freeze point are taken; the append anchors are a closed list (before "## Results" only the "Pending run." fields that OD-2 itself excludes; every other anchor lies after "## Results", where OD-2 requires no freeze at all), and an appended block may hold no rule text.
- **Owner approval:** OD-2, Leonard Lind (project owner), 2026-09-29, working session with Claude Code in chat on the Windows PC. OD-8 (the addition of 2026-09-30), Leonard Lind (project owner), 2026-09-30, working session with Claude Code in chat.

### Amendment C03 (2026-09-29, before any run): Viewer label for a non-pass view; gates keyed to verdicts, not strings

- **Why:** LBL-1, APPR-01, APPR-02, SD-1, SD-2, XREF-1, XREF-2 and two missed items (MISSED-approvals-4, MISSED-cross-2): 007 labels every fail "not better than random", 008 allows that phrase only when U <= 0, and 010's gate and 011's S2b matched the text string, so a failed axis could slip through and the no-007 case was handled three ways.
- **Change:** Amendment C03 (OD-3). (1) Verdicts are unchanged. 007's per-subset verdicts against G and P (pass, fail and not evaluable, 007:335-341; descriptive only, 007:143 and 007:393) and 008's per-view verdict against G (pass, inconclusive, fail; 008:343-350) are computed exactly as pre-registered. (2) For display, each of the three CIs, 008-G, 007-G and 007-P, is classified by 008 rule 1: pass if L >= 0.02; inconclusive if L < 0.02 <= U; fail if U < 0.02. The view's joint outcome is the worst of the three (fail < inconclusive < pass). A 007 subset that is not evaluable or descriptive only, a missing 007 result, and an active 007/008 mismatch suspension are never a pass. (3) Label text (008's exact wording governs): joint inconclusive gives "below the pre-committed margin (inconclusive)". Joint fail gives, for each control named, "not shown to beat a random matrix by the 0.02 margin" if that control's worst CI has U > 0, and "not better than a random matrix of the same size" only if that CI has U <= 0. When the worst outcome comes from P, "a random matrix" is replaced by "a column-shuffled copy of the features"; if a G CI and a P CI share the worst outcome, both controls are named, each with its own form, in one label. The words "not better than random" are used only when U <= 0. A view that fails 007's pre-registered rule against G or P (007 CI lower bound < 0.02) is never labelled "inconclusive"; it carries "not shown to beat a random matrix by the 0.02 margin" (or the U <= 0 form, with the P substitution). (4) The set of views with a non-pass label never shrinks: every view that is a non-pass in 007 (against G or against P) or in 008 (against G) carries a non-pass label whenever it is displayed, for every recording. Every consequence of a 007 fail is unchanged: v0.4 Failure Criterion 1, the documented methodology review, the Reject template decision, and no per-recording flag shipped for that view. (5) The per-recording "weak for this recording" flag (008 rule 3) may be shown for a view only if the view's joint outcome is pass and 008 rule 3 allows it. (6) While 007 has not run or is not decided, no view has a joint pass: a view whose 008-G outcome is a non-pass carries that 008 label; any other view shows only the measured numbers of 008 rule 5, with no verdict label and no per-recording flag. All displays in (3), (4) and (6), including the measured-numbers-only case, remain subject to every evidence, copy and human-review gate; when a required label or number is withheld, the view it qualifies is also withheld. (7) Gates in other experiments read verdicts, never label strings. 010's Experiment 007 gate is met for axis c only if 007's results JSON gives PCA subset {c} the verdict "pass" against both G and P and no 007/008 mismatch suspension is active; anything else (fail, not evaluable, descriptive only, missing, suspended, or 007 not run) means no label on axis c. 011's S2b reads the joint outcome and its exact label text from the export and fails closed unless Experiments 007 and 008 are both decided (Amendment C26).
  - C03 note for 008. The viewPreservation export block (008:509) carries, per view, the joint outcome, its exact label text, whether the per-recording flag may be shown, and the SHA-256 of the 007 and 008 results files it was built from. During a suspension no view is shown as pass and no per-recording flag is shown; every view that is a non-pass in either experiment's results carries a non-pass label, or is not displayed.
  - Display precedence clarification for 008 (2026-09-29, before any run). C03 (6) and the C03 note for 008 are subject to the closed evidence/template gates and the audited-text requirement of C20. A view whose mandatory non-pass label or measured numbers cannot be shown is withheld entirely. This does not authorize pending or suspended S2b text, or unaudited visitor text.
  - OD-7 effect for 008 (2026-09-30, before any run). Under the 2026-09-30 additions to C03 and C14, a view that is a non-pass in 008 is not displayed to visitors until 007 has run and the 007/008 check has passed. During a suspension, a view that is a non-pass in either experiment is not displayed (of the two choices in the C03 note for 008, "carries a non-pass label, or is not displayed", the second applies), and no other view shows any 008 verdict, label or number (C14 (3)). Research records keep every non-pass outcome.
  - Output field read by Experiment 011 (2026-09-30, before any run). The viewPreservation block also carries, per view V, the boolean noiseNotWeak. It is true if the white-noise signal or the pink-noise signal of the synthetic pipeline checks (seeds 20260720 + 804 and 805; 008:265-267) was not flagged weak for view V (weakForThisRecording = false), and it is also true if either of these results is missing. The exporter copies it from this experiment's results JSON (synthetic[]), with the SHA-256 of that file, like the joint outcome. It is an output only and enters no verdict of this experiment. Experiment 011 reads it for its S2b noise condition (Amendment C26 (4), from 008:411).
- **Addition (2026-09-30, before any run):** Amendment C03 (OD-7). (a) In (7), 010's Experiment 007 gate also needs the 007/008 consistency check of Amendment C14 to have run and to be recorded as passed. Until it has, the gate is not met for any axis. (b) Owner decision OD-7 accepts the stricter reading of C14 (3) (see the 2026-09-30 addition to Amendment C14). So the case of (6) in which a view whose 008-G outcome is a non-pass carries that 008 label applies only after 007 has run and the C14 consistency check has run and passed. Before that, the view is withheld from visitors entirely: no label, no number and no view. The measured-numbers-only case of (6) waits for the same check, as C14 (3) already requires. Every non-pass outcome stays recorded in the research results. (c) The citation in (1) was corrected on 2026-09-30. It read "(pass, fail, not evaluable, descriptive only; 007:335-341)"; "descriptive only" is defined at 007:143 and 007:393, not at 007:335-341. (d) Strictness: (a) and (b) only withhold more, and (c) corrects a citation; no verdict, label text or threshold changes.
- **Supersedes:**
  - 008:307 (Additional checks, consistency with Experiment 007): "While suspended, the viewer shows only the measured numbers (rule 5) with no verdict label" (during a suspension a view that is a non-pass in either experiment's results now carries its non-pass label, or is not displayed; see the C03 note for 008). The suspension itself, and "no per-recording flag", are unchanged.
  - 008:355 (rule 1, joint labelling): "(read from 007's results JSON)", which gave no rule for a missing file (now C03 (6)).
  - 008:375 (rule 3 outcomes): "the view passed rule 1" (now: the view's joint outcome is pass, C03 (5)).
  - 008:418 (Disqualification): "a view that does not pass rule 1" (now: a view whose joint outcome is not pass, C03 (5)).
- **Strictness:** Implements owner decision OD-3: no verdict or threshold changes, the set of labelled non-pass views cannot shrink, and every gate becomes at least as strict as before.
- **Owner approval:** OD-3, Leonard Lind (project owner), 2026-09-29, working session with Claude Code in chat on the Windows PC. OD-7 (the addition of 2026-09-30), Leonard Lind (project owner), 2026-09-30, working session with Claude Code in chat.

### Amendment C06 (2026-09-29, before any run): 008 d95 compared like with like

- **Why:** D95-1, APPR-06, SD-3, XREF-4 and CODE-2: 008 defines d95 with production pca(X, null) but cross-checks it against 007's exact-EVD d95, so a pure method difference could suspend 008's governing verdicts.
- **Change:** Amendment C06 (strict default, pending owner decision). (1) Definition. In this experiment d95 means exactly Experiment 007's definition (007:138): the smallest component count with cumulative explained variance >= 0.95, capped at n - 1, from an exact eigendecomposition (ml-matrix 6.14.0 EVD with assumeSymmetric: true, version verified at run time) of the n x n Gram matrix of standardizeFlat(X). It applies both when d95 is read from 007's results JSON and when 008 computes d95 itself. (2) Like-with-like cross-check. On the first 2 analysed recordings, 008 recomputes d95 by this EVD route. Any difference from 007's value is a 007/008 mismatch, with the consequence of 008:307 unchanged. (3) The pca(X, null) trigger stays exactly as written, not relaxed. On the same 2 recordings, 008 also computes d95 with production pca(X, null); any difference from 007's d95 is also a 007/008 mismatch and suspends as 008:307 states. Until the owner decides otherwise, such a suspension is not lifted because the difference is attributed to unconverged components. (4) The pca(X, null) d95 and its count of non-converged components among the d95 components are reported under a separate key (d95_production), marked "approximate" if any component did not converge. It enters no verdict. (5) When 007's results JSON does not exist when 008 runs, the checks in (2) and (3) are made by the consistency step of Amendment C14. (6) Experiment 009's E95 d95 (009:141) is the production value, a different quantity, and is never compared with this d95.
  - C06 note for 008. This amendment does not change 008:306-307 (the suspension and its trigger stand as written; what the viewer shows during a suspension follows Amendments C03, C14 and C20). The d95 in the results JSON (008:457, `recordings[]`) is the EVD value; the key d95_production is added.
- **Supersedes:**
  - 008:220 (Metrics, d95): "the smallest component count with cumulative EV ≥ 0.95 (`pca(X, null)`)".
  - 008:221: "If 007's JSON does not exist, 008 computes d95 itself" (now by EVD).
  - 008:222: "If any is non-converged, d95 is marked **"approximate"**" (now applies to d95_production).
  - 008:319 (compute plan): "`pca(X, null)` for d95 if 007's value is not available", and 008:323: "this is why d95 is taken from 007 when available" (d95 is now computed by EVD; pca(X, null) runs only on the 2 cross-check recordings).
- **Strictness:** Strict default pending owner decision: it adds a like-with-like check and keeps the pre-committed pca(X, null) trigger and its suspension exactly as written.

### Amendment C07 (2026-09-29, before any run): Provisional Decision-Log IDs

- **Why:** ID-1, APPR-19, SD-11, XREF-21, CODE-22 and INC-4: the notebooks proposed decision IDs in two conflicting ways (by experiment number and by closing order), and 007, 008 and 011 did not say that the owner assigns the final number.
- **Change:** Amendment C07. Provisional Decision-Log IDs, by experiment number and whatever the closing order: Experiment 007 -> D-014; Experiment 008 -> D-015; Experiment 009 -> D-016; Experiment 010 -> D-017; Experiment 011 -> D-018; Experiment 012 Part A -> D-019 (Part B proposes no entry). The final numbers are assigned by the project owner when the rows are added to 07_Decision_Log/Decision_Log.md. Cross-references name the experiment first, for example "Experiment 007's decision (provisionally D-014)". Any later renumbering is a dated entry in the Deviations list, never a rewrite.
- **Supersedes:** 008:5 (header): "IDs are assigned only when results come in, and the order may change if another v2 experiment closes first."
- **Strictness:** Documentation only; no rule or threshold changes, and the owner keeps the final numbering.

### Amendment C08 (2026-09-29, before any run): Seed index conventions are experiment-local

- **Why:** SEED-1 (ids-paths-freeze), APPR-25, SD-7, XREF-22, CODE-21 and SEED-9: demo indices and corpus-level seed meanings differ between notebooks; nothing collides, but the hand-off asked for identical shared definitions.
- **Change:** Amendment C08. Seed index conventions are experiment-local, as 010:231 states. (1) Demo files: r = 900 + d in 007 and 008 (identical, as their exact T_G cross-check needs); r = 60 + d in 009 and 010, on purpose, because 010's assertion that the manifest has fewer than 100 entries (which keeps the V2(c) offsets +100 + r' from overflowing) depends on it; 011 uses a combined internal index with no per-recording seeds (011:257); 012 Part B uses evidence recordings only. (2) Corpus-level seed meanings are defined only by each notebook's own table: for example +703 is 007's observer-cluster bootstrap, 008's split-half agreement bootstrap and unused in 010; the recording-level bootstrap seed is +702 in 007, 008 and 010, +909 in 009, +1104 in 011 and +712 in 012. 010:269's "(the same convention as Experiment 007)" refers to +702 only. (3) No seed value changes. Under Amendment C01, streams are shared between experiments only where a notebook says so: the 007/008 matched Gaussian (+1) and column permutation (+2), both with subStream 0.
- **Supersedes:** none. This is a clarification; the marker "*[Clarified by Amendment C08, 2026-09-29.]*" is placed at 008:106 (demo indices) and 008:287 (seed collision note).
- **Strictness:** Documentation only; no seed, offset or rule changes.

### Amendment C10 (2026-09-29, before any run): Gap-excluded trustworthiness: candidate set excludes the point; exact equality kept

- **Why:** XREF-23, CODE-14, SD-18 and a missed item (MISSED-cross-5): 007's candidate set did not exclude i itself, so the pre-registered "gap 0 equals T" test could not pass, and 008's "T_span = T exactly" could fail on floating-point order alone.
- **Change:** Amendment C10. (1) The candidate set excludes the point itself: E_i = { j != i : |t_i - t_j| >= gap } for T_gap, and E_i = { j != i : |startFrame_i - startFrame_j| >= 7 } for 008's T_span. With gap 0, m_i = n - 1 and the formula equals the standard T. (2) One shared implementation, metrics.gapExcludedTrustworthiness in tools/lib/metrics.js, is used by 007, 008 and 012. It accepts the gap either in seconds on emissionTime or as an integer start-frame predicate, and its tests cover both. (3) Exactness is kept, not loosened. When no pair is excluded (gap 0, or T_span at h >= 7), the function computes T with the same arithmetic in the same summation order as metrics.trustworthiness, so the pre-registered "equals T exactly" assertions hold bit for bit, and the "<= 1e-12" tests hold as well.
  - C10 note for 008. The exact-equality assertions at 008:206 and 008:540 stay as written.
- **Supersedes:**
  - 008:204 (Metrics, T_span): "Eᵢ = { j : windows i and j share no audio sample }" (j ≠ i is now explicit).
  - 008:209: "If 007's implementation exists at run time, 008 uses it." (one shared function, Amendment C11).
- **Strictness:** A definitional correction that makes the pre-registered tests passable without loosening any equality or threshold.

### Amendment C11 (2026-09-29, before any run): Runners use only shared, tested code

- **Why:** XREF-18, APPR-09, CODE-8, SD-18 and a missed item (MISSED-approvals-6): 008 and 012 allowed runner-private fallbacks for code that must match across experiments, and the hand-off's "use only tools/lib/*" sat in tension with the notebooks' use of exported exporter functions.
- **Change:** Amendment C11. (1) Every metric, statistic, surrogate, FFT, bootstrap, eigen-solver wrapper and random-number routine a runner uses lives in tools/lib, or is an exported production function of tools/export_single_recording_dataset.js, and has the unit tests this notebook lists. No runner-private implementation is allowed. "Use only tools/lib/*" means no re-implementation; using the exporter's exported production functions is allowed and required. (2) Runner-private fallbacks are withdrawn (see Supersedes). (3) The exact eigen-solver is ml-matrix 6.14.0, a transitive dependency pinned by package-lock.json, used through a tested tools/lib wrapper; the runner asserts its presence and version at start-up.
- **Supersedes:**
  - 008:209 (Metrics, T_span implementation): "If 007's implementation exists at run time, 008 uses it."
  - 008:240 (observer-cluster bootstrap): "it is implemented in the runner (or added to `metrics.js`) with its own unit test".
  - 008:526 (Reproducibility Notes, Statistics): "(or implemented in the runner)".
- **Strictness:** Removes permissions for private code and adds a version check; nothing is loosened.

### Amendment C12 (2026-09-29, before any run): A skipped unit test counts as not passed

- **Why:** CODE-10: some tests skip silently when the smoke file is missing, and 007:180 said what a failure means but not what a skip means.
- **Change:** Amendment C12. A unit test that is skipped counts as not passed, with the same consequence as a failure. The only exception is a test that is skipped because it is explicitly gated to performance measurement by an environment variable (the performance test in tools/test/metrics.test.js). The runner records the status of every test by its actual name (pass, fail or skip) in the results JSON.
- **Supersedes:** 008:530 (Reproducibility Notes): "Unit tests (in `tools/test/`) that must pass before the run" (a skip now counts as not passed).
- **Strictness:** Only makes the test requirement stricter.

### Amendment C13 (2026-09-29, before any run): One standardisation and one distance definition

- **Why:** SD-8, XREF-24 and a missed item (MISSED-regime-4): 007, 008 and 012 describe the metric spaces with different functions and distances, and 012's text implies z-scoring twice, which is not bitwise idempotent and threatens its <= 1e-12 cross-check.
- **Change:** Amendment C13. (1) Runners pass the unstandardised feature matrix (X, or X_w in 012) to every reducer (pca, reduceFeatures, reduceUmap, reduceTsne, reduceRandomProjection) and to metrics.trustworthiness and metrics.continuity, which z-score the original space internally; metrics.makeRankContext is called with { standardize: true } (its default is false). Each z-scores once internally (population SD; a zero-SD column is divided by 1). No runner pre-standardises. (2) Original space: the z-scored matrix, squared Euclidean distance. Embedded space: squared Euclidean distance on the embedding as given, as the code computes it. Ties go to the lower row index. (3) A unit test asserts that metrics.standardize, reducers.standardize and reducers.standardizeFlat give bitwise-identical output on a fixed fixture. 007's start-up assertion (<= 1e-12, 007:114) stays.
- **Supersedes:** none. 008:115 and 008:196 are consistent with this rule; the unit test in (3) is added to this notebook's list of tests that must pass before the run (marker at 008:530).
- **Strictness:** Clarifies definitions to match the code and adds a test; no threshold or cross-check tolerance changes.

### Amendment C14 (2026-09-29, before any run): Cross-checks do not depend on run order

- **Why:** XREF-5 and a missed item (MISSED-ids-2): 008 and 012 run their 007 cross-checks only if 007's JSON already exists, and 007 checks nothing the other way, so running 008 or 012 first would silently skip the checks.
- **Change:** Amendment C14. (1) The 007/008 consistency check (008:306) and the 007 / 012 Part B W15 cross-check (012:333) are run by whichever experiment finishes second, and also by a separate consistency-check script in tools/experiments that runs as soon as both results JSON files exist; that script is frozen with the later experiment. (2) At the end of its run, 007 performs the same checks against 008's and 012's results JSON if they exist. (3) No verdict, label or number of 007, 008 or 012 Part B reaches the viewer, an export, the Decision Log or an Experiment 011 evidence block before the check between the two has been run and recorded as passed. A 007/008 mismatch suspends as 008:307 states. A 012 Part B mismatch is flagged and escalated as 012:333 states, and 012 Part B numbers are not quoted until it is resolved. Every available non-pass outcome remains recorded in the research results. Until the check has passed, no view is shown as pass and no per-recording flag or positive wording is shown. A non-pass view may be displayed to visitors only when its required non-pass label and measured numbers also pass all existing evidence, copy and human-review gates; otherwise the whole view is withheld. This supplies no exception to an undecided, suspended or otherwise closed evidence status or template gate. (4) 008's joint label (Amendment C03) is computed only when 007's results JSON exists. (5) 012 Part A and Part B may be run as separate invocations of the same runner, each writing its own block (partA, partB) with its own run metadata into the one results JSON. Part A does not depend on 007.
- **Addition (2026-09-30, before any run):** Amendment C14 (OD-7). (a) In (3), "the check between the two" means the consistency check of (1) and (2) for that pair of experiments (007 and 008, or 007 and 012 Part B). It counts as passed only when it has run on both results files and been recorded as passed. (b) Owner decision OD-7 accepts the stricter reading of (3). A view that is a non-pass in 008 stays fully withheld from visitors until 007 has run and the 007/008 check has passed. It is not shown with its non-pass label in the meantime. The sentence of (3) that lets a non-pass view be displayed with its required label and measured numbers applies only after that check has passed, and then only under every gate it names. Research records keep every non-pass outcome. (c) Decoder identity. Each check of (1) and (2) records, for both runs, the ffmpeg and ffprobe version strings and the SHA-256 of both binaries, as the two results JSON files give them. A cross-check is valid only if both runs used the same ffmpeg binary and the same ffprobe binary (equal SHA-256 values). Otherwise it is reported as "not comparable". A check that is not comparable does not count as passed, so every verdict, label, number and view that waits for it stays withheld. (d) Strictness: (a) to (c) only withhold more; no tolerance changes.
- **Supersedes:** 008:306 (Additional checks, consistency with Experiment 007): "if Experiment 007's results JSON exists when 008 runs".
- **Strictness:** Only adds checks and holds results back until they pass; no tolerance changes.
- **Owner approval:** OD-7 (the addition of 2026-09-30), Leonard Lind (project owner), 2026-09-30, working session with Claude Code in chat.

### Amendment C16 (2026-09-29, before any run): The lambda-4 probe's convergence is not reported

- **Why:** CODE-15: pca() keeps only the eigenvalue of the lambda-4 probe, so 007:283's request to log its converged flag cannot be met and lambda-4 ratios have unknown accuracy.
- **Change:** Amendment C16. tools/lib/reducers.js pca() returns only the eigenvalue of the lambda-4 probe, not its iterations, residual or converged flag. Unless pca() and app/src/analysis/pca.ts are extended in lockstep to return these (keeping the bit-identical Node/browser parity test green), every lambda-4-based quantity (007: the nextEigenvalueRatio of component 3; 008: lambda-4 / lambda-3 in the eigen-gap stratification) is marked "approximate (probe convergence not reported)", and 007's request to log the probe's converged flag is recorded as "not available". Neither quantity enters any gate.
- **Supersedes:** 008:179 (split-half, component-identity caveat): "The eigen-gap ratios λ₂/λ₁, λ₃/λ₂ and λ₄/λ₃ (from `pca()` `nextEigenvalueRatio`)" (λ₄/λ₃ is now marked approximate).
- **Strictness:** Adds a reporting caveat; no gate or threshold changes.

### Amendment C17 (2026-09-29, before any run): Exposure disclosure: the 010 front-end pre-count

- **Why:** SD-16 and a missed item (MISSED-ids-5): 007 said it was unknown whether evidence recordings went through the production front end, but 010 records that a front-end-only pass was run on every manifest file.
- **Change:** Amendment C17. Disclosure: 010:355-366 records a structural pre-count made on 2026-09-29. 010:355 says, word for word: "A scratch script decoded every manifest entry with `readFullAudio` (ffmpeg via `tools/lib/ffbin.js`) and ran only `computeContinuousFrontEnd` (STFT, points, amplitude filter). It computed n, minShift and D for the full recordings, the 2 s and 4 s halves (straddlers excluded) and the mismatched pairs. **No PCA, descriptor, correlation or null was computed on corpus data, so no outcome of this experiment was seen.**" What that pass computed on corpus data: 010:355 names n, minShift and D, and n is counted after the amplitude filter, which needs each window's RMS and the filter threshold. By the code of computeContinuousFrontEnd (tools/export_single_recording_dataset.js, read 2026-09-29), each call also computes internally the STFT spectra, the per-frame spectral flux, the per-frame series of analyzeFrames (centroid, bandwidth, rolloff, flatness, crest, entropy, slope, RMS, zero-crossing rate) and each window's feature vector. 010 does not record that any of these internal values was printed or used. 010:357-366 gives the resulting counts. This amendment claims nothing about corpus data beyond what 010:355-366 and that code state. Development exposure on the smoke/demo file is disclosed at 007:97-101 and 008:37. The owner's statement at 007's freeze (007:485) must cover this pre-count.
- **Supersedes:** none. This is a disclosure; the marker "*[Clarified by Amendment C17, 2026-09-29.]*" is placed at 008:37 (smoke value) and 008:103 (manifest counts).
- **Strictness:** Adds disclosure only.

### Amendment C20 (2026-09-29, before any run): Visitor-facing strings only as audited text

- **Why:** XREF-12 and a missed item (MISSED-cross-4): 008's view labels, 010's axis captions and 012's user caveats are visitor text outside 011's closed set, and 010 left their translation to the viewer, against the recorded consequence that nothing is shown before human review.
- **Change:** Amendment C20. (1) Every visitor-facing string pre-committed by 008 (the rule 1 labels, the rule 5 tooltip), by 010 (the caption templates, the not-validated text, the None text and the labels-disabled statement) and by 012 (the codec-smearing caveat, 012:238) is shown to visitors only as audited text: it is added as a template to 011's closed set by a dated 011 amendment before the 011 run that audits it, and it passes A1 to A6 with the human checks of Amendment C04 in the language shown. Until then it is not shown to visitors. Until such a string is audited, the view, numbers, loadings picture or compare-mode feature it must accompany is not shown to visitors either; withholding a caveat or non-pass label never leaves what it qualifies on screen without it. (2) Nothing is translated by the viewer; ES and PT versions exist only as audited templates. (3) 012's development-build caveat (012:481, as amended by C05) is shown only in development or internal preview builds, as 012:481 allows, and never to visitors in production.
- **Addition (2026-09-30, before any run):** Amendment C20. (a) The strings of (1) also include 008's "not yet measured" text (008:393, rule 4, fallback F2), which the viewer shows for a recording whose flag is deferred. It is audited under 011 and displayed under (1), like the other strings of (1). (b) A template added to 011's closed set after 011's freeze is a change after the freeze under Amendment C02 (6). It needs a new owner-approved freeze (Amendment C02, addition of 2026-09-30) and a full audit run of that template, with A1 to A6, the controls and a new human review, before it is shown. Where 011:327 requires the entire audit to be re-run, that rule is unchanged. (c) Strictness: more text is withheld until audited, and nothing is loosened.
- **Supersedes:** none. 008:346 "(exact text, passed to Experiment 011)" and 008:410 are consistent with this rule; the display condition is added (markers at 008:346 and 008:410).
- **Strictness:** Only withholds text until it is audited; no pre-committed wording or gate is widened.

### Amendment C25 (2026-09-29, before any run): S2a shown only with the view's trust numbers; one percent definition

- **Why:** SD-5, XREF-8, XREF-25 and a missed item (MISSED-regime-2): 008 rule 5 requires the kept-variation percent, T and the control reference with the margin to be shown together, but 011 shows S2a alone, has no template for T, and computes the percent differently from 008.
- **Change:** Amendment C25. (1) 011 adds template S2c to its closed set. Facts: T <- viewPreservation[view A].trustworthinessK5; T_G <- controlTrustworthinessK5; margin <- marginK5 (signed); each to 2 decimals by 011's rounding rule. Gates: G2c.1 evidence.exp008.status = decided (Amendment C24 statuses fail closed); G2c.2 the viewPreservation block of this recording is present, not "deferred", and view A's three values are finite; G2c.3 runtime toggle = A. A second sentence of S2c states, without numbers, that moments sharing audio with each other count as close (008:403). No draft wording is given; the final wording is fixed and hashed before the run that audits it, and it may not use "neighbour*" or "trustworthiness" (011:222). (2) New gate G2a.4: S2a is shown only while S2c for the same view is shown; otherwise S2a is omitted and listed with G2a.4 in omitted[]. (3) One percent definition: the "keeps X%" number that 008's viewer shows is 011's ev[A], computed and rounded by 011's canonical rule (011:164, and the "under 1%" variant only when ev > 0), and every other number 008 rule 5 shows uses 011's rounding and formatting rule (011:156-170). (4) The row-count bounds at 011:240 are superseded by the same formula with the S2c variants added and S2a gated on S2c; the runner logs the formula's inputs and outputs.
- **Supersedes:**
  - 008:397 (rule 5): "X = EV_V × 100, rounded to the nearest integer, shown as "<1%" if EV_V < 0.005".
  - 008:398-399 (rule 5): "2 decimals" for T, for the control T and for the margin (now by 011's rounding rule).
- **Strictness:** Adds a gate, a template that states only measured numbers, and one shared rounding rule; nothing is shown that was not shown before without its reference.

### Amendment C28 (2026-09-29, before any run): 008 factual corrections

- **Why:** ID-2, STALE-3, APPR-24, SD-9, CODE-16, INC-2, XREF-20, SD-15 and XREF-3: 008 lists the wrong evidence for D-010, quotes 007 text that no longer exists, cites stale code lines, calls its CI tie rule the Experiment 001 tie band, and allows a bird-specific claim that 007 never permits.
- **Change:** Amendment C28. (1) D-010's evidence is Experiments 001, 003 and 006 (Decision_Log.md); the regime disclosure still holds. (2) Experiment 007 v2 no longer says "100 iterations per component"; 007:125 describes the tolerance-based iteration (1e-10 or 5000), matching the code. This stated reason to expect a 007/008 mismatch no longer applies; the exact-match check and its suspension rule are unchanged. (3) metrics.randomMatchedMatrix is at tools/lib/metrics.js lines 529-532. (4) The views-comparison tie rule ("CI lower bound below 0.02 is a tie") is a CI-based rule, stricter than Experiment 001's point-estimate tie band; it keeps its rule and loses that name. (5) No claim of "bird-specific" or "song" structure is made under any outcome. Experiment 007's surrogate gate licenses at most 007:382's wording about the analysed signal. 007's surrogate S tests structure beyond a stationary signal with the same long-term spectrum; it does not test song-specificity (007:231).
- **Supersedes:**
  - 008:12 (regime disclosure): "Experiments 001–004" (for D-010).
  - 008:63 (PR definition, code inspection): "Experiment 007's Method describes "100 iterations per component". That does not match the current code".
  - 008:308 (Additional checks): "007's Method text says "100 iterations per component"".
  - 008:154 (export-time flag, fixed seed): "`tools/lib/metrics.js`, lines 522–525", and 008:313 (F1 exactness): "(`tools/lib/metrics.js`, `randomMatchedMatrix`, lines 522–525)".
  - 008:357 (rule 1, views not ranked): "(the Experiment 001 tie band)".
  - 008:405 (rule 5): "no claim of "bird-specific" or "song" structure, unless Experiment 007's surrogate gate allows it".
  - 008:493 (Discussion, pre-stated limitations): "The surrogate analyses that address whether the structure is song-specific belong to Experiment 007".
- **Strictness:** Factual corrections; the bird/song rule becomes stricter and no threshold changes.

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
  - The surrogate analyses that address whether the structure is song-specific belong to Experiment 007 and are not repeated here. *[Superseded by Amendment C28, 2026-09-29.]*
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
  - The git commit hash and a dirty-tree flag. If the tree is dirty, the SHA-256 of `git diff` is logged. *[Superseded by Amendment C02, 2026-09-29.]*
  - The git blob hashes of `tools/lib/metrics.js`, `tools/lib/reducers.js`, `tools/lib/view_preservation.js`, `tools/lib/synth.js` and `tools/export_single_recording_dataset.js`. *[Superseded by Amendment C02, 2026-09-29.]*
- **Seeds:** the full table in Method, written to the JSON. Base 20260720.
- **Statistics:** `tools/lib/metrics.js` (percentile bootstrap, paired bootstrap, Wilcoxon, Holm, Spearman, type-7 quantiles). B = 2000, α = 0.05. The observer-cluster bootstrap and `gapExcludedTrustworthiness` are not in `metrics.js` as of 2026-09-29 and must be added (or implemented in the runner) *[Superseded by Amendment C11, 2026-09-29.]* with unit tests before the run.
- **Smoke verification of the 30.0% figure (2026-09-29):** a scratch script outside the repo called `readFullAudio` (22050 Hz) and `computeContinuousFrontEnd` on `Assets/smoke/Luscinia_svecica_song.ogg`, then `pca(X, 3)`, giving n = 234 and EV₃ = 0.29952. It is recorded only to document where the motivating number came from.
- **Scratch measurement of the export-time control (2026-09-29, revision author):** a scratch script outside the repo built `metrics.randomMatchedMatrix` of a 700 × 3078 all-zeros matrix with seed 20260720 + 990, ran `pca(·, 3)` (λ₄ probe on), `makeRankContext(·, { standardize: true })` and `trustworthiness(·, ·, 5)` for the 7 views. Iterations 1616 / 5000 (not converged, relative residual 1.23e-9) / 2607; explained-variance ratios 0.00310, 0.00306, 0.00306; T for x, y, z, xy, xz, yz, xyz = 0.5306, 0.5267, 0.5217, 0.5460, 0.5395, 0.5457, 0.5620. Wall-clock 32.8 s for the PCA on an 8-core Apple M2 under a 1-minute load average of 44.3, therefore not a valid timing. Control data only; no real recording was involved. It is recorded only to document the basis of H5 and the rule 5 remark, and is never reported as a result. *[Clarified by Amendment C01, 2026-09-29.]*
- **Label-exclusion code inspection:** date and inspector to be recorded here at run time. *[Clarified by Amendment C02, 2026-09-29: append-only anchor; the date and inspector are written on lines appended directly below this line.]*
- **Unit tests** (in `tools/test/`) that must pass before the run *[Superseded by Amendment C12, 2026-09-29.]* *[Clarified by Amendment C01, 2026-09-29.]* *[Clarified by Amendment C10, 2026-09-29.]* *[Clarified by Amendment C11, 2026-09-29.]* *[Clarified by Amendment C13, 2026-09-29.]* *[Supplemented by Amendment C01, 2026-09-30.]*:
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
  - Seed uniqueness. *[Superseded by Amendment C01, 2026-09-29.]*
- **Revision note (2026-09-29):** revised before any run, after an internal critique. Changes: rule 1 split into pass / inconclusive / fail with exact label texts; control-PCA convergence logging and validity argument; H5 basis corrected to include power iteration, with F1 timed as the expected path and a load check; overlap-regime logging, stratification and T_span; recording-condition confound paragraph with the SNR proxy and the Exp 005 citation; compute plan with subsetting of non-governing extras only; d95 from 007 where available and marked approximate when non-converged; control T and margin always shown next to T; observer-cluster bootstrap sensitivity; no ranking of views; informative-flag prevalence condition; 0.05 EV sensitivity; 007/008 mismatch suspends verdicts; D-008 line and D-004/D-010 regime disclosure; F1 exactness check rebuilt as a separate-process, all-zeros, bitwise test. No pre-registered threshold was loosened.
- **Revision note (2026-09-29, consistency amendments):** 2026-09-29, pre-run consistency amendments C01, C02, C03, C06, C07, C08, C10, C11, C12, C13, C14, C16, C17, C20, C25, C28 after an independent 12-agent audit; no threshold changed; owner decisions OD-1, OD-2, OD-3 applied.
- **Revision note (2026-09-29, later verification rounds, before any run; entry added 2026-09-30):** after the consistency amendments were first written, further verification rounds on 2026-09-29 edited this notebook without a log entry at the time. They changed marker forms ("Supplemented" to "Clarified" where an amendment only clarifies, and one marker per amendment at 008:209 and 008:346), added the C03 marker at 008:307, added the list of amendments recorded in other notebooks to the section introduction, merged the two C01 notes, added C02 (7) with this notebook's anchors and the note on external amendment texts, added the suspension sentence and the display-precedence clarification to the C03 note (with a Supersedes entry for 008:307), reworded the C06 note, and gave every owner-approval line its full attribution. The Change-text synchronizations of that day are listed in the next entry. No threshold, statistic, seed or owner approval changed.
- **Revision note (2026-09-29, resumed-session verification repair, before any run or freeze; moved here from the Deviations list on 2026-09-30):** synchronized the shared Change text of C01, C03, C14, C17, C20 with the existing stricter versions in the other notebooks. Clarified that preserving a non-pass outcome never bypasses evidence, template or human-review gates; a view is withheld if its mandatory label or numbers cannot be shown. In 008 the unfinished, undefined C36 references are resolved by these existing gates. No threshold, statistic, seed or owner approval changed.
- **Revision note (2026-09-30, before any run and before the freeze):** dated additions for owner decisions OD-6 (C01), OD-7 (C03 and C14) and OD-8 (C02), with the same text as in the other notebooks. Also: the Status line now matches 007 (no corpus run and no verdict-or-gate arm before the freeze), and the Date line; C01 names tools/lib/reducers.js makeRandom; C03 (7) and C14 (3) name the C14 check explicitly; C14 compares the ffmpeg and ffprobe binaries behind each cross-check; C03 (1) cites 007:143 and 007:393; C20 adds the "not yet measured" text of 008:393 (with a marker there) and the rule for a template added after 011's freeze; the +704 draw procedure; the OD-6 test on the unit-test list; the output field noiseNotWeak; the OD-7 effect on the C03 note; the "Supplemented" definition and the note on dated additions in the section introduction; and the previous entry moved from the Deviations list to this log. No threshold, B value, statistic or seed value changed.

### Freeze record

Amendment C02 defines the freeze. The value fields below are filled in at the freeze; the Deviations list is dated and append-only.

- **Freeze date / commit / sidecar:** not yet frozen.
- **Deviations from the pre-registration:** none yet.
