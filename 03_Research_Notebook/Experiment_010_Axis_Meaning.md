# Experiment 010 — Axis Meaning: Can Each PCA Axis Be Explained in Plain Words for This Recording?

**Date:** 2026-09-29 (pre-registration written; run date to be filled in at run time)
**Work Package:** WP4 (axis meaning / descriptors) with WP5 (visual-claim validation), v2.0 track
**Related Decision Log ID(s):** D-004 (PCA), D-006 (negative controls), D-010 (raw spectrograms), D-005 (Rule 001), D-011 (Rule 002: benchmark plan before implementation), D-008 (no individual-level claims). Proposed new entry: **D-0NN: plain-language axis labels in exports (production regime, within-recording)**. NN is the next free number ≥ 14 when results come in. Experiment 007 has provisionally proposed D-014 and Experiment 008 D-015, so this is expected to be D-016 or later. The owner assigns the number.
**Status:** Pre-registered, not yet run

**Scientific Hierarchy level:** Frame (`01_Master_Framework/v0.4_Final.md`, Scientific Hierarchy, ~line 336). Each point is a 0.15 s nominal window (actual span 0.1625 s) of 6 consecutive STFT frames. Nothing is segmented, so no point is a syllable, phrase or acoustic event. Every fit is within one recording (Level 1, Individual Recording). No axis label may be worded at any level above Frame, and none may refer to an individual bird (D-008).

> **Blocking pre-run issue (read first): as specified, the labelling rule cannot produce a label.** Under the production regime, a recording has at most 700 points after the amplitude filter (at most 561 when no RMS values tie at the filter threshold; the largest observed in this corpus is 556). So the circular-shift null has at most 699 admissible shifts, and the smallest attainable two-sided p is 1/(D+1) ≥ 1/700 ≈ 0.00143. With Holm over 36 tests, the smallest attainable adjusted p is ≥ 36/700 ≈ 0.051, which is above the required 0.01. The same holds with the 33 tests named in the brief, with a Monte Carlo reading of B = 999 (floor 0.001, adjusted floor 0.036), and in each split half. The proof and two proposed amendments that keep every threshold are in "Feasibility of the significance criterion" below: **A2** (phase-randomised AAFT surrogates, B = 9999; proposed as the governing arm) and **A1** (Gaussian tail extrapolation of the rotation null; proposed as non-decisional only). **The governing arm must be approved by the project owner and committed in `tools/experiments/exp010_governing_arm.json` before the run** (see "Governing arm: technical pre-commitment"). Without that file, the literal rule governs, it gives zero labels by arithmetic, V1 fails, and labels are disabled in exports. That outcome is pre-committed as well.
>
> **Second pre-stated structural consequence:** both Wikimedia demo files (13.7 s and 15.8 s) are too short for the per-export split-half gate to be evaluable (each has a half with fewer than 100 admissible shifts; counts in "Compute plan"). Whatever the validation outcome, **the demo files will ship with no plain-language axis label** under this pre-registration; they will show the numbers and the loadings picture only.

⸻

## Question

**For one recording under the production regime (PR), can each of the three displayed PCA axes be described correctly and reproducibly in one plain-language sound property? Examples: "toward +Z the moments are noisier; toward −Z they are more tonal", or "a mix of brightness and bandwidth". And does the method avoid giving such labels to signals that have no such structure?**

A real "no" is possible in several ways, and each one is a legitimate outcome:

1. On synthetic signals where exactly one property varies, the method does not name that property on PC1, or names it with the wrong direction (V1 fails).
2. The method gives labels to structureless noise, or to real recordings whose descriptors have been misaligned in time (V2 fails).
3. Labels do not reproduce across two interleaved halves of the same recording (V3), so most per-export labels are withheld.
4. The significance criterion cannot be met in this regime (see the blocking issue above), or the amended null (A2, or A1) is miscalibrated on a null that cannot contain the true alignment (mismatched-pairing null, V2(c)).
5. The corpus is too small to decide: fewer labellable units than the pre-committed minimum denominators (outcome "Inconclusive"; labels disabled).

### Why this experiment exists (evidence gap)

- The v2.0 viewer shows the PCA cloud with X / Y / Z toggles, and the project owner has asked for per-recording text saying what each direction means. That text is a claim about the data (Core Philosophy: "Every visual element should represent measurable information"; Design Principles: "traceable back to measurable acoustic properties").
- The meaning of a PCA axis is not fixed. PCA is fit per recording on z-scored 3078-dim log-magnitude windows (D-004, D-010), so PC1 of one recording can be "loudness" and PC1 of another "noisiness". A caption therefore has to be computed per recording and tested. It cannot be written once.
- **Regime disclosure.** D-004 and D-010 were decided on Experiments 001-006, which used a different sampling regime. Whether PCA on raw log-spectrogram windows is the right display under PR is being re-tested in Experiment 007. Axis labels inherit that open question, which is why the Experiment 007 gate exists (see "Additional pre-registered checks").
- PCA signs are arbitrary. "The signs of all loadings (and scores) are arbitrary and only their relative magnitudes and sign patterns are meaningful" (JolliffeCadima2016). So any "+ end = X" wording needs a documented sign convention. Here the sign is resolved by computing labels **in the same run** that produces the exported positions. The exporter's `positionScale` is a positive scalar (`tools/export_single_recording_dataset.js` ~line 721), so it preserves sign.
- The descriptors that give the words (`tools/lib/window_descriptors.js`) come from existing project code. Some of them have documented failures:
  - **width (bandwidth):** the ordering is reversed at 20 dB SNR on synthetic band noise.
  - **pitch (HPS):** the estimator returns sub-harmonics on pure tones, marks broadband noise as voiced, and cannot report f0 above about 3682 Hz. It carries `validatedForLabelling: false`.
  - Both are asserted in `tools/test/window_descriptors.test.js`.
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
    - *Width:* the bandwidth descriptor's ordering is reversed at 20 dB SNR in `tools/test/window_descriptors.test.js`, so the width control may fail at 15 dB.
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
  - **Recording index r:** the 0-based position of the recording in `manifest_v2_corpus.json`, fixed before any exclusion, so that seeds never shift. Entries of `recordings[]` take r = 0 … 59 and entries of `demo[]` continue at r = 60, 61. The runner asserts that the manifest has fewer than 100 entries in total (so that the partner index r′ in the mismatched-pairing seed offsets +100 … +199 cannot overflow) and hence fewer than 1000, so that the synthetic indices below cannot collide.
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
    - o_r is drawn uniformly from the integers in [L, n − L], with L = max(minShift, ⌈0.25·n⌉), so that the offset is "large".
    - The full labelling rule, with its own circular-shift null, is then applied. Any label counts as false.
    - The split-half gate is **not** applied here, because it can only remove labels and would flatter the rate. The rate after the gate is reported as secondary.
  - **(b-rep), extra rigor.** The same procedure with 20 further offsets per recording (seed offsets +50 … +69). This gives a more precise false-label rate than a single offset does. It reuses the full-recording PCA fit (the scores do not change) and recomputes only the shifted descriptor tests and their nulls.
  - **What V2(b) and V2(b-rep) can and cannot show (stated in advance).** They are kept exactly as specified and they gate. But under the **rotation null** (literal arm and A1) they come close to passing by construction: o_r ∈ [L, n − L], so the shift n − o_r, which restores the true alignment, is itself an admissible rotation of the shifted descriptors. In any recording with a real association, the shifted observation then almost never has empirical rank 1, A1 never fires, p ≥ 2/(D+1), and the Holm-adjusted p is at least about 36 · 2/(D+1) ≈ 0.14 (at D ≈ 500), so no false label can appear. **V2(b) and V2(b-rep) are therefore not used as evidence that A1 (or the literal rotation null) is calibrated.** Under **A2** this argument does not apply: a circular rotation of a phase-randomised surrogate is again a phase-randomised surrogate (exactly for odd n; for even n up to the sign of the single fixed Nyquist bin), so the A2 null for shifted descriptors has (essentially) the same distribution as for unshifted ones, and the true alignment is not in it. V2(b) is informative for A2, but the calibration gate below (V2(c)) is still required for both arms.
  - **(a-ext) Extended noise arm (extra rigor, gating in addition to V2(a), never instead of it).** 100 further seeds each of `whiteNoise` and `pinkNoise`, 30 s, disjoint from the V2(a) seeds (pseudo-recording indices below). Same false-label definition. Reason: with 20 seeds, even 0/20 false labels leaves a Clopper-Pearson one-sided 95% upper bound of 0.139 on the rate (two-sided 95% interval upper limit 0.168), far above 0.05; with 100 seeds, 0/100 gives 0.030 (one-sided) and 1/100 gives 0.047.
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
  - V1: the proportion of correct runs, pooled over the 5 primary types × 20 seeds × SNR {30, 15} (200 runs). Also reported per type (40 runs), per type × SNR (20 runs), and at 6 dB.
  - V2: the false-label rate per axis, i.e. the proportion of units with any label on axis c. Also the run-level rate (any axis) for V2(a) and V2(a-ext). For V2(c) additionally the family-wise rate and the per-test exceedance rate at raw p < 0.01/36, per arm.
  - V3: the agreement rate, and the gate removal rate.
  - Loadings: the agreement rate.
  - Every proportion is reported with its count and denominator, with a 95% percentile bootstrap CI (`metrics.bootstrapCI`, B = 2000), and with the **exact Clopper-Pearson** 95% interval (two-sided) and one-sided 95% upper bound. For the corpus arms the resampling unit is the recording; for V1 it is the seed. Clopper-Pearson assumes independent units; where units share a recording (V2(b-rep), V2(c), per-axis tallies) this is stated next to the bound. The Clopper-Pearson function is new code in `tools/lib/axis_meaning.js` (not in `metrics.js`), unit-tested against values computed independently on 2026-09-29 by bisection on the binomial CDF: 0/20 → one-sided upper 0.1391, two-sided upper 0.1684; 1/20 → 0.2161 / 0.2487; 0/100 → 0.0295 / 0.0362.
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
  - Offsets are unique **within this experiment**. The same numeric seed may appear in other experiments' seed tables; that is harmless because streams are never shared across experiments.

  | Offset | Use |
  |---|---|
  | +0 | synthetic signal generator seed (pseudo-recordings only; synth.js keeps the signal identical across SNR levels, because the background uses its own stream) |
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

  Corpus-level seed: 20260720 + 702 for every bootstrap (the same convention as Experiment 007). 20260720 + 703 is reserved for a subsetting draw, which is **not used** (the compute plan pre-commits no subsetting). The runner asserts that all seeds are unique and writes the full table to the JSON.
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
- **Surrogate construction, per unit and per axis c** (n = length of s_c; seeded stream from the table below):
  1. Draw n standard normal values, sort them, and assign them to the time points in the rank order of s_c (ties in s_c take the average of the tied sorted values), giving g.
  2. Compute the exact length-n DFT of g (no padding, no truncation; Bluestein chirp-z via radix-2 FFT). Keep the DC term and, for even n, the Nyquist term unchanged. For k = 1 … ⌈n/2⌉ − 1 replace the phase by an independent uniform phase on [0, 2π) and set bin n − k to the complex conjugate. Inverse-transform to a real series h.
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

- The governing arm (`"literal"`, `"A1"` or `"A2"`) and the approval record (approver name, date, decision text) live in a committed config file, **`tools/experiments/exp010_governing_arm.json`**. It was created on 2026-09-29 on the written (chat) instruction of the project owner, with `governing_arm: "A2"`. **This notebook proposes `"A2"`**; the owner is asked to approve that choice (or to choose `"literal"`), not A1 alone.
- The runner reads that file, writes its git blob hash (`git hash-object`) and the hash of the commit that last touched it to `meta`, and **refuses to run** if the file is missing, untracked, or differs from HEAD (dirty). If the file is missing the runner stops rather than defaulting, so that "no approval" is an explicit `"literal"` entry.
- The governing arm's verdicts are written under `verdicts`; the other two arms' results are written under `non_decisional` with the field `"decisional": false`.
- **Ordering:** the commit that adds or changes the governing-arm file must be an ancestor of the commit that adds `05_Benchmark_Results/v2/experiment_010_axis_meaning.json`, and the results JSON's `meta.governing_arm_commit` must equal that ancestor. The write-up step checks this with `git merge-base --is-ancestor`; a results file that fails the check is void.
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

- The runner may distribute units over worker processes. Every unit has its own seed, so results do not depend on the number of workers; the runner asserts this on a 10-unit subset run with 1 and with 4 workers (identical SHA-256 of the unit results).
- **No subsetting (pre-committed).** Every unit listed above is run. If an arm cannot be completed, it is reported as "not run", and every gate that depends on it counts as failed (labels disabled). No subset is drawn after the fact; the reserved seed 20260720 + 703 stays unused.

### Additional pre-registered checks (extra rigor)

- **PR parity and sign check:** on the smoke recording, the runner's PC scores must equal the exporter's `position[c] / positionScale` to ≤ 1e-9 relative, **with the same sign**. This is stricter than Experiment 007's sign-free parity, because labels depend on the sign. If this fails, the run stops.
- **Descriptor alignment:** `flux` must be bit-identical to the exporter's `point.spectralFlux` for every kept point. This mirrors the existing assertion in `tools/test/window_descriptors.test.js`.
- **Experiment 007 dependency gate:** a label on axis c is shipped only if Experiment 007 has run and its single-axis subset {c} for PCA was **not** labelled "not better than random". Before Experiment 007 has results, no label ships. Experiment 008's per-recording weak-view flag, if adopted, is shown next to the caption. This experiment's decision does not depend on it.
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
- **Direction:** sign(ρ₁). A positive sign means the + end of axis c has more of F1, worded with that family's `higher` / `lower` strings in `DESCRIPTOR_FAMILIES`. For a mix, both directions are given. This is unambiguous because the scores and the exported positions come from the same run, and `positionScale` > 0.

### Method-level gates (all must pass for any label to ship)

- **V1, as specified:** the pooled correct rate over the 200 runs (5 primary types × 20 seeds × SNR 30 and 15 dB) must be ≥ **0.90**. The 6 dB results are reported and do not gate.
- **V2(a):** for white noise and for pink noise separately, the per-axis false-label rate over 20 seeds must be ≤ **0.05** on each of the 3 axes. In addition, the run-level rate (any label on any axis) must be ≤ **0.05**.
- **V2(b):** the per-axis false-label rate over analysed, labellable evidence recordings must be ≤ **0.05** on each of the 3 axes.
- **V2(b-rep), extra rigor:** the same threshold, ≤ **0.05** per axis, pooled over 20 × N shifted units.
- **V2(a-ext), extra rigor (in addition to V2(a), never instead of it):** for white and for pink separately over 100 seeds, per-axis false-label rate ≤ **0.05** on each axis, and run-level rate ≤ **0.05**.
- **V2(c) calibration gate for the governing arm** (A2 or A1, whichever governs): at least **1000** labellable units; family-wise rate ≤ **0.02**; per-test exceedance of raw p < 0.01/36 ≤ **2 × 0.01/36**; per-axis false-label rate ≤ **0.05**. Fewer than 1000 units → "not validatable" → labels disabled. (Under the literal arm the V2(c) criteria are computed and reported, but the literal arm cannot label anything.)
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

**If any gate fails: labels are disabled in exports.** The viewer then shows only:
- the raw correlation numbers (all 36 ρ with Holm p, per axis);
- the loadings picture;
- the statement *"No reliable plain-language label exists for these directions. The numbers show how strongly each measured sound property varies along each direction."*

### Per-family and per-export gates (extra rigor; they can only remove labels, never add them)

- **Family gate:**
  - A family whose own V1 control has a correct rate < **0.90** over its 40 runs at SNR ≥ 15 dB is never shipped as a label, even when the pooled V1 gate passes. This prevents a failing family from riding on the others.
  - Families that have **no** positive control (peakiness, tilt, change) are never shipped as plain-language labels.
  - **Pitch is never shipped as a plain-language label in this experiment**, even if its own V1 control reaches ≥ 0.90 and the pooled V1 gate passes. Reason: `DESCRIPTOR_FAMILIES.pitch.validatedForLabelling` is `false`, and `tools/test/window_descriptors.test.js` documents that HPS returns sub-harmonics on pure tones, marks broadband noise as voiced, and cannot report f0 above about 3682 Hz. The gating V1 pitch control (1000/2000 Hz harmonic tones) is the one configuration where HPS is known to work, so passing it does not show that pitch labels are valid on real songs. Pitch stays in the test grid, in the Holm family and in the pooled V1 gate exactly as specified, so the brief's rule is unchanged; its ρ and p are reported as numbers. A looser per-recording pre-condition (≥ 50% of kept windows voiced and 95th percentile of voiced `pitchHz` < 3.6 kHz) was considered and **rejected**, because noise also reads as voiced. Only a separate descriptor-validation experiment that sets `validatedForLabelling: true` can lift this.
  - When F1 is such a family, the axis shows *"Strongest measured association: \<descriptor\> (ρ = …). This property has not been validated for labelling, so no plain-language label is given."*
  - A **mix** is shipped only if **both** F1 and F2 are shippable families under this gate; otherwise the axis shows the same "not validated" statement for the non-shippable family, with both ρ values.
  - F2 is never promoted to take F1's place.
- **Split-half gate** (V3): as defined in Method.
- **Experiment 007 gate:** as defined above.

### V3 and the loadings check

V3 does not gate the method globally (as specified), and neither does the loadings check. Both are reported.

### Caption templates (pre-committed wording, EN; localisation belongs to the viewer)

- **Single label:** "Toward the + end of this direction, moments measure as \<higher-wording\>; toward the − end, as \<lower-wording\> (strongest measure: \<descriptor\>, Spearman ρ = \<ρ₁\>, n = \<n\> moments; confirmed in both halves of the recording). This direction accounts for \<EV\>% of the variation shown."
- **Mix:** "This direction mixes two measured properties: \<F1\> (ρ = …) and \<F2\> (ρ = …); neither explains it clearly better than the other. …"
- **None:** "No single sound property explains this direction."
- **Mandatory suffix on every label:** "This describes the sound as recorded, including background noise, other animals, distance and the recording equipment. It does not say anything about the bird's behaviour or intent."
- **Forbidden in any generated axis text:** syllable, phrase, song type, call type, individual, alarm, aggression, mood, intent, "the bird is/wants", and causal words ("because", "due to"). A unit test scans the templates for these words.
- **Screen words:** the export states axis ends as "+X / −X" (and likewise for Y and Z). Screen words such as "front / back" may be used only if the viewer knows the camera orientation. Otherwise the viewer must say "+ end / − end".

### Outcomes (exhaustive)

| Case | Pre-committed decision |
|---|---|
| No committed governing-arm file, or the file says `"literal"` | The literal arm governs. It gives zero labels by arithmetic, V1 fails, and **labels are disabled**. The feasibility result is reported as the finding. (The runner stops if the file is missing; `"literal"` must be written explicitly.) |
| Governing-arm file dirty, uncommitted, or committed after the results | The run is void. |
| A2 (or A1) governs, and every method-level gate passes and every minimum denominator is met | Labels may ship, **subject to** the family gate (including the pitch exclusion), the split-half gate, the Experiment 007 gate and the within-family check, per export. |
| A2 (or A1) governs, and a minimum denominator is not met | **Inconclusive.** Labels are disabled and reported as inconclusive. The counts and every computed rate are reported. |
| A2 (or A1) governs, and V1 fails | Labels are disabled. Per-family V1 results are reported, to inform a future experiment. |
| A2 (or A1) governs, and V2 fails, or the governing arm is miscalibrated or not validatable (V2(c)) | Labels are disabled. Per v0.4 Failure Criterion 1 ("random or shuffled data produces … structure similar to real data"), this triggers a **documented methodology review, not a threshold adjustment**. There is no switch to the other arm. |
| Parity or label-invariance fails | The run is void. |

Precedence when several rows apply: "void" first, then "literal", then any failed gate (labels disabled, failed), then "Inconclusive", then "labels may ship". A failed gate is reported as a failure even if a denominator is also below its minimum, because a failure on few units is still evidence against shipping.

## Expected Outcome

- **Support:** a non-literal governing arm (proposed: A2) is committed before the run; V1 pooled ≥ 0.90; every V2 rate ≤ 0.05 (including V2(a-ext) and V2(c)); the governing arm passes the V2(c) calibration gate with ≥ 1000 units; every minimum denominator is met; the parity and invariance checks pass. Then labels ship for the shippable families (brightness, noisiness, loudness, width; never pitch, peakiness, tilt or change) that passed their own control, on axes that pass the split-half and Experiment 007 gates.
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

- **Decision log:** it feeds the proposed **D-0NN** (plain-language axis labels in exports). D-004 and D-010 are not changed.
- **Exporter and viewer:** they receive either the gated `axisMeaning` block or the "no reliable label" state.

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
- **Label-exclusion code inspection:** date and inspector to be recorded here at run time.
- **Unit tests** (in `tools/test/axis_meaning.test.js`) that must pass before the run:
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
  - seed uniqueness;
  - the scan for forbidden words;
  - signed PR parity.
