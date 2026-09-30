# Acoustic Cloud

A browser viewer for the measured points of a recording. The current viewer uses
one Matte cloud, with X/Y/Z controls for all seven nonempty axis subsets.

## Run and check

From `app/`:

```powershell
npm run dev -- --port 5183
npm test
npm run lint
npm run build
npm run preview -- --host 127.0.0.1 --port 5184 --strictPort
```

Build runs the tests, TypeScript checks, Vite and the production leak guard.
Playwright is a root development dependency. With both servers running, run from
the repository root:

```powershell
node tools/check_viewer_browser.mjs
node tools/check_v2_plan_consistency.js
npm test
node tools/verify_browser_port_parity.mjs Assets/smoke/Luscinia_svecica_song.ogg app/public/data/dataset_bluethroat_smoke.json
```

The browser check writes its JSON report and screenshots to
`output/viewer-check/`. It expects the three local published demo files and their
original audio assets. `VIEWER_DEV_URL` and `VIEWER_PROD_URL` override the ports.
Install the test browser once with `npx playwright install chromium` from the root.

## Open a recording

- `?dataset=bluethroat_smoke` selects the local Bluethroat demo.
- `?dataset=blackbird_inat_168505` selects Blackbird.
- `?dataset=blackcap_inat_376675` selects Blackcap.
- `?view=xy` chooses a starting view. Valid values: `x`, `y`, `z`, `xy`, `xz`,
  `yz`, `xyz`; invalid values use `xyz`.
- `?preview` enables owner preview in development only. A production build ignores
  this parameter and excludes the owner module and its wording.

The recording menu and Analyse a file accept audio uploads. Upload analysis uses
the existing browser worker. Its retained mono samples are kept separately from
the transferred worker input. View JSON preserves the underlying points and edges;
analysis JSON preserves the existing upload export contract.

## Controls

Click a dot for A, then another for B. Later clicks replace B; Shift-click replaces
A. Escape clears the pair. X/Y/Z toggle axes, F fits the cloud, and Space toggles
main playback when focus is outside an interactive control. At least one axis
stays enabled. Arrow keys on the seek slider move by one second.

The whole cloud appears at rest. Main playback reveals points in time; pausing
keeps that reveal position. Show all restores all dots, and the natural end also
restores them. Rotate toggles the idle 3D rotation. Selecting a dot pauses rotation.

## Available now and pending evidence

Visitors can see the cloud, measurements, frequency key, published-recording
playback, comparison values, uploads and downloads. Current evidence and copy
acceptance records are all closed. Similarity edges, moment playback, waveform
strips, upload listening, interpretive axis labels, view-quality statements and
generated descriptions remain hidden from visitors.

Owner preview adds a visible warning, experimental edges in xyz and moment audio
when a valid grid-derived span and matching decoded buffer exist. Uploaded audio
must pass an exact RMS/span self-check. Uploaded listening uses the retained
analysis-rate mono buffer. These checks do not substitute for Experiment 012.
Keys 1, 2 and L control preview moments and looping. Main and moment playback are
mutually exclusive. Preview PNGs retain the warning.

The acceptance lock is `src/evidence/accepted.ts`; the gate evaluator is
`src/evidence/gates.ts`. A payload cannot approve itself. Opening a visitor gate
requires independently verified experiment results and the required wording
review. Future evidence-backed readouts are still implementation work.

See [the current resumption checkpoint](../plans/v2/STATUS.md) for completed work,
remaining packages and the limits of the checks. Nothing has been committed or
released by this resumption.
