# Living Decision Log

Extracted from v0.4 (Final) so it can be updated independently as experiments close each entry, without touching the (now-stable) Master Framework document. Template per entry: Decision â†’ Reasoning â†’ Evidence â†’ Risks â†’ Alternatives â†’ Status (per v0.4's adopted decision-record pattern).

**Authority note:** This is the only live Decision Log. The table inside `01_Master_Framework/v0.4_Final.md` is a frozen historical snapshot and is not updated after v0.4.

| ID | Topic | Adopted Direction | Expected Evidence to Close | Reviewer(s) | Date | Confidence | Status | Supersedes |
|---|---|---|---|---|---|---|---|---|
| D-001 | Average Manifold Methodology | Density Cloud (KDE) | Compare against DTW-based averaging on a benchmark dataset | Claude, ChatGPT | v0.4 | Medium | Pending empirical validation | â€” |
| D-002 | Product Vision | Option C (staged: build A/B-scoped first) | Working A/B-scoped build that demonstrably extends to C without redesign | Claude, ChatGPT | v0.4 | Medium | Pending review | â€” |
| D-003 | Scientific Workflow | Pipeline with feedback loop | N/A â€” structural/documentation decision | Claude, ChatGPT | v0.4 | High | Adopted | D-003 (v0.3, linear-only version) |
| D-004 | Embedding Algorithm Selection | PCA | Adopted from WP3 evidence on raw spectrograms: PCA won on raw spectrograms at both 22 samples (Experiment 002) and 150 samples (Experiment 004). UMAP failed the negative control at 22 samples but passed at 150 samples, though still scored well below PCA (0.76 vs 0.98), suggesting UMAP may need a larger dataset than tested to compete. Revisit if dataset grows past ~500 matched samples; not permanently closed. | ChatGPT (adopted over Claude's earlier "pin now" suggestion) | 2026-07-20 | Medium | Adopted, revisitable | Claude's v0.3 informal suggestion to pin one algorithm pre-implementation |
| D-005 | Label Use in Embedding Fitting | Project Rule 001 â€” labels excluded from fitting when evaluating natural clustering | N/A â€” methodological rule | Claude, ChatGPT | v0.4 | High | Adopted | â€” |
| D-006 | Negative Controls | Mandatory for every validated pipeline | N/A â€” methodological rule | Claude, ChatGPT | v0.4 | High | Adopted | â€” |
| D-007 | Interpolation/Smoothing Policy | Toggleable smoothing over raw points | User/expert feedback on whether raw view is actually used when available | Claude | v0.3 | Medium | Pending | â€” |
| D-008 | Individual/Species ID Strategy | Model-consensus metadata may be used for provisional species labels; no individual-bird ground truth currently exists. Filename IDs such as 4_2MM06988 and 1_2MM06956 are recorder/deployment identifiers, not confirmed individual birds. | Experiment 005 showed device/location/recording-condition fingerprinting, not individual-bird clustering. Proper Level 2 Individual Bird validation requires human-confirmed individual-bird labels or another independent ground-truth source; until then, individual-level claims remain untested. | Claude, ChatGPT | 2026-07-20 | Medium | Pending - blocked on ground truth | Original v0.3 assumption of simple recordist metadata |
| D-009 | Segmentation Methodology | Prototype with existing tool (TweetyNet or amplitude-threshold baseline) rather than building bespoke | Literature review (done, WP1) + prototype compared against any available annotated boundaries | Claude, ChatGPT | v0.4 â†’ updated v0.5 | Medium | Pending prototype | â€” |
| D-010 | Acoustic Feature Set | Raw flattened spectrograms | Adopted from WP2 evidence: consistent winner across Experiment 001 (22 samples), Experiment 003 (150 samples), and Experiment 006 (150 samples with loudest-1s window selection). In all fair dimensionality-appropriate tests, raw flattened spectrograms were the only candidate to pass the negative control; MFCCs and inherited 8-axis descriptors failed the negative control. Experiment 006 fixed the first-second silence issue and did not change the decision (raw trustworthiness 0.9838 fixed-start -> 0.9809 loudest-window). Based on current dataset size; open to being overturned by a larger retest and not permanently closed. | Claude, ChatGPT | 2026-07-20 | Medium | Adopted | — |
| D-011 | Project Rule 002 â€” No implementation decisions without a benchmark plan | Adopted | N/A â€” methodological rule | ChatGPT | v0.5 | High | Adopted | â€” |
| D-012 | Project Rule 003 â€” No unpublished intuition survives benchmarking | Adopted | N/A â€” methodological rule | ChatGPT | current | High | Adopted | â€” |
| D-013 | VAE Candidate Scheduling | Defer from-scratch VAE embedding from Experiment 001 to Experiment 002 | Experiment 001 should first prove the simpler MFCC / spectral-descriptor / raw-spectrogram benchmark loop on real audio before adding model-training failure modes | ChatGPT | current | High | Adopted | D-010 scope detail |

â¸»

## How to update this log

1. When an experiment in `03_Research_Notebook/` reaches a Decision, come here and update the relevant row's Status, and add the actual evidence found (replacing "Expected Evidence" text with what was actually observed).
2. Never delete a superseded row â€” move its old content into the Supersedes column of the row that replaces it, as already done for D-004 and D-008/D-009/D-010 above.
3. If a decision changes something in the Master Framework (`01_Master_Framework/v0.4_Final.md`), note that explicitly here, but only actually edit v0.4 if the change is structural (e.g. the visual-channel-convention scenario flagged for WP2) â€” small evidence updates belong here, not in the Master Framework.
