# Bioacoustics & Audio-Analysis Metrics: A Reference for Bird-Song Visualization

*Compiled 2026-07-24. This document maps acoustic measurements used in ornithology, ecoacoustics, and bioacoustic signal processing to (a) how they are computed, (b) why they matter scientifically, and (c) how each could be visualized in an app. Every metric is tagged with a **validation status** distinguishing measures that are genuinely established in the peer-reviewed ornithology/ecoacoustics literature from those that are borrowed from music/speech DSP and are more exploratory when applied to birds. Full citations with URLs are in the [Sources](#sources) section.*

---

## 0. Orientation: three analysis scales

Bird-sound analysis operates at three nested scales, and a good visualization app should let the user move between them:

1. **Fine structure (within a note / syllable):** pitch, harmonics, frequency and amplitude modulation, timbre. Tools: spectrogram, pitch tracker.
2. **Song / phrase structure (seconds):** syllable segmentation, duration, gaps, repetition, rhythm, tempo, similarity/clustering of elements. Tools: warbleR, Raven, UMAP embeddings.
3. **Soundscape (minutes–days, whole community):** acoustic indices (ACI, ADI, AEI, BI, NDSI, H), biophony vs anthrophony, species-classifier output. Tools: seewave, soundecology, scikit-maad, BirdNET.

The single most important cross-cutting caveat from the literature: **no single index or metric describes a soundscape or a song completely**; the field consensus (Bradfer-Lawrence et al. 2019) is to use several complementary measures and validate them against ground-truth (manual annotation, point counts) for your specific habitat.

---

## 1. Fundamental frequency / pitch & harmonics

### 1.1 Fundamental frequency (F0) estimation

**What it is:** F0 is the lowest periodic frequency of a (quasi-)harmonic sound; perceptually it is "pitch." Many bird notes are near-tonal whistles where F0 is well defined; others (buzzes, trills, broadband clicks) have weak or no F0.

**How computed — three classic families:**
- **Autocorrelation (ACF):** correlate the waveform with a time-lagged copy of itself; the lag of the first strong peak (after lag 0) is the period, F0 = 1/period. Simple and robust to phase, but prone to octave errors (picking a multiple/submultiple of the true period).
- **YIN** (de Cheveigné & Kawahara 2002): a refined autocorrelation method using a *cumulative mean normalized difference function* plus parabolic interpolation and a threshold to suppress octave errors. Reports error rates roughly 3× lower than plain ACF, has no hard upper frequency limit (good for high-pitched bird whistles), low latency, few parameters. The de facto standard in modern pitch trackers (e.g. `librosa.yin`, `librosa.pyin`).
- **Harmonic Product Spectrum (HPS):** take the magnitude spectrum, downsample it by factors 2, 3, 4…, and multiply the copies together; harmonics align at the true F0 producing a dominant peak. Cheap in the frequency domain, good for strongly harmonic sounds, but weak for near-pure tones (few harmonics) and susceptible to picking a harmonic.

**Why useful in ornithology:** F0 contours (pitch trajectories over time) are a primary carrier of species and individual identity; many field guides and classifiers key off "whistled" vs "buzzy" vs "trilled" pitch shape. Pitch range and mean pitch differ predictably with body size and habitat (acoustic adaptation hypothesis: lower frequencies propagate better in dense forest).

**How to visualize:**
- Overlay a **pitch-track line** on the spectrogram (colored by confidence/periodicity).
- **F0 contour plot** (Hz vs time) decoupled from the spectrogram for comparing renditions.
- **Piano-roll / note view** quantizing sustained tones.

**Validation status:** YIN/autocorrelation pitch tracking is *well established* in bioacoustics for tonal species; HPS is *less commonly cited* in ornithology but standard DSP. Caution: pitch estimators are unreliable on non-harmonic/noisy bird sounds — always show a confidence measure.

### 1.2 Frequency range, peak / dominant frequency

**What it is:** The min–max frequency band a note occupies (often measured as the −X dB bandwidth around the peak) and the **peak (dominant) frequency** = frequency bin with maximum energy. Raven Pro's standard "robust" measurements (peak frequency, frequency 5%/95%, bandwidth 90%) are built on energy percentiles to resist noise.

**Why useful:** Frequency range and peak frequency are among the most repeatable, species-diagnostic, and easily automated song features; they anchor most classical repertoire and species-discrimination studies (e.g. via warbleR / Raven measurements).

**How to visualize:** shaded frequency band on the spectrogram; box-and-whisker of peak frequency per species/individual; ridgeline plots of frequency distributions.

**Validation status:** *Strongly validated and ubiquitous.*

### 1.3 Harmonics / overtones and harmonic-to-noise ratio

**What it is:** Energy at integer multiples of F0 (2·F0, 3·F0…). The relative strength of overtones defines much of a sound's timbre; the **harmonic-to-noise ratio (HNR)** contrasts periodic (harmonic) energy against aperiodic (noise) energy.

**Why useful:** Harmonic structure distinguishes clear whistles from harmonic-rich or noisy calls; nonlinear phenomena (subharmonics, biphonation, deterministic chaos) are behaviorally meaningful in some species and indicate two simultaneously vibrating syringeal sources.

**How to visualize:** harmonic-cursor overlays (horizontal lines at n·F0) on the spectrogram; harmonic-stack bar chart of energy per harmonic; HNR meter over time.

**Validation status:** Harmonic analysis is *well established*; automated HNR from field recordings is *moderately validated* (noise-sensitive).

---

## 2. Temporal structure

### 2.1 Syllable / phrase segmentation

**What it is:** Partitioning a recording into acoustic units — notes/elements, syllables, phrases, songs — usually via an amplitude envelope threshold or a spectrogram energy detector, then defining onset/offset times. Implemented in warbleR (`auto_detec`, `ext_window`), Raven band-limited energy detector, and scikit-maad.

**How computed:** compute the short-time amplitude/energy envelope → smooth → threshold (absolute or relative) → merge/split by minimum-duration and minimum-gap rules → return timestamped intervals.

**Why useful:** Segmentation is the prerequisite for nearly all downstream song analysis (duration, gaps, repertoire, embeddings). Element counts and boundaries feed repertoire-size estimation and sequence analysis.

**How to visualize:** colored segment boxes on the spectrogram; a segmentation "ribbon" strip beneath the spectrogram; onset markers on the waveform.

**Validation status:** *Standard practice*, but segmentation is noise-sensitive and often needs manual QC — a well-known limitation.

### 2.2 Duration, inter-note gaps, repetition rate, rhythm, tempo

**What it is:**
- **Note/syllable/song duration** (s).
- **Inter-onset interval (IOI) / inter-note gap** (silence between elements).
- **Repetition rate / trill rate** (elements per second).
- **Rhythm** — the pattern of IOIs; **isochrony** = evenly spaced onsets.
- **Tempo** — overall pace, often the modal or median IOI.

**How computed:** derived directly from segmentation timestamps: duration = offset − onset; IOI = onset(n+1) − onset(n); rate = count / span; rhythm characterized by the distribution/regularity (CV) of IOIs, autocorrelation of the onset train, or the "rhythm histogram."

**Why useful:** Trill rate and note timing are tightly linked to performance and sexual selection (e.g. trill-rate/frequency-bandwidth trade-off as an honest signal of vocal performance) and are strongly species- and individual-diagnostic. Rhythm/isochrony is an active comparative-cognition topic.

**How to visualize:**
- **IOI histogram** and **rhythm plot** (onset train with tick marks).
- **Tempogram** (rate vs time).
- **Trill-rate vs bandwidth scatter** with the "performance limit" upper bound.
- Beat/onset markers synchronized to audio playback.

**Validation status:** *Strongly validated* (duration, rate). Rhythm/isochrony metrics are *emerging but increasingly published.*

---

## 3. Modulation

### 3.1 Frequency modulation (FM)

**What it is:** Change of frequency over time within a note — sweeps, warbles, trills. Quantified as the slope (Hz/s) of the F0 or dominant-frequency contour, its total excursion, and modulation rate/depth for periodic FM.

**How computed:** track the frequency contour (peak-frequency ridge or F0), then take its derivative (slope), range (max−min), and spectrum-of-the-contour (FM rate).

**Why useful:** FM shape is a core perceptual and classification feature (rising vs falling vs modulated notes); FM patterns carry species identity and are used in template matching.

**How to visualize:** derivative-colored spectrogram (color = instantaneous slope); contour-slope heat overlay; "gesture" glyphs summarizing sweep direction.

**Validation status:** *Well established.*

### 3.2 Amplitude modulation (AM)

**What it is:** Change of loudness over time — the envelope. Fast periodic AM produces buzzes/rattles; slow AM shapes phrasing. Quantified by the **amplitude envelope** and its modulation spectrum (AM rate/depth).

**How computed:** envelope via Hilbert transform or rectify-and-smooth; AM spectrum = FFT of the envelope; AM depth from envelope min/max.

**Why useful:** AM rate distinguishes rattles/buzzes from tonal notes and is diagnostic for many insects and some birds; the amplitude envelope underpins segmentation and temporal entropy.

**How to visualize:** waveform envelope overlay; **modulation spectrum** plot (AM rate on x, frequency on y — a "modulation power spectrum"); envelope-driven animated loudness meter.

**Validation status:** *Well established* (envelope, AM rate).

---

## 4. Timbre / spectral shape features

These frame-level spectral descriptors come from music/speech MIR. They are cheap, widely available (librosa, scikit-maad), and useful as **classifier inputs and summary glyphs**, but individually they are *less directly interpretable* in ornithology than pitch/duration — treat them as texture descriptors rather than biologically named traits.

| Feature | Formula / intuition | What it captures |
|---|---|---|
| **Spectral centroid** | magnitude-weighted mean frequency = Σ f·M(f) / Σ M(f) | "brightness"; higher = energy skewed to high frequencies |
| **Spectral roll-off** | frequency below which 85–95% of spectral energy lies | skew / high-frequency extent |
| **Spectral bandwidth / spread** | magnitude-weighted std around the centroid | tonal (narrow) vs noise-like (wide) |
| **Spectral flatness (Wiener entropy)** | geometric mean / arithmetic mean of the spectrum (0→1) | **tonality vs noisiness**: ≈0 pure tone, ≈1 white noise |
| **Spectral entropy** | Shannon entropy of the normalized power spectrum | concentration vs spread of energy across bins |
| **Spectral flux** | frame-to-frame change (e.g. Σ(M_t − M_{t−1})²) | rate of spectral change; onset/transient detection |
| **Zero-crossing rate (ZCR)** | count of waveform sign changes per frame | rough proxy for dominant frequency / noisiness; cheap voicing cue |

**Why useful:** These distinguish tonal whistles from broadband noise (flatness/entropy), detect onsets (flux), and serve as compact feature vectors for clustering and machine learning. Spectral flatness / Wiener entropy in particular is heavily used in birdsong work (e.g. Sound Analysis Pro's "Wiener entropy" for zebra-finch song development).

**How to visualize:** small multiples of feature-vs-time curves under the spectrogram; a **radar/spider glyph** per syllable; color-encode one feature (e.g. flatness) along the spectrogram ridge; 2D scatter of centroid vs bandwidth colored by cluster.

**Validation status:** Spectral flatness/Wiener entropy: *validated in birdsong*. Centroid/rolloff/flux/ZCR: *standard MIR features, used as ML inputs in bird-ID papers but not primary biological traits* — flag as descriptive/exploratory.

---

## 5. Soundscape acoustic indices (ecoacoustics)

These summarize *whole recordings/communities* rather than single songs. All are implemented in the R packages **seewave** and **soundecology**, and in Python **scikit-maad**. **Critical caveat (Bradfer-Lawrence et al. 2019, 2023):** >60 indices exist, results are habitat-dependent and sometimes contradictory, indices are confounded by non-biological noise (wind, rain, geophony), and there is no single best index — use several and validate locally.

### 5.1 Acoustic Complexity Index (ACI) — Pieretti, Farina & Morri 2011

- **What it measures:** temporal variability of intensity within frequency bins. Built on the observation that bird song has intrinsically variable amplitude while many anthropogenic noises (engines, aircraft) are near-constant in intensity.
- **Formula / intuition:** for each frequency bin, sum the absolute differences in amplitude between adjacent time frames, divided by the total amplitude in that bin (over a temporal cluster); sum across bins and clusters. High ACI ⇒ many rapid intensity fluctuations (bird activity); constant tones/noise contribute little.
- **Ecological use:** proxy for singing activity / avian vocal richness; correlates (variably) with species richness. Note: ACI increases with *any* fluctuating sound, including some biotic noise and rain — see the recent critical review (Farina et al. 2025, Oikos).
- **Validation status:** *Widely used and validated*, but with well-documented sensitivity to recording settings and noise.

### 5.2 Acoustic Diversity Index (ADI) — Villanueva-Rivera et al. 2011

- **What it measures:** how evenly acoustic energy is spread across frequency bands.
- **Formula:** split spectrogram into frequency bins (default 10 bins of 1 kHz, 0–10 kHz); for each bin compute the proportion of the signal above a threshold (default −50 dBFS); apply the **Shannon diversity index** to those proportions. Higher ADI ⇒ more bands occupied more evenly.
- **Ecological use:** proxy for the diversity of sound-producing activity across the spectrum.
- **Validation status:** *Commonly used*; threshold- and bin-sensitive.

### 5.3 Acoustic Evenness Index (AEI) — Villanueva-Rivera et al. 2011

- **What it measures:** the inverse notion to ADI — inequality of energy across frequency bins.
- **Formula:** same binning/threshold as ADI, but apply the **Gini coefficient** to the per-bin proportions. Higher AEI ⇒ energy concentrated in few bands (more uneven). ADI and AEI are typically negatively correlated.
- **Ecological use:** disturbed/low-diversity soundscapes tend toward higher unevenness.
- **Validation status:** *Commonly used*, same caveats as ADI.

### 5.4 Bioacoustic Index (BI) — Boelman et al. 2007

- **What it measures:** the "amount" of avian sound as area and spread.
- **Formula / intuition:** area under the mean frequency-power spectrum between ~2–8 kHz, referenced to the minimum bin (i.e. dB above the quietest band summed across occupied bands). Captures both sound level and number of occupied frequency bands.
- **Ecological use:** originally validated against bird point counts in Hawaii; correlates with avian abundance in some systems.
- **Validation status:** *Validated against field counts in the source study*; transferability varies by habitat.

### 5.5 Normalized Difference Soundscape Index (NDSI) — Kasten et al. 2012

- **What it measures:** the balance of **biophony** (biological sound) vs **anthrophony** (human/mechanical sound).
- **Formula:** NDSI = (β − α)/(β + α), where α = power in the anthrophony band (default 1–2 kHz) and β = power in the biophony band (default 2–11 kHz), using power spectral density (watts/kHz). Ranges −1 (all anthrophony) to +1 (all biophony).
- **Ecological use:** a headline metric for quantifying human acoustic disturbance and separating biophony from anthrophony; used in soundscape-health and conservation monitoring.
- **Validation status:** *Widely used*; the fixed 1–2 kHz "anthrophony" band is a strong assumption — low-frequency bird/insect sound and wind fall in it, so validate per site.

### 5.6 Acoustic Entropy Index (H) — Sueur et al. 2008

- **What it measures:** overall evenness/unpredictability of energy across both time and frequency; H → 0 for a single pure tone, H → 1 for random noise.
- **Formula:** H = Ht × Hf, the product of **temporal entropy** (Ht, Shannon entropy of the normalized amplitude envelope) and **spectral entropy** (Hf, Shannon entropy of the normalized mean spectrum).
- **Ecological use:** proposed as a rapid biodiversity proxy (more calling species ⇒ more even spread ⇒ higher H). One of the founding ecoacoustic indices; distributed in seewave.
- **Validation status:** *Foundational and widely cited*; like all single indices it saturates and is confounded by broadband noise — the original authors and later reviews stress complementary use.

**Shared visualization ideas for indices:** index-vs-time line/area charts across a day (**diel acoustic cycle**); **false-color long-duration spectrograms** where R/G/B channels = three indices (ACI/ADI/entropy) — a canonical ecoacoustics visualization for 24 h+ of audio; site-comparison heatmaps; NDSI shown as a diverging biophony↔anthrophony gauge.

---

## 6. Similarity, repetition & learned embeddings

### 6.1 Self-similarity matrices / recurrence plots

**What it is:** an N×N matrix comparing every frame (or feature vector) of a recording to every other; bright off-diagonal stripes reveal repeated motifs and periodicity. Recurrence plots are the thresholded/nonlinear-dynamics variant.

**How computed:** feature sequence (spectrogram columns, MFCCs) → pairwise distance/similarity matrix; recurrence plot thresholds distances to binary.

**Why useful:** exposes song structure — repeated syllables, refrains, ABAB phrasing — without prior segmentation; useful for detecting stereotypy vs variability.

**How to visualize:** the SSM itself as a heatmap (diagonal + repeat stripes); arc diagrams linking repeated segments beneath the spectrogram.

**Validation status:** *Established in MIR*; used in birdsong structure analysis but *more exploratory* than mainstream in ecology.

### 6.2 Dynamic Time Warping (DTW)

**What it is:** an elastic distance that aligns two sequences (e.g. two F0 contours or two spectrograms) allowing local time stretching, yielding a similarity score robust to tempo differences.

**How computed:** dynamic-programming search for the minimum-cost monotonic alignment path through the pairwise cost matrix; the accumulated cost is the DTW distance.

**Why useful:** classic method for comparing renditions of harmonic bird vocalizations and for template-based recognition. Pitch- and spectrogram-based DTW achieve >97% syllable-recognition accuracy on clean, stereotyped song (indigo bunting, zebra finch); performance degrades in noise and with complex FM.

**How to visualize:** the two contours with alignment "tie-lines"; the cumulative-cost matrix with the warping path; a similarity dendrogram built from pairwise DTW distances.

**Validation status:** *Validated for individual/song comparison*, with documented noise limitations.

### 6.3 Spectrographic cross-correlation

**What it is:** slide one spectrogram over another and correlate amplitude values at each lag; peak correlation = similarity. Core function in warbleR (`cross_correlation`) and Raven.

**Why useful:** standard, interpretable acoustic-(dis)similarity measure for building distance matrices among many signals (repertoire, geographic comparison).

**How to visualize:** cross-correlation heatmap; MDS/dendrogram of the resulting distance matrix.

**Validation status:** *Standard, validated* ornithology tool.

### 6.4 Learned latent-space embeddings (UMAP / t-SNE / VAE)

**What it is:** project spectrograms of many vocal elements into a low-dimensional (usually 2D) space where similar sounds cluster, using nonlinear dimensionality reduction (**UMAP**, **t-SNE**) or a **variational autoencoder (VAE)**. The dominant modern approach to visualizing whole vocal repertoires.

**How computed (Sainburg et al. 2020; Thomas et al. 2022 practical guide):** segment elements → make uniformly sized spectrograms → (optionally) encode via VAE → UMAP/t-SNE to 2D → scatter, one point per syllable, colorable by individual, species, time, or cluster label (HDBSCAN). Advantage over hand-picked acoustic features: avoids the sensitivity of results to arbitrary feature choice and needs less expert feature engineering.

**Why useful:** reveals repertoire structure, cluster stereotypy, individual identity, population "regiolects/dialects," coarticulation, and enables cross-species comparison. Goffinet et al. 2021 (eLife) show learned features quantify individual/group differences better than traditional features in some datasets.

**How to visualize:** interactive 2D scatter with hover-to-play audio + thumbnail spectrogram; density contours per group; trajectories through latent space for sequential song; cluster color legend.

**Validation status:** *Rapidly becoming standard* and peer-validated across 29 species; the flagship "wow" visualization for a song app. Caveat: 2D projections distort global distances — provide caveats and don't over-read exact positions.

---

## 7. Individual vs species variation, call-type clustering, geographic/seasonal variation

**What it is:** using the above features/embeddings to ask whether sounds cluster by **species**, by **individual** (voice/identity), by **call type** (song vs alarm vs contact), or by **place/time** (dialects, seasonal change).

**How computed:** build a feature matrix (classical acoustic parameters via warbleR/Raven, cross-correlation distances, or latent embeddings) → clustering (k-means, HDBSCAN, hierarchical) and/or supervised classification → test group separation (PERMANOVA, discriminant analysis, random forest).

**Why useful:** underpins individual identification / mark-recapture-by-voice, dialect mapping, monitoring of cultural evolution of song, and detecting seasonal/diel singing patterns.

**How to visualize:** UMAP/t-SNE colored by individual/site/season; **dialect maps** (geographic map with song-type pie markers); dendrograms; confusion matrices for classifier separability; **diel/seasonal activity heatmaps** (hour × day-of-year).

**Validation status:** *Well established* research programs (dialects, individual ID); accuracy is species-dependent.

---

## 8. Species classification confidence — BirdNET (Kahl et al. 2021)

**What it is:** a deep convolutional neural network that identifies bird species from audio; the reference open tool for automated avian acoustic monitoring.

**How computed:** audio is split into **3-second segments**, converted to mel-spectrograms, and passed through the trained CNN; each segment gets per-species **confidence scores in [0, 1]** (logits passed through a sigmoid). BirdNET also exposes internal **embeddings** reusable for transfer learning and clustering (Ghani et al. 2023).

**Why useful:** turns raw passive-acoustic-monitoring audio into species detections at scale, enabling occupancy, phenology, and richness estimates without manual listening.

**How to visualize:** timeline of detections colored by confidence; **species × time heatmap** ("acoustic activity calendar"); confidence-threshold slider showing precision/recall trade-off; ranked bar chart of detected species per recording.

**Validation status:** *Peer-reviewed and extensively used*, but **confidence is not calibrated probability** — thresholds must be validated per species/site; false positives are common at low thresholds. Always surface the threshold and treat scores as relative.

---

## 9. Multi-source scenes: duets, overlapping birds, source separation

**What it is:** real recordings usually contain several simultaneous singers plus noise. In richly annotated birdsong datasets ~20% of vocalization time has ≥2 classes active. **Duets** (coordinated male–female or pair singing) are a special, behaviorally rich case.

**How computed / approaches:**
- **Source separation:** deep-learning models split a mixture into per-source channels — e.g. Google's *bird MixIT* (unsupervised mixture-invariant training; "Separating Birdsong in the Wild"), and **BioCPPNet** (Bermant et al. 2021, *Scientific Reports*), evaluated by scale-invariant SDR. Recent work (Wang et al. 2026) shows separating overlapping birdsong improves the reliability of vocal-activity analysis.
- **Practical tip from the literature:** feeding *both* the separated channels *and* the original mixture to a classifier outperforms using separated channels alone.
- **Duet analysis:** align the two voices' segmentation to quantify temporal coordination/answer latency (warbleR supports coordinated-singing analysis).

**Why useful:** cleaner per-source audio improves species ID, individual ID, and any per-song metric; duet timing is a direct behavioral readout of pair bonding/territory defense.

**How to visualize:** stacked per-source spectrograms after separation; overlap-highlighted spectrogram (regions where sources co-occur); duet "ladder" plot showing the two birds' alternating contributions on a shared timeline.

**Validation status:** source separation is an *active, promising but not-yet-turnkey* area for field audio — flag as advanced/experimental. Duet timing analysis is *established* behaviorally.

---

## 10. Environmental sound categories & biophony vs anthrophony

**What it is:** classifying non-target sound — **geophony** (wind, rain, water, thunder), **biophony** (birds, insects, amphibians), and **anthrophony** (traffic, aircraft, voices, machinery). Insects (cicadas, orthopterans) are a major confound: dense, broadband, sustained.

**How computed:**
- **NDSI** (Section 5.5) explicitly splits biophony vs anthrophony by frequency band and is the headline index for this.
- Spectral shape helps: **wind** = low-frequency, high spectral flatness (noise-like), non-stationary bursts; **rain** = broadband, sustained, high flatness; **insects** = narrowband sustained tones or fast AM buzzes, high in the spectrum; **anthrophony** (engines) = low-frequency, tonal/harmonic, near-constant intensity (which is exactly why ACI down-weights it).
- Modern pipelines use CNN sound-event classifiers and dedicated rain/wind detectors to mask contaminated segments before computing indices — a key QC step stressed by Bradfer-Lawrence et al.

**Why useful:** geophony/anthrophony contaminate every acoustic index (rain inflates ACI/entropy; wind inflates low-band power and depresses NDSI). Detecting and masking them is essential for valid biodiversity estimates.

**How to visualize:** category ribbon under the spectrogram (color-coded biophony/geophony/anthrophony); NDSI diverging gauge; per-band energy stack (low = wind/anthrophony vs high = biophony); a "data-quality" strip flagging rain/wind segments.

**Validation status:** NDSI band-split and rain/wind masking are *established practice*; fine-grained environmental sound classification for field audio is *maturing*.

---

## 11. Recommended visualizations ranked by usefulness + feasibility

Ranking blends *scientific value* (does it convey a validated, meaningful metric?) and *feasibility* (compute cost, robustness on messy field audio, ease of implementation). H = high.

| Rank | Visualization | Metrics shown | Scientific value | Feasibility | Notes |
|---|---|---|---|---|---|
| 1 | **Spectrogram with pitch-track + segment overlays** | F0, freq range, harmonics, segmentation, duration | H | H | The foundational view; everything else layers on it. Show pitch confidence. |
| 2 | **UMAP/t-SNE latent scatter of syllables** (hover-to-play) | learned embedding, clustering, individual/species/dialect | H | Medium-H | The signature "repertoire map" (Sainburg 2020; Thomas 2022). Great wow-factor; caveat 2D distortion. |
| 3 | **Species × time detection heatmap** from BirdNET | classification + confidence over time | H | H | "Acoustic activity calendar"; expose confidence-threshold slider. |
| 4 | **False-color long-duration spectrogram** (RGB = ACI/ADI/entropy) | soundscape indices over 24h+ | H | Medium | Canonical ecoacoustics view; compresses days of audio into one image. |
| 5 | **NDSI biophony↔anthrophony diverging gauge / timeline** | NDSI, biophony vs anthrophony | H | H | Intuitive human-disturbance readout; pair with quality flags. |
| 6 | **Diel / seasonal acoustic-activity heatmap** (hour × day) | index or detection intensity | H | H | Reveals dawn chorus, phenology; simple aggregation. |
| 7 | **IOI / rhythm plot + trill-rate–bandwidth scatter** | duration, gaps, tempo, performance | Medium-H | H | Ties directly to sexual-selection performance literature. |
| 8 | **Similarity heatmap / dendrogram** (DTW or cross-correlation) | pairwise acoustic (dis)similarity | Medium-H | Medium | Good for individual/dialect comparison; needs clean segments. |
| 9 | **Self-similarity matrix / arc diagram** of one song | repetition, motif structure | Medium | Medium | Elegant for showing song architecture. |
| 10 | **Per-syllable spectral-feature radar glyphs** | centroid, flatness, bandwidth, ZCR, entropy | Medium | H | Compact texture summary; label as descriptive, not biological traits. |
| 11 | **Modulation spectrum / envelope + FM-slope colored spectrogram** | AM/FM rate & depth | Medium | Medium | Distinguishes buzzes/trills; nice animation potential. |
| 12 | **Separated-source stacked spectrograms** | source separation, duet timing | Medium | Low-Medium | High value but experimental on field audio; frame as advanced. |

---

## Sources

1. Pieretti, N., Farina, A., & Morri, D. (2011). *A new methodology to infer the singing activity of an avian community: The Acoustic Complexity Index (ACI).* Ecological Indicators 11(3): 868–873. https://www.sciencedirect.com/science/article/abs/pii/S1470160X10002037
2. Villanueva-Rivera, L. J., Pijanowski, B. C., Doucette, J., & Pekin, B. (2011). *A primer of acoustic analysis for landscape ecologists* (ADI & AEI). Landscape Ecology 26: 1233–1246. https://www.researchgate.net/publication/226182392_A_primer_of_acoustic_analysis_for_landscape_ecologists
3. Kasten, E. P., Gage, S. H., Fox, J., & Joo, W. (2012). *The Remote Environmental Assessment Laboratory's acoustic library: An archive for studying soundscape ecology* (NDSI). Ecological Informatics 12: 50–67. https://www.rdocumentation.org/packages/soundecology/versions/1.3.3/topics/ndsi
4. Boelman, N. T., Asner, G. P., Hart, P. J., & Martin, R. E. (2007). *Multi-trophic invasion resistance in Hawaii: bioacoustics, field surveys, and airborne remote sensing* (Bioacoustic Index). Ecological Applications 17(8): 2137–2144. https://esajournals.onlinelibrary.wiley.com/doi/abs/10.1890/07-0004.1
5. Sueur, J., Pavoine, S., Hamerlynck, O., & Duvail, S. (2008). *Rapid acoustic survey for biodiversity appraisal* (Acoustic Entropy H). PLOS ONE 3(12): e4065. https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0004065
6. Sueur, J., Aubin, T., & Simonis, C. (2008). *Seewave: a free modular tool for sound analysis and synthesis.* Bioacoustics 18(2): 213–226. https://www.tandfonline.com/doi/abs/10.1080/09524622.2008.9753600
7. soundecology R package — *An Introduction to the soundecology package* (index formulas & defaults). CRAN. https://cran.r-project.org/web/packages/soundecology/vignettes/intro.html
8. Bradfer-Lawrence, T., Gardner, N., Bunnefeld, L., Bunnefeld, N., Willis, S. G., & Dent, D. H. (2019). *Guidelines for the use of acoustic indices in environmental research.* Methods in Ecology and Evolution 10(10): 1796–1807. https://besjournals.onlinelibrary.wiley.com/doi/full/10.1111/2041-210X.13254
9. Bradfer-Lawrence, T., et al. (2023). *Using acoustic indices in ecology: Guidance on study design, analyses and interpretation.* Methods in Ecology and Evolution. https://besjournals.onlinelibrary.wiley.com/doi/10.1111/2041-210X.14194
10. Farina, A., et al. (2025). *The Acoustic Complexity Index (ACI): theoretical foundations, applied perspectives and semantics* (critical review). Oikos. https://nsojournals.onlinelibrary.wiley.com/doi/10.1111/oik.10760
11. de Cheveigné, A., & Kawahara, H. (2002). *YIN, a fundamental frequency estimator for speech and music.* Journal of the Acoustical Society of America 111(4): 1917–1930. https://pubs.aip.org/asa/jasa/article/111/4/1917/547221/YIN-a-fundamental-frequency-estimator-for-speech (PDF: http://audition.ens.fr/adc/pdf/2002_JASA_YIN.pdf)
12. *Pitch- and spectral-based dynamic time warping methods for comparing field recordings of harmonic avian vocalizations.* Journal of the Acoustical Society of America (2013). https://pubmed.ncbi.nlm.nih.gov/23927136/
13. Araya-Salas, M., & Smith-Vidaurre, G. (2017). *warbleR: an R package to streamline analysis of animal acoustic signals* (segmentation, measurements, cross-correlation). Methods in Ecology and Evolution 8(2): 184–191. https://besjournals.onlinelibrary.wiley.com/doi/10.1111/2041-210X.12624
14. Sainburg, T., Thielk, M., & Gentner, T. Q. (2020). *Finding, visualizing, and quantifying latent structure across diverse animal vocal repertoires* (UMAP/latent embeddings). PLOS Computational Biology 16(10): e1008228. https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008228
15. Thomas, M., et al. (2022). *A practical guide for generating unsupervised, spectrogram-based latent space representations of animal vocalizations.* Journal of Animal Ecology 91(8). https://besjournals.onlinelibrary.wiley.com/doi/full/10.1111/1365-2656.13754
16. Goffinet, J., Brudner, S., Mooney, R., & Pearson, J. (2021). *Low-dimensional learned feature spaces quantify individual and group differences in vocal repertoires* (VAE). eLife 10: e67855. https://elifesciences.org/articles/67855
17. Kahl, S., Wood, C. M., Eibl, M., & Klinck, H. (2021). *BirdNET: A deep learning solution for avian diversity monitoring.* Ecological Informatics 61: 101236. https://www.sciencedirect.com/science/article/pii/S1574954121000273
18. Ghani, B., et al. (2023). *Feature embeddings from the BirdNET algorithm provide insights into avian ecology.* Ecological Informatics. https://www.sciencedirect.com/science/article/abs/pii/S1574954123000249
19. Google Research (2022). *Separating Birdsong in the Wild for Classification* (unsupervised source separation / MixIT). https://research.google/blog/separating-birdsong-in-the-wild-for-classification/
20. Bermant, P. C., et al. (2021). *BioCPPNet: automatic bioacoustic source separation with deep neural networks.* Scientific Reports 11: 23502. https://www.nature.com/articles/s41598-021-02790-2
21. Wang, et al. (2026). *Separating Overlapping Birdsongs Enhances the Reliability of Avian Vocal Activity Analysis.* Ecology and Evolution. https://onlinelibrary.wiley.com/doi/10.1002/ece3.73648
22. scikit-maad documentation — Python acoustic-index & feature implementations (ACI, spectral features, etc.). https://scikit-maad.github.io/generated/maad.features.acoustic_complexity_index.html

*Note on validation labels: "well established / validated" = repeatedly used and tested in peer-reviewed ornithology/ecoacoustics; "standard MIR / exploratory" = borrowed from music/speech DSP and useful as ML features or descriptive glyphs but not primary, biologically named avian traits. When two sources gave slightly different default parameters (e.g. NDSI biophony upper bound 8 vs 11 kHz), the software-default value is quoted from the soundecology/seewave documentation.*
