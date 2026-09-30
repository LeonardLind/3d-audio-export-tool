# Amendment audit: Experiments 007–012

Date: 2026-09-29. Read-only methods review; notebook and code files were not edited. References below use the working-tree line numbers at this review.

## Verdict

**Not ready to freeze or run.** The six notebooks contain all 35 amendments in `amend_spec.json`, but seven shared Change texts diverge, and Experiment 008 references an absent C36. Independent utility implementation and unit tests can continue while these are repaired.

I read `HANDOFF_v2.md`, compared all six notebook diffs against HEAD, compared every repeated Change paragraph, checked amendment coverage against `plans/v2/amend_spec.json`, and checked the relevant production APIs. No applicable `AGENTS.md` was found in the repository or its ancestors. No experiment or corpus computation was run.

## Required harmonization

Preserve notebook-specific notes. Synchronize the shared Change paragraph for each ID, then record the verification repair in each affected revision log. The recovered amendment specification predates several stricter notebook corrections; do not overwrite the notebooks wholesale from it.

| Amendment | Source to preserve | Affected notebooks and reason |
|---|---|---|
| C01 | 012:551 | Copy to 007, 008, 009, 010, 011. Only 012 clarifies that deterministic PCA needs no invented seed and must consume none. Its existing production route is intentionally seedless. |
| C03 | 007:466 | Copy to 008:482, 010:532, 011:424. Only 007 explicitly prevents its own fail verdict from being relabelled inconclusive. Example: a 007 CI [0.01, 0.03] fails the unchanged 007 rule, but the other copies permit the inconclusive label. Statistical verdicts and consequences must stay unchanged. |
| C13 | 008:549 | Copy to 007:526 and 012:653. It explicitly requires `makeRankContext(X, { standardize: true })`. The other copies incorrectly say the default call standardizes internally. `tools/lib/metrics.js:260` defaults this option to false. |
| C14 | 008:556, with the display conflict resolved below | 007:535 and 012:663 omit 008's paragraph retaining non-pass labels during the cross-check hold. Do not propagate it without explicitly retaining C24/C26 and human-review gates. |
| C17 | 007:556 (same shared text in 009, 011 and 012) | Replace 008:570. Its claim that no descriptor or other metric was computed is broader than the recorded disclosure and actual front-end behavior. The fuller version distinguishes internally computed spectral values from inspected outcomes. |
| C20 | 010:576 | Copy to 008:577, 011:493 and 012:688. Only 010 withholds the dependent feature as well as an unaudited caveat or mandatory warning. |
| C22 | 010:591 | Copy to 011:509. Only 010 requires its mandatory labels-disabled statement to be audited before raw correlations/loadings are shown to visitors. 011 currently permits the numbers and picture alone. |

### Missing C36 and display precedence

Experiment 008 references C36 at lines 447, 484 and 497, but no C36 subsection exists in any notebook or in the recovered amendment specification. C02's external-amendment rule at 008:472 explicitly rejects an ID that is neither recorded locally nor hashed from another notebook. This is a hard freeze-validation blocker.

There is also a concrete display-rule conflict to finish resolving: C14 in 008 says retain available non-pass labels before a consistency check passes; C24 in 011:537 and C26 in 011:562 fail the evidence/template gates closed until the checks pass and both experiments are decided. C20 prohibits unaudited strings. The strict resolution is to hide a visitor-facing view whenever its required warning, numbers or audited template cannot legally be displayed, retain every non-pass outcome in research records, and never turn a pending/suspended view into a pass. Complete a dated C36 with this precedence, or remove the dangling references and put the complete clarification in the existing amendments. Update external amendment dependency lists and the specification accordingly. Do not silently introduce a route around S2b or human review.

## What passed this review

- All planned C01–C35 IDs are present in their required notebooks. C17 additionally appears in 009, 011 and 012, extending exposure disclosure.
- After removing amendment sections and inline amendment markers, the original notebook text is preserved; remaining changes are status/date/revision/freeze records and C30's documented calibration seed-table row. No silent threshold deletion was found.
- Shared C02 Change text is identical in all six notebooks. It covers corpus runs and every arm feeding a verdict/gate; unit and smoke tests remain allowed before freezing.
- Experiment 010's governing-arm file still says A2, and its git blob is exactly `9b72d1394fdf17cfd34535b622b1b203e96fc851`, as C31 requires. A1 is non-decisional.
- C04 keeps the language-specific human review requirement; C15 strengthens default edge parity to exact equality; C06 retains the production-d95 mismatch suspension as well as the added EVD check.
- C01 preserves the seed values, draw order, normal construction and explicit per-notebook substreams. The deterministic-PCA clarification above must be synchronized before implementation is treated as conforming.

## Remaining run prerequisites

These are recorded requirements, not reasons to stop ordinary implementation: the six freeze sidecars and runners do not yet exist; the owner-approved freeze must happen before governed runs; 011's human reviews remain required; 012 Part A needs exported offset fields and parity checks first.

One C02 recording detail needs an implementable convention before sidecars are produced: it says the commit adding a sidecar also contains that same commit's hash. A commit cannot contain its own literal Git hash. Use an explicitly documented two-commit record (freeze the inputs, then record that immutable commit), or an equally verifiable convention, without weakening ancestor, clean-tree or hash checks.

After repair, rerun shared-text equality, unknown-ID/dependency closure, original-text preservation and the concrete display-rule examples above. This report is a pre-repair review, not approval of later edits or results.

## Post-repair verification, 2026-09-29

**Shared-text and rule-preservation audit: PASS.** This supersedes the seven shared-text findings and missing-C36 finding above. It does not authorize experiment runs or certify freeze readiness.

- All repeated Change paragraphs for C01–C35 are now identical across their copies. All 35 planned amendments remain present.
- No undefined amendment ID occurs between the actual `## Pre-run consistency amendments` and `## Results` headings. The C36 mentions remaining in revision logs describe its removal; they no longer govern behavior.
- Removing the amendment sections and inline markers leaves no removed original lines other than the date/status lines. Every notebook has a dated repair entry. No threshold, statistic or seed change was found.
- C03 preserves a 007 fail for CI [0.01, 0.03]: it cannot be shown with an inconclusive label. C14 retains the non-pass research record, but neither it nor C03 bypasses evidence, template or human-review gates. A pending/suspended result, unaudited mandatory label or withheld required number causes the entire dependent visitor view to be withheld.
- C20/C22 now agree: if the mandatory axis-meaning caveat is unaudited, raw correlations and loadings are withheld too. Synchronizing C13 retains explicit original-space standardization; synchronizing C01 retains seedless deterministic PCA.
- External amendment closure matches the declared lists for 007, 008, 010 and 011; 009 has no external amendment dependency. No new external amendment ID was introduced by these repairs.

### Freeze prerequisites still open

1. **012 external hashes:** the bounded closure pass found an existing omission that the first review did not identify. The introduction at 012:546 names external C03/C04, but C02's note at 012:573 does not bind their text to the sidecar. Complete the same external-subsection hashing rule used in the other notebooks, with citation closure: C03 in 007, 008, 010 and 011; C04, C24 and C26 in 011. This prevents later changes to the external evidence/human-review rules from escaping 012's freeze. This omission predates the synchronization repair.
2. **C02 commit recording:** the self-referential freeze-commit field still needs the documented implementable convention described above. It does not prevent clearing this shared-text audit.
3. The recorded runner, sidecar, owner-freeze, exporter/parity and human-review prerequisites remain in force.

This verification edited only this report. No notebook, code, experiment result or commit was created or changed.


## Parent follow-up, 2026-09-30

The parent added the missing external-amendment hash-closure note to Experiment
012 C02, including C03 in 007/008/010/011 and C04/C24/C26 in 011. The structural
checker still passes. This follow-up has not had a second independent review;
the C02 self-referential commit field and the other freeze prerequisites above
remain open. No freeze or governing run was performed.
