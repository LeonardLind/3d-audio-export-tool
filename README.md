# Bird Song 3D Audio Export Tool

Core engine for turning bird-song recordings into a 3D visual sound shape.

This repository intentionally excludes the large local bird-sound corpus, generated app datasets, generated audio copies, build output, dependencies, and downloaded BirdNET model files. The code is enough to install the project on another computer and regenerate visualization datasets from recordings available there.

## What Is Included

- `app/` - React, Vite, Three.js viewer for the 3D acoustic manifold.
- `tools/` - Node scripts for feature extraction, BirdNET classification, reducer experiments, and visualization dataset export.
- `tools/GENERATOR.md` - the Acoustic Asset Generator: audio in, analysis JSON + audio out, and the data contract shared with the XP Acoustics screen in `revx-greencubes`.
- `01_...` through `08_...` - project notes, benchmark design, architecture notes, and decision logs.
- `manifest_*.csv` and `05_Benchmark_Results/` - lightweight benchmark metadata/results.

## What Is Excluded

- `Assets/` - raw field recordings and bulk CSV exports.
- `sample-test-audio/` - local test recordings.
- `app/public/assets/` - generated/copy-served audio files for the viewer.
- `app/public/data/*.json` - generated visualization datasets and manifest.
- `app/dist/` - generated Vite build.
- `node_modules/` and `app/node_modules/`.
- `tools/models/` - BirdNET model files downloaded on first use.
- `output/` - generated asset packages from the Acoustic Asset Generator.

## Setup On A New Computer

Install dependencies from the repo root:

```sh
npm install
cd app
npm install
```

Install `ffmpeg` and make sure it is available on `PATH`. The export and BirdNET scripts call `ffmpeg` directly.

## Run The Viewer

From `app/`:

```sh
npm run dev
```

The viewer expects exported data in `app/public/data/manifest.json`. If there is no generated dataset yet, create one with one of the export scripts after adding local audio files.

## Generate Visualization Data

For an arbitrary recording, use the Acoustic Asset Generator. It runs the same pipeline as the
export scripts below, but takes any audio file, validates the result before writing, and emits a
self-contained package (analysis JSON + the audio it describes). See `tools/GENERATOR.md`.

```sh
npm run generate:ui                              # file picker + preview at http://127.0.0.1:5184
npm run generate -- recording.wav --publish      # command line; --publish opens it in the viewer
```

The original per-dataset export scripts remain for the project's own datasets:

```sh
npm run export:sample
npm run export:recording
npm run export:viz
```

BirdNET model files are downloaded automatically into `tools/models/` the first time a script needs species classification.

The project keeps generated datasets and audio out of git so the repository stays small and portable.
