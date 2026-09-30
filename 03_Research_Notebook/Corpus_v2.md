# Corpus v2 - Licence-Clear Evidence Corpus for the v2.0 Experiments

**Date built:** 2026-09-29 (manifest `createdAt` 2026-09-29T14:51:16.386Z)
**Built by:** `tools/download_corpus.js` (no API key needed)
**Manifest:** `manifest_v2_corpus.json` (repo root, committed)
**Audio:** `Assets/v2_corpus/<species_slug>/<source>_<id>.<ext>` (gitignored; restore with `--verify`)
**Status:** Built and verified (62/62 files match their manifest sha256)

## Why this corpus exists

Experiments 001-006 were run on the historical Vale MAC corpus (`vale/MAC/slice_2/acoustic-data/...`, locally `Assets/slice_2_acoustic_data`, referenced by `manifest_slice2_birdnet_150.csv` and the other root manifests). **That audio is not present on this machine.** Only the manifests remain; `Assets/` currently holds `smoke/` and this new `v2_corpus/`.

So the v2.0 work cannot reproduce 001-006. Any result computed on this corpus is a **new experiment on a new corpus**. It must not be reported as a reproduction or confirmation of the earlier numbers, such as the Experiment 001 trustworthiness table. Earlier conclusions can only be *re-tested* here, and each re-test says so.

The corpus also fixes two problems for the v2 work:

1. **Licence-clear.** Every file is CC0, CC BY or CC BY-SA, with attribution recorded per file. The Vale manifests (for example `manifest_slice2_birdnet_150.csv`) have no licence column. The Xeno-canto downloader (`tools/download_xeno_canto.js`) records each licence but does not filter on it.
2. **No API key.** iNaturalist API v1 and Wikimedia Commons are both public, so anyone can rebuild or verify the corpus.

## Sources

| Source | Endpoint | Key needed | Used for |
|---|---|---|---|
| iNaturalist API v1 | `https://api.inaturalist.org/v1/observations` | No | The 60 evidence recordings |
| iNaturalist static files | `https://static.inaturalist.org/sounds/<soundId>.<ext>` | No | Audio bytes |
| Wikimedia Commons API | `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url\|size\|mime\|sha1\|extmetadata` | No | The 2 Bluethroat demo files: licence, author, sha1 |
| Wikimedia upload server | `https://upload.wikimedia.org/wikipedia/commons/...` | No | Audio bytes |

The client sends the User-Agent `birdsong-3d-export-tool/2.0 (research)`. It waits at least 400 ms between requests and retries up to 4 times on network errors, HTTP 429 or HTTP 5xx. Backoff is exponential: 1 s base, or 5 s base for 429, and `Retry-After` is honoured when the server sends it.

## Selection rules (pre-committed in code: `SELECTION_RULES` in the tool and in the manifest)

1. **Species (12).** Chosen for diverse sound types: tonal, noisy/harsh, trills, repetitive, low owls. *Erithacus rubecula, Turdus merula, Fringilla coelebs, Phylloscopus collybita, Troglodytes troglodytes, Parus major, Sylvia atricapilla, Emberiza citrinella, Cuculus canorus, Strix aluco, Corvus corone, Luscinia svecica.*
2. **Candidate pool.** One API request per species: `sounds=true&taxon_name=<name>&sound_license=cc0,cc-by,cc-by-sa&quality_grade=research&per_page=200&order_by=votes&order=desc`. That is the first 200 results, the API's per-page maximum.
3. **Pre-filters on each observation:**
   - `quality_grade == research`.
   - `taxon.name` is the species or one of its trinomials. For example, `Parus major major` is accepted and `Parus cinereus` is rejected.
     - The build ran with a looser prefix check, which would also have accepted a hybrid such as `Corvus corone × cornix`. Review tightened it to exactly one extra epithet. Re-querying all 12 pools found no taxon name that the two checks treat differently, so the tightening does not change this corpus.
   - Not `captive`.
4. **Licence.** The **sound's** `license_code` must be in {cc0, cc-by, cc-by-sa}. The observation's licence is ignored.
5. **One sound per observation.** Take the first sound in `sounds[]` that has an allowed licence and is neither hidden nor flagged. If that sound fails a later check, the whole observation is rejected. Its other sounds are not tried.
6. **Ranking.** Candidates are re-sorted locally by `cached_votes_total` descending, then observation id ascending. The local sort is needed because the API's order inside a vote tie is not id order.
7. **Observer diversity.**
   - Pass 1 takes only observers not yet used for that species.
   - Pass 2 runs only if the target is still unmet, and allows a second recording from an observer (at most 2 per observer per species).
   - In this build pass 2 was never needed: every species has 5 distinct observers.
8. **Per-file checks, after download.** Rejected files are deleted and the next candidate is tried.
   - Size ≤ 25 MiB (26,214,400 bytes). The download aborts once it goes past this.
   - Duration 5-120 s, from bundled `ffprobe` `format.duration`.
   - Must decode cleanly: `ffmpeg -v error -i <file> -vn -ac 1 -ar 22050 -f f32le pipe:1` exits 0, prints nothing at error level, and yields more than 0 samples. This matches the production decode (mono, 22,050 Hz).
9. **Target.** 5 per species, minimum 4. If a species falls short, that is logged in `summary.speciesBelowTarget` / `speciesBelowMinimum`. There are no silent caps.

Every rejection is kept in the manifest's `selectionLog`. That includes each pre-filter reason with its count, and each downloaded-and-rejected file with its reason.

## Final counts (actual, from `manifest_v2_corpus.json`)

**60 recordings from 12 species, 5 per species. Every species met the target of 5.** The recordings come from 49 distinct observers. Total audio is 1,514.8 s (about 25.2 min), with a median duration of 19.6 s.

| Species | Common name (iNat) | Selected | Distinct observers | Total s | Duration range s | API total_results | Pool | Eligible after pre-filters | Downloaded & rejected |
|---|---|---:|---:|---:|---|---:|---:|---:|---:|
| Erithacus rubecula | European Robin | 5 | 5 | 104.3 | 10.6-41.2 | 2500 | 200 | 198 | 4 |
| Turdus merula | Eurasian Blackbird | 5 | 5 | 143.7 | 7.1-40.3 | 2330 | 200 | 199 | 4 |
| Fringilla coelebs | Common Chaffinch | 5 | 5 | 146.2 | 14.8-50.8 | 1806 | 200 | 196 | 0 |
| Phylloscopus collybita | Common Chiffchaff | 5 | 5 | 174.9 | 5.5-96.6 | 2456 | 200 | 197 | 0 |
| Troglodytes troglodytes | Eurasian Wren | 5 | 5 | 92.4 | 7.4-34.9 | 6647 | 200 | 41 | 4 |
| Parus major | Great Tit | 5 | 5 | 168.5 | 9.8-55.1 | 2448 | 200 | 198 | 0 |
| Sylvia atricapilla | Eurasian Blackcap | 5 | 5 | 169.5 | 5.7-104.2 | 1868 | 200 | 200 | 2 |
| Emberiza citrinella | Yellowhammer | 5 | 5 | 95.8 | 11.1-24.9 | 337 | 200 | 200 | 2 |
| Cuculus canorus | Common Cuckoo | 5 | 5 | 69.4 | 5.9-38.6 | 910 | 200 | 200 | 0 |
| Strix aluco | Tawny Owl | 5 | 5 | 126.6 | 8.4-51.1 | 955 | 200 | 200 | 0 |
| Corvus corone | Carrion Crow | 5 | 5 | 59.8 | 5.7-22.9 | 421 | 200 | 158 | 1 |
| Luscinia svecica | Bluethroat | 5 | 5 | 163.8 | 12.3-55.8 | 114 | 114 | 114 | 1 |

`total_results` is the API's own count at query time, and it will change. The number of files that were downloaded and then rejected, across all species, is 18:

- **Duration too short (< 5 s): 7.** These were 2.74, 3.11, 3.38, 4.02, 4.17, 4.32 and 4.92 s long.
- **Duration too long (> 120 s): 6.** These were 154.7, 158.5, 183.2, 217.4, 282.5 and 579.4 s long.
- **Failed the strict decode check: 5.**
  - 3 AAC files reported `Input buffer exhausted before END element found`. One each came from Erithacus, Turdus and Sylvia.
  - 2 MP3 files reported `Header missing` / `Invalid data found when processing input`. One each came from Erithacus and Troglodytes.

  These files might partly decode. The rule rejects them anyway, because a clip that decodes with errors cannot be trusted as evidence.

The exact list, with observation and sound ids, is in `selectionLog[].checkedAndRejected`.

**Pre-filter observation: `taxon_name` is a loose text match in iNaturalist.**

- **Wren.** For `Troglodytes troglodytes`, only 41 of the 200 returned observations were actually Eurasian Wren or a subspecies. The rest included *Thryothorus ludovicianus* (55), *Troglodytes aedon* (17), *Troglodytes hiemalis* (15), *Troglodytes pacificus* (14) and even *Pan troglodytes* (2, including a subspecies).
- **Crow.** For `Corvus corone`, 40 were *Corvus cornix* and 2 were *C. cornix × corone* hybrids.
- **Smaller cases.** *Phylloscopus ibericus* (3), *Fringilla moreletti* / *canariensis palmae* (3) and *Parus cinereus okinawae* (2).

The strict `taxon.name` check removed all of these, so the loose match did not change any label. A hardening option is to resolve and query by `taxon_id`. That is not implemented; see "Open issues" below.

**Subspecies accepted:** *Erithacus rubecula melophilus*, *Phylloscopus collybita tristis* and *Parus major major*. Each record stores `taxonName`, the observation's taxon as given, next to `scientificName`, the corpus species label.

### Demo list (Bluethroat, Wikimedia Commons, separate from the 60)

These two files are **not** part of the evidence set. They are the product demo and smoke recordings. Their licence, author and sha1 come from the Commons API. The downloaded bytes' sha1 matches Commons' `sha1` for both files.

| File | Licence | Author (Commons `Artist`) | Credit / description | Date | Duration s | Format |
|---|---|---|---|---|---:|---|
| `Luscinia_svecica_song.ogg` | CC BY 3.0 | Justin Jansen | waarneming.nl/sound/view/42909 converted to .ogg; "Kraaijenbergse Plassen - Linden, The Netherlands" | 2016-04-08 | 13.70 | Vorbis, 44.1 kHz, 2 ch |
| `Luscinia_svecica.ogg` | CC BY-SA 3.0 | Vladimir Yu. Arkhipov (Arkhivov) | Own work; "Song of Bluethroat, Chukotka, Russia" | 2007-06-02 | 15.76 | Vorbis, 44.1 kHz, 1 ch |

Both demo files would also pass the evidence selection rules: duration, size and decode (`selectionRulesCheck` in the manifest). The existing smoke file `Assets/smoke/Luscinia_svecica_song.ogg` has the same sha1 as the Commons `Luscinia_svecica_song.ogg` (`997a5ff7...`).

## Licence breakdown (evidence set)

| Licence | Recordings |
|---|---:|
| CC BY | 45 |
| CC0 | 13 |
| CC BY-SA | 2 |

Demo: 1 × CC BY 3.0 and 1 × CC BY-SA 3.0.

## Attribution requirements

- **CC BY / CC BY-SA.** Any redistributed audio, derived export or screen that plays or shows a recording must credit the author. Use the manifest's `attribution` string, which is the iNat sound attribution such as `(c) <name>, some rights reserved (CC BY)`. Also give the licence and link to `observationUrl`.
  - The two **CC BY-SA** iNat recordings and the CC BY-SA demo file carry **ShareAlike**. Derived audio (clips, re-encodes) must be released under the same licence.
  - Whether a PCA coordinate export counts as a "derivative" is a legal question and has not been answered here. Keep the attribution with any export either way.
- **CC0.** No attribution is required. The manifest still records the observer.
- `recordist` is the iNaturalist **observer/uploader** (`user.name`, falling back to `user.login`). iNaturalist does not record separately who made the recording.

## Technical profile (measured with bundled ffprobe)

- **Codec:** mp3 25, aac 21, pcm_s16le 9, pcm_s24le 4, pcm_f32le 1.
- **File extensions:** .mp3 23, .m4a 21, .wav 14, .mpga 2. The `.mpga` files are MP3 data with iNaturalist's own extension.
- **Source sample rate:**
  - 44.1 kHz: 41
  - 48 kHz: 15
  - 192 kHz: 1 (Strix aluco `inat_433337`)
  - 32 kHz: 1 (Sylvia atricapilla `inat_69521`)
  - 24 kHz: 1 (Luscinia svecica `inat_333504`)
  - 22.05 kHz: 1 (Turdus merula `inat_366234`)

  The 22.05 and 24 kHz files have no real content above about 11-12 kHz. At the production analysis rate of 22,050 Hz, that is at or above Nyquist, so it does not matter for PR features.
- **Channels:** mono 38, stereo 22. The production decode downmixes to mono.
- **Size:** 77,468,326 bytes of evidence audio plus 412,076 bytes of demo audio, 77,880,402 bytes in total (77.9 MB). The largest file is 13,831,584 bytes.
- **Tool versions:** ffmpeg `6.0` (ffmpeg-static) and ffprobe `n4.4.1` (@ffprobe-installer). These are **different versions**, and both are recorded in the manifest.

**Note (2026-09-29, pre-run consistency amendments to Experiments 007–012):** these are the versions on the machine that built the manifest. By owner decision OD-5 (Leonard Lind, project owner, 2026-09-29, working session), Experiment 012 Part A certifies the exact binary it runs on; the approved reference machine is a Windows PC on which the same ffmpeg-static package resolves to "ffmpeg version 6.1.1-essentials_build-www.gyan.dev" (win32-x64), with ffprobe from @ffprobe-installer/win32-x64. So the npm package does not pin the decoder version across platforms. Every v2 runner must log its ffmpeg/ffprobe version strings and binary SHA-256, and each experiment's freeze must record them (Amendment C02); where a runner uses `decodedSamples22050` it must re-derive it on its own binary and log any difference as a deviation. The manifest itself is the corpus of record and is not rewritten. On that PC, checked 2026-09-29, ffprobe reports "ffprobe version 2023-02-13-git-2296078397-essentials_build-www.gyan.dev", so ffprobe also differs from the manifest's `n4.4.1`.

## Known biases and limits

1. **Citizen-science recordings.**
   - Phones and handheld recorders, with varied gear, gain, compression and SNR.
   - Formats are mixed: lossy AAC/MP3 next to PCM WAV.
   - Uploaders may have trimmed, filtered or amplified files before upload. iNaturalist does not record this, and it has not been checked here.
2. **Background species.** A recording can contain other birds, people, traffic or wind. Nothing here checks or removes that.
3. **Labels are observation-level identifications.** A research-grade iNat label means the community agreed on the *observation's* taxon. It is **not** a per-sound, per-second verification that the target species is the loudest or only source.
4. **Rule 001 still applies.** Species labels are never passed into any fitting step (scaling, PCA, neighbours) or into the trustworthiness score. They are metadata for evaluation only, as in Experiment 001's label-exclusion verification.
5. **Observer and device confound.**
   - 10 observers contribute to more than one species. For example, `rowan_m` contributes to Phylloscopus collybita, Parus major and Cuculus canorus, and `asur` to Strix aluco and Luscinia svecica.
   - Codecs and sample rates are unevenly spread across species. Parus major is 4/5 PCM; Cuculus canorus is 4/5 AAC; Luscinia svecica is 4/5 MP3.
   - Experiment 005 already flagged that recording conditions can explain manifold structure. Any v2 test comparing species or recordings must check for this and not over-read species separation.
6. **Geography.** `placeGuess` is free text, kept exactly as given. Going by the strings, most recordings are from Europe (UK/GB, Germany, France, European Russia, Italy, Austria, ...). At least 4 are from western Asia: 2 give Novosibirsk Oblast and 2 give the Anatolian side of Istanbul. One string ("Abbot's Wood") names no country. The strings have not been parsed or geocoded.
7. **Vote-based ranking carries little quality signal.** Of the selected observations, 46 have `cached_votes_total = 1` and 14 have 0. The ranking is effectively "voted observations first, then oldest id first". It is a deterministic tie-break, not a quality filter.
8. **Small n.** 5 recordings per species is enough for within-recording analyses and smoke-level cross-recording checks. It is not enough for strong population-level claims.

## Reproducibility

- **Verify, or restore missing audio:**
  ```
  node tools/download_corpus.js --verify
  ```
  This re-downloads any manifest file missing from `Assets/v2_corpus/` using its `fileUrl`. It then checks every file's sha256 against the manifest. It exits with code 1 on any mismatch or failure.
- **Tested:** 2 files were deleted, then `--verify` re-downloaded them. Result: `62/62 files match manifest sha256; 2 re-downloaded; 0 failures`.
- **Re-selection matched once, minutes apart:**
  ```
  node tools/download_corpus.js
  ```
  The first and second builds, minutes apart, picked the identical 60 sound ids.
- **Re-selection is not reproducible, even on the same day.** A review on 2026-09-29, a few hours after the build, re-queried all 12 species pools (no manifest rewrite):
  - `total_results` was unchanged for every species.
  - 58 of the 60 selected observations were still in their species' 200-result pool.
  - The 2 missing ones are both 0-vote Eurasian Wren observations.
  - The Wren pool now had 51 observations passing the taxon check, against 41 at build time.

  The cause is the pool cut-off. Wren has 6,647 results, and 147 of the 200 in the pool have 0 votes. Inside that tied vote tier, the API's own order decides which observations make the first 200, and that order changed. Species whose whole candidate set fits in one page (Luscinia svecica, 114) are not affected by this cut. On top of that, the pool changes as observations are added, re-identified or voted on. **The committed manifest (ids + sha256) is the corpus of record.** Do not re-run selection to "refresh" it without logging a new corpus version.
- **Source-side risk.** If an uploader deletes a sound or changes its licence, `--verify` can no longer restore it. The recorded sha256 will show that as a failure, not hide it.

## Open issues

- **Query by taxon id.** Querying by `taxon_id` instead of `taxon_name` would make the candidate pool cleaner. This has not been done, and it would change the pool, so it would need a new corpus version.
- **Decode strictness.** The strict error-level decode check rejects files that ffmpeg can partly decode (3 AAC, 2 MP3). This is deliberate, but it may bias the corpus slightly against some phone/app encoders.
- **Browser playback of `.mpga`.** Two files use iNaturalist's `.mpga` extension (MP3 data). Browser playback may need a MIME or extension mapping. ffmpeg decodes them fine.
- **Short recordings.** Duration is 5-120 s, and production windows are ~0.16 s every ~0.046 s. So a 5 s clip yields far fewer points than the 700 cap, before the quietest-20 % drop. Per-recording point counts will vary widely.
- **Network failures substitute candidates.** If a download still fails after 4 retries, the candidate is rejected (logged as `download failed: ...`) and the next one is tried. So a bad network during a rebuild can change the selection. No such rejection happened in this build.
- **ShareAlike on exports.** Whether exported PCA coordinates count as derivative works of CC BY-SA audio has not been decided.
