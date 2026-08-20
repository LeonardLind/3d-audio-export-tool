# TODO

## Real Individual-Bird Ground Truth

Get human-confirmed individual-bird labels if they ever become available. This is required to properly test Level 2 Individual Bird clustering; filename IDs currently appear to be recorder/deployment IDs, not birds. Act when there is independent individual-level ground truth for repeated recordings.

## Segmentation / Silence Issue

Initial fix tested in Experiment 006: select the loudest 1000 ms sub-window inside each BirdNET detection interval instead of always taking the first second. This improves the stopgap and manual spot-checks, but it is not validated segmentation because loud non-bird noise can still win. Act by keeping this rule as the current stopgap and later replacing it with a validated segmentation method.

## D-009 Segmentation Methodology

Prototype an existing segmentation approach such as TweetyNet or an amplitude/energy-threshold baseline. This matters because the Frame to Syllable/Phrase transition is still unresolved. Act when there are annotated boundaries or a small expert-checked subset to compare against.

## UMAP Retest At Larger Scale

UMAP may need more data than the current 150-sample benchmark to compete with PCA. It failed the negative control at 22 samples, passed at 150, but still scored below PCA. Retest if the dataset grows past about 500 matched samples.

## Perch Rows

Perch-model rows are currently excluded because their window sizes and row semantics do not align cleanly with BirdNET rows. They may add usable data later. Act when perch-vs-BirdNET window alignment is defined and a fair dedupe/selection rule exists.

## Recording-Condition Confound

Experiment 005 suggests device/location/recording-condition fingerprints are present. This matters because manifold differences may reflect recorder, microphone, site, distance, or habitat acoustics rather than biology. Act when metadata for device, location, microphone, date/time, and habitat is available for variance/confound testing.

## Species Validation Against Independent Labels

Current species labels are model-derived, mostly BirdNET-based. This risks circular validation if the manifold recovers classifier cues rather than biological truth. Act when a human expert spot-check or independent label source is available.

## Seasonal / Time-of-Day Comparisons

The framework proposes seasonal and temporal acoustic-shape comparisons, but these have not been tested. This matters for ecological monitoring claims. Act when enough balanced recordings exist across dates, seasons, or time-of-day bins with controlled device/location metadata.

## Average Manifold Methodology / D-001

Density-cloud KDE is adopted conceptually but still pending empirical validation against alternatives such as DTW/time-aligned averaging. This matters for group-level comparisons. Act after segmentation and shared embedding spaces are stable enough to compare averaging methods.

## Negative Controls For Every New Pipeline

Every future feature/reducer/segmentation/visualization claim needs a matched negative control. This matters because reducers can produce convincing structure from random data. Act by adding shuffled-label or random-feature controls before interpreting any new cluster or separation result.

## t-SNE Implementation Check

The current `tsne-js` runs reported suspiciously low iteration counts and unstable results. This matters before accepting or rejecting t-SNE. Act by retesting with a more reliable implementation if t-SNE remains a serious candidate.

## 3D Display Versus Higher-Dimensional Analysis

The adopted PCA reducer may need many components for fair preservation, while visual display is usually 2D/3D. This matters because forcing 3D can change benchmark outcomes. Act by separating analysis-dimensional embeddings from visualization projections.

## Audio Quality Acceptance Criteria

The framework flags audio quality assessment as unresolved. This matters because noisy or clipped recordings can dominate raw spectrogram features. Act by defining measurable acceptance criteria for clipping, SNR, duration, and background noise.

## Swappable Reducer Until Larger Retest

PCA is adopted and currently default, but UMAP remains behind the reducer setting. This matters because the decision is explicitly revisitable. Act by keeping `tools/lib/reducers.js` setting-driven until a larger benchmark justifies locking one reducer.

## VAE Candidate Deferred

The from-scratch VAE candidate remains deferred from Experiment 001. This matters because it could become a useful unsupervised feature representation but adds training failure modes. Act only after the raw-spectrogram/PCA baseline is stable on larger, cleaner data.

## Expert Usefulness Review

The framework requires independent experts to find outputs useful before ecological claims are trusted. This has not happened. Act when there are stable visual outputs and a structured expert-review protocol.

## Metadata Inventory

Create a clear inventory of available metadata fields across S3/downloaded assets. This matters for every Level 2-4 validation question. Act by extracting recorder ID, location/site, date/time, model source, species label source, and any microphone/deployment metadata into a searchable table.
