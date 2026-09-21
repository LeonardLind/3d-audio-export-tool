# Acoustic Asset Generator

Turns one audio recording into one asset package: the scientific acoustic data plus the audio
it describes.

```
audio file -> acoustic processing -> analysis JSON + audio -> package -> S3 -> XP Acoustics screen
```

## The two consumers

There are two, and they read different amounts of the same payload:

1. **XP Acoustics screen** (production) — `revx-greencubes`, at
   `src/Pages/Screens/ExperienceHub/XPScreens/XPAcousticsScreen/`. This is the real target.
   Its contract lives in `XPAcoustics.shared.ts`, whose `AcousticAnalysisPayload` is written
   against this generator's output. It fetches each clip's analysis JSON lazily from a signed
   S3 URL, so payload size is a page-load cost there.
2. **Local BirdSong viewer** (`app/`) — the 3D manifold, sandbox gallery and scrolling panels.
   Reads far more of the payload, off disk.

`--profile` picks which one you are exporting for. See *Export profiles*.

## Running it

**Web interface** (file picker, preview, save):

```sh
npm run generate:ui          # http://127.0.0.1:5184
```

**Command line** (same code, scriptable):

```sh
npm run generate -- path/to/recording.wav --species="Common Wood Pigeon"
npm run generate -- recording.wav --id=my_asset --no-birdnet --publish
```

| Flag | Meaning |
| --- | --- |
| `--id=<slug>` | Asset id. Default: slug of the filename. |
| `--label=<text>` | Label shown in the viewer's Audio Source Switch. |
| `--species=<name>` | Species / caption (`commonName`). |
| `--analysis-rate=<hz>` | STFT sample rate. Default 22050. See *Frequency range* below. |
| `--profile=full\|app` | What to include. Default `full`. See *Export profiles*. |
| `--out=<dir>` | Package directory. Default `output/<id>`. |
| `--no-birdnet` | Skip species classification. Much faster. |
| `--publish` | Also install into `app/public/` so the viewer can open it. |
| `--force` | Export even if validation reports errors. |

### Not this, when you only want to look

The viewer's **Upload** tab analyzes a picked file in the browser and renders its 3D manifold
and spectral-centroid bar, with a button to download the numbers as JSON. It is the quick look,
not a replacement for this generator: it computes the point cloud, the similarity edges and the
per-frame centroid track and nothing else — no spectrogram or chromagram frames, no descriptor
series, no sandbox analysis, no BirdNET, no playback transcode, no validation, and no package
layout to upload. Its download is marked `kind: "browser-upload-partial"` with an
`omittedFields` list so it cannot be mistaken for one of these packages.

Everything from the STFT onwards is a verified port of this pipeline (`npm run verify:port`
checks it against an exported dataset); the decode and resample are the browser's rather than
ffmpeg's. See the 2026-09-10 amendment in `06_Technical_Architecture/Technical_Architecture.md`.

### Input formats

Anything ffmpeg can decode. The picker filters to
`.wav .mp3 .flac .ogg .oga .m4a .aac .aiff .aif .wma .opus`.

Analysis is unaffected by container choice — everything is decoded to mono float at the
analysis rate before the STFT. Container only matters for *playback*: see *Which audio ships*.

## Output package

```
output/<id>/
  acoustic-analysis.json     the payload below
  <original filename>        the source audio, byte-for-byte
  playback.mp3               ONLY when the source container is not browser-playable
  asset-package.json         index: file list, ids, validation result
```

`asset-package.json` is the upload manifest — walk its `files` array and you have uploaded
the package. It also repeats the few fields a backend needs without parsing the whole
analysis file (duration, sample rates, frequency range, top species, validation), plus an
`upload` block giving the S3 key pattern and the row fields that point at these two files.

## Export profiles

| Profile | Contains | Typical size (13 s clip) | For |
| --- | --- | --- | --- |
| `full` (default) | Everything the pipeline computes, pretty-printed. | 1224 KB | Local BirdSong viewer |
| `app` | Only the fields the XP Acoustics screen reads, minified. | 95 KB | Upload to production |

The `app` profile drops:

- `analysis` — pitch track, syllable segmentation, ACI, self-similarity matrix, soundscape
  indices. Read by the local sandbox gallery; the production screen never touches it. The
  self-similarity matrix alone is O(n²).
- `panels.frames`, `panels.chroma`, `panels.freqHz`, `panels.descriptors`,
  `panels.descriptorRanges` — the spectrogram/chromagram/gauge series. The production screen
  reads only `centroidTrack`, `hopSeconds` and `nyquistHz` from `panels`.

That is ~92% of the bytes for data the production screen does not open. Both profiles were
run through that screen's own `resolveCaptureMaxHz`, `derivePeaksFromAnalysis` and
`deriveCentroidSeries` and produce identical results — same 220-sample centroid series
(`origin: 'panels'`), same 72-bar waveform, same axis ceiling.

Do not publish an `app`-profile export to the local viewer (`--publish`): it will load, but
the spectrogram, chromagram, descriptor and sandbox panels will be empty. The CLI warns and
the web UI forces `full` when publishing.

## How it reaches production

The XP Acoustics screen does **not** read `audioUrl` out of the analysis JSON. Each clip is a
`sounds[]` entry on the `ACOUSTIC_BIRD` row's `additional_information_field`, holding two S3
*keys* which the screen signs on demand:

```json
{ "audioUrl": "<folder>/recording.wav", "analysisJsonUrl": "<folder>/acoustic-analysis.json" }
```

with `<folder>` = `public/<clientId>/acoustics/<xpId>/<slugified-bird-name>/`. The generator
cannot know `clientId`/`xpId` — the upload form supplies them — so `asset-package.json.upload`
gives the pattern and the bird-name segment it can derive. `audioUrl` in the analysis JSON is
used only by the local viewer; it is harmless but meaningless in production.

## Data contract

Two schemas describe the same file, from each end:

- [`app/src/types.ts`](../app/src/types.ts) → `RecordingPayload` — the full payload, as the
  local viewer consumes it.
- `revx-greencubes` → `XPAcoustics.shared.ts` → `AcousticAnalysisPayload` — the production
  screen's view. Every field optional, with a trailing index signature, so it tolerates both
  profiles and payloads exported before a field existed.

They agree. The production interface is a strict subset: it declares nothing this generator
does not emit. `contractVersion` is `1`; bump it on any breaking change.

### Identity and metadata

| Field | Required | Source | Notes |
| --- | --- | --- | --- |
| `contractVersion` | yes | generator | Refuse a major version you don't know. |
| `audioId` | yes | operator / filename | Links the analysis to its audio. |
| `audioUrl` | yes | generator | Path the app fetches. `/assets/<file>`. |
| `commonName` | no | operator | Free-text caption. Not an authoritative species record. |
| `generatedFrom` | yes | generator | Provenance: the input path. |
| `generatedAt` | yes | generator | ISO timestamp. |
| `pipeline` | yes | generator | Human-readable description of what was run. |
| `source` | no | ffprobe | The file's own rate/channels/codec/duration, pre-resampling. |

### Recording and analysis parameters

| Field | Meaning |
| --- | --- |
| `durationSeconds` | Decoded length. |
| `sampleRate` / `analysisSampleRateHz` | Rate the STFT ran at. Same number; the second name is unambiguous. |
| `source.sampleRateHz` | The recording's *own* rate. Usually different from the above. |
| `fftSize`, `samplingWindowSeconds`, `samplingHopSeconds` | Sampling grid. |
| `frequencyRange` | The band this export can honestly be plotted against. See below. |

### Calculated acoustic data

| Field | What it is |
| --- | --- |
| `panels.centroidTrack[]` | **Per-frame spectral centroid in Hz.** The spectral centroid series. Frame `i` is at `i * panels.hopSeconds`. |
| `panels.hopSeconds` | Sampling interval of every per-frame series. |
| `panels.descriptors` | Per-frame centroid, rolloff, bandwidth, flatness, flux, RMS, ZCR, crest, entropy, slope, freqMod, ampMod — raw physical units. |
| `panels.descriptorRanges` | `[min,max]` per descriptor, for gauge scaling. |
| `panels.frames[][]` | Normalized spectrogram cells (`freqHz` gives each row's center frequency). |
| `panels.chroma[][]` | 12 pitch classes per frame. |
| `spectralDescriptors` | Whole-recording means of the 8-axis descriptor set. |
| `points[]` | One continuous-sampling window each: `emissionTime`, `position` (PCA 3D), `amplitude`, `spectralCentroidHz`, `spectralFlux`, plus normalized companions. |
| `similarityEdges[]` | Index pairs — nearest neighbors in feature space, **not** temporal adjacency. |
| `analysis.pitch` | Fundamental-frequency track (harmonic product spectrum) + voicing. |
| `analysis.syllables` | Energy-based segmentation: per-syllable timing, count, repetition rate. |
| `analysis.aci` | Acoustic Complexity Index series + total. |
| `analysis.selfSimilarity` | Cosine recurrence matrix. |
| `analysis.indices` | ADI, AEI, BI, acoustic entropy, per-band occupancy. |
| `centroidMaxHz` | Recording's max spectral centroid — top of the 3D color legend. |
| `pcaExplainedVarianceTotal` | Quality signal for the 3D embedding. |
| `birdnetDetections` | Real BirdNET classification, or `null` if the model was unavailable. |

### Derived by the consumer, never exported

- **Audio waveform.** No PNG, SVG or peaks file is produced, and none should be — it would be a
  second copy of data already present that can go stale against the audio. The production
  screen re-bins `points[]` (`emissionTime` + `amplitudeNorm`, peak per bar) into its 72-bar
  envelope via `derivePeaksFromAnalysis`, so it needs no second download; when a clip has no
  analysis payload it falls back to decoding the audio with `derivePeaksFromSamples`. Either
  way the generator ships nothing extra.
- **The spectral centroid graph.** Built from `panels.centroidTrack` + `hopSeconds`, averaged
  down to 220 columns (`deriveCentroidSeries`). Averaged, not peak-picked — a centroid is a
  position in the spectrum, so the mean is the honest summary of a bin.
- **Colors, scales, axis ticks, tooltips, labels, layout.** Presentation.
- **Clip duration for playback.** Taken from the `<audio>` element, not from `source`.
- **Playhead state.** The consumer owns playback.

### Ownership of species / verification / conservation status

The generator emits exactly two species-related things, and both are claims about *this audio*:

- `commonName` — a free-text caption typed by the operator.
- `birdnetDetections` — what BirdNET inferred, with confidences and timestamps.

It deliberately does **not** emit taxon ids, IUCN status, or verification state — and this
matches where production already keeps them. In `revx-greencubes`, `AcousticBirdInfo` (the
`ACOUSTIC_BIRD` row's `additional_information_field`) owns `commonName`, `scientificName`,
`description`, `iucnStatus`, `iucnUrl`, `verificationName` and `verificationId`. All of it is
set in the upload form from a species picker, not read from the analysis JSON.

So the split is already settled and needs no change: **species identity, IUCN status and
verification live on the row; the export only describes the audio.** Duplicating them into the
export would create a second copy that silently goes stale. `birdnetDetections[].scientificName`
is available to pre-fill the picker, but it is a model's claim about this recording, not an
authoritative record.

## Frequency range: why the old range looked fixed at 0–8 kHz

Neither consumer was hardcoded to 8 kHz. Both scaled frequency axes to `panels.nyquistHz`,
which is the *analysis* Nyquist — and the analysis rate was a module-level constant here.
Earlier the pipeline analysed at 16 kHz, so every dataset reported a Nyquist of 8000 Hz and
every axis ran 0–8 kHz. The number was real, but it described the pipeline's setting rather
than the recording.

Two things were wrong with deriving the axis that way:

1. **Raising the analysis rate does not make the top of the axis real.** ffmpeg happily upsamples
   a 16 kHz file to 22050 Hz. The STFT then has bins up to 11025 Hz, but the source carries
   nothing above 8000 Hz, so the top ~3 kHz holds resampler artifacts. An axis drawn to the
   analysis Nyquist presents that as measured signal.
2. **The consumer had to know the pipeline's settings** to interpret the data.

The fix is for the generator to state the usable band explicitly rather than let it be inferred:

```json
"frequencyRange": {
  "minHz": 0,
  "maxHz": 8000,
  "analysisNyquistHz": 11025,
  "sourceNyquistHz": 8000,
  "bandLimited": true,
  "binWidthHz": 21.533203125
}
```

`maxHz = min(analysisNyquist, sourceNyquist)` — the highest frequency backed by real signal.
Consumers scale to `maxHz`; `bandLimited` tells them the source, not the analysis, was the limit.

The local viewer does this: `app/src/frequencyRange.ts` → `displayMaxHz`, falling back to
`panels.nyquistHz`. The spectrogram panel crops its bitmap to match, so image and axis labels
cannot disagree.

The production screen has the same logic in `XPAcoustics.shared.ts` → `resolveCaptureMaxHz`
(trying `frequencyRange.maxHz`, then `analysisNyquistHz`, then `panels.nyquistHz`, then
`analysisSampleRateHz / 2`), but **no component calls it right now**: it was the centroid
graph's axis cap, and that graph was removed. So `frequencyRange` is currently exported and
unread in production. It stays in the `app` profile anyway — it is a handful of bytes, it is
the honest answer to "what band is this", and it is what any frequency axis added to that
screen later must cap itself with.

What the production screen does scale per recording is its centroid colour key, via
`resolveCentroidColorMaxHz`. That is a different quantity — the highest centroid actually
present, not the capture ceiling — because a centroid is a weighted mean and sits well below
Nyquist; scaling the ramp to Nyquist would leave every point in its bottom third.

The analysis rate stays **22050 Hz by default** — deliberately, not by inertia. It covers
essentially all passerine song at ~21.5 Hz/bin; raising it spends resolution on a mostly-empty
top octave. It is now a per-run argument (`--analysis-rate`) for material that genuinely needs
more, and every export records what it used.

> One place is intentionally *not* parameterized: `extractContinuousWindows`, used by the
> behavior-comparison batch, pins the default rate. A feature vector there is a flattened
> spectrogram, so two recordings analysed at different rates are not in the same feature space
> and cannot share one PCA.

## Which audio ships

The **original source file, unmodified**, is what the app plays and what the package keeps. The
analysis runs on an internal mono resampled decode that is never persisted — so there is no
"processed version" a human could be given by mistake, and nothing to choose between.

The one exception: if the source container is not reliably playable in a browser (FLAC, WMA), the
package adds `playback.mp3` **alongside** the untouched source and points `audioUrl` at it. The
source stays because it is the scientific record; the transcode exists only so a human can press
play. Browser-playable sources are shipped as-is — no transcode, no generation loss, one file.

## Validation

`tools/lib/validate.js` runs before anything is written. Errors block the export; warnings don't.

Blocking: audio failed to decode, non-finite or zero duration, no points produced, non-finite or
all-zero spectral centroids, centroids above the analysis Nyquist (physically impossible),
non-finite 3D positions, empty or misaligned `centroidTrack`, invalid `hopSeconds`, missing
`frequencyRange.maxHz`, missing `audioId`/`audioUrl`, reducer non-convergence.

Warning: band-limited source, low PCA variance, very short recording, no syllables segmented,
BirdNET absent or silent, no species caption, source container not browser-playable (in which case a
playback copy is written automatically).

## What was reused, unchanged

The scientific processing is the project's existing code. `runContinuousSamplingPipeline` in
`export_single_recording_dataset.js` does all of it — decode, STFT, per-frame descriptors,
continuous windowing, amplitude filter, PCA, panels, `lib/analysis.js`, `lib/reducers.js`,
`lib/fft.js`, `lib/birdnet.js`, `lib/manifest.js`. The generator calls it; it did not
reimplement any of it.

That function was refactored so the analysis sample rate is a parameter instead of a module
constant (it previously baked into `FREQUENCIES`, the frame hop, and the panel Nyquist). At the
default rate the output is byte-for-byte identical to before — verified by diffing a full export
against a pre-refactor baseline. The three existing exporters (`export:recording`,
`export:sample`, `diagnose:external`) are untouched and still work.

## Open questions

- **Nothing here uploads.** The generator writes a package to disk; getting it into S3 and
  creating the `ACOUSTIC_BIRD` row is still the upload form's job in `revx-greencubes`. The
  package is shaped for that (flat, file index, `upload` key pattern), but no step in this repo
  talks to the bucket. Wiring one would need `clientId`/`xpId` and credentials that only the
  app has.
- **`--profile=app` was derived by reading the production screen, not from a spec.** The field
  list reflects what that code reads today (verified by running its own functions). If the
  screen starts reading `panels.frames` or the `analysis` block, the app profile has to grow
  with it. `full` is always safe.
- **Analysis rate policy.** 22050 Hz suits passerine song. Recordings with real content above
  11 kHz (some warblers, bats, insects) need `--analysis-rate` raised, and there is currently no
  automatic detection of that case — only the `bandLimited` flag for the opposite one. A check on
  how much energy sits in the top octave could suggest it.
- **`analysis.selfSimilarity.times`** is computed as `round(i * (spectra.length ? 1 : 0), 0)`,
  which yields frame indices, not seconds. Pre-existing; left alone since consumers may depend on
  the current values, but it is not what the field name implies.
- **Thresholds tuned per corpus.** The syllable and band-occupancy thresholds were retuned once
  already after a real field recording broke the originals
  (`08_Visualization_Sandbox/Field_Recording_Findings.md`). They are percentile-based now and so
  more robust, but they have not been validated across many recorders or habitats.
