# v2 resumption checkpoint — 2026-09-30

The core Acoustic Cloud viewer is integrated and running locally. This is a
working implementation checkpoint; the full viewer acceptance list and the
25 experiment work items are not all complete.

## Viewer

Implemented across WP0–WP11:

- Matte cloud at rest, up to 40 nonoverlapping frequency labels, seven axis
  subsets, flat cameras, fit, hover and A/B selection. Retired modes, glow and
  comet code are removed. The preserved v0.7 shader and constants have tests.
- Published recordings and uploads use the same viewer. Switching a recording
  resets audio and selection. Request revisions prevent late network or worker
  responses from replacing a newer choice.
- Native playback, time-based reveal, accessible seeking and Show all.
- Measured comparison cards; development preview adds exact-slice playback,
  loop, sequence, waveforms, a red playhead and preview edges in xyz.
- Uploads retain the complete mono 22050 Hz PCM while transferring a separate
  copy to the worker. Listening uses an IEEE float WAV of that retained buffer.
  The self-check rejects off-grid spans and requires exact per-point RMS matches.
- JSON view and analysis downloads, plus PNG capture of dots and labels. PNGs
  taken in owner preview retain the development warning.
- Closed acceptance/copy locks, forged-payload tests, source-isolation checks,
  branded gates and a production-bundle leak guard. All acceptance entries are
  null and all approved-copy entries are false.

The local published data now has readable names: Bluethroat (13.7 s), Blackbird
(40.3 s), Blackcap (104.2 s). Only display names changed in these ignored local
assets; point data and analysis remain intact.

### Viewer work still open

WP2, WP7, WP10 and WP11 still have acceptance work. The full copy registry and its
coverage check, accepted-results file verification, future evidence-backed
readouts (view quality, axis captions/loadings and descriptions), simulated
evidence demonstrations, and independent review of future gate schemas remain.
Current production locks keep those features hidden.

WP4 still needs a deliberate visual check of camera-swap continuity and the
specified GPU performance check at 700 points. Tests confirm all seven views
settle, but do not establish 60 fps or perceptual smoothness. No listening-by-ear
timing certification or Experiment 012 browser-format certification is claimed.
The original walkthrough's other fixture recordings have not all been tested;
the three owner-selected local recordings were checked.

WP12 is the separate, approval-dependent historical documentation amendment.
HANDOFF_v2.md and Technical_Architecture.md were not changed by this continuation.

## Scientific groundwork

Five of the 25 work items have implementations and passing focused tests:

| Item | Implementation |
| --- | --- |
| W01 | Philox4x32-10 and official reference-vector tests |
| W02 | Explicit Philox paths in metrics, reducers and synthesis; legacy paths preserved |
| W08 | Complex radix-2/Bluestein FFT and deterministic phase surrogates |
| W10 | Version-checked exact symmetric EVD PCA with reconstruction/reference tests |
| W22 | Bitwise standardization agreement and explicit rank-context behavior |

W03–W07, W09, W11–W19 and W21–W25 remain, except the above completed items.
W20 is optional. Installing Playwright completes only the dependency portion of
W16. No experiment runner, owner freeze, result acceptance or human review has
been invented. No governing experiment was run.

Recommended next bounded assignments: W05 gap-excluded trustworthiness, W07
cluster bootstrap and W09 subspace/lag helpers. Give each a Sol/medium worker,
its notebook excerpts and separate file ownership. Coordinate edits to metrics.js
sequentially. W04 needs the C02 recording convention resolved before its freeze
writer can be finalized. Runners follow reviewed helpers and seed/freeze guards.

## Plan checks

The independent amendment review passed shared-text equality and preservation of
the original rules after the seven drifts and undefined C36 references were
repaired. All six notebooks contain the intended 35 amendments.

The parent subsequently added 012's missing external-amendment hash closure.
That specific follow-up still needs independent review. The C02 requirement that
a commit contain its own hash remains an implementation blocker for producing
freeze sidecars; use a reviewed, documented convention before any freeze.

## Verification

- App: 50 tests passed; TypeScript build and production leak guard passed.
- App lint: passed.
- Root: 116 passed, one existing skip, zero failures.
- Bluethroat browser/exporter parity: `PARITY OK`, 234 points, 540 edges.
- Notebook structural checker: six notebooks, 35 amendments, shared texts agree,
  no undefined amendment reference in the governed amendment sections.
- Chromium walkthrough: 40 checks passed, zero console/runtime errors. Includes
  real pointer picking, all views, natural playback end, preview loops/sequence,
  downloads, 375 px layout, DPR 2, reduced motion, both request directions, repeat
  uploads, and production preview isolation.
- Browser upload: all 302168 retained samples equal the samples decoded from its
  listening WAV; all 234 dots pass the RMS/span self-check. This browser decode is
  not claimed identical to the separate ffmpeg decode.

Run details and images are local artifacts in `output/viewer-check/`. The reusable
walkthrough is `tools/check_viewer_browser.mjs`.

## Agent routing and workspace

Luna/medium handled the small standardization test. Sol/medium handled data,
export and UI work; Sol/high handled audio/RNG and rendering. Astra was reserved
for the cross-notebook methods audit. Future small tasks should keep those lighter
settings rather than inheriting Astra/high effort by default.

The agents hit the shared usage limit after saving their work. The parent finished
the integration and browser checks locally. No background agent is still building
the remaining packages. Branch remains `v.2.0`; no commit was created and the
pre-existing working tree was preserved. The numerical browser analysis and
`app/src/types.ts` are unchanged.

## Claude resumed, 2026-09-30

- Re-verified independently: root tests 116 pass / 1 skip / 0 fail; app build, tests,
  lint and production leak guard pass; `PARITY OK`; evidence locks all closed;
  `app/src/analysis/**`, `app/src/types.ts` and the exporters unchanged.
- The 52 issues from the interrupted 2026-09-29 verification round were re-checked
  against the current notebooks: 32 were already resolved; the remaining 20 and five
  problems in the earlier repair were fixed as dated 2026-09-30 additions
  (checker: 9 dated additions, shared texts agree; preservation check: only
  Date/Status lines of original text changed).
- Owner decisions 2026-09-30 (recorded in the notebooks): OD-6 seedless deterministic
  PCA with a zero-draw test; OD-7 accept the stricter C14 (a view non-pass in 008 stays
  withheld until 007 has run and the 007/008 check passed); OD-8 two-commit freeze.
- Open design issue for the 011 runner (low priority): a closed-form
  near-constant-loudness decoy may reproduce the genuine fixture's amplitudes exactly,
  which would fail 011's release assertion (2). Resolve before 011's freeze.
- Today's notebook additions have been checked structurally and spot-read; each
  experiment's freeze still requires its own independent review.
