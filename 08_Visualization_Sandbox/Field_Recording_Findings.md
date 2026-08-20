⸻

# Field Recording Findings (2026-07-24)

**Companion to `Bioacoustics_Research.md`.** That document is the literature review; this
one is the result of actually pointing the sandbox at real project audio instead of the
clean sample clip, and recording what broke, what held up, and what changed.

**Benchmark recording:** `4_2MM06988_20250412_033000` (60s, real field recording,
`Assets/slice_2_acoustic_data/Audio/Audio/`), CSV ground truth: **Yellowish-bellied Bush
Warbler** (*Horornis acanthizoides*), model-consensus confidence 0.93–0.999 across almost
the entire clip. Compared throughout against the 15s `MicrosoftTeams-video.mp3` sample
clip the sandbox was originally tuned on.

⸻

## Why this mattered

Every threshold in the sandbox (`tools/lib/analysis.js`) was originally chosen by eye
against one clean, close-mic, 15-second clip. Real field audio differs from that clip in
ways that matter: much longer, far quieter overall, occasional loud outlier transients
(wind, handling noise), and a noise floor that doesn't drop far below the loudest moment.
Several thresholds that looked fine on the demo clip turned out to be silently broken on
real audio — not obviously wrong, just quietly producing near-empty or saturated output.
This is exactly the risk of tuning parameters against a single unrepresentative sample,
and exactly why this benchmarking pass was worth doing before trusting any of this on
real project data.

⸻

## What broke, and the fix

### Syllable segmentation — undersegmented by ~10x

**Symptom:** only 5 syllables found in 60 seconds of near-continuous calling (mean gap
6.6s between syllables), despite the CSV showing the warbler detected in nearly every 3s
window.

**Cause:** the active-frame threshold was "18% of the single loudest frame in the whole
recording." On the field recording, one loud outlier frame (RMS 0.065, ~5x the 99th
percentile of 0.013) dragged that threshold high enough that only **1.1% of all frames**
cleared it — the detector was effectively starved by a single transient.

**Fix:** threshold is now the 85th percentile of the frame-RMS *distribution*, not a
fraction of the single max. A percentile is robust to one outlier the way "fraction of
max" is not — the same reasoning already used elsewhere in this pipeline (the
`AMPLITUDE_FILTER_PERCENTILE` noise filter). Result: **49 syllables**, mean gap 0.96s,
repetition rate 0.82/sec — consistent with the CSV's near-continuous detections.

### Frequency Occupancy — saturated to ~100% on every band

**Symptom:** every band above 1.1kHz reported ~100% occupancy on the field recording (vs.
a meaningfully varied spread on the sample clip) — the metric stopped discriminating
anything.

**Cause:** "active" meant "louder than 20% of this band's own peak." On a genuinely noisy
outdoor recording, the ambient floor in the mid/high bands rarely drops far below the
single loudest moment in that band, so almost every frame cleared 20% of peak.

**Fix:** "active" now means "at least 80% louder than this band's own *median* energy" —
asking "how far above typical" instead of "how far below the single loudest instant."
This stays meaningful whether the recording is quiet/clean or loud/noisy. Result: bands
now show real structure (a clear peak at 4.4–5.5kHz, matching the warbler's likely
dominant range, occupancy 0.198 vs. near-zero elsewhere) instead of a flat wall of 100%.

### Self-Similarity Matrix — fixed 100×100 regardless of duration

**Symptom (anticipated, not yet a failure):** a fixed 100-sample matrix means 0.6s/cell on
a 60s clip vs. 0.15s/cell on the 15s sample clip — a 4x coarser view of exactly the
recording where finer repetition structure matters more.

**Fix:** resolution now scales with duration (~4 samples/sec, floored at 100 so short
clips lose nothing, capped at 220 so compute stays trivial). The field recording now gets
a 220×220 matrix instead of 100×100.

⸻

## What looked wrong but wasn't (verified before touching anything)

**BirdNET per-chunk timeline disagreeing with the CSV ground truth for most of the
clip.** The whole-clip best-anywhere detection correctly found the true species (Bush
Warbler, 0.855 confidence) at the recording's single clearest moment (27s) — matching the
CSV. But the *per-chunk* breakdown showed other species (Band-tailed Guan, Mottled Owl)
outranking the warbler in most other 3-second windows, even though the warbler is present
there too per the CSV.

Two hypotheses were tested and ruled out before accepting this as real:
1. **Amplitude/gain mismatch** (field recording peaks at 0.15 vs. ~1.0 for the sample
   clip) — added per-chunk peak normalization (matching BirdNET-Analyzer's own
   preprocessing). **No effect on the numbers** — the model appears internally
   gain-invariant, which makes sense: linear gain doesn't change signal-to-noise ratio.
2. **Decode/chunking bug** — verified the 48kHz decode has consistent, real signal energy
   across the whole clip (RMS 0.003–0.013 throughout, no silent gaps or truncation).

**Actual explanation:** this app runs BirdNET globally, across all 6,522 species, with no
location or date filtering (no GPS metadata is available for these recordings). The
official BirdNET-Analyzer pipeline that produced the ground-truth CSV almost certainly
*did* have location/date information and used it to suppress geographically implausible
species. Without that filter, several acoustically-similar species from elsewhere in the
world (an owl, a guan) genuinely compete with the true warbler in the model's raw output
for most of the recording — they aren't spurious noise, they show up in the whole-clip
top-5 too. Only at the single acoustically clearest moment does the true species pull
decisively ahead of the pack.

**This is a real, useful finding, not a bug to silently patch over.** It's already
consistent with the caveat the Species Confidence card carried from the start ("no
location/date filtering is applied here"). The **Detection Timeline** card (new, see
below) was designed specifically to make this visible rather than hidden: it shows a
stacked bar of the top-3 candidates per chunk with their actual confidence, so a
contested chunk visibly reads as contested instead of being flattened into one
falsely-confident label.

⸻

## What held up without changes

- **Main 3D visualization.** All 517 points render, all connections stay visible (the
  earlier all-connections-visible fix holds at higher point count), particle
  reveal/pulse/comet behavior is unaffected by recording length. One honest caveat worth
  carrying forward: PCA explains only **3.3%** of variance on this recording (vs. 29% on
  the sample clip) — the 3D shape here is an even lossier summary of the true
  high-dimensional structure. Already surfaced in the payload (`pcaExplainedVarianceTotal`)
  per the "Why 3D?" open question in `01_Master_Framework/v0.4_Final.md`; worth
  remembering when reading the shape as meaningful.
- **FFT / frequency range.** Checked directly: this recording's content tops out at
  4.67kHz, well inside the current 11kHz Nyquist ceiling (22.05kHz sample rate). No
  change needed for this species. A high-frequency specialist (some warblers/kinglets
  call well above 8kHz) could need this revisited.
- **Spectral Descriptors panel.** Live gauges and the instantaneous-vs-average radar both
  update correctly and show plausible values (e.g. spectral flatness 0.485-0.5,
  consistent with a noisier, less tonal real recording vs. the cleaner sample clip).
- **Pitch Trajectory's conservative voicing.** Only ~1% of frames reach high voicing
  confidence on the field recording (vs. clear peaks on the sample clip) — checked
  whether this was a bug: the highest-voicing frames land at the exact same timestamps as
  the cleanest syllables the (now-fixed) segmentation independently finds. The estimator
  is being appropriately conservative on a lower-SNR recording, not broken.

## What's a genuine weak fit — flagged, not silently hidden

**Chromagram / chord detection.** Checked note/chord output at five points spread across
the field recording: a dominant pitch-class ("note") is reported every time, but the
major/minor triad chord match returned "—" (no match) at 4 of 5 sample points. This is
expected, not a bug: chromagram and Western triad-matching assume music built from a
12-tone equal-tempered scale, which bird vocalizations are not. The raw chroma heatmap
still has some descriptive value (it does show *something* about pitch-class energy
distribution), but the "chord" readout in particular is closer to a novelty than a
meaningful bioacoustic descriptor for birdsong specifically. Recommendation: keep the
chromagram as a supplementary display (same status as the 8-axis descriptors — informative
but not scientifically load-bearing) and don't present the chord label as a real finding
in front of stakeholders.

**One visual bug found and fixed along the way:** the Pitch Trajectory's dot color
(`#4ade80`, green) collided with the BirdNET species-band color for this recording's
dominant species, which happened to hash to the same green — dots were nearly invisible
against their own background band. Changed pitch dots to white, which reads clearly
against any band color.

⸻

## Not yet built

**Harmonic analysis** (a dedicated fundamental+overtone ladder view) doesn't exist yet as
its own card. The raw spectrogram + centroid track and the pitch trajectory partially
cover this ground, but a proper harmonic-tracking visualization (following the
fundamental and its integer-multiple overtones as separate tracked lines) would be a
reasonable next prototype — flagged here as a recommendation, not built in this pass, to
keep this benchmarking round scoped to fixing what the real recording revealed as broken.

⸻

## Net effect

Two visualizations were meaningfully broken by parameters tuned on a single clean sample
clip (syllable segmentation, frequency occupancy) — both traced to the same root cause
(a threshold defined relative to a single extreme value instead of the shape of a
distribution) and fixed the same way. One visualization surfaced a genuine, informative
limitation of the current BirdNET integration (no location/date filtering) rather than a
bug, and got a new companion view (Detection Timeline) designed to make that limitation
visible instead of hidden. Everything else held up. This is exactly the outcome a
benchmarking pass against real data is supposed to produce.
