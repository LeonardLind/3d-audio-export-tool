⸻

# Technical Architecture

**Status:** v1 — first implementation specification, scoped to the Option A/B first build (per D-002 staging note in `01_Master_Framework/v0.4_Final.md`).

**Gating note:** Per the (now superseded) note in this folder's `README.md`, this document was withheld until D-004, D-009, and D-010 in `07_Decision_Log/Decision_Log.md` moved from Pending to Adopted. As of this writing, D-004 (Embedding Algorithm Selection → PCA) and D-010 (Acoustic Feature Set → raw flattened spectrograms) are **Adopted**. D-009 (Segmentation Methodology) is still recorded as **Pending prototype**, not Adopted. This document proceeds anyway because nothing specified here depends on segmentation: the visualization pipeline described below operates at the Frame/Recording level only (one point per detected vocalization event), not at the Syllable/Phrase level that D-009 governs. If a future version of this architecture needs Syllable/Phrase-level structure, D-009 must close first.

⸻

## Decision

**Frontend:** Vite + React + TypeScript, rendering 3D scenes via **react-three-fiber** (React bindings for three.js), with `@react-three/drei` for standard helpers (orbit controls, etc.).

**Data pipeline:** The existing Node.js benchmark/feature-extraction scripts in `tools/` (signal processing, feature extraction, PCA) remain exactly what they are — **offline, one-shot preprocessing scripts**, run from the command line, never shipped to or executed in the browser. Their job ends at producing a static, versioned JSON dataset. The web app's only job is to fetch and render that JSON.

```
Audio (Assets/) ──▶ tools/*.js (Node, offline) ──▶ static JSON dataset ──▶ app/ (Vite/React/r3f, browser)
                     [signal processing,              [one file per point:
                      feature extraction,               position, color, size]
                      PCA reduction]
```

This is a strict one-way boundary: the browser never runs FFTs, PCA, or touches raw audio. It only reads a small, already-reduced JSON file and draws it.

⸻

## Rationale

Evaluated against the Decision Principles in `01_Master_Framework/v0.4_Final.md` (Empirical validity → Internal consistency → Transparency → Explainability → Reproducibility → Maintainability → Extensibility → Computational efficiency → Visual clarity, in that priority order):

**1. Empirical validity.** D-004 and D-010 were decided empirically (Experiments 002/004/006 on raw spectrograms + PCA, with mandatory negative controls per D-006). Nothing about choosing a *rendering* stack should re-open or duplicate that already-validated computation. Keeping the Node scripts as the single source of truth for feature extraction and PCA means the numbers on screen are traceable to the exact benchmarked pipeline, not a reimplementation of it in browser JavaScript.

**2. Internal methodological consistency.** Re-implementing STFT/PCA in-browser (e.g. via WebAssembly or Web Audio) would mean maintaining two parallel implementations of the same math — one for benchmarking (Node), one for production rendering (browser) — with real risk of silent numerical drift between them. A single Node-based pipeline avoids that split.

**3. Transparency.** The offline export script is a plain, readable Node file sitting next to the other `tools/*.js` experiment scripts, using the same helper library (`tools/lib/reducers.js`) already used for the adopted PCA benchmark. Anyone auditing "why does this point sit here" can read one script, not a bundled/minified browser build.

**4. Explainability.** The per-point JSON schema (below) is a flat, human-readable structure. A non-expert can open the file and see exactly what each point's position/color/size came from — no hidden state, no client-side derived computation.

**5. Reproducibility.** Running the export script against a given manifest + selected-window CSV always produces the same JSON (PCA here is deterministic given the input matrix — no random initialization dependent on wall-clock time). The dataset is a versionable artifact, diffable in git, regenerable on demand.

**6. Long-term maintainability.** Vite + React + TypeScript is a mainstream, well-documented stack with a large ecosystem, fast dev-server iteration, and static typing to catch schema mismatches between the exported JSON and the renderer. react-three-fiber is the standard way to use three.js declaratively from React, avoiding hand-rolled imperative three.js scene management.

**7. Extensibility.** This shape scales cleanly toward the Option C target architecture (`Recording → Feature Database → Metrics → 3D Visualization → Interactive Analysis → Scientific Conclusions → Reporting`, D-002): the static-JSON step is a placeholder for what becomes a real feature database / API later, without requiring the rendering layer to change. Swapping the reducer from PCA to UMAP later (per the still-open Embedding Benchmark scope in D-004) only touches the export script, not the app.

**8. Computational efficiency.** Signal processing (STFT, PCA over a 150×~15,000-dimension matrix) is genuinely expensive; doing it once offline in Node and shipping a tiny reduced JSON (a few KB) keeps the browser bundle small and the app fast on any device, instead of asking every visitor's browser to redo that work.

**9. Visual clarity.** react-three-fiber + drei gives orbit controls, instancing, and glow/emissive materials with minimal code, sufficient for the Core Philosophy's Visual Channel Convention (position/color/size/edges) without custom WebGL.

### Alternatives considered (not adopted, kept on record)

- **In-browser signal processing (Web Audio API / WASM FFT + client-side PCA).** Rejected: duplicates already-validated Node logic, adds browser-side numerical risk, and buys nothing since the dataset is small and static for this phase. Would only become attractive if the product needed users to upload and analyze *new* audio live in-browser — not the case yet (Option A/B scope).
- **Server-rendered / non-JS 3D (e.g. a Python-based dashboard with a WebGL export, or a desktop-only tool).** Rejected: breaks the "interactive, shareable, web-first" direction implied by the Option C target and the "explainable to a non-expert" principle — a browser link is the lowest-friction way to let a reviewer or collaborator actually rotate the manifold.
- **Bundling the full Node feature-extraction pipeline into a backend API called live by the frontend.** Deferred, not rejected: this is the natural Option C direction (a real Feature Database + API), but building it now would be architecting ahead of validated science, which the Product Vision staging note explicitly warns against. The static-JSON approach is the intentionally narrower first step.

⸻

## Per-Point Data Schema

Matches the Visual Channel Convention in v0.4's **Core Philosophy** section exactly:

| Channel | Source | Field |
|---|---|---|
| Position (x, y, z) | First 3 components of the PCA embedding (D-004) fit over the raw flattened spectrogram feature matrix (D-010) | `position: [x, y, z]` |
| Color | Dominant frequency band at the sample's peak-amplitude frame (single-recording/comparison view — not identity, since these 150 samples span multiple species/recordings and no identity-comparison claim is being made here) | `color: { dominantFrequencyHz, t }` (`t` = 0–1 normalized position along the blue→green→red gradient) |
| Size | Signal amplitude (RMS of the selected 1s window, scaled 0–1 across the dataset) | `size: amplitudeNorm` |
| Edges | Temporal adjacency | connect points in chronological order of recording timestamp (see caveat below) |

```json
{
  "id": "4_2MM06988_20250401_160000",
  "commonName": "Cliff Flycatcher",
  "position": [1.23, -0.87, 0.14],
  "amplitude": 0.031957940814354775,
  "amplitudeNorm": 0.42,
  "dominantFrequencyHz": 3125,
  "colorT": 0.31,
  "timestamp": "2025-04-01T16:00:33.400Z"
}
```

**Temporal-adjacency caveat:** the reference project's "path through time" convention describes consecutive *frames within one continuous recording*. These 150 points are independent detection events, often from different recordings and individuals. This first build orders points by absolute recording timestamp and draws a single chronological path as a visual placeholder for that convention — it is **not** a claim about biologically meaningful continuity between unrelated detections, and should be revisited once segmentation (D-009) and per-recording trajectories exist.

⸻

## Repository Layout

```
BirdSong_Project/
  tools/
    export_visualization_dataset.js   # offline: audio -> spectrogram -> PCA -> JSON (this doc's pipeline)
    run_experiment_006_loudest_window_wp2.js   # unchanged, still the benchmark script
    lib/reducers.js                   # shared PCA/UMAP helper, reused by the export script
  05_Benchmark_Results/
    experiment_006_loudest_windows.csv   # source: selected 1s windows per sample
  app/                                 # Vite + React + TypeScript + react-three-fiber
    public/data/points.json           # generated dataset, fetched at runtime
    src/
      components/PointCloud.tsx       # r3f scene: spheres, color/size mapping, orbit controls, path lines
      App.tsx
```

⸻

## Amendment (2026-07-21): Continuous Sampling, Similarity Edges, Supplementary Panels

The single-recording view (`tools/export_single_recording_dataset.js`) changed from one point per BirdNET-detected call (~20 points) to continuous fixed-grid sampling across the whole recording (~400 points: a 0.5s raw-flattened-spectrogram window every 0.15s hop, PCA top-3 fit on this recording's own points). This is a real change in what a "point" represents, not just a density tuning knob:

- **Before:** each point was a specific BirdNET-labeled vocalization event; per-point species label was meaningful.
- **Now:** each point is an arbitrary fixed-length audio slice on a uniform time grid — it may contain a call, silence, or background noise. Per-point species labels are no longer meaningful, so the species caption moved to a single whole-recording-level field (`commonName`, the modal BirdNET label across that recording's own detections >0.5 confidence), matching the reference video's bottom-caption style rather than a per-point label.

**New edge channel — similarity edges.** In addition to the existing temporal-adjacency path (Core Philosophy: "Edges → temporal adjacency"), the single-recording view now also draws k-nearest-neighbor edges in the 3D PCA embedding (`similarityEdges` in the export payload), excluding candidates within 1.5s of each other in time (otherwise, given ~70% window overlap between adjacent samples, "nearest neighbor" would just re-draw the temporal path and add no information). This is an **addition to**, not a departure from, the Visual Channel Convention: both edge types represent real, measured relationships between points, per Core Philosophy ("If a connection exists, it represents a meaningful relationship"). The two are kept visually and semantically distinct in code (`FadingLine` call sites in `PointCloud.tsx`) and should be treated as two separate documented edge types if this pattern is promoted back into `01_Master_Framework/v0.4_Final.md`.

**Supplementary, non-adopted-feature panels.** Two new side panels were added, both explicitly out of the position/color/size pipeline:
- *Spectral Descriptors* — a radar chart of the inherited 8-axis descriptor set (spectral centroid, spread, entropy, crest, slope, frequency modulation, amplitude modulation, tonality), averaged across the whole recording. This is the descriptor set D-010 found does **not** pass the negative control — it is shown for context/comparison only and never drives position, color, or size.
- *Centroid-Amplitude Profile* — a scatter plot of per-point spectral centroid vs. amplitude, filling in progressively with the same `emissionTime <= currentTime` filter as the 3D view.

**Transparency note (Information Preservation Reporting, per Open Decisions in v0.4):** with ~400 points and a ~7,967-dimension raw-spectrogram feature vector, the top-3 PCA components for this recording currently explain only a small fraction of total variance (`pcaExplainedVarianceTotal` in the export payload, typically a few percent) — consistent with Experiment 006 needing 88 components to reach the 95% target on the cross-recording benchmark. This is exposed in the payload rather than hidden, per the "Why 3D?" open question — 3D is used here for direct visualizability, not because it was shown to preserve most of the structure.

⸻

## Open Items (not resolved by this document)

- Real feature database / API layer (Option C) — deferred per Product Vision staging note.
- Reducer choice beyond PCA (UMAP/t-SNE) — D-004 remains "Adopted, revisitable"; the export script should stay swappable via `tools/lib/reducers.js`'s existing `method` setting.
- Segmentation-aware temporal adjacency (per-recording trajectories instead of one global chronological path) — blocked on D-009.
- Information Preservation reporting in the UI (explained variance, etc.) — not yet surfaced to the viewer; currently only in benchmark JSON outputs.
