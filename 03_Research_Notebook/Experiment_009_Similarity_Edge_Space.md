# Experiment 009 — Similarity-Edge Space: In Which Space Should "Lines Between Moments That Sound Alike" Be Computed?

**Date:** 2026-09-29 (pre-registration written, and revised the same day after an internal critique, including pre-run Amendment A1, which awaits owner sign-off; run date to be filled in at run time)
**Work Package:** WP3 (Embedding Benchmark) / WP5 (visual-claim validation), v2.0 track
**Related Decision Log ID(s):** D-004 (PCA), D-006 (negative controls), D-010 (raw spectrograms), D-005 (Rule 001), D-008 (no individual-bird claims), D-011 (Rule 002: benchmark plan before implementation). Proposed new entry: **D-016 — Similarity-edge space and parameters (production regime, within-recording)**. The number is provisional: Experiment 007 → D-014, Experiment 008 → D-015, this experiment → D-016, which is also the order Experiment 011 assumes. The owner assigns the final number when results come in. In this document "D-016" always means this proposed entry.
**Status:** Pre-registered, not yet run

**Scientific Hierarchy level:** Frame (`01_Master_Framework/v0.4_Final.md`, Scientific Hierarchy, line ~328). Each point is one 0.15 s nominal window of 6 consecutive STFT frames. Nothing is segmented. An edge joins two frame-level windows. No result here may be described as a relation between syllables, phrases or songs. The synthetic motif segments below are ground-truth labels of a test fixture, not a segmentation of real song.

**No individual-bird claims (D-008).** No result here supports any claim about individual birds, their repertoire, or "the bird repeats itself". A recording is not evidence of a single individual or even a single source (Corpus_v2.md, "Known biases and limits"), and no individual-level ground truth exists.

⸻

## Question

**Within one recording, under the production regime (PR), in which feature space do k-nearest-neighbour "similarity edges" (excluding temporally close candidates) join windows of the same known sound type more often than chance? Which space does this best: the 3D PCA view (E3, what ships), auto-95 PCA (E95), the full standardised 3078-d feature (EF), or cosine on the unstandardised log1p feature (EFc)? And are the shipped constants (k = 3, gap = 1.5 s) justified?**

A real "no" is available, and each form of it is a legitimate outcome:

1. No candidate beats chance by the required margin on synthetic ground truth. The edges then carry no validated meaning.
2. A negative control is not at chance. The metric or pipeline is then broken.
3. The shipped space (E3) loses to another space outside the tie band.
4. Another (k, gap) setting beats the shipped constants by the required margin.

### Why this experiment exists (evidence gap)

- **Core Philosophy** (v0.4, line ~157): "If a connection exists, it represents a meaningful relationship." The **visual channel convention** (line ~168) reserves **Edges → temporal adjacency**, and "any departure from this convention requires its own data justification." Similarity edges are exactly such a departure. **No experiment has ever provided that justification.**
- What ships today (`tools/export_single_recording_dataset.js`, `buildSimilarityEdges`, read on 2026-09-29):
  - Each point is linked to its `SIMILARITY_NEIGHBORS = 3` nearest points by Euclidean distance in the **3D PCA positions**, after the uniform `POSITION_SPREAD` scaling. The scaling does not change the neighbour order.
  - Candidates with |Δ emissionTime| < `SIMILARITY_MIN_TIME_GAP_SECONDS = 1.5` s are excluded.
  - Pairs are deduplicated into an undirected edge list `similarityEdges`.
- **Both constants are undocumented design choices.** The code comment says the time-gap exclusion exists because overlapping windows are "trivially near-identical". That motivation is sound, but the value 1.5 s is not derived or tested anywhere, and neither is k = 3.
- **The 3D space is not obviously the right one.** Experiment 001's only raw-spectrogram 3D PCA figure retained 0.2422 explained variance. That was a different regime: 22 rows, 1 s windows, 16 kHz. It is quoted only to show that a 3D shadow can discard most of the variance. It is **not** a measurement of PR.
- **Inherited decisions, not re-validated here.** D-004 (PCA) and D-010 (raw spectrograms) were adopted on evidence from Experiments 001–006. Those used different regimes: 16 kHz audio, 1 s rows, and detection- or loudest-window rows. PR itself (22050 Hz, 0.16 s continuous windows, the 20% RMS filter) inherits both decisions without having been benchmarked on them. This experiment **conditions on D-004 and D-010 and does not re-validate them.** Reducer evidence at the PR level is Experiment 007's job.
- **The current wording overclaims.** The exporter comment says an edge means "these two moments sound alike". That is a perceptual claim, and nothing in this project has tested perception (see "Claim wording" below).
- **Literature:** nothing in `04_Literature/Literature_Database.md` addresses how to choose the space or the metric for within-recording nearest-neighbour links between spectrogram windows. This experiment therefore has **no literature prior** for any candidate. In particular, no source in the database supports or opposes cosine distance for this use. EFc is included as a commonly used alternative with no stated prior, and no citation is claimed for it.

### Production regime (PR), verbatim definition used by this experiment

What `tools/export_single_recording_dataset.js` does today:

- **Decoding:** mono at 22050 Hz.
- **STFT:** Hamming window 1024, hop 512 (≈ 23.2 ms). There is no centre padding: frame f covers samples [512·f, 512·f + 1024), as in `stft()`.
- **Points:** windows of 6 consecutive frames (nominal 0.15 s; the actual span is 3584 samples = **0.1625 s**) every 2 frames (≈ 0.046 s).
  - The hop widens (`pointHopFrames = max(2, ceil(frames / 700))`), so a recording yields at most 700 windows before the amplitude filter.
  - `emissionTime` = window **start** = startFrame · 512 / 22050.
  - Window **centre** = emissionTime + 1792 / 22050 s (+ 0.081270 s).
- **Feature:** frame-major 6 × 513 log1p magnitude, 3078 dims.
- **Amplitude filter:** the quietest 20% of windows by RMS are dropped. The threshold is the sorted RMS at index `floor(0.2·(N−1))`, and windows at or above it are kept.
- **Reduction:** per-recording z-scoring, then PCA.
- **Similarity edges:** k = 3 nearest neighbours in the 3D PCA positions, excluding candidates less than 1.5 s apart.

The runner must obtain features **through the production code path**: `computeContinuousFrontEnd` / `runContinuousSamplingPipelineOnSamples` from `tools/export_single_recording_dataset.js`, and production `pca()` from `tools/lib/reducers.js`. It must not re-implement them. See the parity check in Method.

### Claim wording (pre-stated now, binding on Experiment 011 and on the viewer)

- **What an edge claims:** an edge claims **"these two moments have similar spectrograms"**. Here "spectrogram" means the D-010 feature: the log1p STFT magnitude over the 0.16 s window, compared in the winning space.
- **What it does not claim:** it does **NOT** claim perceptual similarity ("sound alike", "the bird repeats itself", "same note"). No listener or perceptual test exists in this project, and this experiment does not provide one. A synthetic motif match is also a spectrogram match, not a perception.
- **Qualifier for reduced spaces:** if the winner is E3 or E95, the text must add "in the reduced (3-axis / auto-95) view of the spectrogram". It must also report that view's recall@k against EF on the real corpus (defined below), so the reader knows how much of the full-space neighbourhood the drawn edges keep.
- **Experiment 011 must use this meaning.** Any per-sound or per-edge text it generates may only say that two moments have similar spectrograms (in the stated space), with the synthetic precision and real-corpus stability figures from this experiment as the evidence.
- **This rule is independent of the result.** Perceptual wording is not licensed by any result here or in Experiment 007, because neither measures perception. The exporter comment ("sound alike") and any viewer copy should be updated accordingly. That change belongs to whoever owns those files, not to this experiment.
- **Consistency with the other v2 pre-registrations (open items; must be closed before either experiment runs).** The files were re-read on 2026-09-29 while this revision was written. They are being edited in parallel, so the line numbers are approximate and the quoted text is authoritative.
  - *Experiment 007.* An earlier draft (line ~285 at the time of the critique) allowed "sound alike" wording if PCA-3D passed its T_gap check. The current text (Pre-Committed Decision Rule, "Secondary claim gates", *Similarity-edge wording*, lines ~383–386) no longer does. It says "**No outcome of this experiment permits perceptual wording** such as 'these two moments sound alike'". Its default wording is "closest in this 3D projection", upgradeable to at most "similar spectrogram content (in the analysed feature space)". **Open item 1:** the owner of Experiment 007 confirms, before either experiment runs, that this is the final pre-registered text. The confirmation is recorded in Reproducibility Notes. Until then the conflict is treated as unresolved.
  - *Experiment 011.* Template S7 (line ~192, G7.3 "Most-restrictive rule") still reads: "'sound alike' is allowed only if Experiment 007's T_gap gate passed; otherwise 'closest in this 3D picture'". That branch contradicts both this section and the current Experiment 007 text. **Open item 2:** the owner of Experiment 011 amends S7, before any of 007, 009 or 011 runs, to drop the perceptual branch. This experiment does not edit that file.
  - *How the two wording rules combine.* Experiment 009 licenses at most "these two moments have similar spectrograms (in space W)". Experiment 007 licenses at most "similar spectrogram content (in the analysed feature space)" for PCA-3D edges, and only if its own gate passes. Where both apply, the more restrictive wording is used, as Experiment 011's most-restrictive rule intends. Neither experiment can widen the other's licence.
  - *Name collision.* Experiment 007's metric "EF" (edge fidelity) is unrelated to this experiment's candidate **EF** (full standardised feature space). The results JSON uses the key `candidate_EF` to avoid confusion.

## Hypothesis

Each hypothesis is stated so that it can turn out to be wrong. There is no literature prior (see above). The expectations come only from how the synthetic fixture is built and from the arithmetic of PR windows.

- **H1 (full space beats chance):** at SNR 15 dB, EF passes the candidate pass rule: its precision beats chance by ≥ 0.10, and both negative controls are at chance.
  - Basis: the five `motifSequence` types in `tools/lib/synth.js` differ by construction in frequency content and modulation. They are a steady 3000 Hz tone, a 3500 ± 700 Hz 20 Hz FM trill, 3750–6250 Hz band noise, a 2500 → 4000 Hz two-note, and a 2000 → 5000 Hz chirp, each with only ±3% pitch jitter. The full log1p spectrogram should therefore place same-type windows closer than different-type windows.
  - Falsified if EF fails the pass rule at 15 dB.
- **H2 (3D shadow loses precision):** E3's median precision at 15 dB is lower than EF's by at least the tie band (0.02).
  - Basis: a 3-component projection discards variance (see the evidence gap). There is no numeric prediction.
  - Falsified if E3 ties or beats EF.
  - The competing expectation is held as plausible: PCA may *denoise*, because the leading components may capture the motif contrast while discarding background-noise dimensions. E3 could then match or beat EF, especially at 6 dB.
- **H3 (edge preservation on real audio):** on the real corpus, E3's recall@3 against EF edges is well below 1. The shipped 3D edges would then be mostly different edges from those the full space would draw.
  - No numeric prediction is made. The value is reported, not tested against a threshold.
- **H4 (controls):** for every candidate, matched-Gaussian features (a) and shuffled motif labels (b) give a per-seed excess over chance that is consistent with 0. This is the governing check of Amendment A1: the paired-bootstrap 95% CI of median_r(P_ctrl,r − c_r) contains 0.
  - Both controls are expected at chance **by construction**. For (a), G's rows are i.i.d. and independent of labels and time, so the neighbour graph ignores the labels. For (b), the shuffle breaks any link between the real graph and the labels. Any edge graph that ignores the labels sits at chance in expectation.
  - (a) and (b) are therefore **machinery checks**. They test the scorer, the chance draws and the label plumbing. They do **not** test whether edges mean anything; only the positive control (Step 1 conditions 1–2) does that.
  - Falsification here would mean the precision or chance machinery is broken, not that a candidate is good or bad.
- **H5 (constants):** no (k, gap) setting beats the shipped (3, 1.5 s) by > 0.05 in the winner's precision at 15 dB.
  - Precision is expected to rise as k falls, because only the single best match is kept at k = 1. That is why the parameter rule below also requires that coverage not collapse.
  - Falsified if the parameter rule selects a non-default setting.

## Method

* **Dataset / subset used:** two parts.

  **(A) Synthetic ground truth (positive control; governs the decision).**
  - Generator: `tools/lib/synth.js` `motifSequence`, with its own defaults: all 5 motif types (`whistle`, `trill`, `buzz`, `twoNote`, `upsweep`), pitchJitter 0.03, durationJitter 0.1, levelJitterDb 3, gapSecondsRange [0.15, 0.4] s, leadSeconds 0.25, rampSeconds 0.01, rms 0.1. Every instance is scaled to the same nominal RMS and then level-jittered, so motif type is not confounded with loudness (synth.js comment).
  - Settings: `durationSeconds = 30`, `sampleRate = 22050`.
  - **20 seeds × 3 SNR levels (30, 15, 6 dB)** = 60 synthetic recordings.
    - Synthetic index j = 0 … 19 uses recording index r = 500 + j, so signal seed = 20260720 + 1000·(500 + j) + 0.
    - synth.js draws the background from a separate stream derived from the same seed. The three SNR versions of seed j therefore share **the identical clean signal**, and SNR comparisons are paired by seed.
  - **Design check (fixture geometry, not a result; to be regenerated by the runner).** On 2026-09-29, seeds j = 0 and 1 were pushed through `computeContinuousFrontEnd` by a throwaway script that was **not** committed, so its output cannot be re-verified from the repo. No edges or precision were computed. The counts are quoted only to size the design, and **every one is to be regenerated by the runner** (`design_check` block, every seed and SNR):
    - 1290 STFT frames, `framesPerPoint` 6, `pointHopFrames` 2;
    - 643 windows before the amplitude filter and 515 after it;
    - 50 motif segments, 10 per type;
    - the longest segment is 0.383 s (by construction it can be at most 0.35 · 1.1 = 0.385 s);
    - 179–185 of the 515 kept windows are "background", and 54–78 windows fall in each motif type.
    - The critic's independent scratch run (2026-09-29, not an experiment result) reproduced 515 kept windows, 330 labelled and 185 background for seed j = 0 at 15 dB.
    - The runner re-derives and logs these counts for every seed and SNR. It also logs whether the *set* of kept window times is identical across the three SNR levels of a seed. The count n can match while the amplitude filter keeps different windows.
  - **Point label:** the `label` of the motif segment with `start ≤ centre < end`, where centre is the window centre in seconds. A window with no such segment is labelled **"background"**. Segment times come from synth.js and are exact to the sample.

  **(B) Real corpus (no ground truth; report only, plus the tie-break input).**
  - Source: `manifest_v2_corpus.json` (see `03_Research_Notebook/Corpus_v2.md`). It is a **new corpus**, and results are new experiments, not reproductions of Experiments 001–006. Final counts are filled in at run time from the manifest and logged with its SHA-256.
  - At the time of writing, Corpus_v2.md reports 60 iNaturalist evidence recordings (12 species × 5, sound licences CC0 / CC BY / CC BY-SA) plus 2 Wikimedia Commons Bluethroat demo files.
  - Recording index r = the 0-based position in `recordings[]` (r = 0 … 59). The two `demo[]` entries use r = 60 + d.
  - **Aggregates are computed over the evidence recordings only.** The two demo files are reported per recording in a separate `demo` block, because Corpus_v2.md states they "are **not** part of the evidence set".
  - **Pre-stated exclusion rule** (identical to Experiment 007, so that the analysed sets match): a recording is excluded from all arms if it fails to decode or yields fewer than **100** points after the amplitude filter.
    - By PR arithmetic (at least 124 windows are needed, i.e. ≥ 129536 samples), clips shorter than about 5.87 s fall below 100 points. This is derived, not measured.
    - Corpus_v2.md lists per-species duration minima of 5.5, 5.7 and 5.7 s, so at least those recordings are expected to be excluded. The exact list goes to `exclusions[]` with reasons. There are no silent drops.
  - **Species labels are not used anywhere in this experiment,** not even afterwards for inspection.
  - **Confounds on the real corpus (pre-stated; these limit what S and recall@k can mean).** None of the following is controlled, and each can drive S and recall@k independently of bird song:
    1. **Recording condition:** device, microphone distance, habitat and reverberation (the v0.4 Scientific Assumptions confound; Experiment 005 found device and recording-condition fingerprinting).
    2. **Per-recording SNR.** It is unknown, because there is no clean reference. The runner logs a **pre-defined proxy**, the kept-vs-dropped RMS ratio: 20·log10(median RMS of kept windows / median RMS of dropped windows), in dB. The RMS is the same one the amplitude filter uses. It is a proxy for "how far the kept windows stand above the quietest 20%", not a calibrated SNR. If no window is dropped, it is logged as `null`.
    3. **Background sources:** other species, insects, wind, rain, traffic and other anthropogenic noise (Corpus_v2.md, "Known biases and limits").
    4. **Codec and source bandwidth:** mixed codecs, and source sample rates whose Nyquist is below 11025 Hz. Upsampling such a file to 22050 Hz leaves the top bins empty or filled with resampler artefacts. The runner logs, per recording, the source codec, the source sample rate and the channel count (from `FFPROBE` via `tools/lib/ffbin.js`), and a flag `sourceNyquistBelowPR` = (source sample rate < 22050 Hz). Counts per flag are reported. As a non-governing sensitivity, medians of S and recall@k are also reported with the flagged recordings excluded.
    - **Consequences.** Edges on real audio can join non-target sounds, for example two windows of the same wind gust or of a second species. S and recall@k measure only the **robustness** of spectrogram neighbours to a grid-phase shift, and the **agreement** of the drawn neighbours with full-space neighbours. **No bird-song, repertoire or individual-level reading follows from them** (D-008). S and recall@k are reported, not tested, against the SNR proxy (Spearman, secondary family), so a reader can see whether they track recording quality.

* **Procedure (order of operations; each step must finish before the next starts).** The details follow in the bullets below.
  1. Owner sign-off of Amendment A1, and closure of open items 1–2 (Claim wording), are recorded in Reproducibility Notes.
  2. The unit tests pass (Reproducibility Notes).
  3. The **calibration test** of the Amendment A1 control check passes. It uses no candidate result: see "Additional pre-registered checks".
  4. The **pilot** runs (compute plan). It prints and stores timings and convergence diagnostics only.
  5. The PR edge parity check and the label-invariance test pass.
  6. Synthetic arm: 60 recordings × 4 candidates × 9 settings, plus controls (a), (b) and (c), chance draws and secondary metrics.
  7. Real arm: G0 and G1 for every analysed evidence recording and the 2 demo files. This gives recall@k, S and nulls, E95 diagnostics and the confound logs.
  8. The E95 exact-eigensolver sensitivity check on its pre-named subset.
  9. The Pre-Committed Decision Rule, applied mechanically by the runner; then the sensitivity analyses.

* **Candidates (edge spaces).** For each candidate, the neighbour search is run on the post-filter feature matrix X (n × 3078) of one recording.

  | ID | Space | Distance | Construction |
  |---|---|---|---|
  | **E3** (shipped) | 3D PCA | Euclidean | production `pca(X, 3)`: z-scored internally, the leading 3 components. The same positions the exporter draws, up to its uniform scale. |
  | **E95** | auto-95 PCA | Euclidean | production `pca(X, null)` **exactly as shipped** in `tools/lib/reducers.js`: power iteration with deflation, `PCA_TOLERANCE` 1e-10 and `PCA_MAX_ITERATIONS` 5000, keeping the smallest component count d95 whose cumulative explained variance is ≥ 0.95 (`PCA_VARIANCE_TARGET`). **Components that hit the iteration cap are used as returned**, because that is what ships. For every E95 fit (real, control and real corpus), d95 and the per-component diagnostics that `pca()` returns are logged: `iterations`, `relativeResidual`, `converged`. The summary logged is the count of unconverged components, the index of the first one, and the worst relative residual. See the E95 exact-eigensolver sensitivity check below. |
  | **EF** | full standardised feature, 3078-d | Euclidean | Z = X z-scored per column (population SD; a zero-SD column gets scale 1, as in `reducers.js` `standardize`). Note: PCA keeping all n − 1 components is a rotation of the centred Z, so E_{n−1} ≡ EF. E3 and E95 are therefore truncations of EF. |
  | **EFc** | full unstandardised log1p feature, 3078-d | cosine distance 1 − ⟨a,b⟩ / (‖a‖‖b‖) | X as produced by PR, not centred or scaled. A zero-norm row (not expected, because log1p of a magnitude ≥ 0 is 0 only for an all-zero window, which the amplitude filter removes) is logged, and its distance to every other row is set to 1. **Floating-point clamp:** 1 − cos can come out slightly negative (of order −1e-16) for near-parallel rows, and `metrics.asDistanceMatrix` throws on any negative entry. Every off-diagonal distance is therefore computed as max(0, 1 − cos), and the diagonal is set to 0. The runner logs, per matrix, the number of clamped entries and the most negative raw value. A raw value below −1e-12 lies beyond the usual first-order rounding bound for a 3078-term dot product (about d·ε = 3078 · 2.2e-16 ≈ 6.8e-13). It is therefore treated as a bug rather than rounding, and it stops the run for investigation. Clamped entries tie at 0, and ties go to the lower index as usual. |

* **Edge construction (identical for every candidate, a generalisation of `buildSimilarityEdges`):**
  1. For each point i, the candidate set is Eᵢ(g) = { j ≠ i : |tᵢ − tⱼ| ≥ g }, where t = emissionTime. All windows have the same span, so start differences equal centre differences. This matches the exporter's `< gap → excluded` test.
  2. Take the k nearest members of Eᵢ(g) in the candidate space. Distance ties go to the **lower row index**. This is the stable-sort convention of the exporter and of `tools/lib/metrics.js` `knn`, which accepts an `excludeWithin` predicate and a precomputed distance matrix, the latter needed for cosine. If |Eᵢ(g)| < k, all of Eᵢ(g) is used and the shortfall is logged.
  3. The **directed list** Nᵢ is kept (it is needed for recall@k).
  4. The **undirected edge set** is formed by adding each {i, j} with j ∈ Nᵢ once. This is exactly what the exporter draws.
  - The edge-construction function receives only (feature or distance matrix, times, k, gap). **It never receives labels** (see label exclusion below).

* **Parameter grid:** k ∈ {1, 3, 5} × gap g ∈ {0.5, 1.5, 3.0} s, giving 9 settings. **Default = (k = 3, g = 1.5 s)**, as shipped. The candidate decision is taken at the default. The grid is used only for the parameter rule and for sensitivity reporting.

* **Gap floor (hard constraint on any gap, in the grid or proposed later): g ≥ window span + one point hop.**
  - At the base hop this is 3584/22050 + 1024/22050 = 0.1625 + 0.0464 = **0.2090 s**.
  - For a recording whose hop has widened, the floor is 0.1625 s + that recording's hop.
  - The longest evidence recording listed in Corpus_v2.md is 104.2 s. That gives 4487 frames, a hop of ceil(4487/700) = 7 frames = 0.1625 s, and a floor of 0.3251 s. So every grid gap (minimum 0.5 s) satisfies the floor for every listed recording. The runner asserts this per recording and logs it.
  - **Why the floor exists (stated before the run):**
    1. **Shared samples.** Two windows whose starts are less than the span (3584 samples) apart share raw audio samples. At a separation of d < 6 frames they share 6 − d whole STFT frames, i.e. identical 513-value blocks. At the base 2-frame hop, grid neighbours share 4 of 6 blocks, which is 2/3 of the 3078-d vector.
       - Such pairs are near each other **by construction of the feature**, not by any acoustic recurrence.
       - An edge between them would redraw the temporal path, which is the temporal-adjacency channel's job under the v0.4 convention, and would inflate precision trivially.
    2. **One extra hop of margin.** The gap test compares floating-point grid times (startFrame · 512 / 22050). The extra hop guarantees at least one full grid step of non-shared audio between any two linkable windows, so a separation that is nominally exactly one span, and could round either way, can never link sample-sharing windows.
  - **What the floor does not do:** it does **not** prevent "the same sustained sound continues" matches. Those are what larger gaps prevent.
  - **Why the grid starts at 0.5 s:** every grid gap exceeds the longest possible motif segment (0.385 s). For every grid setting, **no synthetic edge can join two windows whose centres lie in the same segment**. Precision therefore measures only matches *between different instances*.

* **Metrics used to evaluate.**
  - **Primary (synthetic): edge precision.** Let L = the undirected edges with **both** ends non-background. Precision = |{ {i,j} ∈ L : label(i) = label(j) }| / |L|.
    - If |L| = 0, precision is undefined for that recording and arm. The recording is dropped from that arm only, and this is logged. It is not expected, since about 330 labelled windows exist per recording.
      - **Pairing rule:** every paired comparison (candidate vs chance, candidate vs candidate, setting vs setting, control vs its chance) uses the **intersection** of recordings present in both arms. The intersection size is logged beside each comparison. Unpaired medians use every recording present in that arm, and the n is logged.
    - **Governing statistic:** the median over the 20 seeds at **SNR 15 dB**, at the default (3, 1.5 s).
  - **Chance level (synthetic; permutation, 1000 draws, seed offset +3):**
    - *One draw:* for each point i, sample min(k, |Eᵢ(g)|) members of Eᵢ(g) uniformly without replacement, using a partial Fisher–Yates shuffle over Eᵢ(g) in ascending index order. Build the undirected, deduplicated edge set exactly as above, and compute its precision on the same point set and the same labels.
      - **Implementation by index arithmetic (feasibility; no change to the distribution).** Times are sorted ascending, so Eᵢ(g) is two contiguous index ranges, [0, loᵢ) and [hiᵢ, n). loᵢ and hiᵢ are found once per point and setting by binary search. The partial Fisher–Yates runs over a *virtual* array of length mᵢ = loᵢ + (n − hiᵢ), with position p mapping to index p if p < loᵢ and to hiᵢ + (p − loᵢ) otherwise, and a sparse swap map. Each draw costs O(n·k), not O(n²). A unit test asserts that, for the same random stream, the virtual version returns **exactly** the same draws as a naive version that materialises Eᵢ(g) as an explicit ascending array. The same sampler is used for the stability null.
    - The draws never look at features, so **one set of draws per recording and setting serves every candidate.** Chance depends only on the points, times, labels, k and g.
    - *Per-recording chance:* c_r = mean of the 1000 draw precisions. The per-recording 95% draw interval is the [2.5, 97.5] percentiles (type 7) of the 1000 draw precisions. The Monte Carlo SE of c_r is logged; it is roughly the per-draw SD / √1000.
    - *Chance level C and chance CI:* for draw index b = 1 … 1000, take the median over the 20 seeds of the draw-b precisions. That gives 1000 null medians. **C** = their median, and the **chance CI** = their [2.5, 97.5] percentiles.
      - This is the sampling distribution of the governing statistic **for uniformly drawn edge sets**, i.e. "the median over seeds of one label-independent, uniform edge set per seed". It is the right reference for C in the positive-control pass rule (Step 1 condition 1).
      - It is **not** the sampling distribution of a negative control's statistic. A control's graph is not a uniform edge set. Control (a) is a kNN graph on i.i.d. 3078-d rows, with hubness and mutual pairs. Control (b) keeps the real, possibly concentrated, kNN graph. Their between-seed variance can therefore exceed the uniform-draw variance. The chance CI is **reported** for the controls but does not govern them; Amendment A1 defines the governing control check.
    - *Expected magnitude (a derived approximation, not a result):* if eligible pairs were drawn in proportion to window shares, chance would be about Σ_t w_t², where w_t is type t's share of labelled windows. With 5 roughly equal shares (54–78 windows per type in the design check) that is about 0.2.
      - The approximation ignores two things. First, same-segment pairs are impossible under every grid gap; this removes same-type pairs from the eligible pool and tends to push chance below Σ w_t². Second, the gap and `motifSequence`'s balanced block order make same-type co-occurrence depend on lag.
      - The critic's scratch run (2026-09-29, not an experiment result) gave a uniform-draw mean of 0.197 at (3, 1.5 s) on seed j = 0 at 15 dB, which is consistent with "near 0.2".
      - The pass line C + 0.10 is therefore expected near 0.30. The actual C is whatever the draws give.
  - **Secondary (synthetic, reported and not governing):**
    - *Background-as-wrong precision:* same-label edges / all edges, where an edge with a background end counts as wrong.
    - *Labelled-edge fraction:* |L| / |E|. This shows whether a space routes edges into background.
    - *Hit coverage:* the fraction of labelled points with ≥ 1 incident same-label edge. It is used in the parameter rule.
    - *Pure-window precision:* points are labelled only if the whole window span [start, start + 0.1625 s) lies inside one segment; all other points are treated as background.
    - Edge counts.
    - Directed-list precision (over Nᵢ instead of undirected edges).
  - **Real corpus (no ground truth; report only):**
    - **recall@k of E3, E95 and EFc against EF** (EFc is extra rigor), at every grid setting. The default is headlined.
      - recallᵢ = |Nᵢ^cand ∩ Nᵢ^EF| / |Nᵢ^EF|, averaged over points with non-empty Nᵢ^EF. Computed with `metrics.neighborOverlap`.
      - Also reported: Jaccard, and undirected edge-set recall |E_cand ∩ E_EF| / |E_EF|.
      - *Analytic chance recall:* the mean over i of min(k, |Eᵢ|) / |Eᵢ| (a uniform random list of the same size). It is reported beside each value.
      - This measures how much of the full-space neighbourhood the drawn edges keep. It is an Information Preservation measure (v0.4, line ~374). It is **agreement with a reference, not correctness.**
    - **Edge stability under a 1-frame phase shift of the point grid,** for all 4 candidates at every grid setting.
      - *Shifted grid G1:* the full production pipeline run on `samples.subarray(512)`.
        - Because `stft()` has no padding and a hop of 512, frame f of the trimmed signal is **bit-identical** to frame f + 1 of the original. So G1's windows start 1 frame later than the production grid G0's.
        - G1's times are mapped back to original-signal time by adding 512/22050 s.
        - The whole pipeline is rerun on G1: amplitude filter, z-scoring, PCA refit and edges. A 1-frame shift is therefore a realistic "same audio, different grid phase" perturbation.
        - If `pointHopFrames` differs between G0 and G1 (possible only at the MAX_POINTS boundary), this is logged and the tolerance uses G0's hop.
      - *Matching:* an edge {a, b} of G0 is **preserved** if there is an edge {a′, b′} of G1 with |centre_a − centre_a′| ≤ h and |centre_b − centre_b′| ≤ h, with the ends matched in either order. Here h = one point hop of G0 in seconds (pointHopFrames · 512 / 22050). At the base hop, each G0 window has up to two G1 matches, at ±1 frame = ±0.0232 s, both within h = 0.0464 s.
      - **Stability S** = preserved G0 edges / |E(G0)|. This is the governing form for the tie-break, because G0 is what ships. The reverse direction (G1 → G0) and the mean of both directions are reported as sensitivity checks.
      - **The tolerance is not the same across recordings.** h is one point hop: 0.0464 s at the base hop of 2 frames, and up to 0.1625 s (7 frames) for the longest listed recording (104.2 s). A wider h makes matching easier, so S from recordings with a widened hop is not directly comparable with S at the base hop. S, its null and the analytic chance recall are therefore **also reported stratified by G0's `pointHopFrames`**, with n per stratum. Next to every pooled aggregate, the notebook states the h range it pools.
        - The Step 2 tie-break uses the pooled median, as pre-registered.
        - As a non-governing sensitivity, the tie-break is recomputed on base-hop recordings only. If that would change the Step 2 winner, this is flagged in Discussion and in D-016.
      - *Stability null (extra rigor, seed offset +5):* 1000 random uniform edge draws per grid, built as for chance with the same index-arithmetic sampler, with G1 draws drawn independently of G0 draws. S is computed on each draw pair and the null median is reported. This shows how much "stability" arises from chance under the same matching tolerance.
    - Synthetic recordings also get recall@k and S. These are reported and not governing.
  - **Information Preservation Reporting (v0.4):** explained variance of E3 (per component and total) and d95 with its explained variance, per recording.

* **Negative control type used** (per candidate, at every SNR and grid setting; governing at 15 dB):

  | Control | Construction | Expected | Seed offset | Governing? |
  |---|---|---|---|---|
  | **(a) Matched Gaussian** | Replace X by G = `metrics.randomMatchedMatrix(X, seed)`. This is an exact port of Experiment 001's `randomMatchedMatrix`: LCG 1664525 / 1013904223 mod 2³², Box–Muller cosine branch with u₁ clamped to ≥ 1e-12, row-major, same n × 3078. Times and labels are kept. Every candidate is rebuilt on G: E3 = `pca(G, 3)`; E95 = `pca(G, null)` with G's **own** d95 (the candidate's defining procedure; matched d95 = the real d95 is reported as sensitivity); EF = standardised G; EFc = cosine on raw G. **Caching:** `randomMatchedMatrix` uses only X's shape and the seed, and the seed does not depend on SNR (r = 500 + j), so G is **the same matrix at 30, 15 and 6 dB** whenever n is the same (the runner asserts this). G's PCA fits and distance matrices are computed once per seed and reused across SNRs. The gap-filtered kNN is then rebuilt with each SNR's kept-window times. If those times are also identical (logged; see design check), **control (a) is the same graph at all three SNRs**, and its 30/15/6 dB results are not independent replications. | The paired excess over chance is consistent with 0 (Amendment A1). G's rows are i.i.d., so its neighbour graph is independent of labels and time. Expected precision = chance **by construction**, whatever the candidate. Only the variance can differ, because of hubness, mutual pairs and deduplication. A machinery check, not a test of edge meaning. | **+1** | **Yes** |
  | **(b) Motif labels shuffled across segments** | Real features and real edges. The 50 segment labels are permuted among the segments (Fisher–Yates, `metrics.makeRandom(seed)`), and the segment timings are kept. Point labels are recomputed from the permuted segments; background is unchanged. **Chance under the same shuffled labels**, c_r^(b), re-scores the same offset +3 draws. | The paired excess over chance under the shuffled labels, median_r(P_(b),r − c_r^(b)), is consistent with 0 (Amendment A1). Because every grid gap exceeds the longest segment, every labelled edge joins two different segments, and under a random relabelling its expected same-label probability equals chance, **by construction, for any graph**. The single-shuffle variance grows with how concentrated the graph is on a few segment pairs, so a *better* candidate has a *more variable* (b). A machinery check, not a test of edge meaning. | **+2** | **Yes** |
  | (c) Column-permuted features, extra rigor | `metrics.columnPermutedMatrix(X, seed)`. Each of the 3078 columns is permuted independently across rows. Times and labels are kept. All candidates are rebuilt. | Precision near chance: the rows become exchangeable with respect to labels. | **+4** | No (reported) |

* **Negative control random seed:** base 20260720. Per recording r: seed = 20260720 + 1000·r + offset.

  | Offset | Use |
  |---|---|
  | +0 | synthetic signal seed (synthetic recordings only; r = 500 + j) |
  | +1 | matched-Gaussian matrix (a) |
  | +2 | segment-label shuffle (b) |
  | +3 | chance permutation draws: one stream per recording, consumed in fixed order (settings in grid order k ascending then g ascending; draws b = 0 … 999; points i ascending) |
  | +4 | column permutation (c) |
  | +5 | stability-null draws (G0 draws first, then G1) |

  - **Calibration-test seeds (Amendment A1; pre-run, not experiment data).** Calibration replicate q = 0 … 199 and synthetic seed index j = 0 … 19 use the pseudo-recording index r = 1000 + 20·q + j, i.e. r = 1000 … 4999. Offset +1 is used for the calibration Gaussian matrices, +2 for the calibration label shuffles, and +6 for the random draws that build the calibration graphs for (b). The times and labels come from real synthetic seed j at 15 dB. Its chance draws are the ordinary offset +3 stream of r = 500 + j.
  - **Corpus-level seed:** 20260720 + 909 for every bootstrap, including the Amendment A1 control checks and every calibration replicate. The same seed is used for every CI, so equal-length comparisons share resample index sets.
  - **Collision check:** real r ≤ 61 gives seeds ≤ 20260720 + 61005. Synthetic r = 500 … 519 gives seeds 20260720 + 500000 … 519005. Calibration r = 1000 … 4999 gives seeds 20260720 + 1000001 … 4999006. The value 909 is below 1000 and matches no r·1000 + offset with offset ≤ 6. The runner asserts that all seeds are unique and writes the full seed table to the JSON.
  - Per-recording seeds are shared across SNR levels, candidates and grid settings, so every comparison is paired.

* **Negative control metric name:** per-seed excess of control edge precision over same-label chance, D_r = P_ctrl,r − c_r, summarised as the median over the 20 synthetic seeds (Amendment A1). For (b), c_r is chance under the same shuffled labels. The old comparison, the control's median precision against the uniform-draw chance CI, is still computed and **reported, not governing**.
* **Negative control numeric result:** Pending run.
* **Negative control threshold (Amendment A1, governing):** the paired-bootstrap 95% CI of median_r(D_r) over the 20 independent seeds must **contain 0**. It is computed with `metrics.pairedBootstrapCI(P_ctrl, c, { stat: 'median', B: 2000, seed: 20260720 + 909 })`, and the rule applies to (a) and (b), per candidate, at SNR 15 dB and at the setting under evaluation. α stays at 0.05, as before. **Before the run, the check must pass the calibration test** in "Additional pre-registered checks". If it does not, the pre-stated fallback in Amendment A1 applies.
* **Negative control pass/fail:** Pending run.
* **Label-exposure risk step:**
  - *Synthetic:* `motifSequence` returns `samples` and `segments` in the same object. The risk is that segment labels or timings reach feature extraction, z-scoring, PCA or neighbour search. Only `samples` may enter the pipeline. Labels may enter **only** the precision scorer.
  - *Real:* manifest taxon fields could reach any step. This experiment does not need them at all.
* **Label-exclusion verification:**
  1. **Code inspection before the run,** dated in Reproducibility Notes. The edge-construction function signature takes (matrix or distance matrix, times, k, gap) only. `segments` and manifest taxon fields are read only by the scoring and reporting stages.
  2. **Label-invariance test (extra rigor):**
     - Synthetic seed j = 0 at 15 dB is run twice: once normally, and once with every `segments[].label` / `value` replaced by `"REDACTED"` *before* the edge stage. The SHA-256 of the edge lists of all 4 candidates must be identical.
     - The first analysed real recording is run with all taxon fields of an in-memory manifest copy replaced by `"REDACTED"`. The per-recording result object, metadata excluded, must hash identically.
     - Both hashes are logged. Any mismatch voids the run (Rule 001).

### Additional pre-registered checks (extra rigor)

- **PR edge parity check:**
  - On the smoke recording `Assets/smoke/Luscinia_svecica_song.ogg`, the runner's E3 edges at (3, 1.5 s) must equal the exporter's `similarityEdges` exactly, as sets of index pairs.
  - **Pass-with-note** is allowed only if ≤ 0.5% of edges differ **and** every differing edge is traced to a near-tie in distance (relative difference < 1e-9) caused by the exporter's scaled positions and square root versus the runner's squared distances. Anything else stops the run, because the benchmark would not be measuring what ships.
  - Smoke-test numbers are never reported as results.
- **EF ≡ full-PCA sanity (unit test):** on a seeded 40 × 60 fixture, EF neighbour lists equal those from PCA with all n − 1 components (reference eigendecomposition) to within ties.
- **Chance-machinery test (unit test):** on a fixture where features are pure i.i.d. noise, the mean candidate precision over 200 seeds lies within the Monte Carlo error of the permutation chance.
- **Draw-sampler equivalence (unit test):** the index-arithmetic sampler for chance and stability-null draws returns exactly the same draws as the naive explicit-array partial Fisher–Yates, for the same stream, on a fixture with unequal time gaps, including points near both ends of the recording and a point with |Eᵢ(g)| < k.
- **Cosine clamp (unit test):** the EFc distance builder returns no negative entry on near-parallel rows, counts its clamps correctly, and is accepted by `metrics.asDistanceMatrix`.
- **Calibration test of the governing control check (Amendment A1; pre-run; blocks the run).** It checks that the A1 check "the paired-bootstrap 95% CI of median_r(P_ctrl,r − c_r) over 20 seeds contains 0" accepts about 95% of the time when the machinery is correct. It uses only synthetic times and labels, and Gaussian or constructed graphs. **No candidate is run on real synthetic features, and no candidate precision is computed.** Times, labels and chance draws come from synthetic seeds j = 0 … 19 at 15 dB, at the default setting (3, 1.5 s). Each replicate q = 0 … 199 is one complete 20-seed check, using the seeds defined in the seed table.
  - *(a) Gaussian replicates:* at least **200 replicates × 20 seeds = 4000** independent matched-Gaussian matrices (n × 3078, seed offset +1 of r = 1000 + 20q + j). The candidate kNN graph is built on each, and each replicate records whether the A1 check accepts.
    - Candidates calibrated: **E3** (production `pca(G, 3)`), **EF** and **EFc**.
    - **E95** is calibrated with an exact symmetric eigensolver in place of production power iteration: the EVD of the n × n Gram matrix (`ml-matrix`, the same dependency and run-time version check as in Experiment 007). Its auto-95 subspace is selected with the same 0.95 rule. The reason is cost: the critic's scratch measurement (2026-09-29, not an experiment result) put one production `pca(G, null)` fit at 564 s, and 4000 such fits are infeasible. This substitution is **disclosed**: production-E95's own calibration on (a) is not directly tested. The E95 exact-eigensolver check below measures how far the two E95s' neighbour lists differ.
  - *(b) Label-shuffle replicates:* at least **200 replicates × 20 seeds** of label shuffles (offset +2 of r = 1000 + 20q + j), each scored on **fixed constructed graphs** that span the concentration range. The graphs are built once per seed from true labels and times, with offset +6, and satisfy the gap constraint and k = 3:
    1. **Uniform:** each point's 3 neighbours are drawn uniformly from Eᵢ(g). There is no concentration.
    2. **Oracle, spread:** each labelled point's 3 neighbours are drawn uniformly from its eligible **same-type** points. Precision is 1, spread over many segment pairs.
    3. **Oracle, concentrated (worst case):** each segment is assigned a single partner: the nearest-in-time same-type segment whose windows all satisfy the gap from the segment's windows, with ties going to the earlier segment. Each labelled point's 3 neighbours are drawn from that partner segment's windows only, or from the next same-type segment if the partner has fewer than 3 windows. Precision is 1, and the graph is concentrated on the fewest segment pairs. This is the critic's toy scenario ("every edge within the original type") taken to its extreme.
    - Background points in graphs 2 and 3 take uniform eligible neighbours.
  - **Acceptance criterion for the calibration (pre-stated).** For each of the 7 calibrated combinations (4 candidates for (a), 3 graphs for (b)), the acceptance rate over the 200 replicates must lie in **0.95 ± 3 Monte Carlo SE**. The Monte Carlo SE is √(0.95 · 0.05 / 200) = 0.0154, so the band is **[0.904, 0.996]**.
    - ±3 SE, rather than ±2 SE, keeps the chance that an exactly calibrated check fails at least one of the 7 combinations by Monte Carlo noise alone at about 2% (normal approximation), against about 28% at ±2 SE.
    - If more replicates are run, the band is recomputed from the same formula with the actual count. The count is fixed before the calibration starts.
  - **Joint false-disqualification rate (reported).** For each candidate, the rate at which a correct pipeline wrongly disqualifies it is estimated as 1 − (1 − f_a)(1 − f_b). Here f_a is the candidate's (a) rejection rate, and f_b is the worst (b) rejection rate over the 3 graphs. Independence is assumed because the two fixtures are separate; this assumption is stated. At nominal calibration this is 1 − 0.95² ≈ **0.0975**, so about 10% per candidate. Over 4 candidates, the chance that at least one sound candidate is wrongly disqualified is higher: at most 1 − 0.95⁸ ≈ 0.34 if all 8 checks were independent. They are not independent (shared G per seed, shared shuffles), and the actual rate is unknown. This cost of using two α = 0.05 controls per candidate is accepted and disclosed. It is **not** reduced by changing α, because α is not being changed; see the "control-only disqualification" flag in the Decision Rule.
  - **If the calibration fails:** see Amendment A1, "Pre-stated fallback".
  - The calibration results are written to `calibration` in the results JSON with every per-replicate outcome. They are **pre-run machinery evidence**, not experiment results.
- **E95 exact-eigensolver sensitivity check (reported, not governing, except for the "provisional" flag).** On a **pre-named subset**:
  - synthetic seeds j = 0 … 4 at 15 dB, real features and control (a);
  - the first 5 analysed evidence recordings in manifest order, on G0.
  - On each, E95 is recomputed from the exact EVD of the same Gram matrix (`ml-matrix`, version verified at run time), at production's d95 and at the exact solver's own d95. The runner reports the directed neighbour-list recall of production-E95 against exact-E95 at the default setting (3, 1.5 s), with `metrics.neighborOverlap`, the difference between the two d95 values, and production's convergence diagnostics.
  - **Pre-stated threshold:** if the median directed recall over the subset, at production's d95, is **< 0.95**, the E95 lists are declared materially different. **If E95 is then the Step 2 winner, the verdict is marked "provisional (unconverged E95 eigenvectors)"** in the JSON, the notebook and D-016. The check is then extended to all 20 synthetic seeds at 15 dB and reported. The mechanical verdict is not changed, because the production implementation is what ships. The "provisional" label means the exporter change is not implemented until the owner has reviewed it.
- **Positive-control sanity:** at **SNR 30 dB**, at least one candidate must beat C by ≥ 0.10 (median, default setting). Otherwise the fixture or pipeline is declared suspect, and **no** 15 dB or real-corpus result is interpreted until the cause is found and documented.
- **Compute plan (no silent caps).**
  - *Known cost driver.* Production auto-95 PCA uses power iteration with deflation. The critic measured, in scratch on this machine (2026-09-29; not an experiment result, and not reproduced for this revision), that `pca(randomMatchedMatrix(515 × 3078), null)` took **564 s** and returned d95 = 456. Of those 456 components, 309 hit `PCA_MAX_ITERATIONS` = 5000 without converging, with a worst relative residual of 5.3e-4.
  - *Fits needed:* E95 is needed on G (20 fits, cached across SNRs; see control (a)), on P for control (c) (60 fits), on real synthetic features (60 fits; d95 at 6 dB is unknown and may be high), and on the real corpus for G0 and G1 (2 × the number of analysed evidence recordings plus the 2 demo files, at most 2 × 62 fits, at up to about 700 windows before the amplitude filter and about 560 after it; the Gram cost grows with n², and the iteration cost is unknown in advance). The distance matrices are cheaper, but there are many of them. The calibration test adds 4000 Gaussian kNN graphs with EVD-based E95.
  - **Pilot (covers every arm).** The pilot runs one full unit of every arm:
    - synthetic seed j = 0 at all three SNRs, with real features, (a), (b), (c) and the chance draws;
    - one calibration replicate-seed unit for (a) and (b);
    - the E95 exact-eigensolver check on one recording;
    - **one real-corpus recording, G0 and G1.** This is the first analysed evidence recording in manifest order that reaches the `MAX_POINTS` cap, the largest n PR can produce. If none reaches the cap, it is the one with the most windows.
    - The pilot logs wall-clock time per arm and per E95 fit, together with d95 and convergence diagnostics, and projects the total. **The pilot prints and stores no precision, chance, recall, stability or control values.** Those quantities are computed only as far as timing requires and are discarded. The pilot's timings are the only pilot output used.
  - **Pre-stated fallback if the projection exceeds 24 h** (replacing "the owner decides"). Deferrals are applied in this order, stopping as soon as the projection is ≤ 24 h:
    1. **Control (c)** (non-governing) is deferred for all candidates. It is run after the governing analysis and reported as an addendum.
    2. The **E95 G1 fits on the real corpus** are made conditional. They are computed only if E95 is in the Step 2 tie set, because S for E95 is used only there. This condition is mechanical and pre-stated. E95's recall@k on G0 is still computed for every recording.
    3. The **E95 fits at SNR 30 and 6 dB** (sensitivity only) are deferred to the addendum. The 30 dB positive-control sanity check needs only "at least one candidate", so it is evaluated on E3, EF and EFc and the deferral is stated beside it. If none of them passes, the deferred E95 30 dB fits are run before the check is declared failed.
    4. If the projection still exceeds 24 h, the run continues **beyond 24 h with checkpointing** (resumable per recording and arm). No governing arm is dropped. The total wall-clock time is logged.
    - Deferred arms never feed a verdict retroactively, except as item 3 states. Every deferral is logged in `timing.deferrals`.
  - No other arm or recording may be dropped. Within-recording point subsampling is forbidden, because it would change the regime.

## Pre-Committed Decision Rule

Defined before any data are seen. It is applied mechanically by the runner, and the results JSON stores both the verdicts and every input to each verdict.

**Primary metric:** median over the 20 synthetic seeds of edge precision at **SNR 15 dB**, default setting (k = 3, g = 1.5 s).

**Precision CI:** 95% percentile bootstrap (B = 2000, seed 20260720 + 909) of the median over seeds.

**Step 1 — Pass rule, per candidate c ∈ {E3, E95, EF, EFc}.** c **passes** if and only if all of these hold:
1. (precision CI lower bound) − C ≥ **0.10**; and
2. *(extra rigor, paired; strictly stronger, never looser)* the 95% paired-bootstrap CI lower bound of the median over seeds of (P_c,r − c_r) is ≥ **0.10**; and
3. control (a) behaves for c: the paired-bootstrap 95% CI of median_r(P_(a),r − c_r) contains 0 (Amendment A1); and
4. control (b) behaves for c: the paired-bootstrap 95% CI of median_r(P_(b),r − c_r^(b)) contains 0, where c_r^(b) is chance under the same shuffled labels (Amendment A1).

A candidate failing any condition is **disqualified**, whatever its precision.

- *Reported, not governing:* the pre-amendment comparison, i.e. whether each control's median precision lies inside the uniform-draw chance CI. Any candidate whose pass/fail would differ under it is listed in Discussion.
- *Control-only disqualification flag (non-governing):* if c meets conditions 1–2 but is disqualified only by condition 3 or 4, the notebook and D-016 say so explicitly. They quote the calibrated joint false-disqualification rate for c (about 10% at nominal calibration), and the control's D_r values. The mechanical verdict stands. The flag tells the reader that a spurious control failure is a known possibility.

**Step 2 — Winner, among passers, at the default setting.**
1. The **leader** L = the passer with the highest median precision.
2. The **tie set** = L plus every passer whose median precision differs from L's by **< 0.02** (strictly less, as in Experiment 001). The leader-vs-each-passer paired CI is always reported.
3. If the tie set is {L}, **L wins**.
4. If the tie set has more than one member and **contains EF**, **EF wins** (no extra reduction assumption), **unless** EF's real-corpus phase-shift stability is lower by **> 0.05** than that of the most stable tie-set member. In that case the most stable tie-set member wins.
   - Stability here means the median S over evidence recordings at the default setting.
   - Among members whose stabilities differ by ≤ 0.05, the order in item 5 applies.
5. *(Rule for a case the specification did not cover; stated here, before the run.)* If the tie set has more than one member and **does not contain EF**, the tie-set member with the highest median stability S wins. If the top stabilities are within 0.05 of each other, the preference order is: **E3** (the incumbent: no change to what ships without evidence, D-011) > **E95** > **EFc**.
   - EFc comes last because it adds a second assumption, a different metric on unstandardised features. The rest of the pipeline, including PCA and trustworthiness, is Euclidean on z-scored features.
6. *Background-routing flag (non-governing; stated before the run).* The primary precision counts only edges with both ends labelled, so a candidate that routes many motif windows into edges with a background end pays no penalty in it. Those edges are still drawn in the viewer. After W is chosen, for each other passer c: if W's median **background-as-wrong precision** or median **labelled-edge fraction** (15 dB, default setting) is lower than c's by **> 0.05**, this is recorded in Discussion and in D-016, with the paired CI. The verdict is not changed.
7. *E95 provisional flag:* see the E95 exact-eigensolver sensitivity check.

**Step 3 — Parameters, for the winner W only.** Keep **k = 3, g = 1.5 s** unless another grid setting s qualifies. Setting s qualifies if and only if all of these hold:
1. median P_W(s) − median P_W(default) > **0.05** at SNR 15 dB; and
2. W passes Step 1 at s: C, the chance CI and both controls are recomputed for s; and
3. *(extra rigor; makes a change harder, never easier)* the paired-bootstrap CI lower bound of the median of per-seed [P_W,r(s) − P_W,r(default)] is > 0; and
4. *(extra rigor; makes a change harder, never easier)* W's median hit coverage at s is not lower than at the default by more than 0.05. This blocks a "precision gain" that comes only from drawing far fewer edges, the expected effect of k = 1 (see H5).
5. The gap floor (≥ span + one hop) holds. It holds for the whole grid; this condition binds any future proposal.
6. *(Chance-adjusted; added in revision; makes a change harder, never easier.)* The chance level differs between settings. The gap changes which pairs are eligible, and `motifSequence`'s balanced block order makes same-type co-occurrence depend on lag: adjacent motifs within a block are always of different types. A raw gain can therefore come partly from a shift in chance. So W's **excess over chance** must also improve by more than the same margin: [median P_W(s) − C(s)] − [median P_W(default) − C(default)] > **0.05**, at SNR 15 dB. C(s) is computed for s exactly as C is for the default.
7. *(Chance-adjusted, paired; added in revision; makes a change harder, never easier.)* Let Δ_r = [P_W,r(s) − c_r(s)] − [P_W,r(default) − c_r(default)] per seed. The paired-bootstrap 95% CI lower bound of median_r(Δ_r) must be **> 0**. This is `metrics.pairedBootstrapCI` on the per-seed excesses, with stat median, B = 2000 and seed 20260720 + 909.

**Reported for all 9 settings, beside the precisions:** C(s), the chance CI(s), median c_r(s), and W's median excess over chance, each at 15 dB, and at 30 and 6 dB as sensitivity.

If several settings qualify, choose the one with the highest median P_W. Qualifying settings whose median P_W differs from it by **< 0.02** are tied. Break the tie by higher hit coverage, then by k = 3 before other k, then by the g closest to 1.5 s.

**Outcomes (exhaustive):**

| Case | Pre-committed decision |
|---|---|
| A winner W exists, and the default setting is kept | Edges are computed in W's space with k = 3 and g = 1.5 s. If W ≠ E3, the exporter change is **justified by this experiment** and implemented under D-011. The claim wording follows "Claim wording" above. |
| A winner W exists, and setting s qualifies | As above, but with s. The exporter constants change to s, and this is documented in the new D-016 entry. |
| W = E95 and the E95 exact-eigensolver check finds median directed recall < 0.95 | As the rows above, but the verdict is labelled **"provisional (unconverged E95 eigenvectors)"**. The exporter change waits for owner review of the extended check. |
| No candidate passes Step 1 | **The similarity edges are not validated.** The v2 viewer must not display them by default, and no exported or generated text (Experiment 011) may describe them. This is treated like v0.4 Failure Criterion 1 (structure is not distinguishable from chance) and triggers a **documented methodology review, not a threshold adjustment**. |
| Controls (a) or (b) fail for **every** candidate | The precision or chance machinery is presumed broken, because controls (a) and (b) are both at chance in expectation by construction, and the A1 check was calibrated before the run. The run is **void** and is kept on record. The cause is found, fixed and documented, and the full experiment is rerun from scratch with the same seeds. The void run's numbers are never used for a decision. |
| The 30 dB positive-control sanity check fails | The fixture or pipeline is suspect. Nothing is interpreted (see above). |
| The label-invariance test or the parity check fails | The run is void (Rule 001 violated, or not measuring what ships). |
| The Amendment A1 calibration test fails (and so does the pre-stated fallback) | The run does not start. A further dated amendment, with owner sign-off, is required before any candidate is run on real synthetic features. |
| Amendment A1 lacks owner sign-off, or open item 1 or 2 is not closed | The run does not start. |
| E3 is disqualified but another candidate wins | Same as the first row. The notebook states explicitly that **the edges shipped before v2.0 were not validated**. |

**Real-corpus quantities** (recall@k, S and their nulls) do **not** gate anything, except S's use in the Step 2 tie-break. They are reported with median, IQR and bootstrap CI. H3 is assessed descriptively.

**Sensitivity (reported, never governing):**
- Steps 1–2 are repeated at SNR 30 and 6 dB.
- Steps 1–2 are repeated at every grid setting.
- Background-as-wrong precision, pure-window precision and directed-list precision.
- The reverse-direction and symmetric S.
- The matched-d95 variant of control (a) for E95.
- The pre-amendment control comparison (median control precision inside the uniform-draw chance CI).
- The Step 2 tie-break recomputed on base-hop recordings only, and with `sourceNyquistBelowPR` recordings excluded.
- E95 verdicts recomputed with the exact-eigensolver E95 on the pre-named subset.
- Every verdict that changes under a sensitivity variant is listed in Discussion. The primary verdict governs.

**Statistics.**
- Every per-recording value is written to the JSON. For each arm the JSON gives the median, the IQR (Q1 and Q3, type 7) and the 95% percentile bootstrap CI of the median (B = 2000).
- Paired comparisons use `metrics.pairedBootstrapCI` (B = 2000) and the two-sided `metrics.wilcoxonSignedRank`. The JSON records the zero-handling and the exact/normal-approximation choice.
- Holm correction (`metrics.holm`) is applied over two families. Their membership is fixed now and does not depend on results:
  - *primary family (exactly 10 tests, at SNR 15 dB and the default setting):* the 4 candidate-vs-chance tests, Wilcoxon signed-rank of (P_c,r − c_r) vs 0 for c ∈ {E3, E95, EF, EFc}, plus all 6 pairwise candidate comparisons (E3–E95, E3–EF, E3–EFc, E95–EF, E95–EFc, EF–EFc), Wilcoxon signed-rank on the per-seed paired precision differences. All 10 are computed whether or not a candidate passes;
  - *secondary family:* everything else, including the Amendment A1 control tests, Step 3 settings, other SNRs, real-corpus quantities and the confound Spearman correlations.
- **The decision uses the bootstrap CIs and point rules above only.** A pass whose Holm-adjusted p is ≥ 0.05 is flagged "fragile" in Discussion.

### Amendment A1 (dated 2026-09-29, before any run): how "controls behave" is carried out

- **Status:** written 2026-09-29, before any candidate has been run on any synthetic or real feature. **Owner sign-off: given 2026-09-29 by Leonard Lind (project owner), in the working session** (recorded in Reproducibility Notes). The runner still verifies the sign-off fields before step 3 of the Procedure. No data from this experiment existed when the amendment was written.
- **What changed.** The original specification governed controls (a) and (b) by "median-over-seeds control precision inside the chance CI". That CI comes from uniformly drawn edge sets. The governing check is now:
  - for each seed r, D_r = P_ctrl,r − c_r, where c_r is the per-recording chance under **the same labels** (the shuffled labels, for (b));
  - **pass** if the paired-bootstrap 95% CI of median_r(D_r) over the 20 independent seeds contains 0 (B = 2000, seed 20260720 + 909).
  - The original check is kept as a **reported, non-governing** comparison.
- **Why (the miscalibration of the original comparator).** The uniform-draw chance CI captures only the variance of *uniform* edge sets. The control graphs are not uniform edge sets:
  - Control (b) keeps the real kNN graph. A good candidate concentrates its edges on a few same-type segment pairs, so one label shuffle moves many edges together, and its single-shuffle precision varies more than uniform edges do. **The better the candidate, the more likely it would have failed (b)**.
  - Control (a) is a kNN graph on 3078-d i.i.d. Gaussian rows, which shows hubness and mutual pairs.
  - The critic's scratch checks (2026-09-29; **not experiment results**; not reproduced for this revision) illustrate the problem.
    1. In a toy model (50 segments, 10 per type, 600 labelled edges, 20 seeds, every edge within the original type), the median-over-seeds single-shuffle precision fell inside the uniform-edge chance CI only 70% of the time, against a nominal 95%. The chance CI was [0.175, 0.192], and the 95% range of (b) was [0.167, 0.198].
    2. On the real pipeline at synthetic seed j = 0, 15 dB (n = 515, k = 3, g = 1.5 s), the per-recording precision SD was 0.0173 for EF on matched Gaussian (30 replicates), against 0.0154 for uniform draws (1000).
  - The original comparator could therefore disqualify the real winner, or produce "no candidate passes" or "void", because of the comparator rather than the data.
  - The paired D_r form makes each seed's own chance its reference. Its bootstrap over seeds therefore contains the control's **own** between-seed variance: hubness, instance clumping and shuffle randomness.
- **What did not change.** α stays at 0.05 (a 95% two-sided interval). The positive-control thresholds (0.10), the tie band (0.02), the stability margin (0.05), the Step 3 margin (0.05), the seeds, the candidates and the grid are all unchanged.
- **This is a calibration correction, not a relaxed threshold.** The new acceptance region can be wider than the old one. That widening is justified only if the calibration test ("Additional pre-registered checks") shows that the new check accepts a correct pipeline about 95% of the time: within [0.904, 0.996] over 200 replicates, for all 7 calibrated combinations. The old check was not shown to do so, and the critic's toy check suggests it does not. If the calibration shows the new check is *too* wide (> 0.996), it fails in the same way as a check that is too narrow.
- **Pre-stated fallback if the calibration fails.**
  1. The percentile bootstrap CI of the median is replaced by the **distribution-free order-statistic (sign-test) CI** for the median of D_r: [D_(6), D_(15)] for n = 20. Its coverage under independence and continuity is 1 − 2·P(Bin(20, 0.5) ≤ 5) = 0.9586, computed exactly. If some recordings drop out, the order-statistic indices are recomputed for the actual n so that coverage is ≥ 0.95, and they are logged.
  2. The calibration test is rerun with the fallback, using the same seeds.
  3. If the fallback also fails, the run does not start, and a further dated amendment (A2) with owner sign-off is required. No change after the run has started is allowed.
- **Interpretation, restated.** (a) and (b) are machinery checks: at chance in expectation by construction for any label-ignoring graph. Passing them does not show that edges mean anything; only the positive-control pass rule does. At nominal calibration, the two α = 0.05 controls together wrongly disqualify a sound candidate about 10% of the time (1 − 0.95²). The calibrated estimate is reported per candidate. The "control-only disqualification" flag in Step 1 makes such cases visible.

## Expected Outcome

- **Support for validated similarity edges:**
  - at least one candidate passes Step 1 at 15 dB;
  - the 30 dB sanity check passes;
  - controls (a) and (b) pass the calibrated Amendment A1 check for that candidate;
  - the parity, label-invariance and calibration checks pass.
  - The edges may then be shown and described as "these two moments have similar spectrograms (in space W)", with W's synthetic precision, chance level and real-corpus stability stated.
- **Support for the shipped design:** E3 wins or is the stability-chosen tie-set member, and Step 3 keeps (3, 1.5 s).
- **Evidence against the shipped design:** another space wins outside the tie band, or a non-default setting qualifies. That is a legitimate result: the exporter changes and the old edges are documented as unvalidated.
- **Failure (v0.4 Failure Criteria, line ~313):**
  - no candidate beats chance by 0.10 at 15 dB. The edges carry no validated meaning and are removed from the default view, followed by a methodology review;
  - or controls (a) or (b) fail for every candidate, and the run is void. A control failure for only some candidates disqualifies those candidates (Step 1) and is flagged, but it does not void the run.
  - Either outcome triggers a documented review, **not** a quiet adjustment of the 0.10 / 0.02 / 0.05 thresholds.
- **What a pass would NOT show:**
  - that edges reflect *perceptual* similarity;
  - that they reflect *biological* recurrence (for example "the bird repeats a phrase") in real song. The synthetic fixture has five clean, spectrally distinct caricature motifs, and nothing here shows that real song shares that structure;
  - that the real-corpus edges are correct. There is no ground truth there; recall@k and S measure agreement and robustness only.
  - This experiment treats precision on synthetic motifs as a necessary condition for calling edges meaningful, by design, and never as a sufficient one.
  - Anything about individual birds or their repertoire (D-008).

⸻

## Results

Pending run. Results will be written to `05_Benchmark_Results/v2/experiment_009_similarity_edge_space.json`. Tables here will link to that file and not duplicate it.

Planned JSON layout (top-level keys):
- `meta`: git hash, dirty flag and diff SHA-256; Node, ffmpeg and ffprobe versions; manifest SHA-256; PR constants as read.
- `seeds`: the full table, including the calibration seeds.
- `amendments`: A1 text hash, owner sign-off name and date, and the open items 1–2 closure records.
- `calibration`: per replicate and per combination, the A1 check outcome and D-median; acceptance rates with the [0.904, 0.996] band; whether the fallback was used; and the estimated joint false-disqualification rate per candidate.
- `pilot`: timings, d95 and convergence diagnostics only.
- `design_check`: per seed and SNR, including whether the kept-window time sets are identical across SNRs.
- `parity`
- `label_invariance`
- `synthetic`: per SNR × candidate × setting, the per-seed precision and secondary metrics; the controls (a), (b) and (c) with per-seed D_r and the A1 CI, plus the non-governing chance-CI comparison; c_r with its Monte Carlo SE and draw intervals; C and the chance CI; and summaries.
- `e95_diagnostics`: per E95 fit (synthetic real features, G, P, real G0/G1), d95 and per-component `iterations`, `relativeResidual` and `converged`.
- `e95_exact_check`: the pre-named subset, directed recall vs the exact eigensolver, the d95 difference, and the provisional flag.
- `real`: per recording × candidate × setting, recall@k, Jaccard, edge-set recall, analytic chance recall, S (both directions), the stability null, and d95 / explained variance; plus S stratified by `pointHopFrames`, the cosine clamp counts, and the confound log (source codec, source sample rate, channels, `sourceNyquistBelowPR`, kept-vs-dropped RMS ratio in dB).
- `demo`
- `exclusions`
- `verdicts`: Steps 1–3 with their inputs, and the flags (control-only disqualification, background routing, E95 provisional, fragile).
- `sensitivity`
- `holm`: the fixed 10-test primary family and the secondary family.
- `timing`: including `deferrals`.

## Unexpected Observations

Pending run.

## Discussion

Pending run.

Known design risks, pre-stated now so they are not discovered after the fact:
- **Control calibration (resolved before the run by Amendment A1).** The original chance-CI comparator was miscalibrated for both controls, not only (b): see A1. Residual risks:
  - The A1 check is calibrated on constructed and Gaussian fixtures, not on the candidates' real graphs under (b).
  - Production E95 is not directly calibrated on (a); the exact-eigensolver version stands in for it.
  - At nominal calibration, about 10% of sound candidates are wrongly disqualified per candidate. Every such case is flagged.
  - As an extra, non-governing diagnostic, the distribution of (b)'s per-seed precision over 1000 label shuffles is reported for the winner and for E3 (offset +2 stream continued after the governing shuffle).
- **Both governing controls are machinery checks.** Any label-ignoring graph sits at chance for both, by construction. They can detect a broken scorer, broken chance draws or label leakage into scoring. They cannot show that edges carry meaning.
- **The ground truth is a caricature.** Five spectrally distinct motifs at controlled RMS are likely easier than real song. **There is no evidence either way on how synthetic precision transfers to real recordings.**
- **The 1-frame phase shift probes only one kind of robustness.** It does not test robustness to recording conditions.
- **Confounds on the real corpus** (see Method (B), "Confounds"). S and recall@k can be driven by recording condition (device, distance, habitat), by each recording's unknown SNR (proxied only by the kept-vs-dropped RMS ratio), by background species and anthropogenic noise, and by codec or source Nyquist below 11025 Hz. Edges on real audio can join non-target sounds. S and recall@k measure the robustness and agreement of **spectrogram neighbours only**. No bird-song, repertoire or individual-level reading follows (D-008). Differences in S between candidates, which the Step 2 tie-break uses, are differences in grid-phase robustness of spectrogram neighbours, not in how well a space captures song.
- **Stability tolerance varies with the hop** (0.046–0.1625 s for the listed recordings), so pooled S mixes tolerances. Stratified values are reported.
- **Scope.** Results apply only to PR, within-recording fits, and this corpus (European-heavy, citizen-science recordings, mixed codecs; see Corpus_v2.md "Known biases and limits"). They say nothing about cross-recording edges in shared embeddings. They are conditional on D-004 and D-010, which were adopted in other regimes and are not re-validated here.

## Decision

Pending run. The decision will be applied mechanically from the Pre-Committed Decision Rule.
- **Decision log:** it feeds the proposed **D-016 (Similarity-edge space and parameters)**. The number is provisional: Experiment 007 → D-014, Experiment 008 → D-015, and the owner assigns the final number. D-004 and D-010 are not overwritten. D-016 also records:
  - whether similarity edges are the data-justified departure from the v0.4 "Edges → temporal adjacency" convention, or not justified;
  - any control-only disqualification, background-routing, E95-provisional or fragile flag;
  - that no individual-bird or repertoire claim follows (D-008).
- **Downstream:** the "Claim wording" section binds Experiment 011 and viewer copy whatever the outcome.

## Reproducibility Notes

- **Runner:** `tools/experiments/run_experiment_009_similarity_edge_space.js` (not yet written).
- **Results:** `05_Benchmark_Results/v2/experiment_009_similarity_edge_space.json` (not yet produced).
- **Planned unit tests:** `tools/test/experiment_009_similarity_edge_space.test.js`. They cover edge construction versus `buildSimilarityEdges` on a fixture, the gap floor assertion, the EF ≡ full-PCA sanity, the chance machinery, the draw-sampler equivalence (index arithmetic vs naive), the cosine clamp, the phase-shift frame identity, label-shuffle correctness, the Amendment A1 check on a hand-computed fixture, the order-statistic fallback indices, seed uniqueness, and the label-invariance hash. All must pass before the run.
- **Calibration test (Amendment A1):** a separate, long-running pre-run step in the same runner (`--calibrate`), not part of the fast unit tests. It is checkpointed per replicate, and its output goes to the `calibration` block.
- **Amendment A1 sign-off:** owner name **Leonard Lind**, date **2026-09-29** (approved in the working session: "Approve 009-A1").
- **Open items (Claim wording) closure:** item 1 (Experiment 007 wording text confirmed final): **closed 2026-09-29** — the Experiment 007 text "No outcome of this experiment permits perceptual wording" (Pre-Committed Decision Rule, Secondary claim gates) is the final pre-registered text; item 2 (Experiment 011 S7 perceptual branch removed): **closed 2026-09-29** — S7 G7.3 amended (see Experiment 011 revision log). Both closures were made by the assistant on the owner's instruction to proceed, before any run; both only make the wording more restrictive.
- **Manifest:** `manifest_v2_corpus.json` (SHA-256, recording count and per-recording source URL / licence logged). Synthetic fixture: `tools/lib/synth.js` `motifSequence`, with the resolved `params` (including defaults and `motifDescriptions`) written to the JSON per seed.
- **PR constants** are read from `tools/export_single_recording_dataset.js`, not re-typed: 22050 Hz, FFT 1024, hop 512, Hamming window, 6 frames per point, base point hop 2 frames, `MAX_POINTS` 700, amplitude filter 0.2, `SIMILARITY_NEIGHBORS` 3, `SIMILARITY_MIN_TIME_GAP_SECONDS` 1.5. The values actually used are logged.
- **Environment:**
  - Node v24.x (exact version logged).
  - ffmpeg/ffprobe **only** via `tools/lib/ffbin.js` (`FFMPEG`, `FFPROBE`; `ffmpegVersion()` logged).
  - Statistics from `tools/lib/metrics.js` (`knn`, `neighborOverlap`, `randomMatchedMatrix`, `columnPermutedMatrix`, `makeRandom`, `bootstrapCI`, `pairedBootstrapCI`, `wilcoxonSignedRank`, `holm`, `median`, `iqr`, `quantile`). B = 2000, α = 0.05.
- **Seeds:** the full table in Method, written to the JSON. Base 20260720.
- **Label-exclusion code inspection:** the date and inspector are recorded here at run time.
- **Design check provenance:** the fixture-geometry counts quoted in Method (frames, windows, segments, background share) came from a throwaway script outside the repo, run on 2026-09-29 against the files as they stood then. The script was not committed, so these numbers are **to be regenerated by the runner** and are not results. The critic's independent scratch reproduction (515 kept, 330 labelled, seed j = 0, 15 dB) is likewise not a result.
- **Numbers from the internal critique** quoted in this document are the critic's scratch measurements on 2026-09-29. They are not experiment results and were not reproduced for this revision: the 564 s E95 fit, d95 = 456 with 309 unconverged components, the toy-model 70% coverage, the SDs 0.0173 and 0.0154, and the uniform-draw mean 0.197. They are quoted only to motivate design changes, and none of them enters a verdict.
- **Revision log:**
  - 2026-09-29, first pre-registration.
  - 2026-09-29, revised after an internal critique:
    - Amendment A1: the governing control check is now the paired D_r CI, with a calibration test and a pre-stated fallback; the chance-CI exactness claim was withdrawn; (a) and (b) are stated to be machinery checks, with the joint false-disqualification rate.
    - E95: pinned to production `pca(X, null)`, with convergence logging, the exact-eigensolver sensitivity check and the provisional flag. G is cached across SNRs.
    - Compute: the pilot covers every arm and prints no results; the >24 h fallback is pre-stated.
    - Step 3: chance-adjusted conditions 6–7, and C(s) reported for all 9 settings.
    - Real corpus: a Confounds paragraph with SNR-proxy and codec/sample-rate logging.
    - Scope and IDs: the D-004/D-010 inheritance disclosure, D-008, and the provisional D-016.
    - Claim wording: open items 1–2 for Experiments 007 and 011.
    - Rules and reporting: the background-routing flag and the pairing-by-intersection rule; the reworded caricature sentence; the design-check numbers marked for regeneration and the chance expectation marked as an approximation; "< 0.02" everywhere and a fixed 10-test Holm primary family.
    - Implementation: the cosine clamp, index-arithmetic draws, S stratified by hop, and an explicit Procedure bullet (template).
    - No threshold was weakened.
