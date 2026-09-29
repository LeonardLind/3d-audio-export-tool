# v2.0 hand-off: where the work stands and what comes next

Written 2026-09-29 so a new Claude session, possibly on another computer, can continue the v2.0 upgrade of this export tool. Read all of it before doing anything.

> **Current state (commit `63077d1` on `v.2.0`).** Phases 0–2 are done (section 4). **Next step:** set up (section 1), run the checks in section 5, then start **Phase 3, running Experiments 007–012** (section 6). No experiment has been run yet. If `git checkout v.2.0` finds no such branch, the owner has not pushed it from the first Mac yet (`git push -u origin v.2.0`); ask them to.

## 0. Scope and non-negotiables

- **Work only in this repo, `3d-audio-export-tool`, on branch `v.2.0`.** Never edit `revx-greencubes`, the production app. You may *read* it to keep the export compatible.
- **The evidence rule (from the owner).** Every visual element, number and sentence must be backed by real, tested, documented evidence, the way PCA was benchmarked against UMAP/t-SNE before being adopted (Experiments 001–006, D-004). That means:
  - Never invent numbers, results or citations.
  - Pre-committed decision rules are final. If a rule turns out to be infeasible, write an amendment and get the owner's dated approval before the run. Never quietly adjust a threshold.
  - Negative results are recorded with the same care as positive ones.
- **The owner is not a statistician.** Explain decisions to them in plain words and keep reports short.
- **Commits.** Commit only when the owner asks. Never force-push.

## 1. Setting up on a new computer

The audio corpus is gitignored and does not travel with the repo.

```sh
git fetch && git checkout v.2.0 && git pull
npm ci && (cd app && npm ci)
# npm 11 may block install scripts. Check the binaries run:
node -e "const b=require('./tools/lib/ffbin');console.log(b.FFMPEG,b.FFPROBE,b.ffmpegVersion())"
node tools/download_corpus.js --verify   # re-downloads the 60 + 2 corpus files and checks sha256
mkdir -p Assets/smoke && curl -sS -A "birdsong-3d-export-tool/2.0 (research)" \
  -o Assets/smoke/Luscinia_svecica_song.ogg \
  https://upload.wikimedia.org/wikipedia/commons/4/46/Luscinia_svecica_song.ogg
npm test                                  # node --test "tools/test/*.test.js"
node tools/generate_acoustic_assets.js Assets/smoke/Luscinia_svecica_song.ogg --no-birdnet --out=/tmp/smoke_out
node tools/verify_browser_port_parity.mjs Assets/smoke/Luscinia_svecica_song.ogg /tmp/smoke_out/acoustic-analysis.json  # must print PARITY OK
```

On macOS, ffmpeg and ffprobe come from npm (`ffmpeg-static`, `@ffprobe-installer/ffprobe`) through `tools/lib/ffbin.js`. You can override them with `FFMPEG_PATH` / `FFPROBE_PATH`. On a non-arm64 or non-mac machine, check that the right platform binary installed.

## 2. What the owner asked for (v2.0 goals)

1. **Viewer focused on the main 3D cloud only.** Remove the older diagrams and modes: spectrogram, chromagram, radar/descriptors, centroid-amplitude scatter, sandbox gallery, behaviour mode. The v0.7 "Matte" style with peak-frequency labels is the canonical look, and it always shows **40 numbers** (the loudest points; overlapping labels are hidden).
2. **X / Y / Z axis toggles.** One axis selected shows a 1D line, two show a 2D scatter on a grid, three show the 3D cloud.
3. **Axis meaning.** Explain in plain words what each direction means for *this* recording, for example "towards the front the moments are noisier". It must be honest: when no single sound property explains a direction, it says so, which gives a "mixed" outcome.
4. **Similarity lines computed in a better space** than the 3D shadow, if the evidence supports it.
5. **Dynamic plain-language description text per recording** in the output JSON, in EN, ES and PT. It replaces hard-coded claims like "0.15-second moments" or "a sliver, often a few percent".
6. **Compare mode.**
   - The user picks two dots and hears each dot's short moment.
   - A **detailed waveform with a red playhead line** is shown for each, so the two sounds can be compared.
   - No such red-line waveform exists anywhere yet (checked in both codebases), so build it new.
7. "More rather than less. Scale down after review." Extra features are welcome **if they are backed by evidence**: dot tooltips with measured values, highlighting a dot's repeats, the axis-loading picture, per-view "how much this view keeps".

## 3. Owner decisions already made (2026-09-29, in chat)

- Use free public recordings, which became the iNaturalist + Wikimedia corpus.
- Use `ffmpeg-static` through npm (approved). `@ffprobe-installer/ffprobe` was added for the same reason.
- There is only one rule, the evidence rule.
- **Experiment 010 governing arm = A2 (approved by the owner, 2026-09-29).**
  - A2 uses phase-randomised AAFT surrogates, B = 9999. A1, the Gaussian-tail method, is computed but reported as non-decisional only. Thresholds are unchanged.
  - The owner first approved A1. After the critique showed A1's calibration could not be checked, the owner approved A2 as the deciding method.
  - Recorded in `tools/experiments/exp010_governing_arm.json`, which must be committed before the run, and in the notebook.
- **Experiment 009 Amendment A1 (controls compared with their own chance level) was approved by the owner on 2026-09-29.** Sign-off is recorded in the notebook's Reproducibility Notes.
  - Open items 1–2 on claim wording are closed: no perceptual wording like "sound alike" is ever allowed.
  - Experiment 011's S7 was amended to match, which only makes it stricter.
- **Experiment 012 browsers:** the owner chose the Chromium, Firefox and WebKit builds bundled with Playwright, as a dev-only dependency. It is not installed yet; install it when running 012 Part A.
- **Consequences the owner has been told about:**
  - The two Bluethroat demo clips (~14 s) are too short for Experiment 010's split-half gate, so they will never get plain-language axis labels.
  - Experiment 011 requires **human** reviewers: at least 2 English lay readers, plus 1 Spanish and 1 Portuguese reader, and a fluent human translation check. AI agents cannot fill these roles, and until humans do, the description text is generated but not shown to visitors. Ask the owner to organise these people; do not simulate them.
  - Compute is heavy: Experiment 010 alone is estimated at ~13 h on one core. Use worker threads across cores, checkpoint, and log the actual times.

## 4. What is done (phases 0–2)

**Environment**
- `tools/lib/ffbin.js` holds the resolver, and all 10 ffmpeg/ffprobe call sites use it.
- The root `npm test` runs `node --test tools/test/`.

**Foundation code.** Each module was built by one agent and checked by an independent reviewer; all got "pass with fixes".
- `tools/download_corpus.js` and `manifest_v2_corpus.json`, with the write-up in `03_Research_Notebook/Corpus_v2.md`.
  - 60 recordings: 12 species × 5, iNaturalist research grade, sound licence CC0 / CC-BY / CC-BY-SA.
  - Plus 2 Bluethroat demo files from Wikimedia Commons.
  - Every entry records its licence, attribution and sha256.
- `tools/lib/metrics.js`:
  - Trustworthiness is an exact port of Exp 001's. Continuity is added.
  - Matched-Gaussian and column-permuted controls.
  - Spearman, circular-shift null, Holm, bootstrap CIs, Wilcoxon.
  - Precomputed rank contexts for speed.
- `tools/lib/reducers.js` and `app/src/analysis/pca.ts`:
  - PCA now returns loadings, means and scales, the per-component variance ratio, and convergence diagnostics.
  - The production 3D PCA was found to be already converged.
  - The reason t-SNE ran only 3 iterations in Exp 002 was found, and the wrapper is fixed.
  - UMAP (seeded) and a random-projection baseline were added, all behind `reduceFeatures`.
  - Node/browser parity is still OK.
- `tools/export_single_recording_dataset.js`:
  - New entry `runContinuousSamplingPipelineOnSamples` runs the pipeline on in-memory samples.
  - Helpers are now exported.
  - Output is byte-identical to before.
- `tools/lib/window_descriptors.js`:
  - Per-window descriptors: centroid, rolloff, bandwidth, flatness, entropy, crest, slope, zcr, rms, flux, freqMod, ampMod, and HPS pitch with voicing.
  - Descriptor families have plain-language names.
  - Known weaknesses are documented in its tests: bandwidth ordering reverses at 20 dB SNR; HPS pitch is `validatedForLabelling: false`.
- `tools/lib/synth.js`: seeded synthetic signals with ground truth, used as positive and negative controls.
- `04_Literature/Literature_Database.md`: 14 new rows, each verified, including DOIs checked against Crossref.

**Pre-registrations, written before any run.** Each was written, then critiqued by a strict methods critic, then revised. Status for all: "Pre-registered, not yet run".

| Exp | File | Question |
|---|---|---|
| 007 | `Experiment_007_Reducer_Rebenchmark_Production_Regime.md` | Does PCA still win at the **displayed** 1/2/3 dimensions under the production regime (0.15 s windows, within one recording) against UMAP, t-SNE and random projection? |
| 008 | `Experiment_008_Display_Views_Information_Preservation.md` | Does each X/Y/Z view (7 subsets) keep structure beyond chance? What share of variance does 3D really keep? |
| 009 | `Experiment_009_Similarity_Edge_Space.md` | Should the lines use 3D, auto-95 PCA, or the full feature space? Tested against synthetic motifs with known repeats. |
| 010 | `Experiment_010_Axis_Meaning.md` | Can axes be labelled reliably? V1 recovers known properties, V2 keeps false labels ≤ 5%, V3 checks split-half stability. Includes amendment A1. |
| 011 | `Experiment_011_Description_Claims_Audit.md` | Every sentence template is gated and traceable to a number, with zero mismatches allowed. |
| 012 | `Experiment_012_Compare_Mode_Timing_and_Grid_Sensitivity.md` | Part A: are compare-mode audio offsets exact? Part B: window-length sensitivity, report only. |

**Findings so far (evidence, not opinion)**
- On the Bluethroat smoke clip, 3D PCA keeps **30.0%** of the variance. The docs (`06_Technical_Architecture/Technical_Architecture.md`, around line 118) say "typically a few percent", which was measured under older settings. Exp 008 will settle the corpus-wide number. Until then, do not repeat either claim.
- The old benchmarks (D-004, D-010) used 1 s / 16 kHz windows across recordings. None of them validates the current 0.15 s per-recording cloud; Exp 007 and 008 exist for that reason.
- `emissionTime` is the window **start**. A point's real audio span is 3584 samples at 22050 Hz, which is 0.1625 s, not 0.15 s.

## 5. First thing to do in the new session

1. Check that the 27-agent foundation workflow actually finished:
   - All six notebooks above exist and look revised.
   - The critic issues were addressed: search each notebook for leftover "TODO", "pending critic" or other contradictions.
   - `npm test` is green.
   - Parity is OK.
2. Confirm the approvals in section 3 are recorded in the notebooks and in `tools/experiments/exp010_governing_arm.json`. They were written on 2026-09-29.
3. Run **one consistency pass across 007–012**:
   - Shared definitions are identical: regime, seeds (base 20260720 + 1000·r + offset), corpus, aggregation rules.
   - Seed offsets do not collide within an experiment.
   - Decision IDs are proposed consistently: D-014 onward, with the owner assigning the final numbers.
   - Every result-JSON path is under `05_Benchmark_Results/v2/`.
   Fix inconsistencies by writing an amendment note in the notebook, never by weakening a rule.

## 6. Remaining phases (do them in this order)

### Phase 3: run the experiments

- **Runners.** For each experiment, write `tools/experiments/run_experiment_0NN_<name>.js`:
  - Use only `tools/lib/*`.
  - Log every subset or cap (no silent caps).
  - Record the ffmpeg version, git commit hash, seeds and timings in the result JSON.
- **Run and store.** Run each experiment and write `05_Benchmark_Results/v2/experiment_0NN_*.json`.
- **Fill in the notebook.** Complete Results, Unexpected Observations, Discussion (including what it does *not* show) and Decision, applying the pre-committed rule mechanically.
- **Verify before writing any conclusion.** An independent agent re-derives every number in the notebook from the JSON.
- **Decision Log.** Add rows D-014 onward to `07_Decision_Log/Decision_Log.md`:
  - Never delete rows.
  - Replace "Expected Evidence" with observed evidence.
  - Leave the numbering to the owner if unsure.
- **Order and parallelism.** Exp 012A and 008 are cheap. 007 is the most expensive; t-SNE and UMAP subsetting must be pre-stated in its notebook. 009 and 010 are independent of each other. They can run in parallel if runners do not share files.
- **Owner decisions.** If a decision says "escalate to owner" (for example, a non-linear reducer beats PCA at 3D outside the tie band), stop and ask. Do not decide yourself.

### Phase 4: generator / JSON v2, applying only what the evidence allowed

Every change goes into both `tools/export_single_recording_dataset.js` and the browser port `app/src/analysis/pipeline.ts`. Extend `tools/verify_browser_port_parity.mjs` to cover the new fields; it must still print PARITY OK. Planned additions:
- `contractVersion: 2` in `tools/generate_acoustic_assets.js` and `pipeline.ts`.
- `pcaExplainedVarianceRatio` per axis.
- `viewQuality` for the 7 views: variance share, T/C, margin vs control, and a weak flag using the Exp 008 rule.
- `axisMeaning` per axis:
  - label, mixed, or none;
  - direction, rho, adjusted p, split-half agreement;
  - the loading picture (24 bands × 6 frames), per the Exp 010 rules.
  - If V1 or V2 failed: no labels, only the raw numbers and the picture.
- `similarityEdges`, in the space and with the parameters Exp 009 chose. Record `similaritySpace`, k and gap. Optionally keep `similarityEdges3D` for comparison.
- Per point: `audioStartSeconds` and `audioEndSeconds` (Exp 012A), plus the per-window descriptors the tooltips show.
- `description`: `{ en, es, pt, sentences: [{ id, gate, facts, source, text }] }`, built from the Exp 011 templates and computed before `toAppProfile` trims the payload.
- `tools/lib/validate.js`: add rules for the new blocks. Keep `position` as 3 numbers.

**Production compatibility (must not break).** The current production screen reads only a few fields. So:
- `points[].position` stays exactly 3 numbers.
- `points` stay sorted by `emissionTime`.
- `amplitude` stays raw RMS. `amplitudeNorm`, `spectralCentroidHz`, `spectralFluxNorm` and `dominantFrequencyHz` keep their current meaning and units.
- `similarityEdges` stays an `[a, b][]` of in-range indices.
- `durationSeconds` stays within 10% of the audio length.
- New fields go at the top level of the flat payload (production drops siblings of a `cloud` wrapper).
- The `app` profile must keep the new fields the production screen may need later.

### Phase 5: viewer v2 (`app/`)

**Structure**
- One screen with no modes; delete the old diagrams, sandbox and behaviour code.
- Keep the Upload path (in-browser analysis) routed to the same scene.
- Suggested structure is in the reader notes: `cloud/`, `compare/`, `data/`, `export/`. Default style v0.7 Matte, 40 peak-frequency labels.

**Axis toggles**
- X/Y/Z toggles: 1 axis gives a 1D line, 2 give a 2D scatter with a grid, 3 give the 3D cloud.
- Use an orthographic, locked camera for 1D/2D.
- Every view shows its measured "keeps X% of the variation" and its trust flag from `viewQuality`.
- The axis caption comes from `axisMeaning`. Never write fixed English claims.

**Compare mode**
- Point picking with raycasting (none exists today).
- Two slots, each playing its moment `[audioStartSeconds, audioEndSeconds)` from the decoded source audio with Web Audio.
- A detailed PCM waveform per moment with a **red playhead**, plus the measured values side by side.
- Keep the decoded audio on the main thread (Upload currently transfers the buffer away).

**Other**
- Show the per-recording `description` text.
- Tooltip with a dot's measured values.
- "Show repeats": highlight a dot's lines and mark their times on a full-clip waveform.
- Add a test harness for pure functions (Vitest or node:test). `npm run build` and `npm run lint` must pass.
- The app has pre-existing TypeScript errors in `scene2/CloudSceneV2.tsx`; these go away with the rewrite.
- Run the app (`cd app && npm run dev`, port 5183) with a generated dataset (`--publish`) and actually try every feature in a browser before calling it done.

### Phase 6: final review

- An adversarial review of every visible claim in the viewer and the JSON text, each traced to an experiment result.
- Code review. All tests, lint, build and parity must be green.
- Update `06_Technical_Architecture/Technical_Architecture.md` with a dated v2.0 amendment, update `tools/GENERATOR.md` (payload contract v2), and fix stale statements such as the "few percent" line.
- A short plain-language summary for the owner: what shipped, what the evidence said, and what was disabled because the evidence didn't support it.

## 7. Useful paths

| What | Where |
|---|---|
| Framework, rules | `01_Master_Framework/v0.4_Final.md` (the copies in `Info/` are stale) |
| Decision log | `07_Decision_Log/Decision_Log.md` |
| Template | `03_Research_Notebook/_Experiment_Template.md` |
| Old reducer benchmark | `tools/run_experiment_002_wp3_reducer_benchmark.js`, Exp 002/004 notebooks |
| Generator docs / contract | `tools/GENERATOR.md` |
| Production contract (read-only) | `revx-greencubes/src/Pages/Screens/ExperienceHub/XPScreens/XPAcousticsScreen/XPAcoustics.shared.ts` |
