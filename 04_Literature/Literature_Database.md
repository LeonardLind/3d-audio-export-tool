# Literature Database

Structured table of papers reviewed, replacing narrative literature-review prose. Add rows as new papers are reviewed. Keep entries short — full notes go in `Paper_Summaries/[citation-key].md` if a paper needs more than a table row.

| Citation Key | Full Citation | Key Finding | Relevant Work Package | Confidence | Notes |
|---|---|---|---|---|---|
| Kahl2021 | Kahl, S. et al. (2021). BirdNET: A deep learning solution for avian diversity monitoring. *Ecological Informatics.* | EfficientNetB0-style backbone; 1024-dim embedding from penultimate layer. | WP1, WP2 | High | Basis for excluding BirdNET embeddings from WP2 (label-circularity risk). |
| Sainburg2020 | Sainburg, T., Thielk, M., & Gentner, T. Q. (2020). Finding, visualizing, and quantifying latent structure across diverse animal vocal repertoires. *PLOS Computational Biology*, 16(10), e1008228. | Raw spectrograms → UMAP recovers individual and species identity across multiple bird datasets, with no hand-designed features. | WP1, WP2, WP3 | High | Direct precedent for this project's core ambition; strongest single reference found so far. |
| Thomas2022 | Thomas, M. et al. (2022). A practical guide for generating unsupervised, spectrogram-based latent space representations of animal vocalizations. *Journal of Animal Ecology.* | Practical tutorial companion to Sainburg2020; notes UMAP preserves local structure/relative closeness, not absolute distance; result varies greatly with feature-extraction choice. | WP1, WP3 | High | Good methods-section reference for whichever paper/writeup eventually documents this project. |
| Goffinet2021 | Goffinet, J. et al. (2021). Low-dimensional learned feature spaces quantify individual and group differences in vocal repertoires. *eLife.* | Mouse USVs do not cluster as cleanly as birdsong — vocal diversity can be continuous rather than discrete. | WP1, WP3 | Medium | Supports NOT assuming discrete clusters will emerge; supports v0.4's density-cloud (KDE) decision. |
| Cohen2022 | Cohen, Y. et al. (2022). Automated annotation of birdsong with a neural network that segments spectrograms (TweetyNet). *eLife.* | Mature, published, ready-to-use syllable segmentation tool; validated against known findings on song syntax. | WP1, WP4 (D-009) | High | Recommended starting point for segmentation prototyping rather than building in-house. |
| HierBirdFeat2023 | A hierarchical birdsong feature extraction architecture combining static and dynamic modeling. (2023). *ScienceDirect/Ecological Informatics.* | MFCCs outperformed other engineered feature families for birdsong specifically, including under noisy conditions. | WP1, WP2 | Medium | One study; worth checking for replication before treating as settled. |
| BirdNETEmbedEcol2023 | Feature embeddings from the BirdNET algorithm provide insights into avian ecology. (2023). *ScienceDirect.* | Ecologists already use BirdNET's penultimate-layer embeddings directly for unsupervised acoustic event clustering. | WP1, WP2 | High | Confirms the circularity risk is a real, already-practiced shortcut in the field — not a hypothetical concern. |
| ChariPachterDebate | Chari, T. & Pachter, L., and subsequent responses (ongoing methodological debate). | UMAP/t-SNE can be made to show apparent structure in dissimilar data; countered by claims that proper validation metrics distinguish real from manufactured structure. | WP3, WP5 | Medium | General reference for why negative controls + preservation metrics are mandatory, not just good practice. |

⸻

## How to add a new entry

1. Assign a citation key (AuthorYear, no spaces).
2. Fill every column — leave "Notes" for anything that doesn't fit elsewhere.
3. If the paper needs more than the table can hold, create `Paper_Summaries/[CitationKey].md` and link it in Notes.
4. If a finding changes a Decision Log entry, update `07_Decision_Log/Decision_Log.md` directly — don't let the decision status live only in this table.
