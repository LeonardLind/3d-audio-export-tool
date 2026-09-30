# Recovered v2 plans

**Current progress:** see [STATUS.md](STATUS.md), updated 2026-09-30.
The starting-state notes below are historical.

This directory preserves the implementation plans recovered from the interrupted
Claude session. The research notebooks remain the authority for experiment rules.
These files are implementation plans, not experiment results or owner freezes.

## Recovered plans

- `viewer_design_final.json`: the final viewer design from the previous session.
- `viewer_wps.json`: the original 12 packages, WP0 through WP11, and dependencies.
- `amend_spec.json`: the amendment specification and 25 experiment work items.
  It predates some notebook corrections; read the current notebooks first.

The originals came from the project-specific scratchpad for session
`4cf80e01-540c-4626-8118-ccf20ce32d55`. They were copied unchanged.

## Starting state verified in this session

- Branch `v.2.0`, HEAD `fec9d2d`; no commits requested or created.
- All six notebook amendment edits are present but their consistency review was
  unfinished. Seven shared amendment texts differ across notebooks, and 008
  references an undefined C36. These require correction before any freeze.
- W01 (`tools/lib/rng.js`) exists with 11 passing Philox tests.
- Root suite: 98 passed, 1 skipped, 0 failed (99 total).
- Bluethroat browser/exporter check: `PARITY OK`, 234 points, 540 edges.
- Three published local recordings remain available: Bluethroat, Blackbird,
  Blackcap. The viewer implementation had not yet landed.

## Resumed work

| Work | Agent model / effort | Initial scope |
| --- | --- | --- |
| Notebook audit | Astra / inherited effort | Independent read-only methods review |
| Viewer foundation | Sol / high | WP0 contracts, state, test harness, shell and old-mode removal |
| RNG integration | Sol / high | W02 opt-in Philox paths, with legacy behavior preserved |

Small follow-up tasks use Luna / medium; substantial implementation uses Sol.
Astra is reserved for difficult methods review and integration review. Tasks run
in dependency order with distinct file ownership; no separate agent is needed
for every file or every check.

## Gates that remain in force

No experiment has run in this resumed session. Governing runs require reviewed
runners, the notebook prerequisites, and the owner's per-experiment freeze.
No result, approval, human review, or caption decision may be invented.
Visitor evidence gates remain closed until their accepted evidence and required
copy checks exist. Owner preview stays development-only. Experiment 011 human
review remains lower priority than the visual work, per the recorded owner choice.

The next build packages after WP0 are independent WP1, WP2, WP3, WP9 and WP10
(subject to their listed dependencies); rendering and audio follow their inputs.
This is a resumption checkpoint, not a claim that all viewer packages are done.
