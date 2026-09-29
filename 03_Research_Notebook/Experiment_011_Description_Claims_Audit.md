# Experiment 011 — Per-Recording Plain-Language Description: a Claims Audit

**Date:** 2026-09-29 (pre-registration written; revised the same day after review, see "Revision log" in Reproducibility Notes; run date to be filled in at run time)
**Work Package:** WP6 (Prototype), v2.0 track. The audit checks that the text shown to visitors reports only numbers the pipeline measured (WP5 statistics are the evidence base, `02_Experimental_Design/v0.5_Benchmarking.md`).
**Related Decision Log ID(s):** D-005 (Rule 001), D-006 (negative controls), D-008 (no individual-bird claims), D-010 (raw spectrograms), D-004 (PCA), D-011 (Rule 002: benchmark plan before implementation), D-012 (Rule 003: no unpublished intuition survives benchmarking). It depends on the decisions from Experiments 007–010. **D-004 and D-010 were established under the Experiment 001–006 regimes, not the production regime (PR); the PR re-test is Experiment 007.** This audit does not re-test them: it checks only that the text states the payload correctly. Proposed new ID: **D-018: the exported plain-language description, where every sentence traces to a validated number.** This ID is provisional. It assumes that Experiments 007–010 take D-014–D-017 in that order. The ID is assigned only when results come in, and it may change.
**Status:** Pre-registered, not yet run

**Scientific Hierarchy level:** Frame (`01_Master_Framework/v0.4_Final.md`, Scientific Hierarchy) for S1–S7. Each dot is one window of 6 consecutive STFT frames. S8 is a scope statement at the Recording level. No sentence may describe any level above Frame (acoustic event, syllable, phrase, song, individual, species). Nothing is segmented, so no such claim could be backed.

**Nature of this experiment:** this is an **audit, not a statistical test**. It produces no p-values and makes no inference beyond the audited outputs. The only statistics are descriptive summaries of the stated facts across recordings. Its verdicts are counts, for example "0 mismatches out of N sentences", with thresholds fixed below.

⸻

## Question

**Can the exporter produce a per-recording plain-language description, in English, Spanish and Portuguese, in which every sentence is present only when its evidence gate holds, and every number equals the payload fact it cites after the stated rounding? This must hold with zero mismatches across every corpus recording and every synthetic control, and no sentence may claim anything that was not measured.**

A real "no" is possible. Any one of these outcomes answers "no" for the template concerned, or for the whole description:

1. A single number in any language does not match its fact.
2. A sentence appears when its gate fails, or is missing when its gate holds.
3. A sentence mentions species, individuals, behaviour or intent.
4. Lay readers do not understand a sentence.
5. A translation is not faithful.

### Why this experiment exists (evidence gap)

The current viewers explain the cloud with **hand-written, fixed** sentences. Some of these are true only for some clips or settings. Others were never measured at all. Found by text search on 2026-09-29:

| # | Hand-written claim | Where | Problem under the production regime (PR) |
|---|---|---|---|
| L1 | "Ball size = how loud that 0.15 s moment is." | `app/src/components/cloudChannels.ts` (`SIZE_LEAD`) | 0.15 s is the *nominal* window length (`POINT_WINDOW_SECONDS`). The actual span is (6 − 1) · 512 + 1024 = 3584 samples = 3584 / 22050 s = **0.16254 s** at 22050 Hz. This is arithmetic from the exporter's constants, not a measurement. The payload field `samplingWindowSeconds` carries the nominal 0.15. |
| L2 | "A tenth of a second of birdsong …" | production screen, `revx-greencubes/src/locales/en/translation.json`, key `xp.acoustics.infoCard.scene` | The span is 0.16254 s, not 0.1 s. The sentence also assumes the window contains birdsong, which is not verified (Corpus_v2, Known biases 2–3). |
| L3 | "Those three directions carry only a sliver of everything in the sound …" | same file, `xp.acoustics.infoCard.caveat` | "Everything in the sound" is not a measured quantity. What *is* measured is the explained-variance share of the z-scored 3078-dim features, and it differs per recording. The task brief also quotes the phrase "a sliver, often a few percent". "A few percent" was **not** found by text search in either repo on 2026-09-29, so it is treated as a quoted draft, not a located string. |
| L4 | "A thread joins two moments that sound alike." | `app/src/scene2/CloudSceneV2.tsx` | The edges are k = 3 nearest neighbours in the 3D PCA positions. Whether this means "sound alike" is exactly what Experiment 007 (edge-wording gate) and Experiment 009 decide. It is not yet backed. |
| L5 | "A real recording … one bird, caught in the act." | same file as L2, `xp.acoustics.infoCard.recording` | This is an individual-level claim (D-008: no individual-bird ground truth). Recordings can contain several sources (Corpus_v2, Known biases 2). |

**Out of scope, flagged for a follow-up audit.** `app/src/components/cloudChannels.ts` states "on the field recording the two are only weakly related (r = 0.29)". This number does not come from any experiment notebook found on 2026-09-29, and it is not one of S1–S8. It is **not** covered by this audit, and it is listed here so it is not forgotten. The same applies to the production screen's "roughly three thousand numbers … five hundred frequency bands". That wording is consistent with 6 × 513 = 3078, but it is not audited here.

The replacement is a **generated** description. Each sentence is a template. It is emitted only when its gate holds, and its numbers are filled from the payload. The planned sentence set is closed. **Anything not in S1–S8 is out.** Adding a sentence requires an amendment to this notebook before the run.

### Deviations from the task specification (deliberate amendments, fixed before the run)

The task specification lists S1–S8 and A1–A5. This notebook follows it, except for the changes below. Each one makes a sentence *more* accurate or the audit *stricter*; none relaxes a threshold.

| # | Spec wording | This notebook | Reason |
|---|---|---|---|
| X1 | S1: "the quietest share (actual percentile from payload)" | S1 states the **realised** dropped share from counts (`pointsBeforeAmplitudeFilter`, `pointCount`). | `amplitudeFilterPercentile` is the filter *parameter* (0.2), not the realised share. The realised share is at most ⌊0.2·(N−1)⌋ / N and lower again under ties (see Unexpected Observations). Stating the parameter would repeat an L1-type error. |
| X2 | S3: "lowest–highest average pitch (spectral centroid)" | S3 describes the spectral centroid without the word "pitch". | The spectral centroid is a magnitude-weighted mean frequency (Peeters2004), not perceived pitch. "Pitch" is on the A3 denylist (with one pre-stated exception for S6). |
| X3 | S8: "every scale is set by this recording alone" | S8 names only the **relative** encodings: positions, colours and sizes. | S3 and S5 state kHz values, which are physical units and can be compared across recordings. "Every scale" would contradict them. Gate G8.3 on a new field `display.positionScaleFrom` is added, because the position scaling (`positionScale` from this recording's `maxAbsPosition`) was otherwise unchecked. |
| X4 | S5: "with its actual range" | S5 states the range **among the up-to-N loudest dots** (the candidate set), and adds a second short sentence that overlapping numbers are hidden. | Screen-space collision culling (`app/src/components/ParticleFieldV2.tsx`, `PointLabels`) hides some candidates, so the stated extremes may not be on screen. |
| X5 | A2: "an independent reviewer checks 100% of sentences" | Kept at 100%. The reviewer's task is extended in writing to the denylist and to payload-visible gates. The A4(b) readers and the A5 reviewer must be humans. | Planted errors of types E5 and E7 need these checks; an AI agent cannot be a "lay reader" or a "fluent reviewer" in the sense the spec intends. |

## Hypothesis

This is an audit, so the hypotheses are engineering claims that can fail. They are stated so that one counter-example falsifies them.

- **H1 (numerical fidelity):** across all corpus recordings and all synthetic fixtures, in all three languages, every number in every emitted sentence equals its cited fact after the stated rounding. The expected number of mismatches is 0. A single mismatch falsifies H1.
- **H2 (gate fidelity):** a sentence is emitted if and only if all of its gate conditions hold. A sentence that is present when a gate fails, or absent when all gates hold, falsifies H2.
- **H3 (claim hygiene):** no emitted sentence contains a term from the pre-committed Rule 001 / D-008 / Scientific Hierarchy denylist below. Reviewers also find no claim about anything that was not measured. A single hit falsifies H3.
- **H4 (the fixed claims are wrong for real clips; descriptive, not governing):**
  - L1 and L2 disagree with the actual window span for **every** recording analysed at 22050 Hz. This is certain by arithmetic, and it is recorded here as a pre-computed fact, not a prediction.
  - The 3D explained-variance share varies across corpus recordings. After integer rounding, the recordings do not all fall into one of the bands used in the legacy-claim tally (see Metrics). This prediction is falsified if every recording's rounded share falls into a single band.
- **H5 (structureless inputs get no axis meaning):** on the synthetic white-noise and pink-noise fixtures, S6 labels no axis. A labelled axis on white or pink noise falsifies H5 and is escalated as an Experiment 010 problem (see the Decision Rule).
  - **Evaluability rule (pre-committed):** H5 is really Experiment 010's negative control, re-checked here at the text layer. S6 fails closed (G6.1) while Experiment 010 is not decided, and then "no axis labelled" holds automatically without testing anything. So **when `evidence.exp010.status` is not `decided`, H5 is reported as "not evaluable (S6 gated off)", never as held or supported.** H5 is evaluated only in the re-run after Experiment 010 is decided.

## Method

* **Dataset / subset used:**
  - `manifest_v2_corpus.json` (`03_Research_Notebook/Corpus_v2.md`): 60 iNaturalist research-grade evidence recordings (12 species × 5) plus the 2 Wikimedia Commons Bluethroat demo files. Final counts, and the manifest SHA-256, are logged at run time from the manifest.
  - This is a **new corpus** and a new experiment. It reproduces nothing from Experiments 001–006.
  - **All 62 files are audited,** including the demo files, because the demo files are what visitors see.
  - Recording index `r` = the 0-based position in the manifest's combined list: the evidence recordings first, in manifest order, then the demo files in manifest order. It is fixed before any exclusion. `r` is internal: it never appears in the reviewer bundle (see "Review packet and reviewer bundle").
  - **Pre-stated exclusion rule:** a recording is excluded only if it fails to decode (bundled ffmpeg via `tools/lib/ffbin.js`). Unlike Experiment 007, there is **no minimum point count**. The description must behave correctly on any size of input, and small inputs are where gates matter most. Every exclusion is logged in `exclusions[]` with its reason.
  - **Synthetic fixtures:** 28 signals, listed in the controls table below and run through `runContinuousSamplingPipelineOnSamples`. Each gets a description and is audited exactly like a corpus recording. Genuine inputs therefore number 62 + 28 = **90**.
  - **Decoy payloads** (for the planted-error control only; see the controls table): extra seeded inputs whose rows carry the planted errors. They are not part of the 90 and not part of any descriptive statistic.
  - `Assets/smoke/Luscinia_svecica_song.ogg` is used for runner smoke tests only. It has the same sha1 as the demo file `Luscinia_svecica_song.ogg`, so it is audited as that corpus entry, not as an extra one.

* **Confounds (what the facts actually describe).** The description describes **the audio file**, not the target animal. Every fact in S1 and S3–S5 is a property of all the sound in the file, after whatever happened to it before upload:
  - **Recording condition and uploader processing** (Corpus_v2, Known biases 1 and 5): gear, gain, trimming, filtering and amplification are not recorded by iNaturalist and have not been checked. Trimming changes the point count and so `dropShare`. Filtering moves `cMin`/`cMax` and `dMin`/`dMax`. Compression or limiting narrows `dbRange`. A uniform linear gain change alone does not change `dbRange`, because `dbRange` is a ratio (this is arithmetic, not a measurement).
  - **Codec** (Known biases 1 and 5): lossy AAC/MP3 files can lack high-frequency content, which lowers `cMax` and `dMax`; codecs are unevenly spread across species (for example Luscinia svecica is 4/5 MP3). Narrow-band sources are caught by `frequencyRange.maxHz` (G3.3/G5.3); codec low-passing below the source Nyquist is not.
  - **SNR:** a higher noise floor raises the RMS of the quietest windows (narrowing `dbRange`), pulls the magnitude-weighted centroid of quiet windows toward the noise spectrum, and changes the explained-variance share `ev`.
  - **Background sources** (Known bias 2): the loudest kept moment, the strongest frequency on a labelled dot, and the colour extremes may come from a car, wind, a person or another species. Labels are observation-level (Known bias 3).
  - **Consequence for the wording:** A6 trap (7) forbids wording that implies the loudest, strongest or dominant content is the target animal or any particular source. This audit makes no cross-recording or cross-species claim, so these confounds bias no verdict here; they limit what the stated facts *mean*, which is why the text states only what was measured.

* **Procedure:**

  **Step 0: implementation prerequisites.** None of these exist yet (checked 2026-09-29). Each is part of the implementation under audit.
  1. **New payload fields.** The exporter (`tools/export_single_recording_dataset.js`) must add the following. Every one is computed in code, never typed by hand.
     - `framesPerPoint` and `stftHopSize`.
     - `samplingWindowSpanSeconds` = ((framesPerPoint − 1) · stftHopSize + fftSize) / sampleRate.
     - `pcaExplainedVarianceRatio` (length 3, from `reduceFeatures` `details.explainedVarianceRatio`).
     - `fitScope`: the constant `"single-recording"`, set by the code path that fits PCA on this recording's own matrix.
     - `display`: the viewer defaults that the description assumes.
       - `colorChannel` (`"spectralCentroidHz"` today)
       - `colorScaleFrom` (`"this-recording"`; `centroidNorm` = centroid / `centroidMaxHz` of this recording)
       - `sizeScaleFrom` (`"this-recording"`; `amplitudeNorm` is min–max over this recording)
       - `positionScaleFrom` (`"this-recording"`; set by the code path that computes `positionScale` = `POSITION_SPREAD` / `maxAbsPosition` from this recording's own embedding, exporter lines ~718–721)
       - `labelValue`
       - `labelCount` (40 today; `app/src/scene2/CloudSceneV2.tsx`)
       - `axisMapping` (`{x: 0, y: 1, z: 2}` today, meaning `position[0..2]`)
       - `axisEndsLabelled` (boolean)
     - `evidence`: one block per experiment 007–010. Each block holds:
       - `status`, one of `pending`, `decided` or `not-run`;
       - `resultsPath`;
       - `resultsSha256`;
       - the per-recording and per-view verdicts that the gates read. The exporter maps verdicts to a recording **by the audio file's SHA-256 from the manifest**, never by name, sound id or file name, so the label-redaction run finds the same verdicts. If an experiment's results file keys recordings differently, the mapping is built once before the run and logged.
     - `axisMeaning`: the per-axis block defined by Experiment 010.
     - `description`: the audited block (schema below).
  2. **Description generator** (proposed `tools/lib/description.js`). It is a pure function from payload to the `description` block. It must be deterministic: the same payload gives byte-identical output, with no timestamps and no randomness.
  3. **Independent checker** (proposed `tools/experiments/check_experiment_011_descriptions.js`).
     - It is written by a different author or agent from the generator, working **only from this notebook**. The model family of each author (if an AI agent) is recorded.
     - It must not `require` or `import` the generator, directly or transitively. The runner asserts this by walking the checker's `require` graph.
     - It re-derives every fact from **raw payload fields** (for example the `points[]` array). It never reads the generator's `facts[].value`.
     - It parses every number out of the rendered text with a per-language parser.
     - It is not told which inputs are decoys, and processes every input identically.
  4. **A1 unit tests:** `tools/test/description_templates.test.js`, run with `node --test tools/test/description_templates.test.js`.

  **`description` block schema (proposed; fixed before the run).** Every entry is emitted into the payload, including the omitted ones, so a reader can see *why* a sentence is missing.
  ```
  description: {
    schemaVersion: 1,
    templatesSha256,                 // SHA-256 of the canonical JSON of all templates, all languages
    generatorBlobHash,               // git blob hash of tools/lib/description.js
    languages: ["en", "es", "pt"],
    translationStatus: { es, pt },   // "reviewed-fluent" | "machine-assisted, not verified by a fluent reviewer"
    readabilityStatus: { en, es, pt },   // "reviewed" | "not reviewed"
    evidenceSnapshot: { exp007, exp008, exp009, exp010 },   // status + resultsSha256 read at export time
    sentences: [ { id, variant, facts: [ { name, path, derivation, value, decimals, rendered: {en, es, pt} } ],
                   runtimeGate: {…} | null, text: { en, es, pt } } ],
    omitted:   [ { id, failedConditions: [ "G2b.1", … ] } ]
  }
  ```

  **Run steps:**
  1. Verify the manifest (SHA-256 per file, as `node tools/download_corpus.js --verify` does), then log the counts.
  2. For each recording r: decode (`FFMPEG` from `tools/lib/ffbin.js`), run the **production** pipeline (`runContinuousSamplingPipeline`), then produce the payload and the `description`.
  3. For each synthetic fixture: generate it (seeds below), run `runContinuousSamplingPipelineOnSamples`, then produce the payload and the `description`.
  4. **Determinism check:** regenerate every description a second time from the same payload. The SHA-256 values must be identical.
  5. Run the independent checker on every (payload, description) pair: A1-style fact checks, number parsing, gate re-evaluation and the denylist scans.
  6. Run the negative controls: cross-recording swap and label redaction (see below).
  7. Run the automated readability checks (A4a).
  8. Build the decoy payloads for review round q (q = 0 for the first review), plant the errors in their rows, and run the checker on all genuine and decoy inputs together (planted-error control).
  9. Build the **review packet and reviewer bundle** for round q (next subsection), run the release assertions, and write the SHA-256 of the sealed key to the results JSON **before** the packet is released, as a commitment.
  10. The human review (A2, A3b, A4b, A5, A6) is entered in the packet.
  11. `--score-review` mode unblinds, scores the review and applies the Pre-Committed Decision Rule mechanically.

  **Review packet and reviewer bundle (blinding and label exclusion).**
  - **Opaque ids.** Every input in the packet (genuine or decoy) gets an opaque payload id, and every row gets an opaque row id, both drawn from a single seeded stream (seed 20260720 + 1150 + q). The map from opaque id to `r`, fixture or decoy is only in the sealed key. Neither `r`, the iNaturalist sound or observation id, nor any file name appears in the packet.
  - **One row per key.** A row is one (payload id, sentence id, variant, language). **No such key appears twice in the packet.** Planted errors live only in decoy payloads, whose rows replace (never duplicate) the decoy's own correct rows, so no planted row has a twin. The runner asserts key uniqueness before release.
  - **Reviewer bundle = projection, not the raw payload.** The reviewer receives, per opaque payload id, a copy of the payload **projected onto the paths the facts and payload-visible gates read**: `framesPerPoint`, `stftHopSize`, `fftSize`, `sampleRate`, `samplingWindowSpanSeconds`, `pointsBeforeAmplitudeFilter`, `pointCount`, `pcaExplainedVarianceRatio`, `pcaExplainedVarianceTotal`, `points[]` restricted to `emissionTime`, `amplitude`, `spectralCentroidHz`, `dominantFrequencyHz` and `position`, `similarityEdges`, `similarityMinTimeGapSeconds`, `frequencyRange`, `fitScope`, `display`, `evidence` (status, `resultsSha256`, and verdicts re-keyed by opaque id) and `axisMeaning`. **Everything else is dropped**, including `commonName`, `generatedFrom`, `audioId`, `audioUrl`, `source` (whose `filename` is the file's base name, `tools/lib/audio_source.js` line ~52; for the demo files that is the species name), `points[].id` (which embeds `audioId`, exporter line ~548), `pipeline`, `birdnetDetections` (a species classifier's output, added by the exporter's `main()`), any `localPath`-derived field, and the generator's own `description` block (so the reviewer never sees the generator's `facts[].value`).
  - **Fact sheet.** Each payload's block starts with a fact sheet listing every fact name and its derivation (from the templates table), with a blank for the reviewer's own value. The reviewer derives each (payload, fact) **once**, then checks every row that renders it, in every language, against their own value after the stated rounding.
  - **Name-token assertion.** Before release, the runner searches the serialised reviewer bundle and packet (case- and accent-insensitive, token-boundary matching) for every manifest name token: `commonName`, `scientificName`, `taxonName`, genus, species epithet, species slug, file name and file stem, recordist/observer name and login, and the iNaturalist sound and observation ids (numeric ids matched as whole JSON values or whole string tokens, not as digit runs inside a float). **Any hit blocks release**; the bundle is fixed and the check re-run.
  - **Ordering.** Rows are shuffled within each payload block and the blocks are shuffled, both with seed 20260720 + 1160 + q. The number of decoys is not disclosed to the reviewer.

  **Rounding and formatting (one rule, used everywhere).**
  - **Decimal rounding:** round half away from zero on the **shortest round-trip decimal representation** of the IEEE-754 double (ECMAScript `Number::toString`). This is what `Intl.NumberFormat` with the default `roundingMode: "halfExpand"` does in Node v24 / ICU 78.3.
    - `Number.prototype.toFixed` is **not** used. It rounds the exact binary value and disagrees in edge cases. Verified on 2026-09-29, Node v24, ICU 78.3: `(1.005).toFixed(2)` = `"1.00"`, while `Intl.NumberFormat('en', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(1.005)` = `"1.01"`.
    - Float scaling before rounding is **not** used either. Verified on 2026-09-29, Node v24.21.0 / ICU 78.3: `Intl.NumberFormat('en', {style: 'percent', maximumFractionDigits: 0})` formats 0.285 as `"29%"` and 0.145 as `"15%"`, while `Math.round(0.285*100)` = 28 and `Math.round(0.145*100)` = 14, because `0.285*100` = 28.499999999999996 and `0.145*100` = 14.499999999999998.
    - The checker re-implements the rule with decimal-string arithmetic. It does not call `Intl` or `toFixed` for rounding.
  - **Canonical computation of every derived fact (identical in generator and checker).** A fact is the result of exactly this computation; the rounding rule is then applied to it.
    - `spanS`: the integer numerator (framesPerPoint − 1) · stftHopSize + fftSize, then one IEEE-754 double division by `sampleRate`.
    - `dropShare`: **exact rational rounding, never through a double.** With integers d = `pointsBeforeAmplitudeFilter` − `pointCount` and N = `pointsBeforeAmplitudeFilter`, the integer percent is k = ⌊(200·d + N) / (2·N)⌋ (half away from zero for d ≥ 0), computed in integer arithmetic (`BigInt` if any intermediate could exceed 2^53). The "under 1%" variant is used iff d > 0 and k = 0; the "none left out" variant iff d = 0.
    - `ev[A]`: IEEE-754 double addition of the exported doubles `pcaExplainedVarianceRatio[axisMapping[a]]`, **left to right in the fixed order x, y, z** restricted to a ∈ A, starting from the first term. The exported JSON decimals parse back to the same doubles (JSON uses the shortest round-trip form). Summing the exported decimal strings exactly is **not** the definition. Percent scaling is a **decimal-point shift by 2 places** on the shortest round-trip string of the sum, not a multiplication by 100; then the rounding rule to an integer.
    - `cMin`, `cMax`, `dMin`, `dMax`: min and max of the exported Hz doubles; kHz by a **decimal-point shift by 3 places** on the shortest round-trip string, not a float division by 1000; then 1 decimal.
    - `dbRange`: exactly `20 * Math.log10(maxAmp / minAmp)`, in that order (one division, one `Math.log10`, one multiplication). `20*(log10(max) − log10(min))` is **not** the definition. ECMAScript does not require `Math.log10` to be correctly rounded, so generator and checker must run on the same Node/V8 version (logged).
  - **Rendering:** the already-rounded decimal is rendered with `Intl.NumberFormat(locale)` for `en`, `es` and `pt`, with fraction digits fixed to the rounding digits, so `Intl` only formats and never re-rounds. Percentages use `style: "percent"` on k/100, so the locale spacing is correct. A1 asserts that for every integer k in 0…100 the percent rendering of k/100 shows k, and that rendering a pre-rounded value never changes a digit.
    - Verified 2026-09-29, Node v24 / ICU 78.3: EN `1,234.5`; ES `1234,5` (no grouping at 4 digits; `12.345` at 5 digits); PT `1.234,5`; ES percent `20 %`; PT percent `20%`.
    - Templates never type digits, `%` or separators themselves.
  - **Per-language number parser (checker):** it knows these locale rules. `1.234` in PT means one thousand two hundred thirty-four, and `0,16` in ES/PT means 0.16.
  - **Spelled-out numbers and vague quantities:**
    - Spelled-out number words count as numbers and must be cited facts. These include "one", "two", "three", "half", "third", "quarter", "fifth", "twice", "dozen" and the ES/PT equivalents ("uno", "dos/dois/duas", "tres/três", "medio/meio", "tercio/terço", "cuarto/quarto", "quinto", "doble/dobro", "docena/dúzia").
    - EN "one" counts as a number even when used as a pronoun, so templates must avoid it. The ES articles "un/una" and PT "um/uma" are **not** counted, because they are indefinite articles that the languages cannot avoid. Instead, the A2 reviewer checks that no article is used as a quantity.
    - Vague quantity words are banned, because each implies an unmeasured amount: "sliver", "few", "most", "many", "almost all", "tiny", "huge" and their ES/PT equivalents ("pizca/fragmento", "pocos/poucos", "mayoría/maioria", "muchos/muitos", "casi todo/quase tudo", "diminuto/minúsculo", "enorme").
    - **Exception:** the tokens "1D", "2D" and "3D" are numbers tied to the fact `view.axisCount`.
  - **Display precision:** no stated number may imply finer precision than its measurement resolution.
    - Frequencies are shown to 0.1 kHz. This is coarser than `frequencyRange.binWidthHz` = 21.53 Hz at 22050 Hz / 1024-FFT, and the runner asserts that 100 Hz ≥ binWidthHz.
    - Durations are shown to 0.01 s. The sample period is 1/22050 s.
  - **Source of facts:** every fact is computed from the **exported** payload values, not from internal values, so that a reader can reproduce it from the JSON alone.

  **The sentence templates (closed set).** The draft EN wording is indicative. The **final** wording, in all three languages, is fixed and hashed (`templatesSha256`) before the run, and every draft must itself pass A3–A6. For S2b, S6 and S7, the wording depends on decisions not yet made (Experiments 008, 010 and 009), so no draft is given. Their wording will be written from those experiments' decided vocabulary and audited here.

  | ID | What it says | Facts (name ← payload path / derivation) | Rounding / format | Gate conditions (all must hold; each has its own ID) | Draft EN (indicative) |
  |---|---|---|---|---|---|
  | **S1** | What a dot is; the quiet share left out | `spanS` ← `samplingWindowSpanSeconds` (checker recomputes it from `framesPerPoint`, `stftHopSize`, `fftSize`, `sampleRate`). `dropShare` ← (`pointsBeforeAmplitudeFilter` − `pointCount`) / `pointsBeforeAmplitudeFilter`, computed in integers (see canonical computation). **Not** `amplitudeFilterPercentile`: the rule keeps windows ≥ the sorted RMS at index ⌊0.2·(N−1)⌋, so the actual share is ≤ 20%. For example, N = 100 gives at most 19 dropped = 19%. | `spanS`: 2 decimals, in seconds. `dropShare`: integer percent. If `dropShare` > 0 but rounds to 0, the variant "under 1%" is used, with the bound 1 as its fact. If `dropShare` = 0, the variant "no moments were left out" is used. | G1.1 `framesPerPoint`, `stftHopSize`, `fftSize` and `sampleRate` are finite positive integers. G1.2 `samplingWindowSpanSeconds` equals its recomputation to ≤ 1e-12 relative. G1.3 1 ≤ `pointCount` ≤ `pointsBeforeAmplitudeFilter`. | "Each dot is a split-second moment of this recording, about {spanS} seconds long; the quietest {dropShare} of moments are left out." |
  | **S2a** | How much of the variation between moments the current view keeps | For each of the 7 non-empty axis subsets A ⊆ {x, y, z}: `ev[A]` ← Σ over a ∈ A of `pcaExplainedVarianceRatio[axisMapping[a]]` (canonical float order x, y, z). `axisCount` ← \|A\|. One variant per subset, and the viewer shows the variant for the current X/Y/Z toggle (a runtime gate). | `ev`: integer percent. If `ev` > 0 but rounds to 0, the variant "under 1%" is used. | G2a.1 `pcaExplainedVarianceRatio` has length 3; each value is finite and in [0, 1]; the sum is ≤ 1 + 1e-9 and equals `pcaExplainedVarianceTotal` to ≤ 1e-9. G2a.2 **PCA fidelity (extra rigor):** the integer-percent rendering of `ev[A]` from production `pca()` equals the rendering from a reference eigendecomposition of **the same n × n Gram matrix that `tools/lib/reducers.js` `pca()` builds** (z-scored features, G = X Xᵀ / max(1, n − 1), n ≤ 700), with ratio = eigenvalue / trace(G), as in Experiment 007's PCA fidelity check. The reference is `ml-matrix` 6.14.0 (`EigenvalueDecomposition`, `assumeSymmetric: true`), version logged. No 3078 × 3078 covariance is formed. If the renderings differ, S2a is omitted for that recording and flagged. G2a.3 Runtime: the current toggle equals A. | "This {axisCount}D view keeps {ev} of the total variation between moments, measured across all frequencies; the rest cannot be shown here." |
  | **S2b** | Whether the current view is weak | The per-view flag from Experiment 008 for subset A, plus the per-view "not better than random" label from Experiment 007 for subset A. | none (no numbers unless Experiment 008's wording cites one; then that number is a fact with its own rounding) | G2b.1 `evidence.exp008.status` = `decided` and the flag exists for this recording and subset A. G2b.2 `resultsSha256` matches the file on disk at export time. G2b.3 Runtime toggle = A. **Precedence (extra rigor):** if Experiment 007 labels subset A "not better than random", S2b must say so, whatever the Experiment 008 flag, because that is the more restrictive claim. If Experiment 007 is not decided, only the Experiment 008 wording is used. | Written from Experiment 008's decided wording. |
  | **S3** | What colour shows, and its range here | `cMin`, `cMax` ← min and max of `points[].spectralCentroidHz` over the kept points, in kHz (decimal shift). | 1 decimal, in kHz. If the rounded `cMin` equals the rounded `cMax`, the single-value variant "all around {cMin} kHz" is used. | G3.1 `pointCount` ≥ 1, and all centroid values are finite. G3.2 `display.colorChannel` = `"spectralCentroidHz"` (also a runtime gate). G3.3 `cMax` ≤ `frequencyRange.maxHz`. If not, the sentence is omitted and flagged, because the colour would then be describing resampler artefacts. G3.4 (extra rigor) every kept point has `amplitude` > 0. On an all-zero window `frameCentroid` returns 0 / (0 + 1e-12) = 0 (exporter line ~232), which is a code convention, not a measured frequency. | "Colour shows where each moment's sound strength sits on average across frequencies: here from {cMin} to {cMax} kHz (thousands of vibrations per second)." (23 words) |
  | **S4** | Loudness range between the loudest and quietest kept moments | `dbRange` ← `20 * Math.log10(max points[].amplitude / min points[].amplitude)` over the kept points. This is a **relative** RMS ratio. It is not dB SPL and not calibrated. | integer dB | G4.1 `pointCount` ≥ 2. G4.2 min amplitude > 0 and both values finite. G4.3 `dbRange` rounds to ≥ 1. Below 1 dB the sentence is omitted: it would carry no content, and no variant is defined. | "The loudest kept moment is {dbRange} decibels (dB, the usual scale for loudness differences) louder than the quietest kept moment." |
  | **S5** | What the numbers on dots show, and their range among the candidate dots; a second sentence says overlapping numbers are hidden | `nLabel` ← min(`display.labelCount`, `pointCount`). The candidate set is the first `nLabel` points after a **stable** sort by `amplitude` descending of the time-ordered `points[]`, which is exactly `app/src/components/ParticleFieldV2.tsx` `PointLabels` (`Array.prototype.sort` is stable since ES2019), so ties are broken by the earlier `emissionTime`. `dMin`, `dMax` ← min and max of `dominantFrequencyHz` over the candidate set, in kHz (decimal shift). Candidates are placed loudest-first and one that would collide on screen is dropped for that frame (`PointLabels` comment, lines ~415–420), so the stated extremes may not be visible. | `nLabel`: integer. `dMin`, `dMax`: 1 decimal, in kHz. There is a single-value variant, as in S3. | G5.1 `display.labelValue` = `"dominantFrequencyHz"` (also a runtime gate: the viewer hides S5 if the user picks another label value or `none`). G5.2 `nLabel` ≥ 1. G5.3 `dMax` ≤ `frequencyRange.maxHz`, or the sentence is omitted and flagged. G5.4 Runtime: the viewer's current `labelCount` equals `display.labelCount`. If not, the variant is re-rendered from the same rule, and that re-rendering is covered by A1. G5.5 (extra rigor) every candidate has `amplitude` > 0 (on digital silence `dominantFrequencyHz` is 0 for every point; see Unexpected Observations). | "Numbers on up to {nLabel} loudest dots show each dot's strongest frequency; among them, {dMin} to {dMax} kHz (thousands of vibrations per second). Numbers that would overlap are hidden, so fewer than {nLabel} may be visible together." (23 + 14 words) |
  | **S6** | Axis meaning, only for axes labelled under Experiment 010's rules, with direction | Per axis a: the descriptor phrase, the direction sign and the strength statistic from `axisMeaning[a]`. **The direction is computed on the exported `position[axisMapping[a]]`**, the same coordinates that are drawn. PCA signs are arbitrary (JolliffeCadima2016), so a sign computed on unexported internal scores would be invalid. | As Experiment 010 specifies for any number it cites. | G6.1 `evidence.exp010.status` = `decided`. G6.2 `axisMeaning[a].status` = `"labelled"` under Experiment 010's rule. There is **one sentence per labelled axis, and none for unlabelled axes.** G6.3 `display.axisEndsLabelled` = true. The direction is stated relative to the axis's **labelled positive end as drawn**, never as "left/right/front/back" on screen, because the camera can rotate. G6.4 Runtime: axis a is toggled on. G6.5 The checker recomputes the sign from the exported positions and per-point descriptor values, where Experiment 010 exports them. If it cannot be recomputed from the payload, the check is made against Experiment 010's results JSON for that recording and recorded as "verified against results file, not payload". | Written from Experiment 010's decided vocabulary. |
  | **S7** | What the lines mean, and how many there are | `nEdges` ← `similarityEdges.length`. `gapS` ← `similarityMinTimeGapSeconds`. The checker verifies, for **100% of edges**, that \|Δ`emissionTime`\| ≥ `gapS` on the time-sorted `points[]`. | `nEdges`: integer, locale grouping. `gapS`: 1 decimal, in seconds. | G7.1 `evidence.exp009.status` = `decided` and its decision gives the line meaning. G7.2 `nEdges` ≥ 1. G7.3 Every edge satisfies the gap. **Most-restrictive rule (extra rigor):** the wording must agree with both Experiment 009's decision and Experiment 007's similarity-edge wording gate (perceptual wording such as "sound alike" is **never** allowed, because neither Experiment 007 nor Experiment 009 tests perception; the most permissive wording is "similar spectrogram content", and only where Experiment 009 decides it and Experiment 007's similarity-edge wording gate permits it; otherwise "closest in this 3D picture"). If Experiment 009 decides the lines have no validated meaning, S7 is omitted. A construction-only variant is allowed only if Experiment 009's decision explicitly permits it. | Written from Experiment 009's decided wording. |
  | **S8** | Scope: the relative encodings (positions, colours, sizes) are scaled to this recording alone | `fitScope`, `display.colorScaleFrom`, `display.sizeScaleFrom` and `display.positionScaleFrom`. There are no numbers. | none | G8.1 `fitScope` = `"single-recording"`. G8.2 `colorScaleFrom` = `sizeScaleFrom` = `"this-recording"`. G8.3 `positionScaleFrom` = `"this-recording"`. A future shared-embedding comparison export fails G8.1, and S8 is then omitted. That case is tested in A1. The sentence must not say or imply that the kHz values in S3/S5 are recording-relative (they are physical units; deviation X3). | "Positions, colours and sizes are scaled to this recording alone, so compare them within this recording, not between recordings." (19 words) |

  **Gates common to all templates:**
  - G0.1: every cited fact is finite. NaN, ±Infinity, `null` and `undefined` all fail the gate.
  - G0.2: no rendered string contains "NaN", "Infinity", "undefined", "null" or an empty placeholder.
  - G0.3: the language is one of en, es and pt.
  - A sentence that fails any gate goes to `omitted[]`, with every failed condition ID. Gates **fail closed**: an evidence status of `pending` or `not-run`, or a missing evidence block, counts as a failed gate.
  - **Payload-visible gates** (a reviewer can evaluate them from the reviewer bundle alone): G0.1–G0.3, G1.1–G1.3, G2a.1, G3.1–G3.4, G4.1–G4.3, G5.1–G5.3, G5.5, G6.1–G6.3 and G7.1 (the `status` field only), G7.2, G7.3, G8.1–G8.3. **Not payload-visible:** G2a.2 (needs the reference PCA), G2b.2 (needs the results file on disk) and every `resultsSha256` comparison. Runtime gates (G2a.3, G2b.3, G3.2 runtime part, G5.1 runtime part, G5.4, G6.4) are covered by one row per variant and by A1, not by the static review.

* **Metrics used to evaluate** (pre-committed acceptance criteria; all must pass):

  | Criterion | What is measured | Threshold |
  |---|---|---|
  | **A1**: unit test per template | For every template and variant, `tools/test/description_templates.test.js` shows: (a) with all gates true, the sentence is emitted, and the multiset of numbers parsed from the text in each language equals the multiset of rounded facts. Every number in the text is a cited fact, and every cited fact appears. (b) For **each** gate condition separately, a fixture where only that condition fails leads to omission, with that condition's ID in `omitted[]`. (c) Rounding edge cases: 1.005 → 1.01 at 2 decimals; **0.285 → 29% and 0.145 → 15%** (percent by decimal shift); `dropShare` with d = 57, N = 200 (exactly 28.5%) → 29% by exact rational rounding; an `ev[A]` case whose float sum and whose exact decimal-string sum round differently, which must follow the float-sum definition (if no such case exists among values in [0, 1] at the precision used, the test states that it searched and found none, with the search range); a value exactly at .5 of the last digit; negative zero; a value just below the "under 1%" threshold. (d) Locale rendering and parsing round trip in en, es and pt, including thousands grouping at 4 and 5 digits; percent rendering of k/100 shows k for every k in 0…100. (e) NaN, Infinity or a missing field leads to omission. (f) S6: flipping the sign of the exported `position[a]` flips the stated direction. (g) S5: tie-breaking in the candidate set matches a stable amplitude-descending sort. (h) S8 is omitted for `fitScope` ≠ `"single-recording"` and for `positionScaleFrom` ≠ `"this-recording"`. (i) A coverage meta-test: the set of template IDs in the generator equals the set tested. A template without tests fails the suite. (j) **Rounding property test:** 10^5 seeded values (seed 20260720 + 1107; half uniform doubles in [0, 1), half uniform in [0, 20000), plus every constructed decimal .5 boundary k/10^p + 5/10^(p+1) for p ∈ {0, 1, 2}, k < 1000) are rounded by the checker's decimal-string rule and by `Intl.NumberFormat` halfExpand at 0, 1 and 2 decimals and as percent. Any disagreement fails A1. (k) S3 and S5 are omitted on an all-zero-amplitude fixture (G3.4, G5.5). | **All tests pass.** 0 failures, 0 skipped. |
  | **A2**: 100% independent check against payload numbers | Every emitted sentence, in every language, for every corpus recording and synthetic fixture, is checked two ways: (i) by the automated independent checker, and (ii) by an independent reviewer using the review packet and the reviewer bundle (never the raw payload, the generator code or the checker code). **The reviewer's written task**, given with the packet: (1) for every (payload, fact), derive the value from the bundle once, using the fact sheet's derivation and this notebook's canonical computation; (2) for every row, check that each rendered number equals that value after the stated rounding and locale format; (3) check every row against the A3 denylist (given in full); (4) re-evaluate every **payload-visible** gate (the gate table and the list above are given) and flag any row whose sentence should have been omitted. The reviewer has not written the templates, the generator or the checker. The reviewer's identity, date and tools (for example a spreadsheet) are recorded. **If the reviewer is an AI agent**, it is disclosed as such, with its model name, family and version. If it shares a model family with the checker's author, review (ii) is not counted as independent of (i), and a second reviewer (a human, or an agent of a different family) must complete A2(ii) as well. Sharing a family with the generator's author is recorded and reported as a correlated-error risk. | **0 confirmed mismatches** from either (i) or (ii), on genuine rows and on the non-planted rows of decoys (both are generator output). A flag raised by the reviewer on a genuine row is re-checked against the payload by a third party. Any confirmed mismatch counts. Unconfirmed flags are logged. |
  | **A3**: no unmeasured claims (Rule 001, D-008, Scientific Hierarchy) | **(a) Automated.** A whole-word, case- and accent-insensitive scan of every emitted sentence against the denylist below, plus every `scientificName`, genus, `taxonName` and iNaturalist common name found in the manifest. **(b) Human.** For each template (not each recording), the A2 reviewer answers: "Does this sentence state anything that is not one of its cited facts, or a definition of how the picture is built?" | (a) **0 hits.** (b) **"No" for every template.** |
  | **A4**: readability for non-technical readers | **(a) Automated.** Word count per grammatical sentence (split at `.`, `?` or `!` followed by a space or the end, never at a decimal separator; a template's text may hold more than one sentence, which only S5 does), where words are whitespace-separated tokens and a parenthetical explanation counts: EN ≤ **25** words, ES/PT ≤ **30** words. At most **3** numbers per sentence. A jargon denylist, below. Every allowed term must be explained in the same sentence. **(b) Human.** At least **2** EN lay readers with no training in signal processing, statistics or ornithology (self-declared; recorded), and at least 1 per ES and PT (the A5 reviewer may double as this reader; this is recorded). **Every A4(b) reader must be a human.** An AI agent cannot fill this role; if it is filled by one, the language's status is `"not reviewed"`, never pass. Each reads every template rendered on 3 example recordings (drawn by seed 20260720 + 1103), answers "understood without help: yes/no", and writes a one-line paraphrase. The A2 reviewer judges each paraphrase "same meaning / different meaning". The word limits (25 / 30) and the 3-number limit are **project-set thresholds, chosen before the run**. They are not derived from any source: `04_Literature/Literature_Database.md` contains no readability literature, and no readability formula is used for that reason. | (a) **0 violations.** (b) **Every** reader answers "yes" for every template, and **every** paraphrase is judged "same meaning". |
  | **A5**: ES/PT faithful to EN | Per template, a reviewer fluent in EN and the target language (proficiency self-declared: native or professional; recorded) marks the template "faithful" or "not faithful", with a reason. **The A5 reviewer must be a human.** If an AI agent fills the role, the language is `"machine-assisted, not verified by a fluent reviewer"`, never pass. Extra rigor: a blind back-translation of each ES and PT template into EN, made by a person or a system not shown the EN original, is given to the reviewer as an aid and stored. Numbers and facts in ES/PT are checked by A1, A2 and A3 regardless. A5 covers wording only. | **"Faithful" for every template in that language.** If no fluent human reviewer is available for a language, that language is **flagged** as `"machine-assisted, not verified by a fluent reviewer"`. This is the only permitted non-pass route (see the Decision Rule). |
  | **A6** (added rigor): technical accuracy of the wording | For each template, the A2 reviewer checks the wording against the **code definition** of each fact. Known traps, pre-stated: (1) the spectral centroid is the **linear-magnitude**-weighted mean frequency (`frameCentroid`, exporter line ~232), averaged over the 6 frames (Peeters2004 barycentre definition). It is not weighted by energy (power), so "energy" is inaccurate, and it is **not** perceived pitch, so the text must not say "pitch" as if it were. (2) `dbRange` is a relative RMS ratio, not a sound level. (3) Explained variance is the share of variance of the z-scored features, not "information" or "everything in the sound". (4) `dominantFrequencyHz` is the loudest STFT bin in the loudest frame of the window. (5) The edges are neighbours in the 3D PCA positions, not in the full spectrogram space, unless Experiment 009 decides otherwise. (6) The kHz values in S3 and S5 are physical units; only positions, colours and sizes are recording-relative (S8). S5's range is over the candidate set, not the labels on screen. (7) **Confound guard:** no wording may imply that the loudest, strongest or dominant content is the target animal or any particular source; the facts describe all sound in the file (see Confounds). | **"Accurate" for every template.** |

  **A3 denylist (pre-committed; whole-word matching; `*` = any ending):**
  - **EN:** bird*, species, individual*, male*, female*, song*, sing, sings, singing, singer*, sang, sung, call, calls, calling, called, alarm*, territor*, courtship, court*, mate, mates, mating, feel*, emotion*, mood*, happy, angry, afraid, scared, excited, want*, try*, trying, intend*, intent*, communicat*, message*, warn*, attract*, defend*, population*, animal*, healthy, health, syllable*, phrase*, note, notes, verse*, motif*; **vocal-type and perceptual words:** pitch*, whistl*, trill*, buzz*, chirp*, tweet*, warbl*.
  - **ES:** ave, aves, pájaro*, especie*, individu*, macho*, hembra*, canto*, cantar, canta*, llamada*, reclamo*, alarma*, territori*, cortejo*, pareja*, siente*, sentir, emoción*, ánimo, feliz, enfadad*, asustad*, quiere*, intenta*, intención*, comunica*, mensaje*, advierte*, atrae*, defiende*, població*, animal*, sílaba*, frase*, nota, notas, verso*, motivo*; **vocal-type and perceptual words:** tono, tonos, tonal*, silb*, trino*, trina*, trinar, zumb*, gorje*, pío, píos, piar, chirri*, gorgoj*.
  - **PT:** ave, aves, pássaro*, espécie*, indivídu*, macho*, fêmea*, canto*, cantar, canta*, chamado*, alarme*, territór*, cortejo*, parceir*, sente*, sentir, emoç*, humor, feliz, zangad*, assustad*, quer, querem, tenta*, intenç*, comunica*, mensage*, avisa*, atrai*, defende*, populaç*, animal, animais, sílaba*, frase*, nota, notas, verso*, motivo*; **vocal-type and perceptual words:** tom, tons, tonal*, assobi*, trinad*, trinar, trilo*, zumbi*, zune*, gorjei*, chilr*, pio, pios, piar, piad*.
  - **Why the list is this broad:** the Frame-level rule forbids "note", "syllable", "phrase" and "motif". The audio is not verified to be one bird (Corpus_v2, Known biases 2–3). Behaviour and intent are unmeasured (Rule 001, D-008). Vocal-type words (whistle, trill, buzz, chirp, tweet, warble and their ES/PT equivalents) imply a bird source and a perceptual category that nothing here measures; an earlier S6 idea in the design discussion used exactly "clear whistles … buzzy notes", so they are listed explicitly. A hit is never waived: the template is rewritten, and the full audit is re-run. This includes innocent hits, such as EN "note that", ES/PT "motivo" meaning "reason", PT "canto" meaning "corner", ES "tono" meaning "tone" or PT "tom" meaning "tone". Once the run has started, a false positive is resolved by rewording the template, **never** by editing the denylist. `sing*` is spelled out word by word so that it does not match "single".
  - **Single pre-stated exception ("pitch"):** the words "pitch", ES "tono" and PT "tom" are allowed **only** in S6, and only if Experiment 010 labels an axis with a pitch descriptor under its own rule. This exception is recorded now, before the run, and no other exception can be added after it starts. Note: Experiment 010's pitch descriptor is pre-registered with `validatedForLabelling: false` (Experiment 010, descriptor table), so under its current pre-registration this exception is not expected to apply.
  - **Label check:** the manifest's `commonName`, `scientificName` and `taxonName` values are appended to the list at run time. The payload's `commonName` must not be read by the generator (see Label-exclusion verification).

  **A4 jargon denylist (pre-committed):**
  - **Banned outright (EN, and the ES/PT equivalents in the final template file):** PCA, principal, component*, variance, eigen*, spectral, centroid, RMS, FFT, STFT, embedding, dimension*, dimensional, z-score, standardi*, normali*, percentile, neighbour*, neighbor*, k-NN, trustworthiness, logarithm*, Nyquist, bin, bins, window, windows, amplitude, correlation, manifold.
  - **Allowed only with an explanation in the same sentence:**
    - "kHz", explained as "thousands of vibrations per second";
    - "dB/decibels", explained as "the usual scale for loudness differences";
    - "spectrogram", explained as "a picture of sound, with time across and frequency up", or as Experiment 009's decided wording.
  - **Word lists for ES and PT:** these are fixed together with the final templates, before the run, and hashed into `templatesSha256`.

  **Descriptive statistics (not governing):**
  - For every corpus recording, the JSON records each fact: `spanS`; `dropShare`; `ev` for all 7 subsets; `cMin`, `cMax`; `dbRange`; `nLabel`, `dMin`, `dMax`; `nEdges`. It also records which sentences were emitted or omitted, and why.
  - **Across-recording summaries use the 60 evidence recordings only.** The 2 demo files are reported separately, value by value, and are not pooled. For the 60, the JSON gives the median, the IQR (Q1 and Q3, linear interpolation) and a 95% percentile bootstrap CI of the median, using `metrics.bootstrapCI` with B = 2000 and seed 20260720 + 1104. It also gives emission and omission counts per template and per failed-condition ID (for all 90 genuine inputs, split by corpus / demo / fixture).
  - **The bootstrap resamples recordings as if independent.** They are not: recordings cluster by species (5 each) and by observer (10 observers contribute to more than one species; Corpus_v2, Known bias 5), and device/codec is unevenly spread. The CI ignores this clustering, is therefore likely too narrow, and is **descriptive only**. These numbers describe the corpus. They decide nothing.

  **Legacy-claim tally (descriptive; tests H4):**
  - For each recording: L1 (true if `spanS` rounds to 0.15), L2 (true if `spanS` rounds to 0.10 at 2 decimals), and the 3D `ev` integer percent.
  - The `ev` values are also counted into these project-defined bands, fixed now: < 1%, 1–4%, 5–9%, 10–24%, 25–49%, ≥ 50%. The bands are **not** a reading of "a sliver" or "a few percent". They exist only so that H4's "a single fixed phrase cannot be right for all recordings" can be counted. The H4 band test uses the 60 evidence recordings; the demo files are listed separately.
  - L3–L5 are not tallied numerically: they are unmeasurable as worded (L3), or they depend on other experiments (L4) or on unavailable ground truth (L5).

  **Feasibility: rows, reviewer effort and compute (pre-stated; actual values logged at run time).**
  - **Row count formula.** R_gen = 3 · Σ over genuine inputs of e_i, where e_i is the number of emitted template-variants for input i. At the first run S2b, S6 and S7 are gated off, so e_i ≤ 12 (S1, 7 S2a subsets, S3, S4, S5, S8), and R_gen ≤ 3 · 12 · 90 = **3,240**. Planted rows P = max(30, ⌈0.05 · R_gen⌉) ≤ **162**. Decoys D = max(12, ⌈P / 8⌉) ≤ **21**, adding ≤ 3 · 12 · 21 = **756** rows. Packet ≤ **3,996** rows. Facts to derive: ≤ 15 per payload (`spanS`, `dropShare`, 7 × `ev`, `cMin`, `cMax`, `dbRange`, `nLabel`, `dMin`, `dMax`), so ≤ 111 · 15 = **1,665** (payload, fact) derivations. After Experiments 008–010 are decided, e_i can rise to 12 + 7 (S2b) + 3 (S6) + 1 (S7) = 23, so R_gen ≤ 6,210 and P ≤ 311; the runner logs the formula's inputs and outputs for each run.
  - **Reviewer effort (a planning assumption, not a measurement).** Assuming 15 min per payload to derive its facts in a spreadsheet and 10 s per rendered row: 111 · 15 min ≈ 27.8 h plus 3,996 · 10 s ≈ 11.1 h, **about 39 reviewer-hours per full review** at the first run. These per-item times are guesses; the reviewer's actual time is logged and reported next to this estimate.
  - **Coverage is 100% and is never subset.** The fact-sheet structure (derive each (payload, fact) once, then check its renderings) is how 100% is kept affordable.
  - **Re-run budget (pre-committed).** The project plans for at most **2** full human reviews (rounds q = 0 and q = 1) per evidence state (before, and again after, Experiments 008–010 are decided). If a template still fails after the second full review, it is removed from the shipped set ("not shipped") rather than reviewed on a subset. A further full review is allowed only if the project owner explicitly funds it; it is recorded as a new round and never replaces an earlier one.
  - **Compute estimate.** Measured once on 2026-09-29 on an Apple M2, Node v24.21.0, with a seeded random 700 × 3078 matrix (not corpus data; a single run, not a benchmark): production `pca()` at 3 components took 4.93 s; building the same n × n Gram product separately took 0.86 s; `ml-matrix` `EigenvalueDecomposition` of the 700 × 700 matrix took 0.92 s. For ≤ 111 inputs, PCA twice (main run and label-redaction run) plus the reference once is ≈ 111 · (2 · 4.93 + 0.86 + 0.92) s ≈ 1,290 s ≈ **22 min**, an upper bound because many inputs have n < 700. Decoding and the STFT were not timed. Actual wall-clock per stage is logged.

* **Negative control type used:** this audit cannot use the matched-Gaussian margin, because nothing here is a neighbourhood metric. Its controls ask a different question: **does the audit actually catch errors, and does the text depend only on what it should?** All of the following are pre-committed:

  | Control | Construction | What it proves | Seed |
  |---|---|---|---|
  | **Planted-error control** (blind, decoy payloads) | Planted errors live **only in decoy payloads**, never as copies of genuine rows. So every genuine row is reviewed as generated, and no planted row has a twin key. **Decoys:** D = max(12, ⌈P / 8⌉) decoy inputs, drawn in the genuine inputs' proportion of real audio to synthetic (round(D · 62/90) real, the rest synthetic). A **real decoy** is a seeded crop of a seeded parent from the 62 corpus files: crop length uniform in [50%, 90%] of the parent's duration (redrawn if the crop would be < 3 s), start at a seeded sample offset that is **not** a multiple of the 512-sample hop, run through the production pipeline as a new input. A **synthetic decoy** is a synth.js generator from the fixture list, with a new seed and a seeded SNR in {30, 15, 6} dB; at least 3 synthetic decoys are drawn from the edge-fixture recipes (near-constant loudness, band-limited guard above 4 kHz) so that payload-visible gate failures exist to plant E7p on. Each decoy gets an opaque id and a full set of rows, exactly like a genuine input. **Planting:** P = max(30, ⌈0.05 · R_gen⌉) planted rows are allocated across decoys (each decoy ≥ 1 and ≤ ⌊rows_j / 3⌋; D is increased by 1 until this is feasible). Each planted row **replaces** that decoy's correct row. The error type is uniform over the types that apply to that row, subject to at least **3** planted rows per type (the runner asserts it): **E1** a number off by one unit in its last displayed digit; **E2** truncation instead of rounding (only where the two differ); **E3** two facts swapped within a sentence (min ↔ max, or between facts); **E4** a number taken from another input in the packet (seeded choice); **E5** a denylisted term inserted (A3); **E6** a number rendered with the wrong locale's separators (for example `0.16` inside ES text); **E7p** a sentence whose **payload-visible** gate failed, re-inserted; **E7e** a sentence whose non-payload-visible gate (G2a.2, or an evidence `resultsSha256` mismatch simulated in the decoy's checker input) failed, re-inserted (checker only). The non-planted rows of decoys are correct generator output and are scored like genuine rows. **Indistinguishability assertions before release:** (1) every packet key is unique; (2) no `points[].amplitude` double of any decoy equals, bit for bit, any `points[].amplitude` of any genuine input; (3) the name-token assertion passes. The sealed key (decoy map, planted rows, error types) has its SHA-256 committed in the results JSON before review. | The checker and the reviewer can detect every kind of error the audit claims to rule out, on rows that cannot be singled out without checking them against the payload. | Round q: decoy allocation (which parents, which recipes, planted counts and error types) 20260720 + 1140 + q; decoy j's crop or signal 20260720 + 1200 + 100·q + j (j < 100); opaque ids 20260720 + 1150 + q; row and block order 20260720 + 1160 + q. q ≤ 7. |
  | **Cross-recording swap control** (checker only) | Each recording's description is checked against the payload of a partner recording r′, taken from a seeded derangement of the corpus (Fisher–Yates with rejection, until there are no fixed points). The expected result, computed from the facts alone, is a mismatch on exactly those (sentence, language) rows whose rounded facts differ between r and r′. The checker must reproduce that set exactly. | The checker reads the payload it is given, and it does not pass by construction. S8, and S1's span, are identical across recordings at 22050 Hz, so they are expected **not** to mismatch. | Corpus: 20260720 + **1101** |
  | **Label-redaction invariance** (every recording) | Each recording is run twice through the whole pipeline. In the second run: the audio is decoded from a scratch copy named by an opaque id (keeping the extension, which the decoder needs), so `source.filename` carries no name; and `commonName`, `generatedFrom`, `audioId` (and hence `points[].id`), `audioUrl`, `source.filename`, any `localPath`-derived field, every taxon or label field in an in-memory copy of the manifest, and `birdnetDetections` (if present) are replaced by `"REDACTED"` or removed. The SHA-256 of the `description` block must be identical, with `evidenceSnapshot` included. | Rule 001: the text does not depend on labels or on anything that encodes them. | none (deterministic) |
  | **Gate-inversion fixtures** | Inside A1: every gate condition is falsified alone (see A1(b)). | H2 at the unit level. | none (deterministic fixtures) |
  | **Synthetic signals** (28 fixtures, described like recordings) | `tools/lib/synth.js`, run through `runContinuousSamplingPipelineOnSamples`. (1) `pitchAlternation`, `noisinessAlternation`, `loudnessAlternation`, `bandwidthAlternation`, `brightnessAlternation`, `motifSequence` and `clickTrain`, each at SNR 30, 15 and 6 dB, 30 s, other parameters at the synth.js `DEFAULTS` (recorded): 21 fixtures. (2) `whiteNoise` and `pinkNoise`, 30 s. The synth.js stationary-noise generators add no background, so SNR does not apply: 2 fixtures. (3) Edge fixtures (5), each with its **pre-stated expected gate outcome**, which the runner asserts (a mismatch between expected and actual gate outcome is a fixture failure, reported, and blocks the audit-validity precondition): **digital silence** (all zeros, 10 s; built in the runner, not seeded): S1 emitted with the "no moments were left out" variant; S2a omitted (G2a.1 or G0.1, the explained variance is not finite); S3 omitted (G3.4); S4 omitted (G4.2); S5 omitted (G5.5); S8 emitted. If the exporter throws on silence, the throw is recorded, and this is acceptable only if no description is emitted (fail closed). **Near-constant loudness** (a 1 kHz sine at the synth.js default RMS 0.1, 10 s; not seeded): S1 emitted with the normal variant (not "none left out"; the RMS values do not tie), S4 omitted (G4.3). **Short clip** (`pitchAlternation`, 1.2 s): every pair is closer than 1.5 s, so there are 0 edges and G7.2 must fail. **Band-limited guard, above** (`pitchAlternation`, `frequenciesHz: [5000, 7000]`, `snrDb: null`, 30 s, passed with `source: {sampleRateHz: 8000}`, so `frequencyRange.maxHz` = 4000 Hz): G3.3 and G5.3 **must fail** (S3 and S5 omitted and flagged). **Band-limited guard, below** (same, `frequenciesHz: [1000, 2000]`): G3.3 and G5.3 **must pass** (S3 and S5 emitted). The expectations for silence, near-constant loudness and both guards were checked in a pilot on 2026-09-29 (Unexpected Observations); the pilot is not a result of this experiment. **Pre-stated expectation for noise:** on white and pink noise, no axis is labelled (H5), evaluable only once Experiment 010 is decided. | The generator behaves correctly where the truth is known, and gates fire at the edges in both directions. | 20260720 + 1110 + 3g + s, where g ∈ 0…6 indexes the list in (1) in the order given and s ∈ 0…2 indexes SNR (30, 15, 6): seeds 1110–1130. `whiteNoise` 20260720 + 1131. `pinkNoise` 20260720 + 1132. Short clip 20260720 + 1133. Band-limited above 20260720 + 1134. Band-limited below 20260720 + 1135. |
  | **Determinism** | Every description is generated twice from the same payload. | Byte-identical output: no hidden state. | none |

* **Negative control random seed:** base 20260720. This experiment uses **no per-recording seeds**: the per-recording offsets +11 (planted-row selection on genuine rows) and +12 (per-recording row order) from the first draft are **retired and not reused**, because planted errors now live in decoys and packet order is drawn per review round.

  | Corpus-level seed | Use |
  |---|---|
  | 20260720 + 1101 | derangement for the swap control |
  | 20260720 + 1102 | unused |
  | 20260720 + 1103 | draw of the 3 example recordings for A4b |
  | 20260720 + 1104 | every bootstrap (descriptive statistics) |
  | 20260720 + 1105 | retired (first-draft planted-error top-up), not reused |
  | 20260720 + 1106 | retired (first-draft block order), not reused |
  | 20260720 + 1107 | A1(j) rounding property test |
  | 20260720 + 1110 … 1135 | synthetic fixtures (see the controls table) |
  | 20260720 + 1140 + q | decoy allocation, review round q (q ≤ 7) |
  | 20260720 + 1150 + q | opaque payload and row ids, round q |
  | 20260720 + 1160 + q | row and block order in the packet, round q |
  | 20260720 + 1200 + 100·q + j | decoy j's crop or signal, round q (j < 100) |

  - **Collision check:** the ranges 1101–1107, 1110–1135, 1140–1147, 1150–1157, 1160–1167 and 1200–1999 are pairwise disjoint. The runner asserts that all seeds actually used are unique and writes the full seed table to the JSON.
  - **PRNG:** `metrics.makeRandom` (the Experiment 001 LCG) for decoy allocation, crops, opaque ids, shuffles, derangements and the property test. `synth.js` uses its own mulberry32 for the signals, which is its documented behaviour.
* **Negative control metric name:**
  - the planted-error detection rate, separately for the checker and for the human reviewer, overall and per error type;
  - the swap-control agreement (the set of mismatches the checker flags vs the pre-computed expected set);
  - label-redaction hash equality (the count of recordings with identical hashes);
  - determinism hash equality;
  - edge-fixture expected-gate agreement.
* **Negative control numeric result:** Pending run.
* **Negative control threshold:**
  - Planted-error detection = **100%** (every planted row flagged) for the checker, for every type E1–E7e. For the A2 reviewer it is also **100%**, separately for each of E1, E2, E3, E4, E5, E6 and E7p. E7e is outside what the reviewer can see and is scored for the checker only.
  - Swap-control agreement is **exact**: the flagged set equals the expected set.
  - Label-redaction and determinism hashes are identical for **100%** of recordings and fixtures.
  - Every edge fixture's gate outcomes equal the pre-stated expectation.
* **Negative control pass/fail:** Pending run.
* **Label-exposure risk step:** three steps could see labels, and one inherits a label risk:
  - **The description generator.** The payload carries `commonName`, `generatedFrom`, `audioId`, `audioUrl`, `source.filename` and `points[].id`, and possibly `birdnetDetections`; the manifest carries taxon fields.
  - **The review packet and bundle.** A reviewer who sees the species, a file name, or a look-up-able sound id could judge text by expectation.
  - **The evidence blocks from Experiments 007–010.** Their own label-exclusion checks apply to them. Here, verdicts are joined to recordings by audio SHA-256, not by name.
  - This experiment uses species labels **only** in one way: the A3 denylist scan and the name-token assertion use manifest names to *forbid* text, never to fit or choose it.
* **Label-exclusion verification:**
  1. **Code inspection, dated in Reproducibility Notes.** The generator reads only an allowlist of payload paths: every path named in the templates table, plus `display`, `evidence` and `axisMeaning`. Reading any other path throws an error, enforced by a proxy in the tests. The tests assert explicitly that reading `commonName`, `generatedFrom`, `audioId`, `audioUrl`, `source` (including `source.filename`), `points[].id`, `birdnetDetections` or any `localPath`-derived field throws.
  2. **Label-redaction invariance on every recording** (see the controls). This is stricter than Experiment 007's single-recording check, and it is affordable because generation is cheap and deterministic.
  3. **The reviewer bundle is the projection defined under "Review packet and reviewer bundle"**, not the raw payload. Inputs are identified by opaque ids only, never by `r`, the iNaturalist sound or observation id, or a file name. The runner's name-token assertion must pass before release.

## Pre-Committed Decision Rule

This rule is defined before any data are seen. The runner applies it mechanically in `--score-review` mode and stores both the verdicts and every input to each verdict.

**Unit of decision:** the **template**, meaning one sentence ID with all of its variants in all three languages. The description as a whole passes only if every template that remains in the shipped set passes.

**Per-template pass rule:** template T passes if and only if all of these hold:
- A1 all pass for T;
- A2 has 0 confirmed mismatches on T's rows, over every recording, fixture and language (and on the non-planted decoy rows);
- A3(a) 0 hits and A3(b) "No" for T;
- A4(a) 0 violations and A4(b) every (human) reader "yes" with every paraphrase "same meaning";
- A5 "faithful" in ES and PT from a human fluent reviewer, or the language is flagged (see below);
- A6 "accurate".

**Audit-validity preconditions (global).** If any of these fails, **no** template can pass, whatever its own results, because the audit itself is not shown to catch errors:
- planted-error detection is 100% for the checker (every type, E1–E7e) **and** for the A2 reviewer (each of E1–E6 and E7p separately), with at least 3 planted rows of each type;
- the release assertions held: every packet key unique, no decoy amplitude equal to a genuine one, the name-token assertion passed;
- if the A2 reviewer is an AI agent sharing a model family with the checker's author, the required second reviewer also completed A2(ii) and met the same detection threshold;
- swap-control agreement is exact;
- label-redaction and determinism hashes are identical for every recording and fixture;
- every edge fixture's gate outcomes equal the pre-stated expectations;
- the checker's `require` graph does not include the generator;
- `templatesSha256` and `generatorBlobHash` at scoring time equal those recorded at generation time.

**If the reviewer misses a planted error:** that review is void. A **different** reviewer repeats the full review in round q + 1: all rows, new decoys, new opaque ids, a new order and a new sealed key (the round-q seeds in the seed table). Both reviews are reported. The detection threshold is never lowered. This counts against the re-run budget (Feasibility).

**Zero-tolerance handling:** "zero mismatches allowed" is not relaxed. Any confirmed mismatch, gate error, denylist hit or unfaithful translation fails that template. The permitted responses are:
1. **Remove** the template from the shipped set. It is then listed as "not shipped" with its failure.
2. **Fix** the root cause, whether a template, the generator, the rounding or a gate. Any fix changes `templatesSha256` or `generatorBlobHash`, and the **entire** audit is then re-run: A1–A6, all controls, and a new human review of all rows in a new round. Every run is kept in `runs[]` in the results JSON. A failed run is never overwritten or deleted. If the re-run budget (2 full reviews per evidence state) is exhausted, response 1 applies unless the project owner explicitly funds another full review.

Editing text in place without re-running the audit is forbidden.

**Evidence-dependent templates (S2b, S6, S7):**
- If Experiment 008, 010 or 009 respectively is not `decided` at run time, the template's gate fails closed on every recording, and the template is **omitted everywhere**.
- Its audit in this run is limited to A1: the omission tests with `pending` evidence.
- Its full audit (A2–A6 on emitted text) is done in a re-run after the decision, recorded as a new entry in `runs[]`.
- It is **not** shipped until that re-run passes.
- If Experiment 007's gates change after this audit, S2b and S7 are re-audited.
- **H5** is reported as "not evaluable (S6 gated off)" in any run where `evidence.exp010.status` is not `decided`.

**Translation route (the only non-pass route):** if A5 cannot be verified for a language, because no fluent human reviewer is available, the template may ship in that language only if:
- A1–A4 and A6 pass for that language;
- the payload's `translationStatus[lang]` is `"machine-assisted, not verified by a fluent reviewer"`;
- the viewer shows a visible note in that language saying the text was translated with machine assistance.

A flagged language is reported as **"flagged"**, never as "pass".

**Readability not evaluable:** if A4(b) cannot be completed, because the required human lay readers are not available, the description is `readabilityStatus[lang] = "not reviewed"`. The viewers **must not display** it to visitors in that language until A4(b) passes. The decision for that template is "Needs more testing". There is no flag route for A4, because the purpose of the text is to be understood. An A4(b) "reader" who is an AI agent does not count toward the required readers.

**Escalations (reported; they do not change a template's pass/fail):**
- A labelled axis on white or pink noise (H5 falsified, in a run where Experiment 010 is decided): this is escalated as a possible defect in Experiment 010's labelling rule, analogous to v0.4 Failure Criterion 1 (structure from structureless input). Until Experiment 010 is re-examined, S6 is not shipped, even if it passes this audit.
- A G3.3 / G5.3 flag (a frequency fact above `frequencyRange.maxHz`) on a **corpus** recording: reported with the recording ID. The sentence is correctly omitted, and the underlying export is reviewed.
- A G2a.2 flag (production PCA and the reference disagree after rounding): reported and escalated to Experiment 007's PCA-fidelity follow-up.
- An A2 reviewer sharing a model family with the generator's author: reported as a correlated-error risk next to the A2 result.

**Outcomes (exhaustive):**

| Case | Pre-committed decision |
|---|---|
| Every precondition holds and every template passes (ES/PT faithful) | **Continue:** ship the generated description. Replace hand-written claims L1–L5 in the viewers with the payload's `description` text. The viewers render only payload text and compose no description sentences of their own. |
| Preconditions hold; some templates pass, and others fail or are omitted pending evidence | Ship **only** the passing templates. List the others as "not shipped", with reasons. The corresponding hand-written claims are **removed**, not kept as a fallback, because a claim that failed the audit or is pending has no evidence behind it. |
| Preconditions hold; a language is flagged under the translation route | Ship per the translation route, with the visible note. Report as flagged. |
| Any audit-validity precondition fails | **Needs more testing.** No template passes, and the hand-written claims L1–L5 are not endorsed by this run. Fix, then re-run everything. |
| A4(b) not evaluable | Needs more testing for the affected language. Nothing is displayed in that language. |

## Expected Outcome

- **Support:**
  - Every audit-validity precondition holds.
  - Every template not blocked by pending evidence passes A1–A6.
  - The planted-error and swap controls show the audit catches errors: 100% detection and exact agreement.
  - H5 is **not** part of Support at the first run: it is "not evaluable (S6 gated off)" until Experiment 010 is decided. In the re-run after that decision, Support additionally requires that H5 holds on white and pink noise.
- **Partial support:** some templates pass and some fail, or some are blocked by pending Experiments 008–010. The passing templates ship. This is the likely outcome if the audit is run before those experiments are decided.
- **Failure:**
  - Any confirmed mismatch, gate error or denylist hit in a template fails that template.
  - A missed planted error, or an inexact swap control, means the audit could not show it catches errors, so no template passes.
  - A label-redaction hash difference is a Rule 001 violation and makes the run void.
  - None of these triggers a threshold change. Each triggers a root-cause fix and a full re-run, which is the documented review that v0.4 Failure Criteria require for methodology failures, applied here to the text layer.
- **What success does *not* show:**
  - It does not show that the facts are *meaningful*. A number can be stated correctly and still describe a view that is weak. That is why S2b, S6 and S7 depend on Experiments 007–010, not on this audit.
  - It does not show that visitors draw correct conclusions beyond each sentence's own content.
  - It does not show that the stated facts describe the target animal: they describe the file (see Confounds).

⸻

## Results

Pending run. The results will be written to `05_Benchmark_Results/v2/experiment_011_description_claims_audit.json`, which will contain:

- `runs[]`, one entry per audit run, never overwritten. Each entry holds:
  - `templatesSha256`, `generatorBlobHash`, the checker blob hash, the git commit and a dirty-tree flag;
  - the seed table;
  - `exclusions[]`;
  - per recording and per fixture: the full `description` block, the checker results, the gate outcomes and the facts;
  - the A1 test summary;
  - the A3 and A4 automated scan results;
  - the feasibility formula inputs and outputs (R_gen, P, D, packet size), the reviewer's logged hours and the per-stage wall-clock times;
  - per review round q: the release-assertion results and the planted-key SHA-256 commitment;
  - the review scores (A2, A3b, A4b, A5, A6) with reviewer metadata (human or AI agent, model family if AI);
  - the control results;
  - the descriptive statistics (60 evidence recordings; demo files separately);
  - the legacy-claim tally;
  - the per-template verdicts, the H5 status and the global verdict.

Companion files:
- the review packet for round q: `05_Benchmark_Results/v2/experiment_011_review_packet_q<q>.csv`;
- the reviewer bundle for round q (projected payloads by opaque id, with fact sheets): `05_Benchmark_Results/v2/experiment_011_reviewer_bundle_q<q>/`;
- the sealed key for round q (decoy map, planted rows, error types): `05_Benchmark_Results/v2/experiment_011_planted_key_q<q>.json`, released only at scoring time;
- the back-translations: `05_Benchmark_Results/v2/experiment_011_back_translations.json`.

Tables in this notebook will link to these files and will not duplicate them.

## Unexpected Observations

Pending run.

Observations already made while writing this pre-registration are recorded here, so they are not rediscovered later. They are code facts or pilot checks on synthetic signals verified on 2026-09-29, not results.

- The payload field `samplingWindowSeconds` holds the nominal 0.15 s. The actual span, 0.16254 s at 22050 Hz, is not exported today. A description built from the existing field would repeat error L1.
- The payload field `amplitudeFilterPercentile` holds the parameter 0.2. The actual dropped share can be lower: it is at most ⌊0.2·(N−1)⌋ / N (19% at N = 100, 19.86% at N = 700), and lower again when RMS values tie at the threshold. S1 therefore uses the counts, not the parameter.
- The payload exports only `pcaExplainedVarianceTotal`, not the per-component ratios. The X/Y/Z toggles need those ratios for S2a.
- `toFixed` and `Intl.NumberFormat` round 1.005 differently at 2 decimals, and `Math.round(x*100)` and `Intl` percent round 0.285 and 0.145 differently (see Method). A generator and a checker that each picked a different one would disagree even when both are "correct".
- **Label-bearing payload fields (code facts):** `source.filename` is `path.basename(audioPath)` (`tools/lib/audio_source.js` line ~52), which for the demo files is the species name; `points[].id` is `${audioId}_${t.toFixed(3)}` (exporter line ~548), so it embeds `audioId`; the exporter's `main()` adds `birdnetDetections` (a species classifier's output) to the field-recording payload. The payload top-level keys on a `runContinuousSamplingPipelineOnSamples` run are `audioId, audioUrl, commonName, generatedFrom, pipeline, sampleRate, analysisSampleRateHz, source, frequencyRange, fftSize, samplingWindowSeconds, samplingHopSeconds, durationSeconds, amplitudeFilterPercentile, amplitudeFilterThreshold, pointsBeforeAmplitudeFilter, confidenceThreshold, pcaExplainedVarianceTotal, similarityNeighbors, similarityMinTimeGapSeconds, centroidMaxHz, spectralDescriptors, pointCount, points, similarityEdges, panels, analysis`. This is why the reviewer gets a projection, not the raw payload.
- **Edge-fixture pilot (synthetic signals only; used to pre-state expected gate outcomes, not a result):**
  - Digital silence, 10 s at 22050 Hz: 212 of 212 windows kept (all RMS tie at 0, so `dropShare` = 0), `pcaExplainedVarianceTotal` = `null`, every point has `amplitude` 0, `spectralCentroidHz` 0 and `dominantFrequencyHz` 0. The exporter did not throw. Without G3.4 and G5.5, S3 and S5 would have stated "all around 0.0 kHz", a code convention rather than a measured frequency.
  - 1 kHz sine, RMS 0.1, 10 s: 170 of 212 windows kept (42 dropped, 19.8%), and the kept loudness range was 0.0019 dB, so G4.3 fails. The "none left out" variant does **not** trigger here, contrary to the first draft's hope.
  - Band-limited guard above (`pitchAlternation` [5000, 7000] Hz, no background, seed 20260720 + 1134, `source.sampleRateHz` 8000): 515 points, `frequencyRange.maxHz` 4000, `cMax` 7.00 kHz and `dMax` over the 40 loudest 7.00 kHz, so G3.3 and G5.3 fail. `cMin` was 1.61 kHz, well below both tones, presumably from windows spanning a tone change or the file edges; not investigated.
  - Band-limited guard below ([1000, 2000] Hz, seed 20260720 + 1135): `cMax` 2.39 kHz and `dMax` 2.00 kHz, so G3.3 and G5.3 pass.
  - The first draft's guard (`brightnessAlternation` with only `source.sampleRateHz` 8000 declared) was not band-limited in its content, and whether it crossed 4 kHz depended on generator defaults. It is replaced by the two tone guards above.

## Discussion

Pending run.

Limitations, pre-stated:
- **Correct is not the same as meaningful.** The audit checks that the text is *correct about the payload*. Whether the payload's numbers mean what a visitor might infer is out of scope. That question belongs to Experiments 007–010. It is also why the evidence-dependent sentences are gated, and not audited here on their numbers alone.
- **The file, not the animal.** Every fact describes all sound in the file after recording, codec and upload processing (see Confounds). The loudest moment or strongest frequency may belong to another source.
- **Upstream evidence regime.** D-004 (PCA) and D-010 (raw spectrograms) were established under the Experiment 001–006 regimes, not the PR. The PR re-test is Experiment 007. This audit neither strengthens nor weakens them.
- **Reviewers are few, and some roles self-declared.** Human review uses a small number of reviewers whose proficiency and lay status are self-declared. The planted-error control measures whether the A2 reviewer catches errors; it does not measure their judgment of readability or faithfulness. A4(b) and A5 therefore remain reviewer-dependent and are reported with reviewer metadata. If the A2 reviewer is an AI agent, its errors may correlate with those of an AI-written generator or checker; the model-family rule limits this but cannot remove it.
- **Thresholds are project choices.** The readability thresholds (25 and 30 words, 3 numbers) are project-set and are not validated against any literature. A pass shows that the text meets *these* thresholds and that the named readers understood it. It does not show general readability.
- **Effort estimate is an assumption.** The ≈ 39 reviewer-hours figure rests on guessed per-item times; the logged actual time replaces it.
- **Descriptive CIs ignore clustering** by species, observer and device, and are descriptive only.
- **Scope of the verdict.** Results apply to this corpus, these templates (by hash), the PR front end, and Node's ICU and V8 versions (logged). A change to any of these requires a re-run.

## Decision

Pending run. The decision will be applied mechanically from the Pre-Committed Decision Rule.
- **Decision log:** it feeds the proposed **D-018** (the exported plain-language description, claims-traceable templates; the ID is provisional).
- **Consequence for the viewers:** hand-written claims L1–L5 are replaced by, or removed in favour of, the payload's audited `description` text. The viewers render only payload text.

## Reproducibility Notes

- **Runner:** `tools/experiments/run_experiment_011_description_claims_audit.js` (not yet written). It has two modes: generation and checks (default), and `--score-review` (with `--round q`).
- **Results:** `05_Benchmark_Results/v2/experiment_011_description_claims_audit.json` (not yet produced), with companion files as listed in Results.
- **Code under audit (proposed paths; not yet written):**
  - generator: `tools/lib/description.js`;
  - independent checker: `tools/experiments/check_experiment_011_descriptions.js`;
  - A1 tests: `tools/test/description_templates.test.js`;
  - the final templates (all languages, plus the ES/PT denylists), stored as data inside the generator module, or in a JSON file it loads, hashed into `templatesSha256`.
- **Manifest:** `manifest_v2_corpus.json`. Its SHA-256, the file-level SHA-256 verification result, and the counts (recordings, species, demo files) are logged.
- **PR constants** are read from `tools/export_single_recording_dataset.js`, not re-typed: 22050 Hz, FFT 1024, hop 512, Hamming window, `POINT_WINDOW_SECONDS` 0.15 (giving framesPerPoint 6), base point hop 2 frames, `MAX_POINTS` 700, amplitude filter 0.2, similarity k 3, gap 1.5 s, `POSITION_SPREAD` 6, viewer `labelCount` default 40. The runner logs the values it actually used.
- **Environment:**
  - Node v24.x (exact version logged; v24.21.0 on the pre-registration machine), `process.versions.icu` (78.3 on the pre-registration machine) and `process.versions.v8`, re-logged at run time.
  - ffmpeg/ffprobe **only** via `tools/lib/ffbin.js` (`FFMPEG`, `FFPROBE`; `ffmpegVersion()` logged).
  - `ml-matrix` 6.14.0 (for the G2a.2 reference; present in `node_modules` on 2026-09-29; version logged).
  - The git commit hash and a dirty-tree flag. If the tree is dirty, the SHA-256 of `git diff` is logged.
- **Seeds:** the full table in Method, written to the JSON. Base 20260720.
- **Statistics:** `tools/lib/metrics.js` (`bootstrapCI`, `median`, `iqr`, `makeRandom`), B = 2000. Descriptive only. No hypothesis tests.
- **Label-exclusion code inspection:** the date and the inspector are to be recorded here at run time.
- **Reviewer records:** for each reviewer, the role (A2/A3b/A6, A4b, A5), whether a person or an AI agent (and, if an agent, its model name, family and version), self-declared proficiency or lay status, the date, the hours spent and the tools used. The model family of the generator's and the checker's authors is recorded too. These are stored in the results JSON.
- **Pilot scripts** used for the compute estimate and the edge-fixture pilot were throwaway scripts in the session scratchpad, not repository code; their outputs are quoted in Method and Unexpected Observations. The runner re-checks every edge-fixture expectation itself.
- **Tests that must pass before the run:**
  - A1 (`tools/test/description_templates.test.js`);
  - the checker's own unit tests, which cover the rounding rule and canonical computations (including 1.005, 0.285, 0.145 and the exact-rational `dropShare`), the locale parsers (including PT/ES grouping) and the `require`-graph assertion;
  - seed uniqueness;
  - the release assertions (key uniqueness, decoy amplitude disjointness, name-token scan) on a smoke packet built from the smoke recording and two fixtures.
- **Revision log:**
  - 2026-09-29, first pre-registration.
  - 2026-09-29, revision after review (before any run): planted errors moved from twin rows to decoy payloads with opaque ids and a key-uniqueness assertion; reviewer bundle changed to a projection that drops `source.filename`, `audioUrl`, `audioId`, `points[].id`, `birdnetDetections` and other label-bearing fields, plus a name-token assertion; H5 made "not evaluable" while S6 is gated off; S8 reworded to the relative encodings with new gate G8.3; feasibility, effort, re-run budget and compute estimate added; human-only A4(b)/A5 roles and AI-reviewer disclosure added; Confounds paragraph and the D-004/D-010 regime note added; canonical computations for derived facts and new A1 rounding cases added; G2a.2 reference pinned to the n × n Gram matrix; reviewer task extended to the denylist and payload-visible gates; S3 and S5 reworded; vocal-type and perceptual words added to the A3 denylist; edge fixtures given pre-stated gate outcomes (guard replaced by two tone guards, fixtures 27 → 28); G3.4/G5.5 added after the silence pilot; descriptive statistics restricted to the 60 evidence recordings with a clustering caveat; deviations from the spec listed. No threshold was lowered.
  - 2026-09-29, consistency amendment before any run (closes Experiment 009 open item 2): S7 G7.3 perceptual branch ("sound alike" if Experiment 007 T_gap passed) removed, to match Experiment 007 ("No outcome of this experiment permits perceptual wording") and Experiment 009. This only makes S7 more restrictive. Edited by the assistant on the owner's instruction to proceed; no threshold changed.
