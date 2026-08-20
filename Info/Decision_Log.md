# Living Decision Log

Extracted from v0.4 (Final) so it can be updated independently as experiments close each entry, without touching the (now-stable) Master Framework document. Template per entry: Decision → Reasoning → Evidence → Risks → Alternatives → Status (per v0.4's adopted decision-record pattern).

**Authority note:** This is the only live Decision Log. The table inside `01_Master_Framework/v0.4_Final.md` is a frozen historical snapshot and is not updated after v0.4.

| ID | Topic | Adopted Direction | Expected Evidence to Close | Reviewer(s) | Date | Confidence | Status | Supersedes |
|---|---|---|---|---|---|---|---|---|
| D-001 | Average Manifold Methodology | Density Cloud (KDE) | Compare against DTW-based averaging on a benchmark dataset | Claude, ChatGPT | v0.4 | Medium | Pending empirical validation | — |
| D-002 | Product Vision | Option C (staged: build A/B-scoped first) | Working A/B-scoped build that demonstrably extends to C without redesign | Claude, ChatGPT | v0.4 | Medium | Pending review | — |
| D-003 | Scientific Workflow | Pipeline with feedback loop | N/A — structural/documentation decision | Claude, ChatGPT | v0.4 | High | Adopted | D-003 (v0.3, linear-only version) |
| D-004 | Embedding Algorithm Selection | Benchmark multiple (PCA/UMAP/t-SNE), pin best after evidence | Quantitative benchmark against Information Preservation metrics + negative control | ChatGPT (adopted over Claude's earlier "pin now" suggestion) | v0.4 | Medium | Pending benchmark — WP3 | Claude's v0.3 informal suggestion to pin one algorithm pre-implementation |
| D-005 | Label Use in Embedding Fitting | Project Rule 001 — labels excluded from fitting when evaluating natural clustering | N/A — methodological rule | Claude, ChatGPT | v0.4 | High | Adopted | — |
| D-006 | Negative Controls | Mandatory for every validated pipeline | N/A — methodological rule | Claude, ChatGPT | v0.4 | High | Adopted | — |
| D-007 | Interpolation/Smoothing Policy | Toggleable smoothing over raw points | User/expert feedback on whether raw view is actually used when available | Claude | v0.3 | Medium | Pending | — |
| D-008 | Individual/Species ID Strategy | Model-consensus metadata (BirdNET + 2 models w/ confidence) used as primary labels; independent human spot-check flagged as valuable but not yet confirmed feasible | Confirm whether a human expert spot-check subset is feasible (WP4 open item) | Claude, ChatGPT | v0.4 → updated v0.5 | Medium | Pending — WP4 | Original v0.3 assumption of simple recordist metadata |
| D-009 | Segmentation Methodology | Prototype with existing tool (TweetyNet or amplitude-threshold baseline) rather than building bespoke | Literature review (done, WP1) + prototype compared against any available annotated boundaries | Claude, ChatGPT | v0.4 → updated v0.5 | Medium | Pending prototype | — |
| D-010 | Acoustic Feature Set | Benchmark MFCC / inherited 8-axis set / raw spectrogram; BirdNET-family embeddings excluded (circularity risk) | Literature review (done, WP1) + WP2 benchmark results | Claude, ChatGPT | v0.4 → updated v0.5 | Medium | Pending benchmark — WP2, see Experiment_001 | — |
| D-011 | Project Rule 002 — No implementation decisions without a benchmark plan | Adopted | N/A — methodological rule | ChatGPT | v0.5 | High | Adopted | — |
| D-012 | Project Rule 003 — No unpublished intuition survives benchmarking | Adopted | N/A — methodological rule | ChatGPT | current | High | Adopted | — |
| D-013 | VAE Candidate Scheduling | Defer from-scratch VAE embedding from Experiment 001 to Experiment 002 | Experiment 001 should first prove the simpler MFCC / spectral-descriptor / raw-spectrogram benchmark loop on real audio before adding model-training failure modes | ChatGPT | current | High | Adopted | D-010 scope detail |

⸻

## How to update this log

1. When an experiment in `03_Research_Notebook/` reaches a Decision, come here and update the relevant row's Status, and add the actual evidence found (replacing "Expected Evidence" text with what was actually observed).
2. Never delete a superseded row — move its old content into the Supersedes column of the row that replaces it, as already done for D-004 and D-008/D-009/D-010 above.
3. If a decision changes something in the Master Framework (`01_Master_Framework/v0.4_Final.md`), note that explicitly here, but only actually edit v0.4 if the change is structural (e.g. the visual-channel-convention scenario flagged for WP2) — small evidence updates belong here, not in the Master Framework.
