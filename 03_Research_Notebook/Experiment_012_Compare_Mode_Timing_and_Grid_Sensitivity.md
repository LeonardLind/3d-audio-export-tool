# Experiment 012 — Compare-Mode Timing Correctness (Part A) and Sampling-Grid Sensitivity (Part B, report only)

**Date:** 2026-09-29 (pre-registration written, then revised the same day after a methods critique; no data had been seen at either point; run date to be filled in at run time)
**Work Package:** Part A: WP5 (Statistical Evaluation, `02_Experimental_Design/v0.5_Benchmarking.md`), applied to a visual claim, on the v2.0 track: the compare view. Part B: WP3 (Embedding Benchmark), Information Preservation Reporting (`01_Master_Framework/v0.4_Final.md`, Open Decisions).
**Related Decision Log ID(s):** D-004 (PCA), D-006 (negative controls), D-010 (raw spectrograms), D-005 (Rule 001), D-008 (no individual-bird ground truth), D-011 (Rule 002: benchmark plan before implementation). Proposed new entry, fed by Part A only: **D-0NN: compare-mode audio-offset convention (production regime)**. NN is the next free number ≥ 14 when results come in. Experiment 007 has provisionally proposed D-014 and Experiment 008 D-015, and Experiments 009 and 010 each propose a D-0NN, so this is expected to be D-017 or later. The owner assigns the number. Part B proposes **no** decision entry: it is report-only. A later owner decision to change the window would get its own entry citing this experiment. A Part B control failure is routed to a methodology review (see the decision rule), not to a decision entry of this experiment.
**Status:** Pre-registered, not yet run

**Revision note (2026-09-29, before any run).** This version replaces the first draft of the same date. The changes are listed in "Revision log" at the end. No threshold of the original specification was weakened. Where a check of the first draft was changed from "gating" to "descriptive", the reason is given at that place, and the check it was meant to back up is now covered by another, stated check.

**Scientific Hierarchy level:** Frame (`01_Master_Framework/v0.4_Final.md`, Scientific Hierarchy). Part A also works at the Audio Sample level, because it checks sample offsets. Nothing is segmented, so no point is a syllable, phrase or acoustic event, and no result here may be described at those levels.

**No individual-bird claims (D-008).** No individual-bird ground truth exists in this project (D-008). Nothing in this experiment says anything about individual birds, and no result may be worded as if it did.

⸻

## Question

**Part A (gating).** Compare mode plays two moments and shows their waveforms. For every exported point, do the audio offsets implied by the export locate the exact audio that produced the point's features? The convention under test is: `emissionTime` = window **start**, and the span is 3584 samples at the 22050 Hz analysis rate. The offsets must hold on the analysis timeline and in the original source file at its own sample rate, to within one analysis frame. They must hold for the sample rates and codecs that the v2 corpus actually contains.

A real "no" is possible: any mislocated click is a "no". A "no" blocks compare mode until it is fixed.

**What Part A can and cannot certify.** Part A decodes every file with the bundled **ffmpeg 6.0**. A Part A pass therefore certifies the offsets **on the ffmpeg-decoded timeline only**. Compare mode plays the file in a browser. Whether browsers decode the same files onto the same timeline is not known. Production shipping of compare mode is therefore also gated on the browser-parity check pre-registered in Method A.8 (see the decision rule).

**Part B (report only).** Keep every other PR setting fixed and change only the window length to 0.10, 0.25 or 0.50 s, with 0.15 s as the reference. How do these change PCA-3D's trustworthiness and continuity (k = 5) relative to matched controls (including an overlap-preserving control), its 3D explained variance, and its point count?

A real "no" is possible here too: the numbers may show that the 0.15 s window is not better than the alternatives on any metric. Part B does not decide any production constant. Any change of window is an owner decision. A control failure in any arm is, however, a v0.4 Failure Criteria event (see the decision rule).

### Why this experiment exists (evidence gap)

Compare mode makes a new visual claim: "this is the sound of that point". Under Core Philosophy ("Every visual element should represent measurable information"), that claim needs evidence. The following facts come from **code inspection of `tools/export_single_recording_dataset.js` on 2026-09-29**:

1. **The time stamp is the window start.** `emissionTime = startFrame · frameHopSeconds`, with `frameHopSeconds = 512 / sampleRate` (`buildContinuousPoints`). It is not the window centre.
2. **Frames are not centred or padded.** `stft()` starts frame t at analysis sample 512·t and covers [512·t, 512·t + 1024). There is no centring and no padding.
3. **The analysed span is longer than the nominal window.** A point's analysed span is `sampleLength = (framesPerPoint − 1)·512 + 1024` = **3584 samples = 0.162540 s** at 22050 Hz. The export's top-level `samplingWindowSeconds` is the **nominal** 0.15 (`POINT_WINDOW_SECONDS`), which is 3307.5 samples. A consumer that uses `samplingWindowSeconds` as the span drops the last ≈ 0.0125 s (≈ 276 samples) of the audio that was actually analysed.
4. **The export does not carry exact offsets.** There is no per-point start/end field and no top-level `hopSize`, `framesPerPoint` or span-in-samples field. The export does emit `sampleRate` / `analysisSampleRateHz`, `fftSize`, `samplingHopSeconds` and `source.sampleRateHz`. The span can currently be derived only from constants hard-coded in the exporter.
5. **The point `id` is rounded.** It encodes time with `toFixed(3)`, so it must not be used for audio offsets.
6. **Decoding goes through ffmpeg's resampler.** The exporter decodes with `FFMPEG -ac 1 -ar 22050 -f f32le` (`readFullAudio`), so libswresample resamples the source.
   - The binary is ffmpeg-static `6.0`. soxr is not compiled in (checked with `-version` on 2026-09-29).
   - `tools/lib/ffbin.js` already records that results depend on libswresample.
   - Whether this resampling, or a lossy decoder, shifts the analysis timeline relative to the source file at its own rate is **not known**. Nothing in the repo tests it.
   - `readFullAudio` passes `maxBuffer: 64 MiB` to `execFileSync` (line 171, read 2026-09-29). That is enough for any 22050 Hz decode in this corpus, but not for every source-native decode Part A needs (see Compute plan).
7. **Playback uses the original file, analysis uses the resampled decode.** `main()` copies the original source file for playback (`fs.copyFileSync(AUDIO_PATH, OUTPUT_AUDIO)`). So playback uses the source at its own rate and codec, while the features were computed on the ffmpeg-resampled 22050 Hz decode. Compare mode is correct only if these two timelines agree.
8. **The grid has gaps on long recordings.** The point hop is `max(2, ceil(S / 700))` frames, where S is the STFT frame count. A window spans 3584 / 512 = 7 hops of 512 samples.
   - Windows therefore tile the recording without gaps while the hop is ≤ 7 frames. That holds for recordings up to **113.82 s**; above that there are gaps.
   - The 700 cap starts to widen the hop above **32.55 s**.
   - The samples after the last window's end are never analysed.
   - The v2 corpus allows 5–120 s (`03_Research_Notebook/Corpus_v2.md`, selection rule 8). In `manifest_v2_corpus.json`, decoded lengths run from 5.53 s to 104.19 s (`decodedSamples22050 / 22050`, computed 2026-09-29). So at PR no corpus recording has gaps, but the selection rule permits recordings that would.
9. **The corpus mixes formats and rates** (`Corpus_v2.md`, Technical profile):
   - Codecs: mp3 25, aac 21 (`.m4a`), pcm_s16le 9, pcm_s24le 4, pcm_f32le 1. The two demo files are Vorbis `.ogg`. Two MP3 files use the `.mpga` extension.
   - Source rates: 44.1 kHz 41, 48 kHz 15, and one file each at 192, 32, 24 and 22.05 kHz.
   - 22 files are stereo.
   - So 46 of the 60 evidence files (mp3 25 + aac 21) and both demo files (Vorbis) are lossy.
10. **The 0.15 s window was never benchmarked.** The exporter comment (2026-07-24 retune) calls the sampling grid "a visualization tuning knob, NOT a scientific claim". Part B supplies the first numbers for it. It does not supply a decision.

### Provenance of the evidence Part B builds on (disclosure)

Part B takes two earlier decisions as given and **does not re-test them**:
- **D-004 (PCA)** was established in Experiments 002 and 004.
- **D-010 (raw flattened spectrograms)** was established in Experiments 001, 003 and 006.

Those experiments used a **different regime** (detection-triggered or loudest-window clips, one feature vector per clip, across-clip embeddings; not the continuous overlapping within-recording windows of PR) and **different corpora** (the earlier manifests of 22 and 150 samples). Whether D-004 and D-010 hold under PR on the v2 corpus is the subject of Experiment 007 (reducers) and is not answered here. Part B compares window lengths **for PCA-3D on raw spectrogram windows only**. None of its numbers is evidence for or against D-004 or D-010.

### Production regime (PR), verbatim definition used by this experiment

What `tools/export_single_recording_dataset.js` does today:

- **Decoding:** mono at 22050 Hz.
- **STFT:** Hamming window 1024, hop 512 (≈ 23.2 ms).
- **Points:** windows of 6 consecutive frames (nominal 0.15 s; actual span 3584 samples = 0.1625 s) every 2 frames (≈ 0.046 s). The hop widens so that a recording yields at most 700 points.
- **Feature:** frame-major 6 × 513 log1p magnitude (3078 dims).
- **Amplitude filter:** the quietest 20% of windows (by RMS) are dropped.
- **Reduction:** per-recording z-scoring, then PCA.
- **Similarity edges:** the k = 3 nearest neighbours in the 3D PCA positions, excluding candidates less than 1.5 s apart.

**Notation used below**

| Symbol | Value | Meaning |
|---|---|---|
| R_a | 22050 Hz | analysis sample rate (`analysisSampleRateHz`) |
| H | 512 samples | STFT hop, one "analysis frame" |
| N_fft | 1024 samples | STFT frame length |
| F | 6 | frames per point (PR) |
| L | (F − 1)·H + N_fft = 3584 samples | analysed span of a point |
| δ | H / R_a = 512 / 22050 s ≈ 0.023220 s | the tolerance: **one analysis frame** |
| sf_p | emissionTime_p · R_a / H | start frame of point p (must be an integer) |
| [a_p, b_p) | [H·sf_p, H·sf_p + L) | analysed samples of p on the analysis timeline |
| [s_p, e_p) | [a_p / R_a, b_p / R_a) | the same interval in seconds; e_p − s_p = 0.162540 s |
| m_p | (s_p + e_p) / 2 | midpoint of p |
| R_s | per file, from `FFPROBE` | source sample rate |
| [A_p, B_p) | [round(s_p·R_s), round(e_p·R_s)) | p's slice of the source file at its own rate (round half up, as `Math.round`) |
| δ_s | round(δ·R_s) | the tolerance in source samples: 512 at 22.05 kHz, 557 at 24 kHz, 743 at 32 kHz, 1024 at 44.1 kHz, 1115 at 48 kHz, 4458 at 192 kHz |

**Choice of tolerance.** "One analysis frame" is read as the frame **hop** H = 512 samples (23.2 ms), not the frame **length** N_fft = 1024 samples. The hop is the stricter of the two readings. It was chosen so that the tolerance is not weakened.

## Hypothesis

Stated so that each one can turn out to be wrong.

- **H-A1 (convention).** Every exported point's features and amplitude come from exactly [a_p, b_p) of the 22050 Hz decode, and sf_p is an integer.
  - Basis: code inspection (facts 1–3 above).
  - Falsified if check A0 fails on any point.
- **H-A2 (resampling alignment).** ffmpeg 6.0 decode and resampling of PCM WAV sources at 22.05–192 kHz keeps the analysis timeline aligned with the source file's own timeline to within δ.
  - There is no evidence either way in the repo.
  - Falsified by any |ε_c| > δ (check A3) in a PCM condition.
- **H-A3 (lossy codecs).** The same alignment holds for MP3, AAC-in-`.m4a` and Vorbis decoded by ffmpeg 6.0.
  - Motivation: lossy encoders can add leading samples (encoder delay or priming), and a decoder may or may not remove them.
  - This motivation is **not** backed by any entry in `04_Literature/Literature_Database.md`. It is a reason to test, not a claim. Whether ffmpeg 6.0 removes such samples for these files is exactly what the codec conditions measure.
  - Falsified by any |ε_c| > δ in a codec condition.
- **H-A4 (end-to-end).** 100% of grid-covered clicks pass checks A1, A2 and A3 in every gated condition.
- **H-A5 (sensitivity of the spec checks; no direction registered as a result).** The spec checks A1 and A2 detect an export-side timing error of **two analysis frames** in every perturbed run.
  - Reasoning, not evidence: A1 and A2 widen the point's interval by δ on each side, and a span is ≈ 7δ long. So an error of δ + 1 sample is detectable only when the click lies in a 1-sample band at the interval edge, and the earliest-`emissionTime` tie-break of A1 tends to pick a window in which the click lies late. The spec checks may therefore be insensitive to small errors, and more so to positive than to negative shifts.
  - Falsified if the planted ±2-frame errors are not flagged by A1 or A2 in 100% of perturbed runs (A.5, scoring S1). A falsification does not block Part A; it changes which checks carry the timing claim (see the decision rule).
- **H-A6 (browser parity).** Each target browser decodes the C2–C16 files onto the same timeline as ffmpeg 6.0, to within δ. There is no evidence either way. Falsified by any |ε^b_c| > δ (A.8).
- **H-B1 (grid sensitivity).** At every window length (0.10, 0.15, 0.25 and 0.50 s), PCA-3D passes the Experiment 007-style control rule against both the matched-Gaussian and the column-permuted control.
  - No directional hypothesis is registered about which window scores highest. Nothing in `04_Literature/Literature_Database.md` benchmarks window length for within-recording, frame-level PCA of birdsong.
  - Falsified at any window where the rule fails.
- **H-B2 (overlap, carried over from Experiment 007 H3 as a prediction, not a result).** At every arm, stationary noise with each recording's duration (white and pink) and each recording's phase-randomised surrogate, pushed through that arm's front end, **also** pass the G and P controls, because overlapping windows alone create neighbourhood structure.
  - Experiment 007 has not been run. This is its prediction, restated per arm.
  - Falsified at an arm if the noise inputs and surrogates fail G or P there.

## Method

* **Dataset / subset used:**
  - **Part A, synthetic:** `tools/lib/synth.js` `clickTrain` with 20 seeds and known click times. The conditions table below lists every source rate and codec. The spec requires 44.1 and 48 kHz files made by resampling a synthetic signal with `FFMPEG`; the other rates and the codec conditions are extra rigor, chosen to match the formats measured in the corpus. A.6 adds `motifSequence` signals, used only to calibrate the RMS-lag diagnostic.
  - **Part A, real files (verification arm):** all 62 files in `manifest_v2_corpus.json`: the 60 evidence recordings plus the 2 Commons demo files. No ground truth is needed, because this arm runs only the exactness and alignment checks (A0, A5, G1, and the RMS-lag diagnostic).
  - **Part B:** the 60 **evidence** recordings in `manifest_v2_corpus.json` (see `03_Research_Notebook/Corpus_v2.md`: 12 species × 5 iNaturalist research-grade recordings, CC0 / CC BY / CC BY-SA sound licences).
    - The 2 Commons demo files are not part of the evidence set (`Corpus_v2.md`), so they are used only for smoke tests. Smoke numbers are never reported as results.
    - This is a **new corpus**. Results are new experiments, not reproductions of Experiments 001–006. Final counts are filled in at run time and logged with the manifest's SHA-256.
    - Recording index r = the 0-based position of the recording in `manifest_v2_corpus.json` `recordings[]`, fixed before any exclusion, so that seeds never shift.
    - **Pre-stated exclusion rule for Part B (primary analysis):** a recording is excluded from **all four** arms, to keep the per-recording pairing, if either of these holds:
      - it fails to decode; or
      - it yields fewer than **50** points after the amplitude filter in **any** arm.
      - Why 50: it keeps k = 5 far below n/2, and the T_gap definition needs mᵢ ≥ 2k. The value is a chosen threshold, not a result.
      - Every exclusion is logged with its reason in `partB.exclusions[]`. There are no silent drops.
    - **Expected exclusions, computed before the run** (from `decodedSamples22050` in `manifest_v2_corpus.json`, on 2026-09-29, with the grid rule of B.1 and the kept count n = N − ⌊0.2·(N − 1)⌋; ties at the amplitude threshold can only raise n, so these counts are upper bounds):

      | Arm | Recordings with < 50 points | Recording ids |
      |---|---:|---|
      | W10 | 0 of 60 | — |
      | W15 | 0 of 60 | — |
      | W25 | 4 of 60 | inat_72900, inat_69521, inat_961201, inat_17127 |
      | W50 | 12 of 60 | inat_214823, inat_72900, inat_306001, inat_355946, inat_69521, inat_240662, inat_397542, inat_961201, inat_302101, inat_17127, inat_81941, inat_113547 |

      - So the primary four-arm analysis is expected to run on **48 of 60** recordings (12 excluded, 20%).
      - The 12 are the shortest recordings (decoded lengths 5.53–9.90 s). The 700 cap never binds for any of them in any arm (it first binds at 16.30 s in W10), so the primary analysis loses exactly the recordings that run at the base hop in every arm. Their codecs: aac 4, mp3 4, pcm_s24le 2, pcm_s16le 2.
      - The exclusion is therefore **not random**. It is disclosed here so that it cannot be discovered after the fact.
      - If the run-time exclusion set differs from this table, the difference and its cause are logged as a deviation.
    - **Pre-registered second paired analysis (W10 / W15 / W25):** the same paired tests for W10 and W25 against W15, on every recording with ≥ 50 points in **those three** arms. Expected: **56 of 60** recordings (the 4 W25 exclusions above). This analysis is reported with the same prominence as the primary one.
    - **Secondary per-arm analysis:** every recording with ≥ 50 points **in that arm** (expected 60 / 60 / 56 / 48), for per-arm summaries and control labels.
    - **Minimum paired sample:** any paired comparison with fewer than **20** paired recordings is labelled **"underpowered, not interpreted"**. Its numbers are still reported. 20 is a chosen threshold, not a result.

* **Procedure:**

  ### Part A — compare-mode timing

  **A.1 Test signals.** There are 20 seeds, s = 1 … 20. Synth seed: `seed_s` = 20260720 + 120000 + s.

  - **Duration** varies by seed group so that every branch of the grid rule is exercised:

    | Seeds | Duration | STFT frames S at 22050 Hz | Point hop | Grid |
    |---|---:|---:|---:|---|
    | 1–5 | 10 s | 429 | 2 frames | base hop |
    | 6–10 | 30 s | 1290 | 2 frames | base hop, just below the cap |
    | 11–15 | 60 s | 2582 | 4 frames | cap widens the hop; no gaps |
    | 16–20 | 118 s | 5080 | 8 frames | cap hop > 7, so there is a **512-sample gap** between consecutive windows |

    The hops were computed from the PR rule on 2026-09-29. The runner recomputes them. The 118 s group goes beyond the specification (which does not fix durations); it was added to exercise the gap branch of the grid rule.
  - **Click times.** tᵢ = 0.25 + 0.5·i + uᵢ s, for i = 0, 1, … while tᵢ ≤ D − 0.5 (D = the duration).
    - uᵢ ~ U[0, 0.25) is drawn from `synth.mulberry32(20260720 + 120100 + s)` and passed to `clickTrain` as `times`.
    - Consecutive clicks are therefore 0.25–0.75 s apart. The jitter spreads the clicks uniformly over sub-frame positions relative to the grid.
    - Because 0.25 s > L/R_a + 2δ = 0.209 s, no point, even with its interval widened by the tolerance, can contain two clicks.
  - **Click shape.** `clickTrain` defaults: `clickSeconds` 0.002 (a Hann-windowed broadband-noise burst) and `rms` 0.3. All resolved parameters are recorded in the JSON.
  - **Background noise.** `snrDb` ∈ {null (noiseless), 30} are **gated**. `snrDb` ∈ {15, 6} are **reported only**.
    - Why the two lowest levels are not gated: they test whether an RMS maximum can still be found in noise, not whether the timing convention is right.
    - synth.js adds background from its own random stream, "so changing snrDb never changes the signal itself" (synth.js header). The noiseless run of the same seed is therefore an exact **noiseless twin**, and it is used for the ground-truth peaks (A.3).
  - **Master files.** For every file condition, the signal is generated by synth at **96000 Hz**. It is scaled by one gain so that max |x| = 0.5 (−6 dBFS, to avoid clipping in 16-bit output; a gain does not change timing). It is written as a pcm_f32le WAV "master".
    - Each condition's source file is then produced from the master with `FFMPEG` (`-ar R_s`, codec as in the table, default `aresample`).
    - 96 kHz is not one of the tested rates, so **every tested file is a product of ffmpeg resampling**, as the spec requires.
    - Every ffmpeg command line is logged verbatim, together with each file's SHA-256.

  **A.2 Conditions** (each condition × 20 seeds × every SNR marked for it)

  | ID | Source file | R_s | Codec / container (encoder pinned by name) | SNR levels | Origin |
  |---|---|---:|---|---|---|
  | C1 | in-memory, no file (`runContinuousSamplingPipelineOnSamples`; synth generated directly at 22050) | 22050 | none | null, 30 gated; 15, 6 reported | spec (synth, 20 seeds) |
  | C2 | WAV | 44100 | `-c:a pcm_s16le` | null, 30 gated; 15, 6 reported | **spec** |
  | C3 | WAV | 48000 | `-c:a pcm_s16le` | null, 30 gated; 15, 6 reported | **spec** |
  | C4 | WAV | 22050 | `-c:a pcm_s16le` | null, 30 | extra (1 corpus file) |
  | C5 | WAV | 24000 | `-c:a pcm_s16le` | null, 30 | extra (1 corpus file) |
  | C6 | WAV | 32000 | `-c:a pcm_s16le` | null, 30 | extra (1 corpus file) |
  | C7 | WAV | 192000 | `-c:a pcm_s16le` | null, 30 | extra (1 corpus file) |
  | C8 | WAV | 44100 | `-c:a pcm_s24le` | null, 30 | extra (4 corpus files use s24) |
  | C9 | WAV | 48000 | `-c:a pcm_f32le` | null, 30 | extra (1 corpus file) |
  | C10 | WAV, **stereo**, identical channels | 44100 | `-c:a pcm_s16le` | null, 30 | extra (22 corpus files are stereo) |
  | C11 | `.mp3` | 44100 | `-c:a libmp3lame -b:a 128k` (CBR) | null, 30 | extra (mp3 is the largest corpus group) |
  | C12 | `.mp3` | 48000 | `-c:a libmp3lame -b:a 128k` (CBR) | null, 30 | extra |
  | C13 | C11's bytes, renamed `.mpga` | 44100 | as C11 | null, 30 | extra (2 corpus files) |
  | C14 | `.m4a` | 44100 | `-c:a aac -b:a 128k` (ffmpeg native AAC encoder; **not** `aac_at`) | null, 30 | extra (aac is 21 corpus files) |
  | C15 | `.m4a` | 48000 | `-c:a aac -b:a 128k` (native; not `aac_at`) | null, 30 | extra |
  | C16 | `.ogg` | 44100 | `-c:a libvorbis -q:a 5` | null, 30 | extra (the demo files) |

  - **Encoders.** libmp3lame, aac, libvorbis, flac and the PCM encoders are present in the bundled ffmpeg (checked with `-encoders` on 2026-09-29). libfdk_aac is not present.
  - **Platform-specific encoders and decoders.** The bundled macOS (darwin-arm64) build also lists the AudioToolbox encoder `aac_at` and the decoders `aac_at` and `mp3_at` (checked with `-encoders` and `-decoders` on 2026-09-29). A build on another platform will not have them. So every encode names its encoder explicitly (table above), and the decoder that ffmpeg actually selected for each file is logged (Reproducibility Notes). No decoder is forced, because the exporter does not force one; the test must measure what the exporter does.
  - **Encoder settings are test choices.** They are **not** matched to the corpus files, whose bitrates were not inventoried.
  - **File conditions go through the full file path.** C2–C16 run through `runContinuousSamplingPipeline` (decode via `readFullAudio`, probe via `FFPROBE`), so they test exactly what ships.

  **A.3 Ground truth, per click c**

  - **Source-native decode x_s.** `FFMPEG -i <file> -ac 1 -f f32le` with **no** `-ar` (so it stays at the file's own rate R_s), run on the noiseless twin's file. For C1, x_s is the in-memory signal. The runner reads this decode with a raised buffer or a stream (see Compute plan); it does not reuse `readFullAudio`'s 64 MiB limit.
  - **Source peak π_c.** π_c = argmax |x_s[n]| over n ∈ [round((t_c − 0.12)·R_s), round((t_c + 0.002 + 0.12)·R_s)). τ_c = π_c / R_s (seconds). This is the "click peak in the ORIGINAL source file".
  - **Analysis-timeline peak π^a_c.** The same argmax on the noiseless twin's analysis decode x_a (`readFullAudio`, 22050 Hz). ε_c = π^a_c / R_a − τ_c.
  - **Pre-encode peak π^ref_c.** The argmax in the 96 kHz master. ε^ref_c = τ_c − π^ref_c / 96000. This is reported, not gated: it shows whether the codec or resampler moved the click relative to the signal before encoding.
  - **Coverage.** The runner computes the window grid **independently of the exporter**: S = ⌊(len(x_a) − 1024)/512⌋ + 1, hop = max(2, ⌈S/700⌉), windows at startFrame = j·hop while startFrame + 6 ≤ S.
    - Click c is **grid-covered** if τ_c lies in [s_j, e_j) of some window j of this grid.
    - Using the independent grid means an exporter bug that loses windows cannot hide as "uncovered".
    - **Deviation from the specification (labelled).** The specification asks that 100% of clicks be located. The **gated** rates here use grid-covered clicks as the denominator. Reason: the 118 s seed group was added beyond the specification, and a click that falls in a grid gap has no containing window, so no point can locate it; this is a property of the grid, not a timing error. From the grid arithmetic, uncovered clicks are expected only in seeds 16–20 (the 10, 30 and 60 s groups tile their click range without gaps); the runner counts them.
    - **Both rates are reported** for every check, condition and seed group: the gated rate over covered clicks, and the rate over **all** clicks, in which every uncovered click counts as a failure. Uncovered clicks are also listed with their position relative to the nearest window.

  **A.4 Checks.** Every check is applied to every grid-covered click, or to every exported point where stated. "Exported points" means the points in the pipeline's returned payload, after the amplitude filter. A check **flags** a run if it fails for at least one click (or point) in that run.

  | Check | What it verifies | Definition | Gated? |
  |---|---|---|---|
  | **A0: offset identity** (extra) | The export's time stamp maps to exactly the audio that produced the point | For **every exported point**, all three must hold:<br>(i) \|sf_p − round(sf_p)\| ≤ 1e-9;<br>(ii) the RMS recomputed over x_a[a_p, b_p) (float64 accumulation, as `frameRms`) equals the exported `amplitude` to a relative difference ≤ 1e-12;<br>(iii) the feature recomputed from the 6 Hamming-windowed frames of that slice (`stft` + `rawSpectrogramFeatures`) equals the pipeline's `rawFeature` for that point (from `computeContinuousFrontEnd`, matched by `emissionTime`) to a maximum absolute difference ≤ 1e-12. | Yes |
  | **G1: grid integrity** (extra) | The exporter's windows are the rule's windows | Both must hold:<br>(i) the exported `emissionTime`s are a subset of the independent grid's start times;<br>(ii) the exported `pointsBeforeAmplitudeFilter` equals the independent grid's window count, and the exported point count equals the count that survives an independently recomputed 20% threshold (index ⌊0.2·(N − 1)⌋ of the sorted RMS, kept if ≥). | Yes |
  | **A1: energy location** (spec) | The loudest nearby point is one that contains the click | Q_c = the exported points with \|m_p − τ_c\| < 0.125 s. Every point whose interval contains τ_c is in Q_c, and no point in Q_c can contain another click.<br>p\*_c = argmax over Q_c of exported `amplitude` (ties go to the earliest `emissionTime`).<br>**Pass** iff s_{p\*} − δ ≤ τ_c < e_{p\*} + δ. If Q_c is empty, or no point in it contains τ_c even within δ, the click counts as "lost", which is a fail. | Yes |
  | **A2: source slice** (spec) | Slicing the original file at the point's offsets gives the click | **Pass** iff A_{p\*} − δ_s ≤ π_c < B_{p\*} + δ_s.<br>**A2-all** also requires, for every p in Q_c with s_p ≤ τ_c < e_p, that A_p − δ_s ≤ π_c < B_p + δ_s. | Yes (both) |
  | **A3: timeline alignment** (extra) | The analysis decode and the source file agree in time | \|ε_c\| ≤ δ. This is needed because A1 on its own cannot detect a shift of up to roughly one span: all the windows that fully contain a click have nearly equal RMS, so p\* can be any of them. | Yes |
  | **A4: no leakage** (extra) | Points that do not contain a click carry no click energy | N0 = the exported points whose interval widened by δ on both sides contains no τ_c. N1 = the exported points whose interval contains [τ_c − 0.005, τ_c + 0.005] for some c.<br>**Pass** iff max_{N0} amplitude < min_{N1} amplitude, per run. | Yes, at null and 30 dB; reported at 15 and 6 dB. For the pre-registered lossy-codec interpretation, see "A4 in lossy conditions" below. |
  | **A5: export completeness** (spec: "each point must carry exact audio offsets") | The export alone is enough to compute exact offsets | From the export JSON **alone**, with no constant hard-coded in the runner, the offsets must be computable and must equal [a_p, b_p) exactly for every point. Either explicit per-point start and end, or top-level analysis rate + hop size + span (or frames per point) together with a stated convention, is acceptable. Field names are the exporter owner's choice. The runner records which fields it used. If the export lacks them at run time, A5 fails. | Yes |
  | **A6: nominal-span diagnostic** | How much it matters to use 0.15 s instead of the real span | The fraction of covered clicks where [s_{p\*}, s_{p\*} + 0.15) excludes τ_c but [s_{p\*}, e_{p\*}) contains it. The same fraction is given for A2 in source samples. | No, reported |
  | **Zero-tolerance variants** | How close the offsets are without the tolerance | A1, A2 and A3 with δ = δ_s = 0. The distributions of ε_c and ε^ref_c are reported in samples and in ms, per condition: median, max \|·\|, and a histogram. | No, reported |

  **A4 in lossy conditions (pre-registered interpretation).** Lossy codecs may spread a click's energy in time (block transforms, pre-echo), possibly beyond δ. Whether that happens with these encoders at these settings is **not known**. The interpretation is fixed now:
  - An A4 failure counts as **"codec temporal smearing"**, and **not** as a timing failure, if and only if all of these hold:
    1. every A4 failure is in C11–C16;
    2. A0, G1, A1, A2, A2-all, A3 and A5 all pass in that condition;
    3. for every offending N0 point p, the leaked energy is **in the file itself**: the RMS of the noiseless twin's source-native decode x_s over [A_p, B_p) exceeds the RMS of the same interval in the same seed's PCM condition at the same rate (C2 for 44.1 kHz, C3 for 48 kHz) by a factor ≥ 2. The factor 2 is a chosen threshold, not a result.
  - **Consequence, decided now:** codec temporal smearing does **not** block compare mode, because the point's offsets are still correct and the smeared energy is part of the audio that compare mode would play. It requires a documented caveat in the export documentation and in the compare view's information text, with the measured maximum extent of the smearing (in ms, before and after the click) per condition.
  - An A4 failure that does not meet all three conditions is a gated A4 failure and is handled by the decision rule like any other.

  **A.5 Planted-error battery (a positive control for the checks themselves; extra rigor).**

  - **Where it runs:** C1, C2 and C3, **all 20 seeds**, null and 30 dB (the first draft used seeds 1–5; widening costs no new pipeline runs because the battery rescores existing runs, and it adds the cap and gap branches of the grid).
  - **How:** the runner perturbs **its own reading** of the export or of the truth. It never modifies the exporter.
  - **Two scorings, both pre-committed.**
    - **S0 (any gated check).** All gated checks are active. A run is flagged if any gated check flags it. This is the first draft's rule and stays unchanged.
    - **S1 (spec checks only).** Only A1, A2 and A2-all count. **A0, G1 and A5 are disabled** (they are exact identity checks and would flag every export-side perturbation whether or not A1 or A2 react). A3 and A4 are computed and their flag rates reported, but they do not count towards S1.
  - **Reported for every planted error:** the flag rate of **each** check separately (A0(i), A0(ii), A0(iii), G1(i), G1(ii), A1, A2, A2-all, A3, A4, A5), as the fraction of perturbed runs flagged and the fraction of clicks (or points) that fail. So the report shows which check detects which error.

  | ID | Planted error | True timing error | S0 requirement (carrier check) | S1 requirement (A1 ∨ A2 ∨ A2-all) |
  |---|---|---|---|---|
  | E1 | emissionTime + 1 analysis sample | 1 sample (≤ δ) | reported | reported |
  | E2 | emissionTime + 256 samples | 0.5 δ | reported | reported |
  | E3 | emissionTime + 513 samples | δ + 1 sample | **must be flagged** (expected carrier: A0) | **required** |
  | E4 | emissionTime read as the window **centre** (start = emissionTime − 1792 samples) | 1792 samples (3.5 frames) | **must be flagged** (A0) | **required** |
  | E5 | emissionTime − 513 samples | δ + 1 sample | **must be flagged** (A0) | **required** |
  | E6 | span read as round(0.15·R_a) = 3308 samples (i.e. using `samplingWindowSeconds`) | end offset 276 samples | **must be flagged** (A0(ii)/(iii)) | not applicable: 276 samples < δ at the end only, so the error is inside the spec tolerance by definition; its S1 flag rate is reported |
  | E7 | source conversion using R_a instead of R_s (a units bug) | grows with time | **must be flagged** in C2 and C3 (A2; in C1 R_s = R_a, so it is not applicable) | **required** in C2 and C3 |
  | E8 | source-native decode delayed by round(1.5·δ·R_s) samples (simulates a decoder delay) | 1.5 δ | **must be flagged** (A3) | reported (decode-side, not export-side) |
  | E9 | source-native decode delayed by round(0.5·δ·R_s) samples | 0.5 δ | reported | reported |
  | F+1 | startFrame + 1 (emissionTime + 512 samples; sf stays an integer, so A0(i) cannot see it) | exactly δ (inside the tolerance) | reported | **should not be flagged**; reported |
  | F−1 | startFrame − 1 | exactly δ | reported | **should not be flagged**; reported |
  | F+2 | startFrame + 2 (emissionTime + 1024 samples) | 2 δ | **must be flagged** (A0(ii)/(iii)) | **required** |
  | F−2 | startFrame − 2 | 2 δ | **must be flagged** (A0(ii)/(iii)) | **required** |

  - **S0 rule (gating):** 100% of perturbed runs with an S0 "must be flagged" error are flagged. If any one is not, the check battery is declared **insufficient**, and Part A cannot pass, whatever the real results are.
  - **S1 rule (decides which checks carry the claim):** for every S1 "required" error, A1 ∨ A2 ∨ A2-all flags at least one click in **100%** of perturbed runs.
    - If S1 holds for an error, the spec checks are shown to detect that error.
    - If S1 fails for an error, the notebook must state, verbatim with the numbers filled in: "The spec checks A1 and A2 do not detect a timing error of ⟨size⟩ in every run (S1 flag rate ⟨x⟩ of ⟨n⟩ runs). For errors of this size the timing claim rests on A0 (export side) and A3 (decode side), not on the spec checks." This statement goes into the Discussion, the proposed D-0NN entry and the export documentation. It does **not** block Part A on its own, because A0 and A3 are gated; but if S1 fails for F+2 or F−2 **and** S0 is carried there by A0 alone, the documentation must say that no click-based check confirms the offsets at two frames.
  - **F±1 (inside the tolerance):** if A1, A2 or A2-all flags a ±1-frame shift, the case is listed and explained in Discussion (it would mean a check is stricter than its stated tolerance, for example through source-rate rounding). It is not gating.

  **A.6 Real-file verification arm (all 62 corpus files, extra rigor).**

  - **Gated checks:** A0 and A5 on every exported point of every file, through `runContinuousSamplingPipeline`. G1 is also run.
  - **RMS-lag diagnostic** (reported; it can block individual recordings, see the decision rule):
    - **Lowpass first.** The source-native decode x_s is low-passed at 11025 Hz with `FFMPEG -af lowpass=f=11025:p=2,areverse,lowpass=f=11025:p=2,areverse` (forward–backward filtering, so the net filter adds no phase delay), so that the source RMS does not contain content above 11025 Hz that the analysis decode lacks. For R_s ≤ 22050 Hz the filter is skipped (11025 Hz is at or above the source Nyquist). The two-pole filter rolls off gently, so some content above 11025 Hz remains and r < 1 is still expected. The command line is logged.
    - For lags ℓ from −20 to +20 frames in quarter-frame steps (128 analysis samples), compute the RMS of the low-passed x_s over [A_p + ℓ′, B_p + ℓ′), where ℓ′ = round(ℓ·δ·R_s).
    - Compute the Pearson r between those RMS values and the exported `amplitude` across points. ℓ\* = the lag with the largest r.
    - A recording is **flagged** if |ℓ\*| > 1 frame and its maximum r is ≥ 0.5.
    - It is **"not informative"** if its maximum r is < 0.5. 0.5 is a chosen threshold, not a result. Flat-envelope recordings cannot localise a lag.
    - **Peak sharpness** is reported for every file: r(ℓ\*) − max(r(ℓ\* − 1 frame), r(ℓ\* + 1 frame)). A broad peak (small sharpness) means ℓ\* is poorly localised.
    - **Calibration before use (true lag 0).** The flag rule was not calibrated in the first draft. It is now calibrated on synthetic files whose true lag is 0 by construction, **before** it is applied to corpus files:
      - *Calibration set 1:* every C2–C16 click-train file at the gated SNR levels (15 conditions × 20 seeds × 2 = 600 files).
      - *Calibration set 2 (smoother envelopes, closer to song):* `synth.motifSequence`, 30 s, seeds 20260720 + 120300 + s for s = 1…5, at `snrDb` 30, encoded through the same C2–C16 settings (75 files).
      - Reported per set and condition: the false-flag rate (flagged files / informative files), its exact zero-event 95% upper bound when it is 0, and the distributions of ℓ\* and peak sharpness.
      - **Pre-committed use of the calibration:** the flag rule and its thresholds are **not** changed after seeing the calibration (that would weaken or tune them). If the calibrated false-flag rate is > 0 in any condition, every corpus flag is still applied (it blocks that recording, the conservative direction), and the report prints the calibrated false-flag rate of the matching codec/rate condition next to each corpus flag.

  **A.7 Determinism check.** C2 with seed 1 at 30 dB is run twice. The SHA-256 of the two payloads must be identical.

  **A.8 Browser-parity check (pre-registered here; run separately; gates production shipping, not the Part A verdict).**

  - **Why:** compare mode plays the source file in a browser, but Part A measures ffmpeg 6.0 decoding. How browsers handle leading samples in MP3, AAC and Vorbis is **not known**, and no browser was tested in this repository. Without this check, the claim "this is the sound of that point" is unverified in the browser for every corpus format, including the 46 lossy evidence files (mp3 25, aac 21) and the 2 Vorbis demo files. PCM WAV files are also unverified in browsers; no mechanism is assumed either way.
  - **Browsers:** named by the project owner on 2026-09-29: the Chromium, Firefox and WebKit (Safari engine) builds bundled with Playwright, installed as a dev-only dependency of this repo. Browser name, version, engine and OS are logged.
  - **Files:** exactly the C2–C16 files of A.2 (same bytes, same SHA-256), gated SNR levels, all 20 seeds.
  - **Decode path:** the decode path that compare mode will actually use for playback, stated in the run log. If that path is Web Audio, the file is decoded with `decodeAudioData` in an `OfflineAudioContext` created at sampleRate = R_s, so that the browser does not resample. If compare mode plays through an `<audio>` element instead, the check must capture that element's output; the capture method is written into a dated amendment to this notebook before the check runs.
  - **Checks:** for each click, π^b_c = the argmax of |x_b| in the same search window as π_c (A.3), where x_b is the browser's mono decode (channel mean for C10). ε^b_c = π^b_c / R_s − τ_c. **Pass** iff |ε^b_c| ≤ δ for 100% of grid-covered clicks, and A2 and A2-all repeated with π^b_c in place of π_c pass for 100% of grid-covered clicks, per browser and condition.
  - Also reported: the ε^b distributions per browser and condition, and the lag between x_b and x_s by cross-correlation of the full signals.
  - **Results** go to `05_Benchmark_Results/v2/experiment_012_browser_parity.json`. The harness is a separate script (see Reproducibility Notes). Its outcome feeds the decision rule's shipping condition.
  - `Corpus_v2.md` separately notes that `.mpga` files may need a MIME or extension mapping for browser playback. A browser that cannot decode a condition at all is recorded as "not playable", which is a parity failure for that condition.

  ### Part B — sampling-grid sensitivity (report only)

  **B.1 Arms.** Everything is PR except the window.
  - frames per point F_w = round(w / (512/22050)), which is the production rule.
  - base hop h_w = max(1, round((w/3) / (512/22050))) frames, i.e. "window/3 rounded to frames". Reading it as round(F_w / 3) gives identical values (checked on 2026-09-29).
  - hop = max(h_w, ⌈S/700⌉), with the same 700 cap and the same 20% filter.

  | Arm | w (s) | F_w | Dims (F_w × 513) | Span L_w (samples / s) | Base hop h_w (frames / s) | Adjacent-window sample overlap at base hop | Cap widens the hop above | Grid has gaps above |
  |---|---:|---:|---:|---|---|---:|---:|---:|
  | W10 | 0.10 | 4 | 2052 | 2560 / 0.1161 | 1 / 0.0232 | 0.800 | 16.30 s | 81.32 s |
  | **W15 (= PR)** | 0.15 | 6 | 3078 | 3584 / 0.1625 | 2 / 0.0464 | 0.714 | 32.55 s | 113.82 s |
  | W25 | 0.25 | 11 | 5643 | 6144 / 0.2786 | 4 / 0.0929 | 0.667 | 65.06 s | 195.09 s |
  | W50 | 0.50 | 22 | 11286 | 11776 / 0.5341 | 7 / 0.1625 | 0.696 | 113.82 s | 373.89 s |

  The table was computed from the rules above on 2026-09-29, and the runner recomputes and logs every value.

  **What the corpus actually runs at** (computed from `decodedSamples22050` in `manifest_v2_corpus.json` on 2026-09-29; overlap = max(0, (L_w − hop·512) / L_w); a gap means hop·512 > L_w):

  | Arm | Recordings where the 700 cap binds (hop > h_w) | Overlap across the 60 recordings, min / median / max | Recordings with grid gaps |
  |---|---:|---|---:|
  | W10 | **36 / 60** | 0.000 / 0.600 / 0.800 | 2 (inat_855622, 96.6 s, hop 6; inat_376675, 104.2 s, hop 7) |
  | W15 (PR) | **17 / 60** | 0.000 / 0.714 / 0.714 | 0 |
  | W25 | 2 / 60 | 0.417 / 0.667 / 0.667 | 0 |
  | W50 | 0 / 60 | 0.696 / 0.696 / 0.696 | 0 |

  - So **most of the corpus does not run at "hop = window/3" in W10** (36 of 60), and a large minority does not in W15 (17 of 60). The arms differ in hop and overlap per recording, not only in window length.
  - Coverage (union of analysed spans over the duration) is reported per recording and arm.

  **B.2 Front end.**
  - The runner builds each arm from the exporter's exported building blocks: `readFullAudio`, `stft`, `spectralFluxPerFrame`, `binFrequencies`, `buildContinuousPoints` (with `framesPerPoint = F_w` and the arm's hop), and `amplitudeThreshold` with 0.2.
  - Reduction uses production `reduceFeatures({ method: "pca", dimensions: 3 })`.
  - **Parity check (the run stops if it fails):** for W15, the arm's post-filter `emissionTime`s and `rawFeature`s must be **bitwise identical** to `computeContinuousFrontEnd`'s `rawPoints` on the smoke file and on the first analysed corpus recording. Its 3D embedding must also equal the exporter's `position` with `POSITION_SPREAD` scaling undone, to ≤ 1e-9 relative.
  - **Cross-check (escalated, not stopping):** if `05_Benchmark_Results/v2/experiment_007_reducer_rebenchmark_production_regime.json` exists at run time, W15's real T(k=5) per recording must equal Experiment 007's PCA d = 3 real T to ≤ 1e-12 (the code path is the same and deterministic). A mismatch is flagged and escalated.

  **B.3 Per recording, per arm.**
  1. Build X_w (n × D_w), z-scored per column with `tools/lib/reducers.js` `standardize`, as in Experiment 007.
  2. Build the matrix controls G_w and P_w, and the signal-level controls S_w, N^white_w and N^pink_w (controls table below).
  3. Run PCA-3D on X_w and on every control.
  4. Compute the metrics below on all of them.

* **Metrics used to evaluate:**
  - **Part A:** per-condition, per-seed-group and overall counts of covered clicks, passes and failures for each check, plus uncovered counts; the gated rate over covered clicks and the rate over all clicks (A.3).
    - With N covered clicks and zero failures, the exact one-sided 95% upper confidence bound on the per-click failure probability is 1 − 0.05^{1/N}. It solves (1 − p)^N = 0.05, the zero-event binomial bound. It is reported so that "100% passed" carries its sample size.
    - **Scope of that bound:** it assumes independent per-click failures. A systematic per-file or per-codec offset (the main risk being tested) would hit every click of a file at once, so for systematic errors the independent units are files or conditions, not clicks. Systematic offsets are bounded by the per-condition ε_c distributions (median and max |ε_c|, in samples and ms), not by the per-click bound. As a secondary figure the bound is also reported with N = the number of distinct source files per condition (20 seeds × 2 gated SNR levels = 40 files, bound 0.0722; or 20 if the noiseless twin and the 30 dB file of a seed are counted as one unit, bound 0.1391; both computed 2026-09-29).
    - The ε_c, ε^ref_c and (A.8) ε^b_c distributions are reported.
    - Planted-error battery: the per-check, per-error flag-rate table (A.5).
  - **Part B, primary:** trustworthiness T(k=5) and continuity C(k=5) of PCA-3D.
    - `tools/lib/metrics.js` `trustworthiness` / `continuity`, the definitions as in Experiment 001's port (see Experiment 007, Metrics).
    - Original space: the arm's z-scored matrix with squared Euclidean distance. Embedded space: Euclidean distance.
    - Reported for the real matrix and for each control, together with the margins T_real − T_G, T_real − T_P, **T_real − T_S**, C_real − C_G, C_real − C_P and C_real − C_S.
    - **Gap-excluded T_gap(k=5)**, defined exactly as in Experiment 007 (gap 1.5 s; G and P rows inherit the real rows' timestamps; S and noise rows use their own front-end timestamps). T_gap and its margins against G, P and S are the **headline quantities for between-arm comparisons**, because plain T at k = 5 is dominated by adjacent overlapping windows whose time extent differs between arms (Confounds).
  - **Part B, also required:**
    - 3D explained variance EV₃, the cumulative ratio of PC1–3 from production `pca()` `details`. Per-component ratios are given too.
    - EV₃ of G_w as a dimension- and n-matched reference. Because raw EV₃ is not comparable across D_w, the **paired quantity is EV₃,real − EV₃,G**; the ratio EV₃,real / EV₃,G and raw EV₃ are reported descriptively only.
    - Point counts: n after the filter, N before the filter, the hop actually used, whether the cap widened the hop, the adjacent-window overlap actually used, and the coverage fraction (the union of analysed spans over the duration, before and after the filter).
  - **Part B, extra rigor (reported):** T and C at k = 10; the white/pink noise results per arm.
  - **Aggregation across recordings:** every per-recording value is written to the JSON. For each arm the JSON also gives the median, the IQR (Q1 and Q3, linear interpolation) and a 95% percentile bootstrap CI (B = 2000) of the median.
  - **Paired comparisons** (W10, W25 and W50 each against W15; in the second paired analysis W10 and W25 only), each as per-recording differences Δᵣ, the mean of Δᵣ with `metrics.pairedBootstrapCI` (paired percentile, B = 2000), and two-sided `metrics.wilcoxonSignedRank` with zero-handling and the exact/normal-approximation choice recorded:
    - **Headline family** (Holm with `metrics.holm`, within each paired analysis): the T_gap(k=5) margins real − S, real − G and real − P. Primary analysis: 3 comparisons × 3 = 9 tests; second analysis: 2 × 3 = 6 tests.
    - **Secondary family** (Holm separately): T_real − T_S, T_real − T_G, T_real − T_P, raw T, raw C, C_real − C_G, and EV₃,real − EV₃,G. Primary analysis: 3 × 7 = 21 tests; second analysis: 2 × 7 = 14 tests.
    - Everything else (k = 10, noise inputs, raw EV₃, ratios) is descriptive, with no tests.
    - For T, T_gap and C quantities, each comparison is labelled "inside / outside the ±0.02 band" (Experiment 001's tie band), as a description only.
    - A comparison with fewer than 20 paired recordings is labelled "underpowered, not interpreted".

* **Negative control type used:**

  **Part A** has no structure-vs-noise question, so its controls test the **checks**:
  1. **Planted-error battery** (A.5), scored S0 and S1. This is the positive control that decides whether the checks can certify anything.
  2. **Misaligned-truth null (descriptive; rescored).** Every τ_c is replaced by τ_c + σ_c·v_c, with a random sign σ_c, in two bands, each scored separately:
     - band 1: v_c ~ U[δ + 1/R_a, 2δ] s (513 to 1024 analysis samples), seed 20260720 + 120200 + s;
     - band 2: v_c ~ U[2δ, 0.10) s, seed 20260720 + 120250 + s.
     - Scored on **A1 ∧ A2 only**, on C1–C3, all 20 seeds, null and 30 dB. A1 alone, A2 alone and A3 are reported alongside.
     - **Why it is descriptive and not a gate.** The first draft scored this null with A3 included. A3 fails by construction for every shift ≥ 0.10 s > δ, so that null could not fail and decided nothing. Without A3, the pass rate measures how large a timing error A1 ∧ A2 lets through. With a span of ≈ 7δ and a ±δ widening, a high pass rate in both bands is plausible from the geometry (reasoning, not evidence). A threshold on it would test the geometry, not whether the scorer works, so none is set. The question "is the scorer hard-wired to pass?" is answered by S0 and the scorer unit tests instead.
     - Under band 2, Q_c may contain a point that holds a neighbouring click (the shifted τ can lie up to 0.10 s nearer to it). This is accepted because the null is descriptive; such cases are counted.
     - The first draft's null (v_c ~ U[0.10, 0.15), scored A1–A3) is **dropped**.

  **Part B:**

  | Control | Construction | Preserves | Destroys | Seed offset (per recording r; arms W10 / W15 / W25 / W50) | In the report-only control label? |
  |---|---|---|---|---|---|
  | Matched Gaussian G_w | `metrics.randomMatchedMatrix`, an exact port of Experiment 001's `randomMatchedMatrix` (LCG 1664525 / 1013904223 mod 2³², Box–Muller cosine branch, u₁ ≥ 1e-12, row-major), with the same n × D_w as X_w | shape only | everything else | **+21 / +22 / +23 / +24** | Yes |
  | Column-permuted P_w (extra) | `metrics.columnPermutedMatrix`: each column of X_w permuted independently across rows (Fisher–Yates, same LCG) | each feature's marginal distribution | cross-feature and temporal (overlap) structure | **+31 / +32 / +33 / +34** | Yes |
  | **Phase-randomised surrogate S_w** (extra, overlap-preserving; Experiment 007's construction) | The recording's own decoded mono 22050 Hz signal: complex FFT (zero-padded to the next power of two), magnitudes kept, phases replaced with i.i.d. uniform [0, 2π) under Hermitian symmetry, inverse FFT, truncated to the original length. **One surrogate signal per recording**, then pushed through **each arm's** full front end (windowing, 700 cap, 20% filter), so the arms' S values are paired on the same signal. Needs a complex FFT/iFFT (`tools/lib/fft.js` exposes only `makeFft(...).magnitudes` today, read 2026-09-29), unit-tested for round-trip error ≤ 1e-9; shared with Experiment 007 if that implementation exists at run time | long-term power spectrum (approximately, because of zero-padding), duration, **each arm's window-overlap geometry** | the temporal organisation of the song | **+41** (the same for all arms, by design) | Separate "beyond-overlap" label (see threshold) |
  | White / pink noise N^white_w, N^pink_w (extra, overlap diagnostic) | `synth.whiteNoise` / `synth.pinkNoise` at 22050 Hz with the recording's decoded duration (`decodedSamples22050`), default `rms`, then each arm's full front end | duration and each arm's window geometry | all spectral and temporal structure of the recording | **+51 / +52** (the same for all arms) | No; diagnostic for H-B2 |

* **Negative control random seed:** base 20260720.

  | Seed | Use |
  |---|---|
  | 20260720 + 120000 + s, s = 1…20 | synth `seed` for `clickTrain` (synth derives its click-noise and background streams from it internally) |
  | 20260720 + 120100 + s | click-time jitter uᵢ |
  | 20260720 + 120200 + s | misaligned-truth null, band 1 |
  | 20260720 + 120250 + s | misaligned-truth null, band 2 |
  | 20260720 + 120300 + s, s = 1…5 | `motifSequence` signals for the RMS-lag calibration (A.6) |
  | 20260720 + 1000·r + {21, 22, 23, 24} | Part B matched Gaussian G_w |
  | 20260720 + 1000·r + {31, 32, 33, 34} | Part B column permutation P_w |
  | 20260720 + 1000·r + 41 | Part B surrogate phases S (one per recording) |
  | 20260720 + 1000·r + 51 / 52 | Part B white / pink noise |
  | 20260720 + 712 | every Part B bootstrap (corpus-level; the same seed for every CI, so equal-length comparisons share resample index sets) |

  - **Why these cannot collide:** with at most 60 evidence recordings, the per-recording seeds are ≤ 20260720 + 59052. They cannot collide with the Part A seeds (≥ 20260720 + 120001) or with +712. The Part A ranges 120001–120020, 120101–120120, 120201–120220, 120251–120270 and 120301–120305 are disjoint.
  - The runner asserts that all seeds are unique and writes the full table to the JSON.
  - The offsets differ from Experiment 007's (+1, +2, +7, 804/805), so W15's control values are **not** expected to equal Experiment 007's. Only the real-data T is cross-checked (B.2).

* **Negative control metric name:**
  - Part A: the planted-error flag rates (S0 and S1, per error and per check). The misaligned-truth null pass rate, A1 ∧ A2, per band (descriptive).
  - Part B: trustworthiness at k = 5 as the paired difference real − control per recording, for G, P and S; the same for T_gap(k=5), which is the headline for between-arm comparisons.

* **Negative control numeric result:** Pending run.

* **Negative control threshold:**
  - **Planted errors, S0:** 100% of "must be flagged" runs are flagged (gating).
  - **Planted errors, S1:** 100% of "required" runs flagged by A1 ∨ A2 ∨ A2-all. A failure triggers the pre-committed disclosure (A.5), not a block.
  - **Part A null:** no threshold; descriptive (reason in the controls section). It is not called a control that decides anything.
  - **Part B, report-only control label:** the Experiment 007 pass rule, applied per arm. An arm is labelled "passes controls" iff both of these hold:
    - the 95% paired-bootstrap CI lower bound of mean(T_real − T_G) is ≥ **0.02**; and
    - the same bound for mean(T_real − T_P) is ≥ **0.02**.
  - **Part B, report-only "beyond-overlap" label** (Experiment 007's surrogate gate, per arm): the 95% paired-bootstrap CI lower bound of mean(T_real − T_S) is ≥ **0.02**. The same bound is also reported for T_gap. If it is not met at an arm, no wording about structure beyond what stationary noise with the same spectrum and windowing produces may be used for that arm.

* **Negative control pass/fail:** Pending run.

* **Label-exposure risk step:**
  - **Part A:** no labels exist for the synthetic signals. The real-file arm reads only `localPath`, `id`, `sha256` and `codec`/`sourceSampleRateHz` (for grouping the report).
  - **Part B:** z-scoring, PCA fitting, control construction and metric scoring could see labels if the runner passed them.
  - This experiment makes **no** use of species labels, not even afterwards for inspection. Taxon fields are copied into the JSON metadata only by the reporting stage. The pre-stated exclusion list above identifies recordings by id, duration and codec only.

* **Label-exclusion verification:**
  1. Code inspection before the run; the date and inspector are recorded in Reproducibility Notes.
  2. **Label-invariance test (extra rigor, as in Experiment 007):** the first analysed Part B recording is run twice, once with every taxon and label field of an in-memory manifest copy replaced by `"REDACTED"`. The SHA-256 of the two per-recording result objects (metadata excluded) must be identical, and the result is logged.

### Compute plan

- **Part A:**
  - gated runs: 16 conditions × 20 seeds × 2 gated SNR levels = 640 pipeline runs;
  - reported-SNR runs: 3 × 20 × 2 = 120;
  - planted-error and null scoring: these reuse existing runs, so no new pipeline runs are needed;
  - the RMS-lag calibration: set 1 reuses the C2–C16 runs; set 2 adds 5 seeds × 15 conditions = 75 pipeline runs;
  - the real-file arm: 62 runs;
  - the browser-parity check (A.8) is a separate run on the same files, not counted here.
- **Source-native decodes and buffers:** `readFullAudio` uses `maxBuffer` 64 MiB. A source-native f32 decode of a 118 s C7 file at 192 kHz is 118 × 192000 × 4 = 90.6 MB, so a runner copying that pattern would fail. The runner therefore reads source-native decodes through a stream (or with `maxBuffer` ≥ 256 MiB), and it asserts that the decoded sample count equals the ffprobe-reported duration × R_s to within one frame of the source codec. The analysis decode still goes through the unmodified `readFullAudio`, so that what ships is what is tested.
- **Part B:** 60 recordings × 4 arms × 6 inputs (X, G, P, S, white, pink) of PCA-3D, at up to 11286 dims for W50; plus 60 surrogate signals and 120 noise signals, each through 4 front ends.
- **No subsetting.** No subsetting of seeds, conditions or recordings is pre-registered or permitted. If the projected wall-clock time (timed on the first 2 of each) exceeds 24 h, the run stops and the owner decides. There is no ad-hoc cap.
- **No within-recording point subsampling**, because it would change the regime.

## Pre-Committed Decision Rule

Defined before any data are seen. It is applied mechanically by the runner, and the results JSON stores both the computed verdicts and the inputs to each verdict.

### Part A (gating)

**Pass conditions.**

1. **A0 and A5:** 100% of exported points in every condition (C1–C16, gated SNR levels) and in every real corpus file.
2. **G1:** 100% of runs.
3. **A1, A2, A2-all and A3:** 100% of grid-covered clicks in every gated condition, **tolerance one analysis frame** (δ = 512 samples at 22050 Hz; δ_s in source samples).
4. **A4:** 100% of runs at null and 30 dB, except failures that meet the pre-registered "codec temporal smearing" criteria (A.4).
5. **The planted-error battery, scoring S0:** 100% of "must be flagged" runs are flagged.
6. **The determinism check** gives identical hashes.

(The first draft's condition "misaligned-truth null pass rate ≤ 0.05" is removed, because that null could not fail; see the controls section. No other condition was removed or relaxed.)

**Format and rate groups** (used by row R4): 22.05 kHz (C4), 24 kHz (C5), 32 kHz (C6), 192 kHz (C7), pcm_s24le (C8), pcm_f32le (C9), stereo (C10), MP3 (C11, C12, C13), AAC/M4A (C14, C15), Vorbis (C16).

**Outcomes.** The rows are evaluated **in order**, and the **first** row whose condition holds applies. So the rows are mutually exclusive by construction.

| Row | Condition | Pre-committed decision |
|---|---|---|
| **R1** | Condition 5 (S0) or condition 6 fails | The checks cannot certify anything. Part A **cannot pass**, and compare mode is blocked. The checks must be redesigned and the redesign pre-registered as a dated amendment to this notebook before any re-run. |
| **R2** | A5 fails because the export lacks offset fields, and every other condition holds | Blocked until the exporter emits them. Then all of Part A is re-run. |
| **R3** | Any failure of conditions 1–4 in C1, C2 or C3; or any A0 or G1 failure in the real-file arm; or failures of conditions 1–4 in **more than one** format or rate group; or an A5 failure together with any other failure | **Compare mode is blocked until it is fixed.** Every failing case is listed with condition, seed, click and check. After a fix, **all of Part A is re-run** with the same seeds. A partial re-run is not allowed. The tolerance, the checks and the conditions are not changed after seeing data. |
| **R4** | Failures of conditions 1–4 confined to **exactly one** format or rate group among C4–C16 | Blocked as in R3. The only other exit is an explicit **owner decision**, recorded in the decision log, to exclude that format or rate from compare mode. Compare mode must then refuse to operate on files of that format or rate. This is a scope restriction, **not** a pass. It is not available for C1–C3. |
| **R5** | Conditions 1–6 hold, and at least one A4 failure was classified as codec temporal smearing | **Part A passes on the ffmpeg-decoded timeline**, as in R6, with the codec-smearing caveat of A.4 added to the documentation. |
| **R6** | Conditions 1–6 hold | **Part A passes on the ffmpeg-decoded timeline.** The convention:<br>• point audio = [emissionTime, emissionTime + 3584/22050 s) on the analysis timeline;<br>• the source slice is [round(s·R_s), round(e·R_s)).<br>The convention text, the per-condition ε distributions and the zero-failure upper bounds (with their scope, see Metrics) go into the export documentation and the proposed D-0NN. Any duration shown to users must describe the analysed span (0.1625 s, "≈ 0.16 s"), not the nominal "0.15 s". The nominal value may be named only as nominal. |

**Modifiers that apply on top of R5 or R6** (they do not change which row applies):
- **S1 disclosure:** if S1 fails for any "required" error, the verbatim statement of A.5 is added to the Discussion, the D-0NN entry and the export documentation.
- **RMS-lag flags (A.6):** compare mode is blocked **for each flagged corpus recording** until the cause is investigated and documented. The recordings are listed, with the calibrated false-flag rate of the matching condition. If ≥ 1 recording is flagged, the whole of Part A's conclusion is marked "escalated" in Discussion.

**Shipping in production (browser parity; decided now).** A Part A pass (R5 or R6) certifies the offsets on the **ffmpeg 6.0-decoded timeline** only. In addition:
- Compare mode may ship in production **only for the format and rate groups (and the C2/C3 PCM baselines) that pass the browser-parity check A.8 in every target browser**.
- Until A.8 has passed for a group, compare mode must not be shown in production for files of that group. It may be used in development or internal preview builds only, and only with this user-facing caveat, verbatim: **"Audio offsets verified against ffmpeg 6.0 decoding only. Browser playback alignment is not verified for this file format."** The caveat applies to every format until A.8 has run. The affected corpus formats are: MP3 (25 evidence files, 2 of them `.mpga`), AAC/M4A (21), PCM WAV (14: pcm_s16le 9, pcm_s24le 4, pcm_f32le 1), and Vorbis/OGG (the 2 demo files).
- A browser-parity failure in a group blocks that group in production. It is handled like R3/R4: fix and re-run A.8, or an owner decision to exclude that format, with compare mode refusing to operate on it.

**Scope of a pass.** A pass is valid only for:
- the PR constants (R_a 22050, FFT 1024, hop 512, F = 6, L = 3584);
- the bundled ffmpeg-static `6.0` binary, identified by its version string and the SHA-256 of the binary, on the logged platform and architecture;
- the conditions tested;
- the ffmpeg-decoded timeline (browser playback is covered only by A.8).

Any change to these requires a full Part A re-run before compare mode relies on the new setting. This includes a window change adopted after Part B, and a different ffmpeg binary or platform.

### Part B (report only)

**Pre-committed: REPORT ONLY.** No production change follows from this experiment, whatever the numbers are.
- **No constant changes.** `POINT_WINDOW_SECONDS`, `POINT_HOP_SECONDS`, `MAX_POINTS` and `AMPLITUDE_FILTER_PERCENTILE` stay as they are.
- **No optimality claims.** No viewer text, export text or documentation may call 0.15 s "optimal", "validated" or "best" on the basis of this experiment. Numbers may be quoted as numbers, with their CIs and the confounds below.
- **Any change of window is an owner decision** informed by these numbers, recorded as its own decision-log entry.
- **Before a changed window ships:**
  - Part A must be re-run at the new F, because the span becomes (F − 1)·512 + 1024;
  - every v2 experiment whose pre-registration defines PR at 0.15 s (Experiments 007–010) must be re-run or explicitly caveated as applying to 0.15 s only.
- **Control failure is a v0.4 Failure Criteria event, not a report line.** v0.4 Failure Criteria (bullet 1) lists a failed mandatory negative control as a methodology failure, and says it "should trigger a documented methodology review, not a quiet adjustment of thresholds". So, decided now:
  - **If W15 (= PR) fails the G or the P control** under the Experiment 007 rule above, a **documented methodology review is triggered and escalated to the owner**. It is cross-referenced to Experiment 007 and its proposed D-014 (the display-reducer decision for PR), because W15 here is the same regime and code path. The production display claim is then treated as under review until that review is closed, whatever Experiment 007 finds.
  - **If any other arm fails G or P**, a documented methodology review is also triggered and escalated, limited to that window setting. In particular, it must be closed before that window could be adopted.
  - The review is a written record in this notebook's Discussion and in the decision log. It is not a quiet adjustment. No threshold is changed to resolve it.
  - A failure of the "beyond-overlap" (S) label is not a Failure Criteria event on its own (S is not the mandatory control, D-006). It restricts wording as stated in the threshold section.
- **The per-arm control labels** use the Experiment 007 pass rule with threshold **0.02**, and the ±**0.02** band labels come from Experiment 001. Apart from the methodology-review trigger above, they describe; they do not decide.

**Confounds pre-stated for Part B** (so they are not discovered after the fact). The four arms differ in more than "window length":
- **Feature dimensionality** D_w (2052 to 11286). The matched controls are matched per arm; EV₃ is compared only through EV₃,real − EV₃,G.
- **Point count** n. Trustworthiness depends on n, and the matched control has the same n, so the margin partly adjusts for it.
- **Adjacent-window overlap and hop, which the 700 cap changes per recording.** At base hop the overlap is 0.667–0.800, but the cap overrides the base hop on much of the corpus (B.1, "What the corpus actually runs at"): it binds in W10 for 36/60 recordings, W15 17/60, W25 2/60 and W50 0/60. The per-recording overlap then runs W10 0.000/0.600/0.800 (min/median/max), W15 0.000/0.714/0.714, W25 0.417/0.667/0.667, W50 0.696 throughout, and W10 has grid gaps in 2 recordings. Experiment 007's H3 predicts that overlap dominates original-space k-NN, and k = 5 neighbours span very different durations across arms (at base hop, 5 hops = 0.116 s in W10 vs 0.81 s in W50). **G and P destroy the overlap structure**, so every real − G and real − P margin includes the neighbourhood structure that overlap alone creates. Between-arm differences in the G and P margins are therefore largely differences in overlap and hop, not in window length. This is why the overlap-preserving surrogate S and the T_gap margins are the headline for between-arm comparisons.
- **Cap-driven hop widening and grid gaps,** which start at different durations per arm (B.1).
- **The amplitude-filter threshold,** which is recomputed per arm.
- **The non-random primary exclusion set** (12 of 60 short recordings, all at the base hop in every arm; see Dataset). The second paired analysis (56 recordings) is there to show whether this matters.
- **Recording conditions** (`Corpus_v2.md`, Known biases 1, 2 and 5):
  - per-recording **SNR** varies (phones and handheld recorders, varied gain and compression), and it was not measured;
  - **background species**, people, traffic and wind can be present, and nothing checks or removes them;
  - **codec and sample rate are unevenly spread across species**: Parus major is 4/5 PCM, Cuculus canorus 4/5 AAC, Luscinia svecica 4/5 MP3; overall mp3 25, aac 21, PCM 14; 44.1 kHz 41, 48 kHz 15, one file each at 192, 32, 24 and 22.05 kHz.
  - Part B does not compare species, but these properties change per recording what a window "sees" (for example a low-SNR recording has more noise-dominated windows), and they could interact with window length. No adjustment for them is made; their per-recording values that are available (codec, R_s, channels, duration) are logged next to each result so that the interaction can be inspected afterwards without labels.

So a difference in T between arms cannot be attributed to "window length" alone. Discussion must say this.

## Expected Outcome

- **Support for compare mode:**
  - all Part A pass conditions hold (R6, or R5 with the smearing caveat);
  - the ε_c distributions show the decode is aligned within δ for every tested rate and codec;
  - the zero-failure upper bounds are reported with their N and their scope;
  - for production, A.8 passes in every target browser.
- **Failure (v0.4 Failure Criteria, in spirit for Part A):**
  - Any mislocated click means that the sound compare mode would play is not the sound that produced the point. That would be a visual element that does not represent the measurable information it claims to (Core Philosophy). Compare mode stays blocked, and the finding is documented, not tuned away.
  - A failure that appears **only** in lossy-codec conditions (C11–C16) and **only** against the pre-encode reference (ε^ref, not gated) is **not** a Part A failure. It is reported as a codec-delay finding, because the file as decoded is the reference for compare mode. It does, however, raise the stakes of the browser-parity check A.8.
  - If S1 fails, that is not a failure of compare mode, but it is a finding about the spec checks, and it is reported as such (A.5).
- **Part B:** no outcome counts as support for a production decision, because none is taken. But, tied explicitly to **v0.4 Failure Criteria bullet 1** ("Random or shuffled data produces manifolds with structure similar to real data (i.e. the mandatory negative control fails)"):
  - a failure of G or P at W15 (PR) is a Failure Criteria event and triggers the documented methodology review described in the decision rule, cross-referenced to Experiment 007 / D-014;
  - a failure of G or P at any other arm triggers the same review for that setting.
  - Informative, non-triggering outcomes:
    - white/pink noise or the surrogate passing G and P at an arm (H-B2 confirmed there), which would show that "passes G and P" only means "better than a structureless matrix" at that arm;
    - a paired T_gap margin difference against W15 whose CI lies entirely outside ±0.02;
    - a large EV₃,real − EV₃,G difference between arms.

⸻

## Results

Pending run. The results will be written to `05_Benchmark_Results/v2/experiment_012_compare_mode_timing_and_grid_sensitivity.json`, with top-level keys `partA` and `partB`, and the browser-parity results to `05_Benchmark_Results/v2/experiment_012_browser_parity.json`. Tables here will link to those files and not duplicate them.

## Unexpected Observations

Pending run.

## Discussion

Pending run.

Limitations and disclosures pre-stated now, so they are not discovered after the fact:
- **Browser decoding.** Part A verifies offsets against **ffmpeg 6.0** decoding. Browser parity is pre-registered as A.8 and gates production shipping (decision rule). Until A.8 has run, nothing here says anything about browser playback.
- **Only the export is tested.** The production screen's own use of the fields (rounding, clip scheduling, any fade-in or fade-out ramps added to avoid playback clicks) is not tested here. A fade changes what is heard at the span edges, and must be documented if used.
- **Waveforms.** If the compare view draws waveforms from exported arrays rather than from the audio file, those arrays need their own equality check against [A_p, B_p). That is outside this pre-registration.
- **Clicks are not birdsong.** They are a timing fixture chosen because their peak is well defined. Part A says nothing about what a point "sounds like". It checks only which audio produced it.
- **Hamming weighting.** The 6 frames are each Hamming-weighted, so the first and last 512 samples of the span contribute less to the features than the interior. The span is still the audio that produced the features. How strongly each sample is weighted is not claimed here.
- **Which checks carry the timing claim.** If S1 fails, the spec checks A1/A2 are insensitive at that error size, and the claim rests on A0 and A3 (A.5). This must be stated wherever the Part A result is cited.
- **Evidence provenance.** D-004 (PCA) and D-010 (raw spectrograms) were established under a different regime and on different corpora (Experiments 001–006). Part B does not re-test them (see "Provenance" in Question).
- **No individual-bird claims** (D-008).
- **Part B covers one corpus, PCA-3D only, and within-recording fits.** The corpus limits and the confounds listed above (SNR, background species, codec and sample-rate imbalance across species, observer overlap in `Corpus_v2.md`) and the recording-condition confound in v0.4 Scientific Assumptions apply. Trustworthiness measures local neighbourhood preservation, not biological meaning.

## Decision

Pending run. The decision will be applied mechanically from the Pre-Committed Decision Rule.
- **Part A** feeds the proposed **D-0NN: compare-mode audio-offset convention**. Its outcome row (R1–R6) gates the compare view on the ffmpeg-decoded timeline; A.8 gates production shipping per format group.
- **Part B** feeds no decision entry. Its numbers are handed to the owner. A G or P control failure in any arm opens a documented methodology review (cross-referenced to Experiment 007 / D-014 for W15).

## Reproducibility Notes

- **Runner:** `tools/experiments/run_experiment_012_compare_mode_timing_and_grid_sensitivity.js` (not yet written).
- **Browser-parity harness:** `tools/experiments/run_experiment_012_browser_parity.js` (not yet written). The browser automation tool and its version are logged; none is installed or assumed by this document.
- **Results:** `05_Benchmark_Results/v2/experiment_012_compare_mode_timing_and_grid_sensitivity.json` and `05_Benchmark_Results/v2/experiment_012_browser_parity.json` (not yet produced).
- **Generated test audio:**
  - Written to a temporary directory and **not committed**.
  - Each file's SHA-256, its generation parameters (synth params, click times, master gain) and the verbatim ffmpeg command lines (with the encoder named explicitly) are logged in the JSON, so every file can be regenerated bit-for-bit, provided the same ffmpeg binary is used.
- **Manifest:** `manifest_v2_corpus.json`. Its SHA-256, recording count and per-recording `id`, `codec`, `sourceSampleRateHz`, `channels` and `decodedSamples22050` are logged. The expected exclusion table and the cap/overlap table in Method were computed from this file on 2026-09-29; the runner recomputes both and logs any difference.
- **PR constants** are read from `tools/export_single_recording_dataset.js`, not re-typed: 22050 Hz, FFT 1024, hop 512, Hamming, `POINT_WINDOW_SECONDS` 0.15, `POINT_HOP_SECONDS` 0.05, `MAX_POINTS` 700, `AMPLITUDE_FILTER_PERCENTILE` 0.2. The runner logs the values it actually used and the derived F, L, hops and thresholds.
- **Environment:**
  - Node (v24.x; exact version logged).
  - ffmpeg/ffprobe **only** via `tools/lib/ffbin.js` (`FFMPEG`, `FFPROBE`); `ffmpegVersion()` is logged. `Corpus_v2.md` records that the bundled ffmpeg (`6.0`) and ffprobe (`n4.4.1`) are **different versions**. Both are logged.
  - The **SHA-256 of the FFMPEG and FFPROBE binaries** (the files at the paths `ffbin.js` resolves), `process.platform` and `process.arch` are logged. On 2026-09-29 these paths resolved to `node_modules/ffmpeg-static/ffmpeg` and `node_modules/@ffprobe-installer/darwin-arm64/ffprobe`.
  - The encoder list (`-encoders`) and decoder list (`-decoders`) are logged.
  - **The decoder actually used for each file** is logged, from ffmpeg's stream-mapping line at `-loglevel verbose` (for example which of `mp3float`, `mp3_at`, `aac` or `aac_at` ffmpeg selected), next to ffprobe's `codec_name`.
  - The git commit hash and a dirty-tree flag. If the tree is dirty, the SHA-256 of `git diff` is logged.
- **Seeds:** the full table in Method, written to the JSON. Base 20260720.
- **Statistics:** `tools/lib/metrics.js` (percentile bootstrap, paired bootstrap, Wilcoxon, Holm). B = 2000, α = 0.05.
- **Label-exclusion code inspection:** date and inspector to be recorded here at run time.
- **Unit tests** (in `tools/test/`) that must pass before the run:
  - **scorer fixtures:** a single click at a known 22050-sample index with no noise → A0–A3 pass; the same fixture with emissionTime + 513 samples → S0 flags it; the fixture with startFrame ± 2 → the flag rates of A1/A2 under S1 are computed without error (their values are results, not test expectations);
  - **Part B front-end parity** (W15 bitwise equal to `computeContinuousFrontEnd`);
  - **independent grid** equal to the exporter's `pointsBeforeAmplitudeFilter` on synthetic lengths at 10, 30, 60 and 118 s;
  - **complex FFT round trip** ≤ 1e-9 and Hermitian symmetry of the surrogate spectrum;
  - **zero-phase lowpass:** a synthetic impulse passed through the A.6 filter chain keeps its peak sample index;
  - **seed uniqueness.**

## Revision log

2026-09-29, before any run, after a methods critique (verdict "needs revision"):
1. **Planted-error battery:** per-check, per-error flag rates; new S1 scoring with A0, G1 and A5 disabled; A1 ∨ A2 must flag every S1-required error in 100% of runs, else a verbatim disclosure that A0 and A3 carry the claim; new integer-frame shifts F±1 (should pass) and F±2 (required); all 20 seeds. E6 is kept S0-only because its error (276 samples, end only) is inside the spec tolerance.
2. **Misaligned-truth null:** rescored on A1 ∧ A2 in two bands ([δ + 1 sample, 2δ] and [2δ, 0.10 s)); now descriptive; the old null and its ≤ 0.05 condition are removed from the pass rule.
3. **Part B overlap:** new overlap-preserving surrogate S (Experiment 007's construction, seed +41) and white/pink noise diagnostics (+51/+52); T_gap margins are the headline; manifest-computed cap-binding counts and overlap distributions added to B.1 and Confounds.
4. **Part B exclusions:** expected exclusions (12 of 60, ids listed) pre-stated; second paired analysis on 56 recordings; minimum 20 paired recordings.
5. **Failure Criteria:** a G or P failure in W15 or any arm triggers a documented methodology review, escalated to the owner and cross-referenced to Experiment 007 / D-014.
6. **Browser parity:** Part A pass scoped to the ffmpeg-decoded timeline; A.8 pre-registered; production shipping gated per format group; verbatim caveat and affected formats in the decision rule.
7. **Disclosures:** D-004/D-010 provenance; D-008; SNR, background species and codec/sample-rate imbalance (counts from `Corpus_v2.md`) in Confounds.
8. **Minor:** scope of the zero-failure bound, with file-level N; RMS-lag diagnostic low-passed, calibrated on true-lag-0 files, with peak sharpness; EV₃ compared as EV₃,real − EV₃,G; codec-smearing interpretation of A4 pre-registered; outcome rows made mutually exclusive by ordered evaluation and format groups; coverage denominator labelled as a deviation, with the all-clicks rate reported; buffer, binary hashes, platform, decoder logging and pinned encoder names; WP5 named as in v0.5.
