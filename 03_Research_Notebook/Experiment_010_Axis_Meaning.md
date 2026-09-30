# Experiment 010 — Axis Meaning: Can Each PCA Axis Be Explained in Plain Words for This Recording?

**Date:** 2026-09-29 (pre-registration written and revised the same day; pre-run consistency amendments added 2026-09-29, see "Pre-run consistency amendments"; dated additions to the amendments made on 2026-09-30, before any run; run date to be filled in at run time)
**Work Package:** WP4 (axis meaning / descriptors) with WP5 (visual-claim validation), v2.0 track
**Related Decision Log ID(s):** D-004 (PCA), D-006 (negative controls), D-010 (raw spectrograms), D-005 (Rule 001), D-011 (Rule 002: benchmark plan before implementation), D-008 (no individual-level claims). Proposed new entry: **D-0NN: plain-language axis labels in exports (production regime, within-recording)**. NN is the next free number ≥ 14 when results come in. Experiment 007 has provisionally proposed D-014 and Experiment 008 D-015, so this is expected to be D-016 or later. *[Superseded by Amendment C07, 2026-09-29.]* The owner assigns the number.
**Status:** Pre-registered; consistency-amended 2026-09-29, with dated additions on 2026-09-30 (see "Pre-run consistency amendments"); not yet run; not yet frozen (Amendment C02). No corpus run, and no run of any arm whose output enters a verdict or gate, may start before the freeze.

**Scientific Hierarchy level:** Frame (`01_Master_Framework/v0.4_Final.md`, Scientific Hierarchy, ~line 336). Each point is a 0.15 s nominal window (actual span 0.1625 s) of 6 consecutive STFT frames. Nothing is segmented, so no point is a syllable, phrase or acoustic event. Every fit is within one recording (Level 1, Individual Recording). No axis label may be worded at any level above Frame, and none may refer to an individual bird (D-008).

> **Blocking pre-run issue (read first): as specified, the labelling rule cannot produce a label.** Under the production regime, a recording has at most 700 points after the amplitude filter (at most 561 when no RMS values tie at the filter threshold; the largest observed in this corpus is 556). So the circular-shift null has at most 699 admissible shifts, and the smallest attainable two-sided p is 1/(D+1) ≥ 1/700 ≈ 0.00143. With Holm over 36 tests, the smallest attainable adjusted p is ≥ 36/700 ≈ 0.051, which is above the required 0.01. The same holds with the 33 tests named in the brief, with a Monte Carlo reading of B = 999 (floor 0.001, adjusted floor 0.036), and in each split half. The proof and two proposed amendments that keep every threshold are in "Feasibility of the significance criterion" below: **A2** (phase-randomised AAFT surrogates, B = 9999; proposed as the governing arm) *[Superseded by Amendment C32, 2026-09-29.]* and **A1** (Gaussian tail extrapolation of the rotation null; proposed as non-decisional only). **The governing arm must be approved by the project owner and committed in `tools/experiments/exp010_governing_arm.json` before the run** (see "Governing arm: technical pre-commitment"). *[Superseded by Amendment C32, 2026-09-29.]* Without that file, the literal rule governs, it gives zero labels by arithmetic, V1 fails, and labels are disabled in exports. *[Superseded by Amendment C31, 2026-09-29.]* That outcome is pre-committed as well.
>
> **Second pre-stated structural consequence:** both Wikimedia demo files (13.7 s and 15.8 s) are too short for the per-export split-half gate to be evaluable (each has a half with fewer than 100 admissible shifts; counts in "Compute plan"). Whatever the validation outcome, **the demo files will ship with no plain-language axis label** under this pre-registration; they will show the numbers and the loadings picture only.

⸻

## Question

**For one recording under the production regime (PR), can each of the three displayed PCA axes be described correctly and reproducibly in one plain-language sound property? Examples: "toward +Z the moments are noisier; toward −Z they are more tonal", or "a mix of brightness and bandwidth". And does the method avoid giving such labels to signals that have no such structure?**

A real "no" is possible in several ways, and each one is a legitimate outcome:

1. On synthetic signals where exactly one property varies, the method does not name that property on PC1, or names it with the wrong direction (V1 fails).
2. The method gives labels to structureless noise, or to real recordings whose descriptors have been misaligned in time (V2 fails).
3. Labels do not reproduce across two interleaved halves of the same recording (V3), so most per-export labels are withheld.
4. The significance criterion cannot be met in this regime (see the blocking issue above), or the amended null (A2, or A1) *[Superseded by Amendment C31, 2026-09-29.]* is miscalibrated on a null that cannot contain the true alignment (mismatched-pairing null, V2(c)).
5. The corpus is too small to decide: fewer labellable units than the pre-committed minimum denominators (outcome "Inconclusive"; labels disabled).

### Why this experiment exists (evidence gap)

- The v2.0 viewer shows the PCA cloud with X / Y / Z toggles, and the project owner has asked for per-recording text saying what each direction means. That text is a claim about the data (Core Philosophy: "Every visual element should represent measurable information"; Design Principles: "traceable back to measurable acoustic properties").
- The meaning of a PCA axis is not fixed. PCA is fit per recording on z-scored 3078-dim log-magnitude windows (D-004, D-010), so PC1 of one recording can be "loudness" and PC1 of another "noisiness". A caption therefore has to be computed per recording and tested. It cannot be written once.
- **Regime disclosure.** D-004 and D-010 were decided on Experiments 001-006, which used a different sampling regime. Whether PCA on raw log-spectrogram windows is the right display under PR is being re-tested in Experiment 007. Axis labels inherit that open question, which is why the Experiment 007 gate exists (see "Additional pre-registered checks").
- PCA signs are arbitrary. "The signs of all loadings (and scores) are arbitrary and only their relative magnitudes and sign patterns are meaningful" (JolliffeCadima2016). So any "+ end = X" wording needs a documented sign convention. Here the sign is resolved by computing labels **in the same run** that produces the exported positions. The exporter's `positionScale` is a positive scalar (`tools/export_single_recording_dataset.js` ~line 721), so it preserves sign.
- The descriptors that give the words (`tools/lib/window_descriptors.js`) come from existing project code. Some of them have documented failures:
  - **width (bandwidth):** the ordering is reversed at 20 dB SNR on synthetic band noise. *[Superseded by Amendment C32, 2026-09-29.]*
  - **pitch (HPS):** the estimator returns sub-harmonics on pure tones, marks broadband noise as voiced, and cannot report f0 above about 3682 Hz. It carries `validatedForLabelling: false`.
  - Both are asserted in `tools/test/window_descriptors.test.js`. *[Superseded by Amendment C32, 2026-09-29.]*
  Nothing in the project has yet tested whether *correlation with a PCA axis* recovers a known property.
  **Pre-commitment on pitch:** because of these documented failures, the pitch family is **never shipped as a plain-language label in this experiment**, whatever its V1 result (see "Family gate"). It stays in the test grid (so the brief's rule and the Holm family are unchanged) and is reported as a number only, like peakiness, tilt and change, until a separate descriptor-validation experiment sets `validatedForLabelling: true`.
- Consecutive PR points share 4 of 6 frames, so the descriptor and score series are strongly serially correlated, and a naive correlation p-value is invalid (Ebisuzaki1997). An autocorrelation-preserving null is required. Here that is the circular shift as specified, plus the phase-randomised surrogate arm A2 (Ebisuzaki1997; Theiler1992); see "Feasibility" and the literature gaps in Discussion.

### Production regime (PR), verbatim definition used by this experiment

What `tools/export_single_recording_dataset.js` does today:

- **Decoding:** mono at 22050 Hz.
- **STFT:** Hamming window 1024, hop 512 (≈ 23.2 ms).
- **Points:** windows of 6 consecutive frames, every 2 frames.
  - Nominal length 0.15 s; actual span 3584 samples = 0.1625 s.
  - The hop is ≈ 0.046 s. It widens (`pointHopFrames = max(2, ceil(frames / 700))`) so a recording yields at most 700 windows before the amplitude filter.
- **Feature:** frame-major 6 × 513 log1p magnitude, 3078 dims.
- **Amplitude filter:** the quietest 20% of windows by RMS are dropped (threshold = sorted RMS at index `floor(0.2·(N−1))`; windows at or above it are kept). So at most 700 − 139 = 561 points remain **when no RMS value ties at the threshold**. With ties (for example digital-silence padding that makes the threshold 0), every tied window is kept, so the guaranteed bound is n ≤ 700. The runner logs the exact n per unit. (Structural pre-count, 2026-09-29: the largest n in the corpus is 556 and no recording keeps extra windows through ties; see "Compute plan".)
- **Reduction:** per-recording z-scoring, then PCA (`tools/lib/reducers.js` `pca`).
- **Similarity edges:** k = 3 nearest neighbours in the 3D PCA positions, excluding candidates less than 1.5 s apart. Edges are not used here.

The runner must obtain features, scores, loadings and descriptors **through the production code path**: `computeContinuousFrontEnd` / `runContinuousSamplingPipelineOnSamples` from the exporter, and `descriptorsFromFrontEnd` from `tools/lib/window_descriptors.js` with `which = "kept"`. It must not re-implement them. See the parity check below.

## Hypothesis

Each hypothesis is stated so that it can turn out to be wrong. There is no strong prior for most of them: nothing in `04_Literature/Literature_Database.md` tests descriptor-to-PCA-axis labelling on frame-level windows of birdsong.

- **H1 (positive controls, V1):** on the five single-property alternations (pitch, noisiness, loudness, bandwidth, brightness) at SNR ≥ 15 dB, PC1 receives the correct family with the correct direction in ≥ 90% of runs.
  - Falsified if the pooled rate is < 0.90.
  - **Pre-stated risks, from existing project evidence and not from this experiment's data:**
    - *Width:* the bandwidth descriptor's ordering is reversed at 20 dB SNR in `tools/test/window_descriptors.test.js`, so the width control may fail at 15 dB. *[Superseded by Amendment C32, 2026-09-29.]*
    - *Pitch:* in the harmonic pitch alternation the spectral centroid moves with f0, so brightness may beat pitch, or the gap may fall below 0.1 and give a "mix". Either result counts as incorrect.
    - *Noisiness:* adding broadband noise also raises bandwidth and lowers crest, so width or peakiness may compete.
    - *Brightness:* low-pass versus high-pass noise also changes spectral slope, so tilt may compete.
- **H2 (false labels, V2):** labels are rare on structureless inputs. The rate is ≤ 5% per axis on white and pink noise and on real recordings whose descriptor series have been circularly shifted.
  - **Pre-stated competing expectation, held as plausible:** in stationary noise, PC1 of z-scored log spectra may track window-to-window level fluctuation. Its Spearman ρ with window RMS could then be large and significant, which would give a "loudness" label on noise.
  - Such a label would be *numerically true* but is counted as **false** by the pre-committed rule, because the rule asks whether the method labels structureless signals.
  - If this happens, V2(a) fails and labels are disabled. It will not be reinterpreted after the data are seen.
- **H2b (calibration of the amended null, V2(c)):** on the mismatched-pairing null (scores of one recording against descriptors of another), the governing arm's family-wise rate of any Holm-adjusted p < 0.01 is ≤ 0.02, and the per-test rate of raw p < 0.01/36 is ≤ 2 × 0.01/36. No strong prior: neither the circular shift nor the surrogate method has been validated on PR data in this project.
- **H3 (stability, V3):** no directional prediction. The agreement rate of labels across interleaved halves is reported. Short recordings (the corpus median is 19.6 s) are expected to make the split-half gate non-evaluable for many recordings, and those axes then carry no label. The structural pre-count (front end only, see "Compute plan") gives **25 of 60** evidence recordings with both 2 s halves evaluable, so the primary V3 statistic can have at most 75 axes in its denominator.
- **H4 (loadings):** on the pitch and brightness controls, the oriented loading profile puts its largest positive band weight in the band that the label names (definitions below). No agreement rate is predicted.

## Method

* **Dataset / subset used:** `manifest_v2_corpus.json` (see `03_Research_Notebook/Corpus_v2.md`).
  - Contents: 60 iNaturalist research-grade evidence recordings (12 species × 5; CC0 / CC BY / CC BY-SA sound licences), plus 2 Wikimedia Commons Bluethroat demo files.
  - This is a **new corpus**. Results are new experiments, not reproductions of Experiments 001–006. Final counts are filled in at run time from the manifest and logged with its SHA-256.
  - **Evidence set:** the 60 recordings. Every rate that gates a decision is computed on the evidence set only. The 2 demo files are analysed and reported **separately**, because they are what the product shows, and they never enter a gating rate.
  - **Recording index r:** the 0-based position of the recording in `manifest_v2_corpus.json`, fixed before any exclusion, so that seeds never shift. Entries of `recordings[]` take r = 0 … 59 and entries of `demo[]` continue at r = 60, 61. The runner asserts that the manifest has fewer than 100 entries in total (so that the partner index r′ in the mismatched-pairing seed offsets +100 … +199 cannot overflow) and hence fewer than 1000, so that the synthetic indices below cannot collide. *[Clarified by Amendment C08, 2026-09-29.]*
  - **Exclusion rule, stated before the run:** a recording is excluded from all arms if it fails to decode or yields fewer than **100** points after the amplitude filter. This is the same floor as Experiment 007. Every exclusion is logged with its reason in `exclusions[]`; there are no silent drops.
  - **Labellability (under amendments A1 and A2, below):** a recording, a half, or a mismatched pair is *labellable* only if its circular-shift null has ≥ **100** admissible shifts (D = n − 2·minShift + 1 ≥ 100). This is a pre-committed convention, not a literature value: A1 fits a mean and SD to the null, and 100 values is the minimum accepted here for doing that. The same convention is applied under A2 (which does not need it) so that both arms have identical denominators and can be compared.
    - Non-labellable units are reported, and **excluded from the denominators of false-label rates** so that they cannot dilute them. Because this shrinks denominators, minimum denominators are pre-committed (see "Minimum denominators and the Inconclusive outcome").
    - At the base hop, D ≥ 100 needs n ≥ 165 points, which is roughly ≥ 10 s of audio. A half needs about ≥ 20 s of recording.
  - **Recording-level proxy (descriptive only, not an SNR):** per unit the runner logs `levelProxy` = median RMS of the kept windows ÷ `amplitudeThresholdValue` (the amplitude-filter threshold RMS from `computeContinuousFrontEnd`); null when the threshold is 0. It is labelled in the JSON as "level proxy, not a signal-to-noise ratio". Per-recording SNR is **not measured** in this corpus; this proxy is not validated as an SNR estimate and is never used in a gate or in a caption.
  - Species labels are **not used anywhere in this experiment**, not even afterwards for inspection (Rule 001, D-005). The stricter choice was made because 5 recordings per species, together with the observer, device and codec confounds in `Corpus_v2.md`, would invite over-reading.
  - `Assets/smoke/Luscinia_svecica_song.ogg` is used for runner smoke tests and the parity check only. Smoke-test numbers are never reported as results. The file has the same sha1 as the demo file `Luscinia_svecica_song.ogg`, which is analysed like any other demo file.

* **Descriptors (per kept window):** from `tools/lib/window_descriptors.js`, grouped exactly as its `DESCRIPTOR_FAMILIES`. There are **12 descriptors in 8 families**:

  | Family | Descriptor(s) | Notes |
  |---|---|---|
  | brightness | `centroidHz`, `rolloffHz` | Roll-off is 85%; Peeters2004 uses 95%, a documented discrepancy |
  | noisiness | `flatness`, `entropy` | |
  | loudness | `rms` | |
  | width | `bandwidthHz` | Noise-floor sensitive (documented caveat) |
  | pitch | `pitchHz` | HPS median over voiced frames; null if < 50% of the window's frames are voiced; `validatedForLabelling: false`. **Tested and reported as a number only; never shipped as a label in this experiment** (pre-committed) |
  | peakiness | `crest` | |
  | tilt | `slope` | |
  | change | `flux`, `freqMod`, `ampMod` | |

  - `zcr` is excluded as redundant (`EXCLUDED_FROM_LABELLING`), and `voicedFraction` is not a labelling descriptor.
  - **Count discrepancy, recorded:** the brief says "33 tests", but the families it lists contain 12 descriptors, so the test grid is **12 × 3 = 36** tests per recording. Holm is applied over all 36. With more tests Holm is more conservative, never less, so this does not weaken the brief's rule.
  - Descriptors are used **only to interpret axes**. They never drive position. This is consistent with D-010, where the engineered descriptor sets lost to raw spectrograms as a feature set.

* **Procedure (per recording, and identically per synthetic signal and per split half):**
  1. PR front end: kept windows in time order (index t = 0 … n−1), z-scored feature matrix, `pca(matrix, 3)` → scores s_c(t) and unit loadings ℓ_c (3078-dim) for c = 1, 2, 3. Also log per-component explained variance, the eigen-gap and convergence diagnostics as returned by `pca`. The loadings are exact: `reducers.js` computes ℓ_c = Xsᵀu_c / ‖Xsᵀu_c‖ with Xs·ℓ_c = s_c. This relation follows from the SVD identity in JolliffeCadima2016 eq. 2.2–2.4 (our derivation; the paper does not state it as a recipe).
  2. Descriptors for the same kept windows (`descriptorsFromFrontEnd(frontEnd, { which: "kept" })`).
  3. For every descriptor j and axis c: ρ_jc = Spearman(s_c, d_j), using `metrics.spearman` (average ranks for ties).
     - For `pitchHz`, null values are NaN and dropped pairwise (`dropNaN`).
     - If fewer than **30** non-null pairs remain, the test is "not computable" and gets ρ = NaN and p = 1. 30 is a pre-committed convention without literature backing.
     - A zero-variance descriptor also gets p = 1. Both cases are logged.
  4. Significance: `metrics.circularShiftNull(s_c, d_j, { statistic: "spearman", minShift, B: 999, seed, dropNaN: true })`.
     - Rotation is over the **time-ordered kept-point index**.
     - minShift = ⌈1.5 s / point hop⌉ points, where point hop = `pointHopFrames` × 512 / 22050 s for that recording. At the base hop this is ⌈1.5 / 0.04644⌉ = 33.
     - Because consecutive kept points are at least one hop apart in time, an index shift of minShift always spans ≥ 1.5 s.
     - Two-sided p = (1 + #{|ρ_null| ≥ |ρ_obs|}) / (count + 1).
     - `circularShiftNull` enumerates every admissible shift when D ≤ B. In PR, D ≤ 699 < 999 always (n ≤ 700), so the null is the **exact rotation distribution** and the seed (offset +4) is recorded but inert. This is at least as conservative as sampling B = 999 with replacement, because its p-floor 1/(D+1) ≥ 1/700 is larger than 0.001.
     - This literal rotation p is always computed and exported. The A1 and A2 p-values (see "Feasibility") are computed alongside it for every test; which of the three drives the labelling rule is fixed by the committed governing-arm file.
  5. Holm across the 36 p-values of the recording (`metrics.holm`) → p_holm,jc, separately for each arm (literal, A1, A2).
  6. Apply the Pre-Committed Labelling Rule (below) per axis.
  7. Loadings picture per axis (below), always computed and exported, whether or not the axis is labelled.
  8. Split-half check (V3, below) and the export gates.

* **Loadings picture (per axis, all runs):**
  - The oriented loading w = σ_c · ℓ_c is reshaped to 6 frames × 513 bins in frame-major order (index = frame·513 + bin).
    - σ_c = sign(ρ₁) of the axis's label when one exists (+ end = "more F1"). Otherwise σ_c = +1, which is the exported sign.
  - It is pooled into **24 log-spaced bands** with edges e_i = 100 · 110^(i/24) Hz, i = 0 … 24 (100 Hz to 11 kHz).
    - Bin k (centre k · 22050/1024 Hz) belongs to band i if e_i ≤ f_k < e_{i+1}. Bins below 100 Hz (k ≤ 4) and at or above 11 kHz (k ≥ 511) are excluded.
    - Every band contains at least one bin: the counts run from 1 bin in the lowest bands to 91 in the highest (computed 2026-09-29 from these definitions).
  - Band weight B_i = the **mean** (not the sum) of w over the bins in band i and over all 6 frames. The mean is used so that high bands, which contain more bins, are not favoured.
  - The runner exports the 6 × 24 frame-by-band matrix and the 24-band frame-averaged profile.
  - Loadings are in z-scored units. A bin with low variance across windows can therefore carry a large weight, and this is stated in the exported caption metadata.

* **Validation arms (all pre-committed; seeds in the table below):**

  **V1: positive controls.** Five `tools/lib/synth.js` alternations, 20 seeds each, at SNR 30, 15 and 6 dB (white Gaussian background from synth.js). Every signal is 30 s long, so n is about 515 kept points and D about 450 (n = 515, D = 450 measured on a 30 s synth.js white-noise signal on 2026-09-29).
  - **Scope of V1, stated in advance:** V1 validates the method only against a **stationary white Gaussian background**. It does not represent real backgrounds such as wind, traffic, rain, reverberation, or other vocalising animals (other birds, insects, people). A V1 pass is therefore no evidence that labels are correct on recordings with such backgrounds.

  Two parameter choices are fixed before the run. They are the construct-validity requirements for "only one property varies":
  - **`gapSeconds: 0`.** With the synth.js default gap of 0.2 s, the file alternates between bursts and background-only gaps. PC1 would then plausibly encode burst-versus-gap (level), so two properties would vary and the "correct family" would be undefined. The default-gap variants are run as a **secondary, non-gating** arm and reported.
  - **`order: "random"`** (synth.js seeded balanced order). With the default strict `alternate` order the signal is periodic (period 0.6 s at gap 0). Rotations by whole periods, all of which are ≥ 1.5 s, would re-align the pattern, so the circular-shift null would contain the observed value and could never reject. The same null-deflating property applies to strongly periodic real songs, where it makes the test conservative (less powerful) and does not create false positives. That is noted as a limitation.

  | Type | synth.js generator and parameters (all others at synth.js defaults, recorded in the JSON) | "More" state (+ direction truth) | Correct family |
  |---|---|---|---|
  | pitch (primary) | `pitchAlternation`, `frequenciesHz: [1000, 2000]`, `harmonics: [1, 0.5, 0.25]` | high | pitch |
  | noisiness | `noisinessAlternation` (toneHz 3000, noiseFraction 0.5) | noisy | noisiness |
  | loudness | `loudnessAlternation` (toneHz 3000, levelDifferenceDb 12) | loud | loudness |
  | bandwidth | `bandwidthAlternation` (centre 4000, 200 vs 4000 Hz) | wide | width |
  | brightness | `brightnessAlternation` (cutoff 3000 Hz, 2nd-order) | bright | brightness |

  - The primary pitch parameters are the configuration on which `tools/test/window_descriptors.test.js` found HPS within 3% of the truth (991 / 2003 Hz). The synth.js default (2000 vs 4000 Hz, pure tones) is run as a secondary, non-gating arm, because 4000 Hz is above the HPS search limit and HPS fails on pure tones.
  - **Ground-truth direction:** each window gets its segment label from `labelWindowsBySegments`. Windows that straddle a boundary are unlabelled and are excluded from the truth computation, but not from PCA. The truth sign is sign(Spearman(PC1, 𝟙[label = "more" state])) over labelled windows.
  - **A run is correct** only if all of these hold:
    - PC1's outcome is a **single-family label** (a "mix" counts as incorrect, even if it contains the correct family);
    - that family is the correct family;
    - sign(ρ₁) equals the truth sign.
  - PC2 and PC3 outcomes on the controls are reported and do not gate. If the correct family appears on PC2 or PC3 instead of PC1, this is reported.

  **V2: false labels.**
  - **(a) Synthetic noise.** `whiteNoise` and `pinkNoise` (synth.js), 30 s, 20 seeds each, through the full PR pipeline. **Any** label (single or mix) on any axis counts as false.
  - **(b) Misaligned real data.** For every analysed evidence recording, all 12 descriptor series are circularly shifted **jointly** by one seeded offset o_r. The joint shift keeps the relations among descriptors and breaks their alignment with the scores.
    - o_r is drawn uniformly from the integers in [L, n − L], with L = max(minShift, ⌈0.25·n⌉), so that the offset is "large". *[Superseded by Amendment C01, 2026-09-29.]*
    - The full labelling rule, with its own circular-shift null, is then applied. Any label counts as false.
    - The split-half gate is **not** applied here, because it can only remove labels and would flatter the rate. The rate after the gate is reported as secondary.
  - **(b-rep), extra rigor.** The same procedure with 20 further offsets per recording (seed offsets +50 … +69). *[Superseded by Amendment C01, 2026-09-29.]* This gives a more precise false-label rate than a single offset does. It reuses the full-recording PCA fit (the scores do not change) and recomputes only the shifted descriptor tests and their nulls.
  - **What V2(b) and V2(b-rep) can and cannot show (stated in advance).** They are kept exactly as specified and they gate. But under the **rotation null** (literal arm and A1) they come close to passing by construction: o_r ∈ [L, n − L], so the shift n − o_r, which restores the true alignment, is itself an admissible rotation of the shifted descriptors. In any recording with a real association, the shifted observation then almost never has empirical rank 1, A1 never fires, p ≥ 2/(D+1), and the Holm-adjusted p is at least about 36 · 2/(D+1) ≈ 0.14 (at D ≈ 500), so no false label can appear. **V2(b) and V2(b-rep) are therefore not used as evidence that A1 (or the literal rotation null) is calibrated.** Under **A2** this argument does not apply: a circular rotation of a phase-randomised surrogate is again a phase-randomised surrogate (exactly for odd n; for even n up to the sign of the single fixed Nyquist bin), so the A2 null for shifted descriptors has (essentially) the same distribution as for unshifted ones, and the true alignment is not in it. V2(b) is informative for A2, but the calibration gate below (V2(c)) is still required for both arms.
  - **(a-ext) Extended noise arm (extra rigor, gating in addition to V2(a), never instead of it).** 100 further seeds each of `whiteNoise` and `pinkNoise`, 30 s, disjoint from the V2(a) seeds (pseudo-recording indices below). *[Superseded by Amendment C01, 2026-09-29.]* Same false-label definition. Reason: with 20 seeds, even 0/20 false labels leaves a Clopper-Pearson one-sided 95% upper bound of 0.139 on the rate (two-sided 95% interval upper limit 0.168), far above 0.05; with 100 seeds, 0/100 gives 0.030 (one-sided) and 1/100 gives 0.047.
  - **(c) Mismatched-pairing null (gating calibration of the governing arm; cannot contain the true alignment).**
    - A unit is an ordered pair (r, r′) of distinct analysed evidence recordings: the PCA scores s_c of r (from r's own full-recording fit) are paired with the 12 descriptor series of r′. Both are cut to the first m = min(n_r, n_r′) kept points in time order. The PCA is **not** refit on the truncated scores.
    - minShift = max(minShift_r, minShift_r′); D = m − 2·minShift + 1; the pair is labellable if D ≥ 100.
    - **All** labellable ordered pairs are used; no pairs are drawn at random, so no pairing seed is needed (offset +9 is left unused and reserved). A2 surrogates for pair (r, r′) use seed offset +100 + r′ on recording r (they are surrogates of the truncated s_c, so they cannot be reused from r's full unit).
    - Per unit the full procedure runs: 36 tests, all three arms (literal, A1, A2), Holm over 36, labelling rule.
    - **Calibration criteria, at the level the decision uses (gating for the governing arm):**
      - **(i) family-wise:** the fraction of units with **any** Holm-adjusted p < 0.01 among its 36 tests must be ≤ **0.02** (at most twice the nominal 0.01 that Holm guarantees under the null).
      - **(ii) per-test, at the label threshold:** over all 36 × (number of units) raw p-values, the fraction with raw p < 0.01/36 (≈ 2.78 × 10⁻⁴, the smallest-p Holm step) must be ≤ 2 × 0.01/36 (≈ 5.56 × 10⁻⁴).
      - **(iii) false labels:** the per-axis false-label rate (any label on axis c) must be ≤ **0.05**, as for V2(b).
    - **Required size, stated in advance:** at nominal level, (i) expects 0.01 × units and (ii) expects 2.78 × 10⁻⁴ × 36 × units = 0.01 × units exceedances. For both expected counts to be ≥ 10, at least **1000 labellable units** are needed. If fewer are available, the governing arm is **"not validatable"** and labels stay disabled. The structural pre-count gives **2450** labellable ordered pairs (50 labellable recordings × 49), so both expected counts are about 24.5.
    - **Dependence caveat:** each recording appears in up to 98 pairs (49 as scores, 49 as descriptors), so units are not independent; the Clopper-Pearson bounds reported next to these rates assume independence and are optimistic. A cluster bootstrap by scores-recording (B = 2000, corpus seed) is reported alongside.
    - Shared non-stationarity (for example many files starting or ending with a fade) can create associations between unrelated recordings that neither null models. Such a result is counted as miscalibration, as it should be: it would mean the null does not protect the shipped labels.

  **V3: stability (evidence set).**
  - Kept windows are assigned to 2 s blocks, b = ⌊startTime / 2.0 s⌋. Half A = even b and half B = odd b.
  - **Straddlers are excluded from both halves (extra rigor):** these are windows whose span [startTime, endTime) crosses a block boundary. Otherwise adjacent A and B windows would share STFT frames. The number excluded is logged.
  - Each half is z-scored and reduced with PCA separately, with 3 components. Each half gets its own descriptor tests (36 tests, its own Holm family, its own minShift, and null seed offsets +7 for A and +8 for B), and its own labelling.
  - **Axis matching:** use the 3 × 3 matrix of |cos(ℓ_A,i, ℓ_B,j)| and take the one of the 6 permutations that maximises the summed |cos|. With 3 axes this exhaustive search is exactly the Hungarian optimum; ties go to the lexicographically first permutation. Matched signs are aligned by sign(cos). The matched |cos| values are reported.
  - **Agreement:** two labelled axes agree if they have the same outcome type (single or mix), the same family (or unordered family pair) and the same direction after sign alignment.
  - **Primary V3 statistic (as specified):** the agreement rate among axes labelled in A. Also reported: the rate among axes labelled in B, and the per-recording values with median, IQR and bootstrap CI.
  - **Per-export split-half gate** (applied in every export, and in the experiment's "shipped" tallies):
    - Full-recording axis c is matched to the A axes and to the B axes by the same procedure.
    - Its label is shipped only if **both** matched half axes carry the same outcome as the full axis. This is stricter than requiring A = B only.
    - If either half is non-labellable or has fewer than 100 points, the full axis's label is **withheld** ("split-half check not evaluable").
    - The experiment reports how often the gate removes labels, overall and by reason.
  - **Secondary, non-gating: 4 s blocks.** The whole V3 procedure is repeated with 4 s blocks (b = ⌊startTime / 4.0 s⌋, same straddler rule, null seed offsets +13 for A and +14 for B, A2 surrogate offsets +15 and +16) on every recording where both 4 s halves are labellable. Agreement at 4 s is reported next to 2 s. It never changes a shipped label. Reason: adjacent 2 s blocks usually continue the same sounds and background, so the 2 s halves are not independent and the 2 s agreement is optimistic (see Discussion); longer blocks weaken, but do not remove, that dependence. Structural pre-count: 26 evidence recordings have both 4 s halves labellable (25 at 2 s).

  **Loadings check (reported, not gating).** This applies to the pitch and brightness V1 runs. Band indices are 0-based.
  - **Primary pitch** (low state partials 1000/2000/3000 Hz, high state 2000/4000/6000 Hz):
    - *Agree* if argmax_i B_i is a band that contains a high-only partial: band 18 (3396.6–4131.5 Hz, containing 4000 Hz) or band 20 (5025.3–6112.5 Hz, containing 6000 Hz).
    - Secondary: argmin_i B_i ∈ {band 11 (862.3–1048.8 Hz, containing 1000 Hz), band 17 (2792.5–3396.6 Hz, containing 3000 Hz)}.
    - Band 15 (containing 2000 Hz) is shared by both states and cannot discriminate between them.
  - **Secondary pitch** (2000 vs 4000 Hz pure): agree if argmax = band 18; secondary argmin = band 15.
  - **Brightness** (cut-off 3000 Hz):
    - agree if argmax_i B_i has lower edge ≥ 3000 Hz (bands 18–23);
    - secondary: argmin has upper edge ≤ 3000 Hz (bands 0–16).
    - Band 17 straddles 3000 Hz and counts as neither.
  - Rates are reported (i) over runs where PC1 got the correct label (the orientation from the label, as specified), and (ii) over all runs, oriented by the ground-truth sign.
  - Profiles for the noisiness, loudness and bandwidth controls are reported without an agreement criterion, because no single band is implied by those labels.

* **Metrics used to evaluate:**
  - V1: the proportion of correct runs, pooled over the 5 primary types × 20 seeds × SNR {30, 15} (200 runs). *[Superseded by Amendment C33, 2026-09-29.]* Also reported per type (40 runs), per type × SNR (20 runs), and at 6 dB.
  - V2: the false-label rate per axis, i.e. the proportion of units with any label on axis c. Also the run-level rate (any axis) for V2(a) and V2(a-ext). For V2(c) additionally the family-wise rate and the per-test exceedance rate at raw p < 0.01/36, per arm.
  - V3: the agreement rate, and the gate removal rate.
  - Loadings: the agreement rate.
  - Every proportion is reported with its count and denominator, with a 95% percentile bootstrap CI (`metrics.bootstrapCI`, B = 2000), and with the **exact Clopper-Pearson** 95% interval (two-sided) and one-sided 95% upper bound. For the corpus arms the resampling unit is the recording; for V1 it is the seed. Clopper-Pearson assumes independent units; where units share a recording (V2(b-rep), V2(c), per-axis tallies) this is stated next to the bound. *[Superseded by Amendment C33, 2026-09-29.]* The Clopper-Pearson function is new code in `tools/lib/axis_meaning.js` (not in `metrics.js`), unit-tested against values computed independently on 2026-09-29 by bisection on the binomial CDF: 0/20 → one-sided upper 0.1391, two-sided upper 0.1684; 1/20 → 0.2161 / 0.2487; 0/100 → 0.0295 / 0.0362.
  - Per recording: all 36 ρ, raw p, Holm p, null summaries (mean, SD, min, max; `nullDistribution`), D, minShift, n, point hop, explained variance of PC1–3, the labelling outcome and the gate outcomes.
  - Across recordings: median, IQR (Q1 and Q3, linear interpolation) and a 95% bootstrap CI of the median, for |ρ₁|, the gap |ρ₁| − |ρ₂|, and per-axis explained variance.
  - No paired comparisons between methods are made, so the paired bootstrap and Wilcoxon are not used here.
  - **Information Preservation Reporting (v0.4):** every label is reported next to its axis's explained-variance share. A caption on an axis that explains little variance says so in the export (see the caption templates).

* **Negative control type used:** there are four layers.
  1. The per-test null: a circular-shift (rotation) null over the time-ordered point index (literal arm and A1), or phase-randomised AAFT surrogates of the score series (A2).
  2. V2(a) and V2(a-ext): synthetic stationary white and pink noise through the full PR pipeline (20 + 100 seeds per type).
  3. V2(b): real recordings with the descriptor series misaligned by a large seeded circular shift.
  4. V2(c): mismatched pairing (scores of one recording, descriptors of another), which cannot contain the true alignment; it is the calibration gate for the governing arm.
* **Negative control random seed:**
  - Base 20260720. Per recording r: seed = 20260720 + 1000·r + offset.
  - Synthetic signals are treated as pseudo-recordings with index r ≥ 1000 (table below), so the same formula and offsets apply to them.
  - Offsets are unique **within this experiment**. The same numeric seed may appear in other experiments' seed tables; that is harmless because streams are never shared across experiments. *[Clarified by Amendment C08, 2026-09-29.]*

  | Offset | Use |
  |---|---|
  | +0 | synthetic signal generator seed (pseudo-recordings only; synth.js keeps the signal identical across SNR levels, because the background uses its own stream) *[Superseded by Amendment C01, 2026-09-29.]* |
  | +4 | circular-shift null, full recording or full synthetic signal (as specified; inert while D ≤ 999, recorded anyway) |
  | +5 | V2(b) primary large offset o_r |
  | +7 | circular-shift null, half A (2 s blocks; inert while exhaustive) |
  | +8 | circular-shift null, half B (2 s blocks; inert while exhaustive) |
  | +9 | reserved, unused (V2(c) enumerates all pairs, so no pairing draw is needed) |
  | +10 | A2 surrogates, full recording or full synthetic signal (reused unchanged by V2(b) and V2(b-rep), whose scores are the same series) |
  | +11 | A2 surrogates, half A (2 s) |
  | +12 | A2 surrogates, half B (2 s) |
  | +13 | circular-shift null, half A (4 s blocks, secondary; inert) |
  | +14 | circular-shift null, half B (4 s blocks, secondary; inert) |
  | +15 | A2 surrogates, half A (4 s) |
  | +16 | A2 surrogates, half B (4 s) |
  | +50 … +69 | V2(b-rep) 20 further offsets |
  | +100 + r′ (+100 … +199) | V2(c) A2 surrogates for the truncated scores of r paired with recording r′ (r′ < 100 asserted) |

  **Synthetic pseudo-recording indices:** r = 1000 + 20·t + s, with seed s = 0 … 19 and type t:

  | t | Signal | Role |
  |---|---|---|
  | 0 | pitch (primary: 1000 / 2000 Hz, harmonics [1, 0.5, 0.25]) | V1 gating |
  | 1 | noisiness | V1 gating |
  | 2 | loudness | V1 gating |
  | 3 | bandwidth | V1 gating |
  | 4 | brightness | V1 gating |
  | 5 | white noise | V2(a) gating |
  | 6 | pink noise | V2(a) gating |
  | 7 | pitch, synth.js default (2000 / 4000 Hz pure) | secondary |
  | 8–12 | types 0–4 with the synth.js default `gapSeconds` 0.2 | secondary |

  All V1 signals use `gapSeconds: 0` and `order: "random"` except t = 8–12, which use the default gap and `order: "random"`.

  **V2(a-ext) pseudo-recording indices:** r = 2000 + 100·u + s, with s = 0 … 99 and u = 0 (white noise) or 1 (pink noise). The range 2000 … 2199 cannot collide with the V1/V2(a) range 1000 … 1259 or with the corpus (r < 100). The same offsets (+0, +4, +10) apply.

  Corpus-level seed: 20260720 + 702 for every bootstrap (the same convention as Experiment 007). *[Clarified by Amendment C08, 2026-09-29.]* 20260720 + 703 is reserved for a subsetting draw, which is **not used** (the compute plan pre-commits no subsetting). The runner asserts that all seeds are unique and writes the full table to the JSON. *[Superseded by Amendment C01, 2026-09-29.]*
* **Negative control metric name:** false-label rate per axis (V2(a), V2(a-ext), V2(b), V2(b-rep), V2(c)); run-level false-label rate (V2(a), V2(a-ext)); V2(c) family-wise rate and per-test exceedance rate at raw p < 0.01/36.
* **Negative control numeric result:** Pending run.
* **Negative control threshold:** ≤ **0.05** per axis for V2(a) white, V2(a) pink, V2(a-ext) white, V2(a-ext) pink, V2(b), V2(b-rep) and V2(c). In addition, the run-level rate must be ≤ **0.05** for white and for pink separately, in V2(a) (at most 1 of 20 seeds with any label on any axis) and in V2(a-ext) (at most 5 of 100). V2(c): family-wise rate ≤ **0.02** and per-test exceedance ≤ **2 × 0.01/36**, with ≥ 1000 labellable units. See the decision rule.
* **Negative control pass/fail:** Pending run.
* **Label-exposure risk step:** z-scoring, PCA, descriptor computation, correlation and null testing, the labelling rule, the split-half assignment and axis matching could all see labels if the runner passed them. None of these steps needs species or taxon labels, and none uses them. The V1 ground-truth segment labels are used **only** to score correctness after labelling. They are never passed to PCA, descriptors or the labelling rule.
* **Label-exclusion verification:**
  1. Code inspection before the run, dated in Reproducibility Notes. The analysis stage reads only `audio path`, `recording id`, `source URL` and `licence` from the manifest.
  2. **Label-invariance test (extra rigor):** the first analysed recording is run twice, once with every taxon and label field in an in-memory copy of the manifest replaced by `"REDACTED"`. The SHA-256 of the two per-recording result objects (metadata excluded) must be identical.
  3. For V1, a unit test asserts that the labelling function's signature takes no segment argument.

### Feasibility of the significance criterion (blocking; pre-run)

**Claim.** Under PR, "p_holm,1 < 0.01" is unattainable in every recording.

**Proof.**
- The number of kept points satisfies n ≤ 700. (Without RMS ties at the amplitude-filter threshold, n ≤ 700 − ⌊0.2 · 699⌋ = 561; with ties every tied window is kept, so only n ≤ 700 is guaranteed.)
- The number of admissible rotations is D = n − 2·minShift + 1 ≤ 699, because minShift ≥ 1.
- `circularShiftNull` then runs exhaustively (D ≤ 999), so p ≥ 1/(D + 1) ≥ 1/700 ≈ 0.00143 (≥ 1/561 ≈ 0.00178 without ties).
- Holm multiplies the smallest p by m = 36. So p_holm ≥ min(1, 36/700) ≈ 0.051 > 0.01 (≈ 0.064 without ties).
- The runner logs the exact n, D, p-floor and Holm floor per unit (`feasibility` block).

Other readings do not help:

| Reading | Smallest attainable Holm-adjusted p (guaranteed bound n ≤ 700; no-ties bound n ≤ 561 in brackets) |
|---|---|
| m = 33, as the brief states | ≈ 0.047 (≈ 0.059) |
| Holm per axis only, m = 12 (a weakening; not proposed) | ≈ 0.017 (≈ 0.021) |
| Forced Monte Carlo with B = 999 (p-floor 0.001) | 0.036 |

Halves have about n/2 points and are worse. Worked values under PR (approximate; the runner logs the exact ones):

| Recording length | n | minShift | D | p-floor | Holm floor (× 36) |
|---|---:|---:|---:|---:|---:|
| 30 s (synthetic, measured) | 515 | 33 | 450 | ≈ 0.0022 | ≈ 0.080 |
| 120 s | ≈ 517 | 9 | ≈ 500 | ≈ 0.0020 | ≈ 0.072 |

**Consequence if nothing is changed:** every axis of every recording is "no single sound property explains this direction". V1 is then 0% correct and fails, so labels are disabled. This follows from arithmetic, not data.

Two amendments are proposed. Neither changes α = 0.01, Holm over 36 tests, any ρ threshold, the labelling rule or any gate. Both are always computed; exactly one governs, fixed before the run by the committed governing-arm file (below).

**Proposed amendment A2: phase-randomised amplitude-adjusted (AAFT) surrogates. Proposed as the governing arm.**
- **Basis in `04_Literature/Literature_Database.md`:** Ebisuzaki1997 (significance of a correlation between serially correlated series; widely implemented as the random-phase test) and Theiler1992 (surrogate-data framework; FT and AAFT surrogates are commonly attributed to it). **Confidence caveats, copied from the Lit DB rows:** for Ebisuzaki1997, bibliographic data and abstract are High confidence, but the random-phase method details are **Medium confidence, confirmed only from secondary sources** (the AMS full text was not read). For Theiler1992, the abstract is High confidence, but the FT/AAFT surrogate details are **Medium confidence**, and their attribution to that paper is confirmed only via a secondary source (Räth & Monetti, arXiv:0812.2380). The iteratively refined variant (IAAFT) has **no row in the Lit DB; any IAAFT reference is "citation pending verification"**, and IAAFT is not used here.
- **Null hypothesis tested:** the score series s_c is a monotone transform of a stationary linear Gaussian process that is independent of d_j. Only s_c is randomised; d_j is kept as observed (the Ebisuzaki-style one-sided randomisation). Only s_c's autocorrelation (via the Gaussianised series' power spectrum) and marginal distribution are preserved.
- **Surrogate construction, per unit and per axis c** (n = length of s_c; seeded stream from the table below) *[Superseded by Amendment C01, 2026-09-29.]* *[Superseded by Amendment C32, 2026-09-29.]*:
  1. Draw n standard normal values, sort them, and assign them to the time points in the rank order of s_c (ties in s_c take the average of the tied sorted values), giving g. *[Superseded by Amendment C01, 2026-09-29.]*
  2. Compute the exact length-n DFT of g (no padding, no truncation; Bluestein chirp-z via radix-2 FFT). Keep the DC term and, for even n, the Nyquist term unchanged. For k = 1 … ⌈n/2⌉ − 1 replace the phase by an independent uniform phase on [0, 2π) and set bin n − k to the complex conjugate. *[Superseded by Amendment C01, 2026-09-29.]* Inverse-transform to a real series h.
  3. Reorder the original values of s_c into the rank order of h, giving the surrogate s*. (Spearman depends only on ranks, so step 3 does not change the statistic; it is implemented so that s* has exactly the marginal of s_c.)
- **B = 9999 surrogates per axis**, generated once per axis and reused for all 12 descriptors of that axis (so the 12 tests of one axis share a null ensemble; Holm is valid under arbitrary dependence).
- **p-value:** p_A2 = (1 + #{b : |ρ(s*_b, d_j)| ≥ |ρ_obs|·(1 − 10⁻¹²)}) / (B + 1), two-sided, the same tolerance convention as `circularShiftNull`. Pairs where d_j is NaN (pitch) are dropped pairwise in every surrogate, as for the observation.
- **Floors:** p_A2 ≥ 1/10000 = 10⁻⁴, so the smallest attainable Holm-adjusted p is 36 × 10⁻⁴ = 0.0036 < 0.01. A label is attainable under A2.
- **Known risks, stated honestly:** FT-type surrogates assume stationarity and circular continuity of the series; bird-song score series are neither guaranteed stationary nor continuous across the file ends. There is **no row in `04_Literature/` documenting these pitfalls or their size**, so they are not quantified from literature. Their effect is tested empirically by V2(a), V2(a-ext), V2(b) and, decisively, the V2(c) calibration gate.
- **Implementation checks (unit tests before the run):** the Bluestein DFT agrees with a direct O(n²) DFT to ≤ 10⁻⁹ relative for n ∈ {97, 234, 515, 556, 700}; every surrogate has exactly the multiset of values of s_c; the power spectrum of step 2's output equals that of g to ≤ 10⁻⁹ relative; identical seeds give identical surrogates.

**Proposed amendment A1: Gaussian tail extrapolation of the rotation null. Proposed as non-decisional (reported only).**
- Keep the exact rotation null over all D admissible shifts.
- Replace the p-value **only for tests whose observed |ρ| strictly exceeds every rotation value |ρ_null|** (empirical rank 1) with a Gaussian-tail value on the Fisher scale:
  - clamp |ρ| to at most 1 − 10⁻¹² before transforming (atanh(±1) is infinite); z = atanh(ρ); μ and σ are the mean and SD (n − 1 denominator) of z over all D rotations;
  - p_A1 = 2·normalCdf(−|z_obs − μ| / σ), using `metrics.normalCdf` (computing the lower tail directly avoids the cancellation of 1 − Φ in the far tail);
  - if σ = 0, p_A1 = 1.
- For every other test, p_A1 = the exact rotation p.
- **What A1 does, stated plainly:** A1 is applied only when the observation lies beyond the entire empirical null; it may give p < 1/(D+1), which is its purpose and its risk. That tail is exactly the region a label needs (raw p ≈ 0.01/36 ≈ 2.8 × 10⁻⁴), and it rests on a normality assumption on the Fisher scale for which **no citation exists in `04_Literature/`**.
- A1 applies only to labellable units (D ≥ 100).
- **Why A1 is not proposed to govern:** A2 has a literature basis (with the Medium-confidence caveats above) and needs no extrapolation; A1 has none. A1 is still computed on every unit and passed through every negative control, including V2(c), and reported under `non_decisional`, so that its calibration is documented.

**Calibration gates (both arms; gating for the governing arm only):**
- **Primary: V2(c) mismatched-pairing null** (defined in Validation arms): family-wise rate ≤ 0.02, per-test exceedance of raw p < 0.01/36 ≤ 2 × 0.01/36, per-axis false-label rate ≤ 0.05, with at least 1000 labellable units; otherwise "not validatable".
- **Secondary (coarse, reported, kept from the previous version):** over all 36 raw p-values of every V2(a) and V2(a-ext) noise run, the fraction with p < 0.01 must be ≤ 0.02 and the fraction with p < 0.05 must be ≤ 0.10. This check is kept because it can only remove labels, but it is **not** evidence of calibration in the label-relevant tail (A1 barely changes these fractions, because rank-1 tests already have p ≈ 1/(D+1) ≈ 0.002 < 0.01). The same fractions on V2(b-rep) are reported without gating, for the reason given under V2(b).
- If the governing arm fails any calibration gate, it is declared miscalibrated and labels are disabled. **There is no fallback to the other arm after the data are seen.**

Alternatives considered and **not** proposed:
- Lowering α, or Holm per axis. Both are weakenings, and per-axis Holm is still infeasible (≈ 0.017).
- A block-permutation null with finer resolution. It changes the null, and no row in `04_Literature/` supports it.
- IAAFT surrogates. No verified citation in the Lit DB (see A2 caveats).
- Longer inputs. PR caps n.

### Governing arm: technical pre-commitment

- The governing arm (`"literal"`, `"A1"` or `"A2"`) and the approval record (approver name, date, decision text) live in a committed config file, **`tools/experiments/exp010_governing_arm.json`**. It was created on 2026-09-29 on the written (chat) instruction of the project owner, with `governing_arm: "A2"`. **This notebook proposes `"A2"`**; the owner is asked to approve that choice (or to choose `"literal"`), not A1 alone. *[Superseded by Amendment C32, 2026-09-29.]*
- The runner reads that file, writes its git blob hash (`git hash-object`) and the hash of the commit that last touched it to `meta`, and **refuses to run** if the file is missing, untracked, or differs from HEAD (dirty). If the file is missing the runner stops rather than defaulting, so that "no approval" is an explicit `"literal"` entry.
- The governing arm's verdicts are written under `verdicts`; the other two arms' results are written under `non_decisional` with the field `"decisional": false`.
- **Ordering:** the commit that adds or changes the governing-arm file must be an ancestor of the commit that adds `05_Benchmark_Results/v2/experiment_010_axis_meaning.json`, and the results JSON's `meta.governing_arm_commit` must equal that ancestor. The write-up step checks this with `git merge-base --is-ancestor`; a results file that fails the check is void. *[Superseded by Amendment C02, 2026-09-29.]*
- **Owner approval:** **given 2026-09-29 by Leonard Lind (project owner), in the working session.** Governing arm = **A2**; A1 is computed and reported as non-decisional only; thresholds unchanged. (Earlier the same day the owner had approved A1; after the critique showed A1’s calibration could not be checked, the owner approved A2 as the deciding method.) Recorded in `tools/experiments/exp010_governing_arm.json`, committed before any run.

### Compute plan

**Structural pre-count (2026-09-29).** A scratch script decoded every manifest entry with `readFullAudio` (ffmpeg via `tools/lib/ffbin.js`) and ran only `computeContinuousFrontEnd` (STFT, points, amplitude filter). It computed n, minShift and D for the full recordings, the 2 s and 4 s halves (straddlers excluded) and the mismatched pairs. **No PCA, descriptor, correlation or null was computed on corpus data, so no outcome of this experiment was seen.** The run recomputes all counts.

| Quantity | Count |
|---|---:|
| Evidence recordings decoded | 60 of 60 |
| Analysed (n ≥ 100) | 57 (3 excluded: n = 93, 96, 97) |
| Labellable full recordings (D ≥ 100) | 50 |
| Both 2 s halves labellable | 25 |
| Both 4 s halves labellable | 26 |
| Labellable ordered mismatched pairs (V2(c)) | 2450 |
| Largest n; recordings keeping extra windows through RMS ties | 556; none |
| Demo files: n, D (full); D of halves A / B at 2 s | 234, 169; 28 / 52 (Luscinia_svecica_song) and 269, 204; 72 / 43 (Luscinia_svecica) |

**Measured per-unit wall time (this machine: Apple M2, 8 cores, Node v24.21.0; single thread; 2026-09-29).** Timed with scratch scripts that call the production functions; the A2 timing used a prototype AAFT with a Bluestein DFT (the final implementation may differ). Correlation values were computed only to be timed and were not printed.

| Step | Smoke file (n = 234) | 30 s synthetic (n = 515) |
|---|---:|---:|
| decode | 30 ms | (synthetic, no decode) |
| front end | 64 ms | 264 ms |
| PCA, 3 components | 191 ms | 2584 ms |
| descriptors | 27 ms | 29 ms |
| 36 exhaustive rotation nulls (literal; A1 reuses them) | 425 ms | 2685 ms |
| A2: 3 × 9999 surrogates | not measured with the FFT prototype | 5467 ms |
| A2: 3 × 9999 × 12 correlations | 446 ms per axis (≈ 1.3 s for 3) | 2053 ms |
| **Total per full unit** | **≈ 2 s without A2 surrogate generation** | **≈ 13 s** |

**Units per arm and total estimate** (≈ 13 s per full unit taken as an upper bound for every unit with its own PCA; ≈ 5 s for units that reuse a PCA and their A2 surrogates; ≈ 10 s for V2(c) units, which need new rotation nulls and new surrogates but no PCA). These are extrapolations from the two measured units, not measurements:

| Arm | Units | Estimate |
|---|---:|---:|
| V1 gating (5 types × 20 seeds × 3 SNR) | 300 | ≈ 3900 s |
| V1 secondary (t = 7: 60; t = 8–12: 300) | 360 | ≈ 4700 s |
| V2(a) (2 × 20) | 40 | ≈ 520 s |
| V2(a-ext) (2 × 100) | 200 | ≈ 2600 s |
| Full recordings (57 analysed + 2 demos) | 59 | ≈ 770 s |
| Halves, 2 s and 4 s (2 × 2 × 59) | 236 | ≤ 3100 s (upper bound; halves are smaller) |
| V2(b) (reuses PCA and surrogates) | 57 | ≈ 290 s |
| V2(b-rep) (57 × 20; reuses PCA and surrogates) | 1140 | ≈ 5700 s |
| V2(c) (all labellable ordered pairs) | 2450 | ≈ 24500 s |
| **Total** | | **≈ 46000 s ≈ 12.8 h single-threaded** |

- The runner may distribute units over worker processes. *[Superseded by Amendment C18, 2026-09-29.]* Every unit has its own seed, so results do not depend on the number of workers; the runner asserts this on a 10-unit subset run with 1 and with 4 workers (identical SHA-256 of the unit results).
- **No subsetting (pre-committed).** Every unit listed above is run. If an arm cannot be completed, it is reported as "not run", and every gate that depends on it counts as failed (labels disabled). No subset is drawn after the fact; the reserved seed 20260720 + 703 stays unused.

### Additional pre-registered checks (extra rigor)

- **PR parity and sign check:** on the smoke recording, the runner's PC scores must equal the exporter's `position[c] / positionScale` to ≤ 1e-9 relative, **with the same sign**. This is stricter than Experiment 007's sign-free parity, because labels depend on the sign. If this fails, the run stops.
- **Descriptor alignment:** `flux` must be bit-identical to the exporter's `point.spectralFlux` for every kept point. This mirrors the existing assertion in `tools/test/window_descriptors.test.js`.
- **Experiment 007 dependency gate:** a label on axis c is shipped only if Experiment 007 has run and its single-axis subset {c} for PCA was **not** labelled "not better than random". *[Superseded by Amendment C03, 2026-09-29.]* Before Experiment 007 has results, no label ships. Experiment 008's per-recording weak-view flag, if adopted, is shown next to the caption. *[Superseded by Amendment C03, 2026-09-29.]* This experiment's decision does not depend on it.
- **Within-family sign consistency:** if any other descriptor of F1 (or, for a mix, of either family) has p_holm < 0.01 with the **opposite** sign to that family's best descriptor, the axis gets no label ("inconsistent within family"). This is logged.
- **Loudness confound report (not gating):** for every labelled non-loudness axis, the Spearman partial correlation of the F1 descriptor with the axis controlling for `rms` is reported. Tchernichovski2000 reports that Wiener entropy is negatively correlated with amplitude within motifs, so a "noisiness" axis may partly be a loudness axis.

## Pre-Committed Decision Rule

This rule is defined before any data are seen and is applied mechanically by the runner. The JSON stores the verdicts and every input to them.

### Labelling rule (per unit, per axis c)

- Rank all 12 descriptors by |ρ_jc|. Ties are broken by `DESCRIPTOR_KEYS` order. NaN counts as |ρ| = 0 and p = 1.
- **F1** = the family of the top descriptor, with ρ₁ and p_holm,1 taken from that descriptor.
- **F2** = the family of the highest-ranked descriptor **not** in F1, with ρ₂ and p_holm,2.
- gap = |ρ₁| − |ρ₂|.
- The conditions are evaluated in this order:
  1. **Single label F1** if |ρ₁| ≥ **0.5** AND p_holm,1 < **0.01** AND (gap ≥ **0.1** OR p_holm,2 ≥ **0.01**).
  2. **"Mix of F1 and F2"** if |ρ₁| ≥ **0.4** AND |ρ₂| ≥ **0.4** AND p_holm,1 < **0.01** AND p_holm,2 < **0.01** AND gap < **0.1**.
  3. Otherwise **"no single sound property explains this direction"**.
- Then the within-family sign-consistency check is applied (above).
- **Direction:** sign(ρ₁). A positive sign means the + end of axis c has more of F1, worded with that family's `higher` / `lower` strings in `DESCRIPTOR_FAMILIES`. *[Superseded by Amendment C22, 2026-09-29.]* For a mix, both directions are given. This is unambiguous because the scores and the exported positions come from the same run, and `positionScale` > 0.

### Method-level gates (all must pass for any label to ship)

- **V1, as specified:** the pooled correct rate over the 200 runs (5 primary types × 20 seeds × SNR 30 and 15 dB) must be ≥ **0.90**. The 6 dB results are reported and do not gate.
- **V2(a):** for white noise and for pink noise separately, the per-axis false-label rate over 20 seeds must be ≤ **0.05** on each of the 3 axes. In addition, the run-level rate (any label on any axis) must be ≤ **0.05**.
- **V2(b):** the per-axis false-label rate over analysed, labellable evidence recordings must be ≤ **0.05** on each of the 3 axes.
- **V2(b-rep), extra rigor:** the same threshold, ≤ **0.05** per axis, pooled over 20 × N shifted units.
- **V2(a-ext), extra rigor (in addition to V2(a), never instead of it):** for white and for pink separately over 100 seeds, per-axis false-label rate ≤ **0.05** on each axis, and run-level rate ≤ **0.05**.
- **V2(c) calibration gate for the governing arm** (A2 or A1, whichever governs) *[Superseded by Amendment C31, 2026-09-29.]*: at least **1000** labellable units; family-wise rate ≤ **0.02**; per-test exceedance of raw p < 0.01/36 ≤ **2 × 0.01/36**; per-axis false-label rate ≤ **0.05**. Fewer than 1000 units → "not validatable" → labels disabled. (Under the literal arm the V2(c) criteria are computed and reported, but the literal arm cannot label anything.)
- **Secondary noise-run calibration check** (governing arm), as defined in "Calibration gates".
- **Minimum denominators** met (below).
- **Parity and label-invariance checks** pass.

**Minimum denominators and the Inconclusive outcome (pre-committed).**
- N_min = **30** labellable evidence recordings in V2(b). (Structural pre-count: 50.)
- N_min = **30** axes labelled in half A (2 s blocks) among recordings whose both halves are labellable, i.e. the denominator of the primary V3 statistic. (Structural ceiling: 25 recordings × 3 = 75 axes; the number that will be labelled is unknown before the run.)
- N_min = **1000** labellable units in V2(c) (derived above from the expected-count requirement).
- 30 is a pre-committed convention without literature backing; at 0 events out of 30, the one-sided 95% Clopper-Pearson upper bound is 0.095.
- If any of these is not met, the outcome is **"Inconclusive"**: labels are disabled and reported as inconclusive (not as "the method failed" and not as "the method passed").
- V1 (200 runs), V2(a) (20 per type) and V2(a-ext) (100 per type) have fixed designed denominators.

**If any gate fails: labels are disabled in exports.** The viewer then shows only: *[Superseded by Amendment C20, 2026-09-29.]* *[Superseded by Amendment C22, 2026-09-29.]*
- the raw correlation numbers (all 36 ρ with Holm p, per axis);
- the loadings picture;
- the statement *"No reliable plain-language label exists for these directions. The numbers show how strongly each measured sound property varies along each direction."* *[Superseded by Amendment C20, 2026-09-29.]*

### Per-family and per-export gates (extra rigor; they can only remove labels, never add them)

- **Family gate:**
  - A family whose own V1 control has a correct rate < **0.90** over its 40 runs at SNR ≥ 15 dB is never shipped as a label, even when the pooled V1 gate passes. This prevents a failing family from riding on the others.
  - Families that have **no** positive control (peakiness, tilt, change) are never shipped as plain-language labels.
  - **Pitch is never shipped as a plain-language label in this experiment**, even if its own V1 control reaches ≥ 0.90 and the pooled V1 gate passes. Reason: `DESCRIPTOR_FAMILIES.pitch.validatedForLabelling` is `false`, and `tools/test/window_descriptors.test.js` documents that HPS returns sub-harmonics on pure tones, marks broadband noise as voiced, and cannot report f0 above about 3682 Hz. *[Superseded by Amendment C32, 2026-09-29.]* The gating V1 pitch control (1000/2000 Hz harmonic tones) is the one configuration where HPS is known to work, so passing it does not show that pitch labels are valid on real songs. Pitch stays in the test grid, in the Holm family and in the pooled V1 gate exactly as specified, so the brief's rule is unchanged; its ρ and p are reported as numbers. A looser per-recording pre-condition (≥ 50% of kept windows voiced and 95th percentile of voiced `pitchHz` < 3.6 kHz) was considered and **rejected**, because noise also reads as voiced. Only a separate descriptor-validation experiment that sets `validatedForLabelling: true` can lift this.
  - When F1 is such a family, the axis shows *"Strongest measured association: \<descriptor\> (ρ = …). This property has not been validated for labelling, so no plain-language label is given."* *[Superseded by Amendment C20, 2026-09-29.]* *[Superseded by Amendment C22, 2026-09-29.]*
  - A **mix** is shipped only if **both** F1 and F2 are shippable families under this gate; otherwise the axis shows the same "not validated" statement for the non-shippable family, with both ρ values.
  - F2 is never promoted to take F1's place.
- **Split-half gate** (V3): as defined in Method.
- **Experiment 007 gate:** as defined above. *[Superseded by Amendment C03, 2026-09-29.]*

### V3 and the loadings check

V3 does not gate the method globally (as specified), and neither does the loadings check. Both are reported.

### Caption templates (pre-committed wording, EN; localisation belongs to the viewer) *[Superseded by Amendment C20, 2026-09-29.]*

- **Single label:** "Toward the + end of this direction, moments measure as \<higher-wording\>; toward the − end, as \<lower-wording\> (strongest measure: \<descriptor\>, Spearman ρ = \<ρ₁\>, n = \<n\> moments; confirmed in both halves of the recording). This direction accounts for \<EV\>% of the variation shown." *[Superseded by Amendment C22, 2026-09-29.]*
- **Mix:** "This direction mixes two measured properties: \<F1\> (ρ = …) and \<F2\> (ρ = …); neither explains it clearly better than the other. …" *[Superseded by Amendment C22, 2026-09-29.]*
- **None:** "No single sound property explains this direction."
- **Mandatory suffix on every label:** "This describes the sound as recorded, including background noise, other animals, distance and the recording equipment. It does not say anything about the bird's behaviour or intent." *[Superseded by Amendment C22, 2026-09-29.]*
- **Forbidden in any generated axis text:** syllable, phrase, song type, call type, individual, alarm, aggression, mood, intent, "the bird is/wants", and causal words ("because", "due to"). A unit test scans the templates for these words.
- **Screen words:** the export states axis ends as "+X / −X" (and likewise for Y and Z). Screen words such as "front / back" may be used only if the viewer knows the camera orientation. Otherwise the viewer must say "+ end / − end".

### Outcomes (exhaustive)

| Case | Pre-committed decision |
|---|---|
| No committed governing-arm file, or the file says `"literal"` *[Superseded by Amendment C31, 2026-09-29.]* | The literal arm governs. It gives zero labels by arithmetic, V1 fails, and **labels are disabled**. The feasibility result is reported as the finding. (The runner stops if the file is missing; `"literal"` must be written explicitly.) |
| Governing-arm file dirty, uncommitted, or committed after the results | The run is void. |
| A2 (or A1) governs *[Superseded by Amendment C31, 2026-09-29.]*, and every method-level gate passes and every minimum denominator is met | Labels may ship, **subject to** the family gate (including the pitch exclusion), the split-half gate, the Experiment 007 gate and the within-family check, per export. |
| A2 (or A1) governs *[Superseded by Amendment C31, 2026-09-29.]*, and a minimum denominator is not met | **Inconclusive.** Labels are disabled and reported as inconclusive. The counts and every computed rate are reported. |
| A2 (or A1) governs *[Superseded by Amendment C31, 2026-09-29.]*, and V1 fails | Labels are disabled. Per-family V1 results are reported, to inform a future experiment. |
| A2 (or A1) governs *[Superseded by Amendment C31, 2026-09-29.]*, and V2 fails, or the governing arm is miscalibrated or not validatable (V2(c)) | Labels are disabled. Per v0.4 Failure Criterion 1 ("random or shuffled data produces … structure similar to real data"), this triggers a **documented methodology review, not a threshold adjustment**. There is no switch to the other arm. |
| Parity or label-invariance fails | The run is void. |

Precedence when several rows apply: "void" first, then "literal", then any failed gate (labels disabled, failed), then "Inconclusive", then "labels may ship". A failed gate is reported as a failure even if a denominator is also below its minimum, because a failure on few units is still evidence against shipping.

## Expected Outcome

- **Support:** a non-literal governing arm (proposed: A2) *[Superseded by Amendment C32, 2026-09-29.]* is committed before the run; V1 pooled ≥ 0.90; every V2 rate ≤ 0.05 (including V2(a-ext) and V2(c)); the governing arm passes the V2(c) calibration gate with ≥ 1000 units; every minimum denominator is met; the parity and invariance checks pass. Then labels ship for the shippable families (brightness, noisiness, loudness, width; never pitch, peakiness, tilt or change) that passed their own control, on axes that pass the split-half and Experiment 007 gates.
- **Expected partial outcome (pre-stated, from existing evidence):**
  - the width family and possibly the pitch family fail their own control (see H1); pitch is not shipped either way;
  - many corpus recordings are too short for the split-half gate to be evaluable (median 19.6 s; 25 of 60 have both 2 s halves labellable), so a large share of axes carry "no label" even if the method passes;
  - both demo files ship with no plain-language label (their halves are too short).
  - This is a legitimate result, not a failure of the experiment.
- **Failure (v0.4 Failure Criteria):**
  - the method labels structureless inputs (V2 fails), or its null is miscalibrated on the mismatched-pairing null (V2(c));
  - the positive controls are not recovered (V1 fails);
  - either leads to labels being disabled and a documented methodology review.
- **Inconclusive:** a minimum denominator is not met; labels are disabled and the result is reported as inconclusive, not as support or failure.

⸻

## Pre-run consistency amendments (2026-09-29)

These amendments were made on 2026-09-29, before any run, after an independent 12-agent audit of Experiments 007 to 012. No threshold, B value, statistic or seed value changes; gates only become stricter. An amendment that touches several notebooks has the same ID and the same Change text in each. References of the form 010:NNN are line numbers of this notebook as committed in fec9d2d, before this section was added. The pre-registered text above is kept. Each superseded passage carries the marker "*[Superseded by Amendment Cnn, 2026-09-29.]*", and each passage that an amendment only clarifies carries "*[Clarified by Amendment Cnn, 2026-09-29.]*". A marker names one amendment; a passage touched by several amendments carries one marker per amendment. Owner decisions are cited as OD-n. OD-1, OD-2 and OD-3 were taken by Leonard Lind (project owner) on 2026-09-29, in a working session with Claude Code in chat on the Windows PC.

Amendments cited here but recorded in other notebooks of the set. C04 (human review of description text, per language), named in C20 (1) and C22 (1), C23 (S7, the similarity-line sentence), named in item (a) of the C22 drafting note, and C26 (S2b facts, gate and payload source), named in C03 (7), are recorded only in the notebook of Experiment 011 (`03_Research_Notebook/Experiment_011_Description_Claims_Audit.md`). C05 (ffmpeg reference binary for Part A), named in C20 (3), is recorded only in the notebook of Experiment 012 (`03_Research_Notebook/Experiment_012_Compare_Mode_Timing_and_Grid_Sensitivity.md`). C26 in turn cites C24 (evidence statuses that fail closed), recorded only in Experiment 011's notebook, and C24 cites C14 (cross-checks do not depend on run order), recorded in the notebooks of Experiments 007, 008 and 012 (`03_Research_Notebook/Experiment_007_Reducer_Rebenchmark_Production_Regime.md`, `03_Research_Notebook/Experiment_008_Display_Views_Information_Preservation.md` and the Experiment 012 notebook above). The other amendments that these subsections cite (C02 and C03) are recorded here. Their text is not repeated here. In particular, the display conditions of C20 and C22 depend on the human checks of C04, which exist only in Experiment 011's notebook. This notebook's freeze does not cover other notebooks, so the note on external amendment texts under C02 makes the freeze sidecar hash all of these subsections.

A passage that an amendment only extends (adding seeds, constructions or checks while the original words stay in force) carries "*[Supplemented by Amendment Cnn, 2026-09-29.]*" (definition added 2026-09-30). Dated additions (2026-09-30, before any run and before the freeze). Some amendments carry a line "Addition (2026-09-30, before any run)" after their Change text and notes. An addition with the same amendment ID has the same text in every notebook that records the amendment. A marker dated 2026-09-30 points to such an addition. Owner decisions OD-6, OD-7 and OD-8 were taken by Leonard Lind (project owner) on 2026-09-30, in a working session with Claude Code in chat. The additions change no threshold, B value, statistic or seed value.

### Amendment C01 (2026-09-29, before any run): random numbers, Philox4x32-10 (also the dated amendment to A2 surrogate generation)

- **Why:** SEED-1 (seeds), SEED-2, SEED-3, SEED-6, SEED-7, SEED-8, SEED-11 and the seeds-lens missed items: the legacy generators (32-bit LCG makeRandom, mulberry32) have one short cycle, so different seeds were shown to give overlapping, shifted copies of the same random numbers (009 calibration, 010 noise and backgrounds, 007/008/009/012 controls), and several draws named no generator at all. (All finding IDs: SEED-1 (seeds), SEED-2, SEED-3, SEED-6, SEED-7, SEED-8, SEED-11, MISSED-seeds-1, MISSED-seeds-2, MISSED-seeds-4.)
- **Change:** Amendment C01 (OD-1). (1) Generator. Every random draw that feeds a v2 result comes from Philox4x32-10 (Salmon, Moraes, Dror & Shaw 2011, "Parallel random numbers: as easy as 1, 2, 3", SC11, DOI 10.1145/2063384.2063405), implemented in tools/lib/rng.js. This covers negative controls (matched Gaussian, column permutation, label shuffles), surrogates (phase-randomised, AAFT, frame shuffles), calibration matrices and graphs, every bootstrap (ordinary, paired, observer-cluster), chance and null draws, compute-subset draws, random offsets, random projections, synthetic signals and their noise, backgrounds and jitter, decoy and packet draws, and the seeds of stochastic reducers where the library accepts a random function. (2) Key and counter. A stream is identified by the key (k0, k1) = (seed, subStream). seed = the value already given in this notebook's seed table (a 32-bit unsigned integer; no seed value changes). subStream = a 32-bit unsigned index, 0 unless the C01 note of this notebook assigns another value. The 128-bit counter starts at 0 and increases by 1 for each 4-word output block (word 0 is the least significant, with carry into words 1 to 3). Distinct (seed, subStream) keys give distinct streams that are not segments of one shared cycle, and one stream cannot wrap (2^128 blocks). (3) Consumption. A stream's 32-bit words are used in order: block 0 words 0 to 3, then block 1 words 0 to 3, and so on. Each draw takes the next unused words. When a notebook uses one seed for several fits or calls (for example the same reducer seed for X, G, P, S and F, or the same bootstrap seed for every CI), each fit or call starts a fresh stream with that key at counter 0, exactly as the legacy makeRandom(seed) restarted per call. (4) Uniform double in [0, 1): take the next two words a, then b; u = ((a >>> 5) * 2^26 + (b >>> 6)) / 2^53. (5) Standard normal: take the next two uniforms u1, then u2; u1 = max(u1, 1e-12); z = sqrt(-2 ln u1) * cos(2 pi u2) (Box-Muller cosine branch; the sine value is not used). Matrices of normals are filled row-major, as metrics.randomMatchedMatrix does, unless this notebook states another order. (6) Derived draws: integer in [0, m) = floor(u * m); uniform on [lo, hi) = lo + (hi - lo) * u; uniform phase = 2 pi u; Fisher-Yates shuffle of m items: for i = m - 1 down to 1, swap item i with item floor(u * (i + 1)); a column-permuted matrix shuffles columns in order 0 to d - 1 from one stream, as metrics.columnPermutedMatrix does. (7) Bootstraps: resample index = floor(u * n), for resamples b = 1 to B in order and positions i = 1 to n within each; each CI call starts a fresh stream from (bootstrap seed, 0), so comparisons of equal length that share a seed still share resample index sets, as pre-registered. (8) Constructions are unchanged apart from the uniform source: G is i.i.d. N(0,1) of the same shape by (5), row-major; P is per-column Fisher-Yates by (6). (9) Synthetic signals (tools/lib/synth.js, v2 mode): the signal stream uses key (seed, 0) and the background stream key (seed, 1); normals by (5), uniforms by (4). (10) Legacy generators. metrics.makeRandom (the Experiment 001 LCG) and synth.mulberry32 stay in the code only to reproduce pre-v2 results (for example the unit test that metrics.randomMatchedMatrix equals the Experiment 001 function). No v2 runner may use them for any governing stream. (11) No silent default seeds. In a v2 runner, a call that omits a seed is an error: synth DEFAULTS seed 1, reducers `seed ?? 0` and metrics DEFAULT_SEED may not be used. Deterministic reducers (pca) are called through pca() directly, or reduceFeatures asserts that no seed is consumed; no seed is invented for them. In reduceFeatures, a namespaced seed or dimensions value that differs from the top-level value is an error. For every UMAP, random-projection and random-initialised t-SNE run, the runner asserts that the returned details.seed equals the seed-table value. (12) Tests that must pass before the run: rng.js reproduces the official Random123 known-answer vectors for philox4x32 10 (https://raw.githubusercontent.com/DEShawResearch/random123/main/tests/kat_vectors), for example key 00000000 00000000 with counter 0 gives 6627e8d5 e169c58d bc57ac4c 9b00dbd8; determinism for a fixed key; the v2 matched-Gaussian and column-permutation constructors, given the legacy LCG as their uniform source, reproduce the Experiment 001 functions bit for bit (so only the source changed); the seed-uniqueness test also asserts that every (seed, subStream) key this experiment uses is distinct, so streams cannot overlap by construction, and that no legacy generator is reachable from the v2 governing code. (13) Unchanged: every pass/fail threshold, every B value, every statistic, every seed value and every seed offset. Numbers quoted in this notebook from pre-registration scratch runs that used the legacy generators are planning figures only; the runner regenerates them with Philox.
  - **C01 note for 010.** This amendment is also the dated amendment to A2's surrogate generation. A2: for each unit, axis c in {1, 2, 3} and surrogate b in {1, ..., 9999}, the stream key is (the unit's A2 seed from the table: offset +10, +11, +12, +15, +16 or +100 + r', subStream = 10000*(c - 1) + b). Each surrogate stream first draws the n standard normals of step 1 by C01 (5), then the ceil(n/2) - 1 phases of step 2 as 2 pi u for k = 1 to ceil(n/2) - 1 in ascending k. Each surrogate therefore depends only on its key, so results cannot depend on worker count or scheduling. V2(b) o_r (offset +5) and each V2(b-rep) offset (+50 to +69): o_r = L + floor(u*(n - 2L + 1)) from one uniform. circularShiftNull (offsets +4, +7, +8, +13, +14) stays exhaustive while D <= 999; if it ever samples, it uses key (seed, 0). Synthetic pseudo-recordings (r = 1000 to 1259 and 2000 to 2199): synth v2 mode, signal subStream 0, background subStream 1; every V1, V2(a) and V2(a-ext) signal and background stream is therefore distinct by construction (this removes the legacy overlaps between noise signals and between V1 backgrounds). Bootstraps, including the V2(c) cluster bootstrap by scores-recording: key (20260720 + 702, 0), fresh for each CI. Unchanged: B = 9999, Holm over 36, alpha = 0.01, every gate, and tools/experiments/exp010_governing_arm.json. The per-unit timings at 010:368-379 used a prototype and stay planning figures.
- **Addition (2026-09-30, before any run):** Amendment C01 (OD-6). (a) Owner decision OD-6: PCA is called without a seed. Deterministic PCA draws no random numbers, so pca() and reduceFeatures with method "pca" are called with no seed, and no seed is invented for them. This is an explicit, owner-approved exception to the rule of (11) that a call which omits a seed is an error. It applies only to deterministic PCA; for every other call, omitting a seed stays an error. (b) A test is added to (12). It must pass before the run of every experiment of this set, because each one fits PCA through pca() or through the exporter path. On a fixed fixture, the test calls pca() and reduceFeatures with method "pca" with no seed and with at least two different explicit seed values. It asserts that every embedding and every details object is bitwise identical across these calls, and that no random stream (Philox or legacy) is created or read during them. A PCA call that consumes a random number is an error. (c) The legacy generators of (10) also include tools/lib/reducers.js makeRandom, a 32-bit LCG that reducers.js exports. Like the other two, it stays in the code only to reproduce pre-v2 results; no v2 runner may use it for any governing stream, and the test of (12) that no legacy generator is reachable from the v2 governing code covers it. (d) Strictness: (a) confirms the treatment of deterministic PCA already stated in (11), and (b) and (c) only add tests; no threshold, B value, statistic or seed value changes.
- **Supersedes:** 010:313 "seeded stream from the table below" (generator and draw order now fixed); 010:314 "Draw n standard normal values"; 010:315 "replace the phase by an independent uniform phase on [0, 2π)"; 010:166 "o_r is drawn uniformly from the integers in [L, n − L]"; 010:169 "20 further offsets per recording (seed offsets +50 … +69)"; 010:171 "disjoint from the V2(a) seeds" (now disjoint as streams, not only as seed values); 010:235 "+0 | synthetic signal generator seed" (synth v2 mode); 010:269 "The runner asserts that all seeds are unique" (extended by C01 (12) to distinct (seed, subStream) keys, to non-overlap by construction and to the absence of legacy generators from v2 governing code); 010:567 "seed uniqueness;" (extended).
- **Strictness:** Implements owner decision OD-1: it only changes where the uniform numbers come from, makes independence true by construction, forbids silent seeds and adds tests; no threshold, B, statistic or seed value changes.
- **Owner approval:** OD-1, Leonard Lind (project owner), 2026-09-29, working session with Claude Code in chat on the Windows PC. OD-6 (the addition of 2026-09-30), Leonard Lind (project owner), 2026-09-30, working session with Claude Code in chat.

### Amendment C02 (2026-09-29, before any run): Freeze of pre-registration, runner and code before the first run

- **Why:** FRZ-1, FRZ-2, APPR-08 and missed items: only 007 had a freeze, its span left out shared libraries and pre-registered text, run-time fields sat inside the hashed span, and nothing checked hashes against a stored reference. A later verification of these amendments found that the Results and Decision lines and 009's label-exclusion line were not covered by the anchor wording, and that nothing limited what an appended block may contain. (All finding IDs: FRZ-1, FRZ-2, FRZ-3, APPR-08, MISSED-ids-3, MISSED-ids-6, MISSED-approvals-5.)
- **Change:** Amendment C02 (OD-2). (1) What is frozen. Before this experiment's first real (corpus) run, the project owner freezes: (a) its pre-registration; (b) its runner or runners; (c) every repo module under tools/ in each runner's require graph (for example tools/lib/reducers.js, metrics.js, synth.js, rng.js, window_descriptors.js, fft.js, tools/export_single_recording_dataset.js and any new tools/lib module) and every repo data or config file the runner reads; plus the resolved name, version and integrity (from package-lock.json) of each third-party package the runner loads (not the whole lockfile), and the SHA-256, version string, platform and architecture of the ffmpeg and ffprobe binaries the runner resolves through tools/lib/ffbin.js. (2) Extent of the pre-registration (stricter reading, see Strictness). OD-2 names the notebook up to the line "## Results"; because its exclusions name fields that also lie after that line, the whole notebook file is frozen, except only: the **Date:** line; the **Status:** line; the blocks appended directly below the append anchors listed under (7); the value fields of the Freeze record; and the dated, append-only Deviations list. Nothing else may change after the freeze. Stricter than OD-2's minimum: any arm whose output enters a verdict or gate (synthetic, calibration, fixture or corpus) also waits for the freeze; unit tests and smoke tests on the smoke file may run before it. (3) How it is recorded. The freeze is a commit the owner approves. It adds tools/experiments/exp0NN_freeze.json (NN = this experiment) holding: owner, date, the freeze commit, the SHA-256 of the canonical frozen notebook text, the append anchors as (7) lists them, the git blob hash of each frozen file, the package list with name, version and integrity, the ffmpeg/ffprobe binary records, and the experiment-specific references below. Canonical text: the notebook's UTF-8 content with CRLF normalised to LF, split into lines, with the excluded lines and every appended block removed, joined with LF. (4) What the runner does. At start-up the runner computes all of these values, writes them to the results JSON (preregistration.hashes), and refuses to run on any mismatch with the sidecar or on any uncommitted change to a frozen file. Only an explicit override flag lets it run; the whole output is then marked "exploratory, not pre-registered" and may never feed a verdict, a Decision Log row, an evidence block or any viewer or exported text. (5) The commit that adds the results JSON must have the freeze commit as an ancestor (git merge-base --is-ancestor); otherwise the result is void. (6) Any change after the freeze is a dated entry in the Deviations list, with what changed, why, and whether results had been seen; the original text is kept. (7) Append anchors. The anchors are exactly these lines, and no others: (i) every line that begins with "Pending run." (this includes the lines that read only "Pending run.", the first line under "## Results" and the first line under "## Decision"); (ii) every line that ends with "Pending run." (in these notebooks, the "Negative control numeric result" and "Negative control pass/fail" lines); (iii) the "Label-exclusion code inspection" line of Reproducibility Notes (007:467, 008:529, 009:492, 010:552, 011:467, 012:592), named here because its wording differs between the notebooks. No other line is an anchor, whatever its wording; the "run date to be filled in at run time" on the **Date:** line is covered by the Date-line exclusion. Each notebook's C02 note lists its anchors. The sidecar lists every anchor of this notebook explicitly, each by its exact text, its order among lines with the same text, and its line number in the notebook file at the freeze commit. An anchor line itself is never edited; run-time values and results are written only in the block appended directly below it. An appended block is the run of lines inserted between a listed anchor and the frozen line that followed it at the freeze; pre-registered text that follows an anchor in the same section (for example a planned JSON layout, pre-stated limitations or the Decision bullets) stays frozen. Any other added, removed or changed line outside the excluded lines of (2), and any difference between the notebook's anchors and the sidecar's list, is a change to the frozen text: a mismatch under (4), and a dated entry under (6). An appended block may hold only run-time values and records (measured values, counts, verdicts and decisions produced by the pre-committed rules, the discussion of the results, dates, names, file paths and hashes), never rule text: no new or changed threshold, gate, method, seed, definition, decision rule or visitor-facing string. Rule text in an appended block is a change to the frozen text under (6). At start-up the runner writes each anchor, with the SHA-256 of the block appended below it at that time (UTF-8, LF line ends; the SHA-256 of the empty string when nothing is appended), to the results JSON (preregistration.appendedBlocks).
  - **Note for 010.** Sidecar: `tools/experiments/exp010_freeze.json`. `tools/experiments/exp010_governing_arm.json` is a frozen config file (see Amendment C31). Checkpoints record the freeze hashes (Amendment C18). The value fields of the freeze and the Deviations list are kept in the subsection "Freeze record" at the end of Reproducibility Notes. Append anchors of this notebook under (7), numbered as in fec9d2d: 010:271 and 010:273 (negative control numeric result and pass/fail, each ending "Pending run."); 010:506 (the first line under "## Results"); 010:512 (Unexpected Observations); 010:516 (Discussion; the pre-registered limitations below it stay frozen); 010:532 (the first line under "## Decision"); 010:552 (label-exclusion code inspection, "to be recorded here at run time"). 010:81 ("Final counts are filled in at run time from the manifest and logged with its SHA-256") is not an anchor: those counts go to the results JSON and to the Results section. The "run date to be filled in at run time" on the **Date:** line is covered by the Date-line exclusion.
  - **Note for 010, external amendment texts.** The amendments that this section's introduction lists as recorded in other notebooks are not part of this notebook's canonical text, so under (3) alone a later change to them would not change this experiment's hashes. The sidecar therefore also holds, for each listed amendment and for each notebook of Experiments 007–012 that records it, that notebook's path and the SHA-256 of the amendment's subsection there, computed from the freeze commit. A subsection is the lines from the line that begins "### Amendment Cnn " up to, not including, the next line that begins with "### " or "## ", with CRLF normalised to LF, joined with LF. The list is closed under citation: any ID of the form C followed by two digits that appears inside a hashed subsection, heads an amendment subsection in one of the six notebooks and is not recorded in this notebook is hashed too, repeated until no new ID appears. An amendment that this notebook records itself is covered by this notebook's canonical text, because its Change text is the same in every notebook. At start-up the runner computes these hashes from the current files, writes them to preregistration.hashes and refuses to run on any mismatch, as (4) states. It also refuses to run if a line of this notebook from "## Pre-run consistency amendments (2026-09-29)" up to "## Results" names an ID of the form C followed by two digits that is neither recorded in this notebook nor hashed in the sidecar. A change to a hashed subsection after this experiment's freeze is a mismatch under (4) and a dated entry in this notebook's Deviations list under (6). For 010 the hashed subsections are, as the notebooks stand on 2026-09-29: C04, C23, C24 and C26 in Experiment 011's notebook; C05 and C14 in Experiment 012's notebook; and C14 in the notebooks of Experiments 007 and 008.
- **Addition (2026-09-30, before any run):** Amendment C02 (OD-8). (a) Two-commit freeze. Under (3), the freeze commit adds a sidecar that records the freeze commit, that is, its own hash; a commit cannot contain its own hash. Owner decision OD-8 replaces this one recording step with two commits, both approved by the owner. Commit 1, the input freeze commit, contains this notebook, the runner or runners and every frozen code, data and config file of (1), each in its frozen form. Commit 2 has commit 1 as its only parent. It adds tools/experiments/exp0NN_freeze.json, which records the full hash of commit 1 and every value that (3) lists, each computed from commit 1. Commit 2 changes no line of any frozen file, except the value fields of this notebook's Freeze record, which (2) excludes from the frozen text. In (3), (4) and (5), and in every note of this set that names the freeze commit, the freeze commit now means commit 1. The commit that adds the results JSON must have commit 2 as an ancestor, and so commit 1 as well. Where a sidecar holds more than one freeze record (for example one per audit run in Experiment 011), each record has its own commit 1 and commit 2, and each commit 2 only appends its own record. (b) Start-up checks, in addition to (4). The runner refuses to run unless all of these hold: commit 1 is an ancestor of HEAD (git merge-base --is-ancestor); the freeze record in the sidecar at HEAD is unchanged from the version its commit 2 added, and it names commit 1; every frozen file other than this notebook is byte-identical at HEAD to its version in commit 1, with the git blob hash that the sidecar records; the canonical text of this notebook at HEAD, as (3) defines it, has the SHA-256 that the sidecar records, which is that of its canonical text in commit 1 (the notebook is compared by its canonical text because (2) lets its excluded lines change after the freeze); every other hash in the sidecar matches; and the working tree has no staged, unstaged or untracked change to any frozen file or to the sidecar. No check of (3) to (7) is removed. (c) New freeze after a deviation. After a freeze, any change recorded in the Deviations list under (6) needs a new owner-approved freeze, made by the same two-commit procedure, before any governing run. The new freeze record names the Deviations entries it covers. At start-up the runner refuses to run if the Deviations list holds an entry that no freeze record names; with the override flag of (4), its output stays exploratory. A recorded deviation never lets a run with mismatching hashes count as pre-registered. (d) Strictness: (a) makes (3) possible to carry out without dropping any recorded value, and (b) and (c) only add checks.
- **Supersedes:** 010:6 Status line "**Status:** Pre-registered, not yet run" (updated in place to the current status); 010:350 "the commit that adds or changes the governing-arm file must be an ancestor of the commit that adds `05_Benchmark_Results/v2/experiment_010_axis_meaning.json`" (the ancestor check covered the governing-arm commit only; it now also covers the freeze commit, by (5)).
- **Strictness:** Implements owner decision OD-2 and only adds checks; where OD-2's wording could be read two ways, the wider frozen set and the earlier freeze point are taken; the append anchors are a closed list (before "## Results" only the "Pending run." fields that OD-2 itself excludes; every other anchor lies after "## Results", where OD-2 requires no freeze at all), and an appended block may hold no rule text.
- **Owner approval:** OD-2, Leonard Lind (project owner), 2026-09-29, working session with Claude Code in chat on the Windows PC. OD-8 (the addition of 2026-09-30), Leonard Lind (project owner), 2026-09-30, working session with Claude Code in chat.

### Amendment C03 (2026-09-29, before any run): Viewer label for a non-pass view; gates keyed to verdicts, not strings

- **Why:** LBL-1, APPR-01, APPR-02, SD-1, SD-2, XREF-1, XREF-2 and two missed items: 007 labels every fail "not better than random", 008 allows that phrase only when U <= 0, and 010's gate and 011's S2b matched the text string, so a failed axis could slip through and the no-007 case was handled three ways. (All finding IDs: LBL-1, APPR-01, APPR-02, SD-1, SD-2, XREF-1, XREF-2, MISSED-approvals-4, MISSED-cross-2.)
- **Change:** Amendment C03 (OD-3). (1) Verdicts are unchanged. 007's per-subset verdicts against G and P (pass, fail and not evaluable, 007:335-341; descriptive only, 007:143 and 007:393) and 008's per-view verdict against G (pass, inconclusive, fail; 008:343-350) are computed exactly as pre-registered. (2) For display, each of the three CIs, 008-G, 007-G and 007-P, is classified by 008 rule 1: pass if L >= 0.02; inconclusive if L < 0.02 <= U; fail if U < 0.02. The view's joint outcome is the worst of the three (fail < inconclusive < pass). A 007 subset that is not evaluable or descriptive only, a missing 007 result, and an active 007/008 mismatch suspension are never a pass. (3) Label text (008's exact wording governs): joint inconclusive gives "below the pre-committed margin (inconclusive)". Joint fail gives, for each control named, "not shown to beat a random matrix by the 0.02 margin" if that control's worst CI has U > 0, and "not better than a random matrix of the same size" only if that CI has U <= 0. When the worst outcome comes from P, "a random matrix" is replaced by "a column-shuffled copy of the features"; if a G CI and a P CI share the worst outcome, both controls are named, each with its own form, in one label. The words "not better than random" are used only when U <= 0. A view that fails 007's pre-registered rule against G or P (007 CI lower bound < 0.02) is never labelled "inconclusive"; it carries "not shown to beat a random matrix by the 0.02 margin" (or the U <= 0 form, with the P substitution). (4) The set of views with a non-pass label never shrinks: every view that is a non-pass in 007 (against G or against P) or in 008 (against G) carries a non-pass label whenever it is displayed, for every recording. Every consequence of a 007 fail is unchanged: v0.4 Failure Criterion 1, the documented methodology review, the Reject template decision, and no per-recording flag shipped for that view. (5) The per-recording "weak for this recording" flag (008 rule 3) may be shown for a view only if the view's joint outcome is pass and 008 rule 3 allows it. (6) While 007 has not run or is not decided, no view has a joint pass: a view whose 008-G outcome is a non-pass carries that 008 label; any other view shows only the measured numbers of 008 rule 5, with no verdict label and no per-recording flag. All displays in (3), (4) and (6), including the measured-numbers-only case, remain subject to every evidence, copy and human-review gate; when a required label or number is withheld, the view it qualifies is also withheld. (7) Gates in other experiments read verdicts, never label strings. 010's Experiment 007 gate is met for axis c only if 007's results JSON gives PCA subset {c} the verdict "pass" against both G and P and no 007/008 mismatch suspension is active; anything else (fail, not evaluable, descriptive only, missing, suspended, or 007 not run) means no label on axis c. 011's S2b reads the joint outcome and its exact label text from the export and fails closed unless Experiments 007 and 008 are both decided (Amendment C26).
  - **Note for 010.** The 008 weak-view flag may be shown next to an axis caption only where C03 (5) allows it.
- **Addition (2026-09-30, before any run):** Amendment C03 (OD-7). (a) In (7), 010's Experiment 007 gate also needs the 007/008 consistency check of Amendment C14 to have run and to be recorded as passed. Until it has, the gate is not met for any axis. (b) Owner decision OD-7 accepts the stricter reading of C14 (3) (see the 2026-09-30 addition to Amendment C14). So the case of (6) in which a view whose 008-G outcome is a non-pass carries that 008 label applies only after 007 has run and the C14 consistency check has run and passed. Before that, the view is withheld from visitors entirely: no label, no number and no view. The measured-numbers-only case of (6) waits for the same check, as C14 (3) already requires. Every non-pass outcome stays recorded in the research results. (c) The citation in (1) was corrected on 2026-09-30. It read "(pass, fail, not evaluable, descriptive only; 007:335-341)"; "descriptive only" is defined at 007:143 and 007:393, not at 007:335-341. (d) Strictness: (a) and (b) only withhold more, and (c) corrects a citation; no verdict, label text or threshold changes.
- **Supersedes:** 010:403 "a label on axis c is shipped only if Experiment 007 has run and its single-axis subset {c} for PCA was **not** labelled "not better than random"" and "Experiment 008's per-recording weak-view flag, if adopted, is shown next to the caption"; 010:459 "Experiment 007 gate: as defined above."
- **Strictness:** Implements owner decision OD-3: no verdict or threshold changes, the set of labelled non-pass views cannot shrink, and every gate becomes at least as strict as before.
- **Owner approval:** OD-3, Leonard Lind (project owner), 2026-09-29, working session with Claude Code in chat on the Windows PC. OD-7 (the addition of 2026-09-30), Leonard Lind (project owner), 2026-09-30, working session with Claude Code in chat.

### Amendment C07 (2026-09-29, before any run): Provisional Decision-Log IDs

- **Why:** ID-1, APPR-19, SD-11, XREF-21, CODE-22, INC-4: the notebooks proposed decision IDs in two conflicting ways (by experiment number and by closing order), and 007, 008 and 011 did not say that the owner assigns the final number.
- **Change:** Amendment C07. Provisional Decision-Log IDs, by experiment number and whatever the closing order: Experiment 007 -> D-014; Experiment 008 -> D-015; Experiment 009 -> D-016; Experiment 010 -> D-017; Experiment 011 -> D-018; Experiment 012 Part A -> D-019 (Part B proposes no entry). The final numbers are assigned by the project owner when the rows are added to 07_Decision_Log/Decision_Log.md. Cross-references name the experiment first, for example "Experiment 007's decision (provisionally D-014)". Any later renumbering is a dated entry in the Deviations list, never a rewrite.
- **Supersedes:** 010:5 "**D-0NN: plain-language axis labels in exports ...** NN is the next free number ≥ 14 when results come in. ... so this is expected to be D-016 or later."; 010:534 "the proposed **D-0NN**".
- **Strictness:** Documentation only; no rule or threshold changes, and the owner keeps the final numbering.

### Amendment C08 (2026-09-29, before any run): Seed index conventions are experiment-local

- **Why:** SEED-1 (ids-paths-freeze), APPR-25, SD-7, XREF-22, CODE-21, SEED-9: demo indices and corpus-level seed meanings differ between notebooks; nothing collides, but the hand-off asked for identical shared definitions.
- **Change:** Amendment C08. Seed index conventions are experiment-local, as 010:231 states. (1) Demo files: r = 900 + d in 007 and 008 (identical, as their exact T_G cross-check needs); r = 60 + d in 009 and 010, on purpose, because 010's assertion that the manifest has fewer than 100 entries (which keeps the V2(c) offsets +100 + r' from overflowing) depends on it; 011 uses a combined internal index with no per-recording seeds (011:257); 012 Part B uses evidence recordings only. (2) Corpus-level seed meanings are defined only by each notebook's own table: for example +703 is 007's observer-cluster bootstrap, 008's split-half agreement bootstrap and unused in 010; the recording-level bootstrap seed is +702 in 007, 008 and 010, +909 in 009, +1104 in 011 and +712 in 012. 010:269's "(the same convention as Experiment 007)" refers to +702 only. (3) No seed value changes. Under Amendment C01, streams are shared between experiments only where a notebook says so: the 007/008 matched Gaussian (+1) and column permutation (+2), both with subStream 0.
- **Supersedes:** none. The clarification is marked next to 010:83, 010:231 and 010:269.
- **Strictness:** Documentation only; no seed, offset or rule changes.

### Amendment C11 (2026-09-29, before any run): Runners use only shared, tested code

- **Why:** XREF-18, APPR-09, CODE-8, SD-18 and a missed item: 008 and 012 allowed runner-private fallbacks for code that must match across experiments, and the hand-off's "use only tools/lib/*" sat in tension with the notebooks' use of exported exporter functions. (All finding IDs: XREF-18, APPR-09, CODE-8, SD-18, MISSED-approvals-6.)
- **Change:** Amendment C11. (1) Every metric, statistic, surrogate, FFT, bootstrap, eigen-solver wrapper and random-number routine a runner uses lives in tools/lib, or is an exported production function of tools/export_single_recording_dataset.js, and has the unit tests this notebook lists. No runner-private implementation is allowed. "Use only tools/lib/*" means no re-implementation; using the exporter's exported production functions is allowed and required. (2) Runner-private fallbacks are withdrawn (see Supersedes). (3) The exact eigen-solver is ml-matrix 6.14.0, a transitive dependency pinned by package-lock.json, used through a tested tools/lib wrapper; the runner asserts its presence and version at start-up.
- **Supersedes:** none. This notebook grants no runner-private fallback, and 010:540 already requires `tools/lib/axis_meaning.js`; the rule is added.
- **Strictness:** Removes permissions for private code and adds a version check; nothing is loosened.

### Amendment C12 (2026-09-29, before any run): A skipped unit test counts as not passed

- **Why:** CODE-10: some tests skip silently when the smoke file is missing, and 007:180 said what a failure means but not what a skip means.
- **Change:** Amendment C12. A unit test that is skipped counts as not passed, with the same consequence as a failure. The only exception is a test that is skipped because it is explicitly gated to performance measurement by an environment variable (the performance test in tools/test/metrics.test.js). The runner records the status of every test by its actual name (pass, fail or skip) in the results JSON.
- **Supersedes:** 010:553 "Unit tests ... that must pass before the run" (skips now count as not passed).
- **Strictness:** Only makes the test requirement stricter.

### Amendment C18 (2026-09-29, before any run): Checkpointing that cannot mix code versions

- **Why:** APR-2, APPR-17, SD-19, XREF-28: the owner asked for worker threads, checkpoints and logged times (HANDOFF 2026-09-29); 010 had no checkpointing, and neither 009 nor 010 prevented a resume from mixing code versions.
- **Change:** Amendment C18. Recorded owner instruction (2026-09-29): "Use worker threads across cores, checkpoint, and log the actual times." (1) The runner checkpoints after every completed unit (010: per unit; 009: per recording and arm, and per calibration replicate) and can resume from the checkpoints. It logs actual wall time per unit and per arm and the worker count. (2) Every checkpoint records the freeze-sidecar hashes, the freeze commit and (010) the governing-arm file blob. A resume refuses if any of these differs from the current values; units computed under different code or config versions are never combined. (3) A unit test asserts that a run interrupted and resumed gives the same unit-result SHA-256 as an uninterrupted run (010: extending the worker-count invariance test, 010:563). Seeds and results do not change.
- **Supersedes:** 010:396 "The runner may distribute units over worker processes." (checkpointing was missing).
- **Strictness:** Only adds checks; nothing that is run or decided changes.

### Amendment C20 (2026-09-29, before any run): Visitor-facing strings only as audited text

- **Why:** XREF-12 and a missed item: 008's view labels, 010's axis captions and 012's user caveats are visitor text outside 011's closed set, and 010 left their translation to the viewer, against the recorded consequence that nothing is shown before human review. A later verification of these amendments found that withholding such a string could leave the view, numbers or feature it qualifies on screen without its caveat or non-pass label. (All finding IDs: XREF-12, MISSED-cross-4.)
- **Change:** Amendment C20. (1) Every visitor-facing string pre-committed by 008 (the rule 1 labels, the rule 5 tooltip), by 010 (the caption templates, the not-validated text, the None text and the labels-disabled statement) and by 012 (the codec-smearing caveat, 012:238) is shown to visitors only as audited text: it is added as a template to 011's closed set by a dated 011 amendment before the 011 run that audits it, and it passes A1 to A6 with the human checks of Amendment C04 in the language shown. Until then it is not shown to visitors. Until such a string is audited, the view, numbers, loadings picture or compare-mode feature it must accompany is not shown to visitors either; withholding a caveat or non-pass label never leaves what it qualifies on screen without it. (2) Nothing is translated by the viewer; ES and PT versions exist only as audited templates. (3) 012's development-build caveat (012:481, as amended by C05) is shown only in development or internal preview builds, as 012:481 allows, and never to visitors in production.
  - **Note for 010.** In this notebook, the 010:447 statement must accompany the raw correlation numbers and the loadings picture (010:444-446), and the 010:455-456 not-validated text must accompany the ρ value or values it names. Until that statement or text is audited, those numbers, that picture and those ρ values are not shown to visitors (see also Amendment C22 (1)).
- **Addition (2026-09-30, before any run):** Amendment C20. (a) The strings of (1) also include 008's "not yet measured" text (008:393, rule 4, fallback F2), which the viewer shows for a recording whose flag is deferred. It is audited under 011 and displayed under (1), like the other strings of (1). (b) A template added to 011's closed set after 011's freeze is a change after the freeze under Amendment C02 (6). It needs a new owner-approved freeze (Amendment C02, addition of 2026-09-30) and a full audit run of that template, with A1 to A6, the controls and a new human review, before it is shown. Where 011:327 requires the entire audit to be re-run, that rule is unchanged. (c) Strictness: more text is withheld until audited, and nothing is loosened.
- **Supersedes:** 010:465 "(pre-committed wording, EN; localisation belongs to the viewer)"; 010:447 labels-disabled statement and 010:455 not-validated statement (display now needs the 011 audit); 010:444 "The viewer then shows only:" (the numbers and the loadings picture of 010:445-446 are also withheld until the 010:447 statement is audited).
- **Strictness:** Only withholds text, and what the text qualifies, until the text is audited; no pre-committed wording or gate is widened, and nothing that must carry a caveat or non-pass label is ever shown without it.

### Amendment C21 (2026-09-29, before any run): axisMeaning export schema and the S6 gate

- **Why:** XREF-9: 011's S6 gates on axisMeaning[a].status = "labelled", which 010 never defines, and 010 gives no export schema, so it is unclear whether a mix or a withheld axis counts.
- **Change:** Amendment C21. (1) 010 exports, per axis a: outcome (one of "single", "mix", "none"); families ([F1] or [F1, F2]); direction sign(s), relative to the exported position[axisMapping[a]]; rho1 and pHolm1 (and rho2, pHolm2 for a mix); n; explainedVarianceShare; shipped (true or false); withheldReason, one of a fixed list: "labels disabled (method gate)", "inconclusive (denominator)", "family not shippable", "not validated for labelling", "split-half check not evaluable", "split-half disagreement", "inconsistent within family", "Experiment 007 gate not met", "caption wording not approved"; and the 6 x 24 loadings matrix with the 24-band profile. (2) shipped = true only if every 010 gate for that axis and export passes and the caption wording is approved (Amendment C22): a single label on a shippable family, or a mix whose two families are both shippable (010:456). (3) 011's G6.2 is met only if axisMeaning[a].shipped = true. One sentence per shipped axis, none for any other axis.
- **Supersedes:** 010:535 "they receive either the gated `axisMeaning` block or the "no reliable label" state" (schema now fixed).
- **Strictness:** Defines an undefined gate by the stricter reading (a label ships only when every gate passes); nothing is widened.

### Amendment C22 (2026-09-29, before any run): Axis caption wording: unshipped until owner-approved; proposed plain-language drafts

- **Why:** XREF-10, SD-6, XREF-11 and two missed items: 010's pre-committed caption words (bird's, animals, intent, tonal, higher-sounding, Spectral, centroid, RMS), its 39-word sentence and its incomplete templates cannot pass 011's audit, and "of the variation shown" misstates what the share is a share of. A later verification of these amendments found that the first wording of (1) let the numbers and the loadings picture be shown without the 010:447 statement that 010:444-447 requires with them. (All finding IDs: XREF-10, SD-6, XREF-11, MISSED-cross-1, MISSED-cross-6.)
- **Change:** Amendment C22 (strict default, pending owner decision). (1) Rule in force: until the owner approves concrete reworded captions by a dated amendment, and those captions pass 011 (A1 to A6 with the human checks of Amendment C04), S6 and every axis caption stay unshipped. Nothing about axis meaning is shown to visitors until the 010:447 statement is audited; then the viewer shows the numbers, the loadings picture and that statement together (010:444-447). (2) The caption words come from an owner-approved caption table stored in tools/lib/axis_meaning.js and frozen with 010, not from the DESCRIPTOR_FAMILIES higher / lower / plain strings, which are not visitor text. (3) The variance clause says "of the total variation between moments", with the share computed and rounded by 011's ev rule, never "of the variation shown". (4) Additions to 011's A3 denylist, for every template, whole-word, never waived: EN "tonal*", "tone*", "aggressi*", "because", "due to"; ES "agresi*", "porque", "debido a"; PT "agressi*", "porque", "devido a". The ES/PT entries are drafts to be confirmed by the fluent A5 reviewer; they may be extended, never reduced. (5) PROPOSED, awaiting owner approval (EN drafts only; ES/PT are written later and checked by fluent humans): Single label: "Toward the + end of this direction, moments have {higherWords}." / "Toward the − end, they have {lowerWords}." / "The strongest measure is {descriptorPlain}; its rank agreement with this direction is {rho}, over {n} moments." / "The same result appeared again when the recording was split into alternating parts." / "This direction alone keeps {ev} of the total variation between moments, measured across all frequencies." Suffix on every label: "This describes all sound in the file as recorded, including background noise, other sources, distance and the recording equipment." / "It says nothing about behaviour or purpose." Mix: "This direction reflects {F1plain} and {F2plain} together." / "Neither matches it clearly better than the other." / "Their rank agreements with this direction are {rho1} and {rho2}." then, for each family, "Toward the + end, moments have {words}." and "Toward the − end, moments have {words}.", then the variance sentence and the suffix. Not validated: "The strongest measured link is with {descriptorPlain}, at rank agreement {rho}." / "No plain label is given for this measure." (reworded 2026-09-30; see the addition below) None: "No single sound property explains this direction." (010:469, unchanged). Labels disabled: 010:447's statement, unchanged. Direction words (higherWords / lowerWords): brightness "sound strength higher in frequency" / "sound strength lower in frequency"; noisiness "a more hiss-like sound, with strength spread more evenly across frequencies" / "a purer sound, with strength less evenly spread across frequencies"; loudness "a louder measured level" / "a quieter measured level"; width "sound strength covering a wider range of frequencies" / "sound strength covering a narrower range of frequencies". Family phrases for a mix: brightness "where the sound's strength sits in frequency"; noisiness "how hiss-like or pure the sound is"; loudness "the measured loudness level"; width "how wide a range of frequencies the sound covers". Descriptor phrases: centroidHz "the average frequency of the sound's strength"; rolloffHz "the upper edge of the sound's strength across frequencies"; flatness "how evenly the sound's strength spreads across frequencies"; entropy "how scattered the sound's strength is across frequencies"; rms "the measured loudness level"; bandwidthHz "how wide a range of frequencies the sound's strength covers"; pitchHz "the estimated base frequency"; crest "how much the strongest frequency stands out"; slope "whether the sound's strength leans toward low or high frequencies"; flux "how much the sound's strength rises from instant to instant"; freqMod "how fast the average frequency of the sound's strength moves"; ampMod "how fast the measured loudness level changes". Rendering in the drafts: rho to 2 decimals with sign, n as an integer, ev as an integer percent by 011's rule. Each draft sentence has at most 25 words and at most 3 numbers, and uses no word on 011's A3 or A4 lists as amended here.
  - **Note for 010.** The drafts in (5) are labelled "PROPOSED, awaiting owner approval". The forbidden-words scan of 010:471 applies to the drafts and to the approved captions.
  - **C22 drafting note (the same text stands in Experiments 010 and 011). PROPOSED, awaiting owner approval; not part of the shared Change text; nothing here is shipped or shown.** These items belong to the same set of proposals as the drafts in (5), so the owner reviews one set. They take effect only if the owner approves them, together with the captions, in the dated amendment named in (1).
    - (a) Check of the drafts. On 2026-09-29 a scratch script (not part of the repo; not a result of Experiment 010 or 011) filled every draft in (5), and the proposals in (c) and (d) below, with every direction phrase, family phrase and descriptor phrase, a signed ρ with 2 decimals, n = 556 (the largest n in Experiment 010's structural pre-count, 010:365) and both forms of ev (an integer percent and "under 1%"). It split the text into sentences by 011's A4(a) rule and scanned every sentence against: 011's EN A3 denylist (011:214) with the additions in C22 (4); the EN perceptual phrases of Amendment C23 (4); every `commonName`, `scientificName` and `taxonName` value in `manifest_v2_corpus.json`, whole and word by word; 011's A4 jargon list and its terms that need an explanation (011:221-226); and the forbidden words of 010:471. Result: 0 hits. Every sentence is within 011's EN limits of 25 words and 3 numbers; the longest is the "strongest measure" sentence with the bandwidthHz phrase, at exactly 25 words. ES and PT were not checked, because no ES or PT text exists yet. 011's own automated A3 and A4(a) checks remain the governing checks.
    - (b) Direction words (a rendering rule the drafts in (5) leave implicit; it follows 010:422). If sign(ρ₁) is positive, the + end sentence takes {higherWords} and the − end sentence takes {lowerWords}; if it is negative, the two are swapped. For a mix, the same holds for each family, with the sign of its own ρ (ρ₁ for F1, ρ₂ for F2).
    - (c) Proposed correction of the not-validated draft in (5). "This measure has not been checked for labelling" would be untrue for a family that was checked and failed its own V1 control (a pre-stated risk for the width family; see Experiment 010's H1 risks, 010:64-65, and Amendment C32 (2) of Experiment 010). Proposed instead: "This measure has not passed the checks needed for labelling, so no plain label is given."
    - (d) Proposed text for the case of 010:456 that (5) does not cover: a mix in which at least one family is not shippable, shown with both ρ values. {F1descriptorPlain} and {F2descriptorPlain} are the descriptor phrases of the descriptors that give ρ₁ and ρ₂. Sentences: "The strongest measured link is with {F1descriptorPlain}, at rank agreement {rho1}." / "The strongest link with another kind of measure is with {F2descriptorPlain}, at rank agreement {rho2}." / then exactly one of: "The first of these has not passed the checks needed for labelling, so no plain label is given." (only F1 not shippable); "The second of these has not passed the checks needed for labelling, so no plain label is given." (only F2 not shippable); "Neither of these has passed the checks needed for labelling, so no plain label is given." (neither shippable).
    - (e) Added 2026-09-30. Item (c) was written before the not-validated draft in (5) was reworded on 2026-09-30 (see the addition below). Both wordings are true in both cases; the owner chooses between them when approving the captions.
- **Addition (2026-09-30, before any run):** Amendment C22. The PROPOSED not-validated draft in (5) was reworded on 2026-09-30. It read "This measure has not been checked for labelling, so no plain label is given." That would be false for a family that was checked and failed its own V1 control. The new draft, "No plain label is given for this measure.", is true in both cases. Like every draft in (5), it is PROPOSED, awaiting owner approval; nothing is shipped or shown. The new sentence was not part of the 2026-09-29 scratch check in item (a) of the C22 drafting note; 011's automated A3 and A4(a) checks remain the governing checks.
- **Supersedes:** 010:422 "worded with that family's `higher` / `lower` strings in `DESCRIPTOR_FAMILIES`"; 010:467 single-label template (one sentence of about 39 words, "(strongest measure: \<descriptor\>, Spearman ρ = \<ρ₁\>, ...)" and "This direction accounts for \<EV\>% of the variation shown."); 010:468 mix template ending "…" (incomplete); 010:455 "Strongest measured association: \<descriptor\> (ρ = …)." (incomplete); 010:470 mandatory suffix "including background noise, other animals, ... It does not say anything about the bird's behaviour or intent."; 010:444 "**If any gate fails: labels are disabled in exports.** The viewer then shows only:" (the same display, and nothing else about axis meaning, also applies while the captions are unshipped under (1), and only once the 010:447 statement is audited).
- **Strictness:** Strict default pending owner decision: captions stay unshipped, the denylist grows, and the drafts are proposals only; no gate or threshold is loosened.

### Amendment C31 (2026-09-29, before any run): 010 governing arm pinned to the approved A2

- **Why:** A missed item, APPR-15 and FRZ-3: the runner check only required the file to be committed and clean, so a later clean commit saying A1 would pass, and 010 says two different things about a missing file. (All finding IDs: MISSED-ids-1, MISSED-ids-4, APPR-15, FRZ-3.)
- **Change:** Amendment C31. (1) The only non-literal value accepted in tools/experiments/exp010_governing_arm.json is "A2", the arm the owner approved on 2026-09-29 (010:351). The runner asserts governing_arm === "A2" and that the file's git blob equals 9b72d1394fdf17cfd34535b622b1b203e96fc851 (committed in 63077d1), unless a later dated, owner-approved amendment names a new blob. (2) A missing, untracked or modified file stops the runner (010:348). The literal arm governs only if an owner-approved committed file says "literal" explicitly. (3) "A2 (or A1) governs" and "(A2 or A1, whichever governs)" are read as "A2 governs"; A1 never governs under this pre-registration.
- **Supersedes:** 010:10 "Without that file, the literal rule governs"; 010:478 first cell "No committed governing-arm file, or the file says `"literal"`"; 010:431 "(A2 or A1, whichever governs)"; 010:480-483 "A2 (or A1) governs"; 010:25 (Question, ways to a real "no", item 4) "the amended null (A2, or A1)" (read as "the amended null (A2)", because by (3) A1 never governs under this pre-registration).
- **Strictness:** Pins the approved value and removes a contradictory default; stricter only.

### Amendment C32 (2026-09-29, before any run): 010 status and factual corrections; revision log created

- **Why:** APPR-14, APPR-16, SD-10, INC-3, STALE-1, CODE-19, XREF-26 and a missed item: 010 still calls A2 a proposal awaiting approval, understates the bandwidth failure, credits the 3682 Hz limit to a test that does not check it, points to a table "below" that is above, and has no revision log. (All finding IDs: APPR-14, APPR-16, SD-10, INC-3, STALE-1, CODE-19, XREF-20, XREF-26, MISSED-seeds-3.)
- **Change:** Amendment C32. (1) The owner approved A2 as the governing arm on 2026-09-29, after first approving A1 (010:351; tools/experiments/exp010_governing_arm.json); the passages that describe A2 as proposed or ask for approval are historical. (2) The bandwidth ordering already reverses at 30 dB SNR as well as at 20 dB (tools/test/window_descriptors.test.js, "LIMITATION: bandwidth ordering reverses at 30 and 20 dB SNR"; tools/lib/window_descriptors.js, "already REVERSED at 30 dB SNR"), so the width control may fail at both gating SNR levels (30 and 15 dB). The family gate, the pitch exclusion and every threshold are unchanged. (3) The limit of about 3682 Hz for pitch is documented in tools/lib/window_descriptors.js (pitch definition and caveats) and follows from tools/lib/analysis.js (the HPS search ends at floor(bins/3) = 171 bins); the test file does not assert it. (4) "seeded stream from the table below" means the seed table above ("Negative control random seed"). (5) A revision log is created in Reproducibility Notes. Its first entries: "2026-09-29: pre-registration written and revised the same day after an internal critique (010:336, 'kept from the previous version'); the individual changes of that revision were not logged at the time and are not reconstructed here." and "2026-09-29: the owner approved A1, then A2 as the governing arm (010:351)."
  - **Note for 010.** The C02 revision entry is added to the new log.
- **Supersedes:** 010:10 "proposed as the governing arm" and "**The governing arm must be approved by the project owner and committed ... before the run**" (approval given); 010:347 "**This notebook proposes `"A2"`**; the owner is asked to approve that choice (or to choose `"literal"`), not A1 alone."; 010:490 "(proposed: A2)"; 010:35 "the ordering is reversed at 20 dB SNR on synthetic band noise"; 010:65 "the bandwidth descriptor's ordering is reversed at 20 dB SNR ... so the width control may fail at 15 dB"; 010:36-37 "cannot report f0 above about 3682 Hz ... Both are asserted in `tools/test/window_descriptors.test.js`"; 010:454 "cannot report f0 above about 3682 Hz" (attributed to the test file); 010:313 "seeded stream from the table below"; 010:3 Date line (no revision was recorded; updated in place).
- **Strictness:** Status and factual corrections only; the width-family risk statement becomes more cautious and no threshold changes.

### Amendment C33 (2026-09-29, before any run): 010 V1: the SNR pairing is disclosed

- **Why:** SEED-10, SEED-2 and a missed item: the 200 pooled V1 runs are 100 seeds each run at two SNR levels that share the clean signal and the background, but the Clopper-Pearson bounds did not disclose it, and two V1 backgrounds overlapped under the legacy generator. (All finding IDs: SEED-10, SEED-2, MISSED-seeds-4.)
- **Change:** Amendment C33. The 200 pooled V1 runs are 100 seeds (5 types x 20 seeds), each run at SNR 30 and 15 dB. The two runs of a seed share the clean signal and the same background realisation, rescaled (010:235). They are not 200 independent units. Next to the pooled V1 rate and its Clopper-Pearson bounds the notebook states this pairing, and it also reports the rate at each SNR with its own Clopper-Pearson bounds (100 units each). The bootstrap unit stays the seed (010:217). Under Amendment C01, every V1 background is its own Philox stream, so no two V1 units share background values. The >= 0.90 gate and its pooled definition are unchanged.
- **Supersedes:** 010:217 "where units share a recording (V2(b-rep), V2(c), per-axis tallies) this is stated next to the bound" (V1 pairing added); 010:213 "pooled over the 5 primary types × 20 seeds × SNR {30, 15} (200 runs)" (pairing disclosed; per-SNR bounds added).
- **Strictness:** Adds disclosure and extra reported bounds; the gate is unchanged.

## Results

Pending run. Results will be written to `05_Benchmark_Results/v2/experiment_010_axis_meaning.json`. Tables here will link to that file and not duplicate it.

Planned top-level JSON keys: `meta` (versions, git hash, manifest SHA-256, `governing_arm`, approval record copied from the config file, the config file's blob hash and `governing_arm_commit`), `seeds`, `exclusions`, `feasibility` (per unit: n, minShift, D, p-floor and Holm floor per arm), `level_proxy` (per recording; "level proxy, not a signal-to-noise ratio"), `v1`, `v2a`, `v2a_ext`, `v2b`, `v2b_rep`, `v2c_mismatched`, `calibration` (per arm), `denominators` (each N against its N_min), `v3` (2 s primary, 4 s secondary), `loadings_check`, `corpus_labels` (per recording, per axis: all 36 tests with literal, A1 and A2 p-values, outcome, gates, 6 × 24 loadings), `demo_labels`, `verdicts` (governing arm only), `non_decisional` (the other two arms, each marked `"decisional": false`), `compute` (wall time per arm, worker count). Every rate carries count, denominator, bootstrap CI and Clopper-Pearson bounds.

## Unexpected Observations

Pending run.

## Discussion

Pending run.

Limitations and literature gaps, stated now so that they are not discovered after the fact:

- **Rotation-null citation gap.** Ebisuzaki1997 documents that serial correlation invalidates naive correlation tests, and proposes a random-phase null. Theiler1992 gives the general surrogate-data framework. **No entry in `04_Literature/Literature_Database.md` documents the circular-shift (rotation) test itself.** A citation must be found and added before results are written up. Until then, the rotation null's validity here rests on the empirical negative controls, and V2(b) cannot test it (see V2).
- **Surrogate-method evidence level.** A2's method details rest on Medium-confidence secondary sources (Lit DB rows Ebisuzaki1997 and Theiler1992); the full texts were not read. FT-type surrogates assume stationarity and circular continuity, and no Lit DB row documents how large the resulting error is. A2's calibration here rests on V2(c), not on the literature.
- **Split halves are not independent.** Halves built from interleaved 2 s blocks share the same recording session, background and usually the same ongoing sounds across adjacent blocks. Split-half agreement is therefore optimistic, and the per-export split-half gate is less strict than "replicated on independent data" would be. The 4 s secondary result shows how agreement changes with longer blocks; it does not remove the dependence.
- **Periodicity.** For strongly periodic songs, rotations by whole periods re-align the signal. This makes the test conservative (it loses power) and does not create false labels, so such recordings may get no label even when a real association exists.
- **Scope.** Correlation with an axis is not causation. PC loadings describe variance directions and are not evidence that a perceptual property "causes" an axis (JolliffeCadima2016).
- **Descriptor definitions.** The descriptors follow the project's own formulas. Peeters2004 differs on roll-off (95% vs 85%) and on flux and flatness definitions, so the words are tied to the project's definitions and not to Peeters' definitions.
- **What an axis can reflect.** An axis can reflect background noise, microphone, codec or distance as easily as the focal bird. It can also reflect **background species**: other birds, insects or people in the same recording, in which case an axis may describe a different animal's sound. Nothing in this experiment separates the focal bird from other sources. The recording-condition confound (v0.4 Scientific Assumptions; Experiment 005) is not addressed here, and the mandatory caption suffix exists for that reason.
- **SNR is unmeasured.** Per-recording signal-to-noise ratio is not known for any corpus file. The logged `levelProxy` (median kept RMS ÷ amplitude-filter threshold RMS) is descriptive only and is not a validated SNR estimate. V1 tests SNR only on synthetic signals with a white Gaussian background, which does not represent wind, rain, traffic, reverberation or other vocalising animals.
- **Corpus.** Small (12 species × 5), citizen-science recordings with mixed codecs. Results apply to PR, within-recording fits, and this descriptor set.

## Decision

Pending run. The decision will be applied mechanically from the Pre-Committed Decision Rule and the governing arm committed in `tools/experiments/exp010_governing_arm.json` before the run.

- **Decision log:** it feeds the proposed **D-0NN** *[Superseded by Amendment C07, 2026-09-29.]* (plain-language axis labels in exports). D-004 and D-010 are not changed.
- **Exporter and viewer:** they receive either the gated `axisMeaning` block or the "no reliable label" state. *[Superseded by Amendment C21, 2026-09-29.]*

## Reproducibility Notes

- **Runner:** `tools/experiments/run_experiment_010_axis_meaning.js` (not yet written).
- **Proposed library module:** `tools/lib/axis_meaning.js` (not yet written). It holds the labelling rule, the A1 p-value, the A2 AAFT surrogates and p-value (with the Bluestein DFT), the mismatched-pair construction, Clopper-Pearson bounds, split-half matching and band pooling. The exporter must call the same function, so that shipped labels are the tested ones.
- **Governing-arm config:** `tools/experiments/exp010_governing_arm.json` (created 2026-09-29 with `governing_arm: "A2"`, owner-approved, committed before the run). Its blob hash and the commit that last touched it are logged; the runner refuses to run if it is missing, untracked or dirty.
- **Scratch scripts used for the structural pre-count and timings** (not part of the repo, not results): `exp010_counts.js` and `exp010_timing.js` / `exp010_timing2.js` in the session scratchpad (`…/scratchpad/v2/`). The runner recomputes every count; the notebook's pre-count numbers are for planning only.
- **Results:** `05_Benchmark_Results/v2/experiment_010_axis_meaning.json` (not yet produced).
- **Manifest:** `manifest_v2_corpus.json`. Its SHA-256 and the per-recording id, source URL and licence are logged.
- **PR constants** are read from `tools/export_single_recording_dataset.js`, not re-typed: 22050 Hz, FFT 1024, hop 512, Hamming window, 6 frames per point, base hop 2 frames, `MAX_POINTS` 700, amplitude filter 0.2, `POSITION_SPREAD` 6. The runner logs the values it actually used. The descriptor constants (`VOICING_THRESHOLD` 0.15, `MIN_VOICED_FRACTION` 0.5) are read from `tools/lib/window_descriptors.js`.
- **Environment:**
  - Node v24.x (exact version logged).
  - ffmpeg/ffprobe **only** via `tools/lib/ffbin.js` (`FFMPEG`, `FFPROBE`; `ffmpegVersion()` logged).
  - The git commit hash and a dirty-tree flag. If the tree is dirty, the SHA-256 of `git diff` is logged.
- **Seeds:** the full table in Method, written to the JSON. Base 20260720.
- **Statistics:** `tools/lib/metrics.js` (`spearman`, `circularShiftNull`, `holm`, `bootstrapCI`, `normalCdf`). B = 2000 for bootstraps; the rotation null is exhaustive whenever D ≤ 999 (always, since n ≤ 700); B = 9999 AAFT surrogates per axis for A2.
- **Label-exclusion code inspection:** date and inspector to be recorded here at run time. *[Clarified by Amendment C02, 2026-09-29: append-only anchor; the date and inspector are written on lines appended directly below this line.]*
- **Unit tests** (in `tools/test/axis_meaning.test.js`) that must pass before the run: *[Superseded by Amendment C12, 2026-09-29.]*
  - the labelling-rule truth table, including every boundary: |ρ| = 0.5, 0.4, gap = 0.1, p = 0.01;
  - Holm with m = 36;
  - the feasibility computation;
  - A1 on a fixture with a known Gaussian null; the |ρ| clamp at 1 − 10⁻¹²; σ = 0 → p = 1; far-tail precision of 2·normalCdf(−x);
  - the rank-1 condition for A1;
  - A2: Bluestein DFT against a direct DFT, surrogate marginal and power-spectrum preservation, seed determinism, and the p-floor 1/(B+1);
  - mismatched-pair construction (truncation to m, minShift = max, D ≥ 100 filter) and the V2(c) expected-count requirement;
  - Clopper-Pearson against the reference values listed in Metrics;
  - the governing-arm file check (missing, untracked or dirty → refuse);
  - worker-count invariance of unit results;
  - 3 × 3 matching against brute force;
  - band edges and bin counts;
  - within-family sign check;
  - seed uniqueness; *[Superseded by Amendment C01, 2026-09-29.]*
  - the scan for forbidden words;
  - signed PR parity.

### Revision log

Created by Amendment C32 (2026-09-29).

- 2026-09-29: pre-registration written and revised the same day after an internal critique (010:336, 'kept from the previous version'); the individual changes of that revision were not logged at the time and are not reconstructed here.
- 2026-09-29: the owner approved A1, then A2 as the governing arm (010:351).
- 2026-09-29, pre-run consistency amendments C01, C02, C03, C07, C08, C11, C12, C18, C20, C21, C22, C31, C32, C33 after an independent 12-agent audit; no threshold changed; owner decisions OD-1, OD-2, OD-3 applied.
- 2026-09-29, before any run and before any freeze, after an independent verification of the amendments: C02 gained (7) (append anchors listed explicitly in the sidecar, including the Results and Decision lines; appended blocks limited to run-time values and records and hashed into the results JSON); C20 (1) now also withholds whatever an unaudited string must accompany; C22 (1) now shows nothing about axis meaning until the 010:447 statement is audited, and then shows it with the numbers and the loadings picture. Only stricter; no threshold changed.
- 2026-09-29, resumed-session verification repair before any run or freeze (moved here from the Freeze record's Deviations list on 2026-09-30): synchronized the shared Change text of C01, C03 with the existing stricter versions in the other notebooks. Clarified that preserving a non-pass outcome never bypasses evidence, template or human-review gates; a view is withheld if its mandatory label or numbers cannot be shown. In 008 the unfinished, undefined C36 references are resolved by these existing gates. No threshold, statistic, seed or owner approval changed.
- 2026-09-30, before any run and before the freeze: dated additions for owner decisions OD-6 (C01), OD-7 (C03) and OD-8 (C02), with the same text as in the other notebooks. Also: the Status line now matches 007 (no corpus run and no verdict-or-gate arm before the freeze), and the Date line; C01 names tools/lib/reducers.js makeRandom; C03 (7) needs the C14 check to have passed; C03 (1) cites 007:143 and 007:393; C20 adds 008's "not yet measured" text and the rule for a template added after 011's freeze; the PROPOSED not-validated caption draft of C22 (5) was reworded so that it is true in both cases, with drafting-note item (e); the "Supplemented" definition and the note on dated additions in the section introduction; and the previous entry moved from the Deviations list to this log. No threshold, B value, statistic or seed value changed.

### Freeze record

Defined by Amendment C02 (OD-2). The value fields are filled in by the freeze commit; the Deviations list is dated and append-only.

- Freeze date / commit / sidecar: not yet frozen.
- Deviations from the pre-registration: none yet.
