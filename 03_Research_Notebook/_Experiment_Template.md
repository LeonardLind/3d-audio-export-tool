# Experiment [NNN] — [Short Title]

**Date:**
**Work Package:** (WP1 / WP2 / WP3 / WP4 / WP5 / WP6 / etc.)
**Related Decision Log ID(s):** (e.g. D-010)
**Status:** Planned / Running / Complete / Abandoned

⸻

## Question

What specific, answerable question is this experiment trying to resolve? (Not a general topic — a question with a real "no" available as an answer.)

## Hypothesis

What do we expect to happen, and why? State it precisely enough that it could turn out to be wrong.

## Method

* Dataset / subset used:
* Procedure:
* Metrics used to evaluate:
* Negative control type used (e.g. shuffled labels / synthetic random data):
* Negative control random seed:
* Negative control metric name:
* Negative control numeric result:
* Negative control threshold:
* Negative control pass/fail:
* Label-exposure risk step: which specific fitting step could have seen labels?
* Label-exclusion verification: how was exclusion verified? (Example: "labels not passed as a variable anywhere in the fitting function — verified by code inspection on [date].")

## Expected Outcome

What result would count as support? What result would count as a failure, per the Failure Criteria chapter in v0.4?

⸻

## Results

(Fill in after running. Numbers, tables, or figure references — link to `05_Benchmark_Results/` rather than duplicating large tables here.)

## Unexpected Observations

(Anything that didn't fit the hypothesis, even if not directly relevant — these often matter later.)

## Discussion

What does this actually tell us? Be explicit about what it does *not* tell us too.

## Decision

Continue / Reject / Needs more testing — and which Decision Log entry (if any) this updates.

## Reproducibility Notes

Enough detail (code version, random seed, exact dataset subset) that this experiment could be rerun and should produce the same result.
