// Builds the v2 evidence corpus: a licence-clear, reproducible set of bird recordings
// that downloads WITHOUT any API key.
//
//   node tools/download_corpus.js            select + download + write manifest_v2_corpus.json
//   node tools/download_corpus.js --verify   re-download files missing from the manifest and
//                                            check every file's sha256 (reproducibility check)
//
// Sources
//   - iNaturalist API v1 (no key): research-grade observations with sounds whose SOUND licence
//     is cc0 / cc-by / cc-by-sa. The sound's own license_code is authoritative, never the
//     observation's licence.
//   - Wikimedia Commons (no key): two Bluethroat files kept as a separate "demo" list. Their
//     licence, author and sha1 are read from the Commons API, not typed in by hand.
//
// Selection is deterministic given the API's candidate pool (see SELECTION_RULES below and
// 03_Research_Notebook/Corpus_v2.md). Because the iNaturalist pool itself changes as people
// upload and vote, the reproducibility guarantee is the committed manifest + --verify, not
// re-running the selection months later.
//
// Every rejection is logged into the manifest's selectionLog -- there are no silent caps.

const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");
const { spawn, execFileSync } = require("child_process");
const { FFMPEG, FFPROBE, ffmpegVersion } = require("./lib/ffbin");

const ROOT = path.resolve(__dirname, "..");
const CORPUS_DIR = path.join(ROOT, "Assets", "v2_corpus");
const MANIFEST_PATH = path.join(ROOT, "manifest_v2_corpus.json");
const USER_AGENT = "birdsong-3d-export-tool/2.0 (research)";
const MIN_REQUEST_GAP_MS = 400;
const MAX_RETRIES = 4;
const RETRY_BASE_MS = 1000;
const RATE_LIMIT_BASE_MS = 5000;

const SPECIES = [
  "Erithacus rubecula",
  "Turdus merula",
  "Fringilla coelebs",
  "Phylloscopus collybita",
  "Troglodytes troglodytes",
  "Parus major",
  "Sylvia atricapilla",
  "Emberiza citrinella",
  "Cuculus canorus",
  "Strix aluco",
  "Corvus corone",
  "Luscinia svecica",
];

const ALLOWED_LICENSES = ["cc0", "cc-by", "cc-by-sa"];

const SELECTION_RULES = {
  targetPerSpecies: 5,
  minimumPerSpecies: 4,
  candidatePoolPerSpecies: 200, // iNaturalist API v1 per_page maximum; one page per species
  qualityGrade: "research",
  allowedSoundLicenses: ALLOWED_LICENSES,
  licenceField: "observation.sounds[].license_code (the sound's licence, not the observation's)",
  taxonMatch: "observation.taxon.name equals the species name or is a descendant trinomial (species name + ' ' + epithet)",
  excludeCaptive: true,
  excludeHiddenOrFlaggedSounds: true,
  soundsPerObservation: "at most one: the first sound in the observation's sounds[] array whose licence is allowed and which is neither hidden nor flagged; if that sound fails a check the observation is rejected (its other sounds are not tried)",
  maxPerUserPerSpecies: 2,
  userPreference: "pass 1 takes only observers not yet used for the species; pass 2 (only if the target is not met) allows a second recording from an already-used observer",
  ranking: "iNaturalist order_by=votes&order=desc for the pool, then re-sorted locally by cached_votes_total descending, observation id ascending",
  durationSeconds: { min: 5, max: 120, measuredWith: "ffprobe format.duration after download" },
  maxBytes: 25 * 1024 * 1024,
  maxBytesNote: "25 MiB = 26214400 bytes; the download is aborted as soon as it exceeds this",
  decodeCheck: "ffmpeg -v error -i <file> -vn -ac 1 -ar 22050 -f f32le pipe:1 must exit 0, print nothing at error level, and yield > 0 samples",
  rejectsAreDeleted: true,
};

const COMMONS_DEMO_FILES = ["File:Luscinia_svecica_song.ogg", "File:Luscinia_svecica.ogg"];

// ---------------------------------------------------------------------------------------
// HTTP: polite, rate-limited, retrying
// ---------------------------------------------------------------------------------------

let lastRequestAt = 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function politeGap() {
  const wait = lastRequestAt + MIN_REQUEST_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

function isRetryable(err) {
  return !err.statusCode || err.statusCode === 429 || err.statusCode >= 500;
}

async function withRetries(label, fn) {
  let attempt = 0;
  for (;;) {
    await politeGap();
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt > MAX_RETRIES || !isRetryable(err)) throw err;
      // HTTP 429: honour Retry-After when given, else back off from a longer base
      // (observed on upload.wikimedia.org for a burst of two file requests).
      const retryAfterMs = Number(err.retryAfterSeconds) * 1000;
      const base = err.statusCode === 429 ? RATE_LIMIT_BASE_MS : RETRY_BASE_MS;
      const backoff = Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? retryAfterMs : base * 2 ** (attempt - 1);
      console.warn(`  retry ${attempt}/${MAX_RETRIES} for ${label} in ${backoff} ms (${err.message})`);
      await sleep(backoff);
    }
  }
}

// One GET, following redirects. onResponse(res, resolve, reject) consumes a 200 response.
function rawGet(url, onResponse, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": USER_AGENT } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirects >= 5) return reject(new Error(`Too many redirects: ${url}`));
        rawGet(new URL(res.headers.location, url).toString(), onResponse, redirects + 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c.length < 400 ? c : ""));
        res.on("end", () => {
          const err = new Error(`GET ${url} -> HTTP ${res.statusCode} ${body.slice(0, 200)}`);
          err.statusCode = res.statusCode;
          err.retryAfterSeconds = res.headers["retry-after"];
          reject(err);
        });
        return;
      }
      onResponse(res, resolve, reject);
    });
    req.setTimeout(60000, () => req.destroy(new Error(`Timeout: ${url}`)));
    req.on("error", reject);
  });
}

function getJson(url) {
  return withRetries(url, () =>
    rawGet(url, (res, resolve, reject) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`Invalid JSON from ${url}: ${err.message}`));
        }
      });
      res.on("error", reject);
    }),
  );
}

// Streams url -> destPath, hashing on the fly. Aborts (and deletes the partial file) once
// maxBytes is exceeded, so an oversized file is never fully downloaded.
function downloadFile(url, destPath, maxBytes = Infinity) {
  const partPath = `${destPath}.part`;
  return withRetries(url, () =>
    rawGet(url, (res, resolve, reject) => {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      const hash = crypto.createHash("sha256");
      const out = fs.createWriteStream(partPath);
      let bytes = 0;
      let aborted = false;
      const fail = (err) => {
        if (aborted) return;
        aborted = true;
        res.destroy();
        out.destroy();
        fs.rmSync(partPath, { force: true });
        reject(err);
      };
      const declared = Number(res.headers["content-length"]);
      if (Number.isFinite(declared) && declared > maxBytes) {
        const err = new Error(`too large: Content-Length ${declared} > ${maxBytes}`);
        err.statusCode = 413; // not retryable
        err.oversize = true;
        return fail(err);
      }
      res.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > maxBytes) {
          const err = new Error(`too large: exceeded ${maxBytes} bytes while downloading`);
          err.statusCode = 413;
          err.oversize = true;
          return fail(err);
        }
        hash.update(chunk);
      });
      res.on("error", fail);
      out.on("error", fail);
      res.pipe(out);
      out.on("finish", () => {
        if (aborted) return;
        fs.renameSync(partPath, destPath);
        resolve({ bytes, sha256: hash.digest("hex") });
      });
    }),
  );
}

function hashFile(filePath, algorithm = "sha256") {
  return crypto.createHash(algorithm).update(fs.readFileSync(filePath)).digest("hex");
}

// ---------------------------------------------------------------------------------------
// Audio checks (bundled ffprobe / ffmpeg only)
// ---------------------------------------------------------------------------------------

function ffprobeVersion() {
  try {
    return execFileSync(FFPROBE, ["-version"], { encoding: "utf8" }).split("\n")[0].trim();
  } catch {
    return null;
  }
}

function probeAudio(filePath) {
  const raw = execFileSync(
    FFPROBE,
    ["-hide_banner", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", filePath],
    { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
  );
  const info = JSON.parse(raw);
  const stream = (info.streams || []).find((s) => s.codec_type === "audio");
  if (!stream) throw new Error("ffprobe found no audio stream");
  const duration = Number(info.format && info.format.duration);
  return {
    durationSeconds: Number.isFinite(duration) ? duration : null,
    sourceSampleRateHz: Number(stream.sample_rate) || null,
    channels: Number(stream.channels) || null,
    codec: stream.codec_name || null,
  };
}

function decodeCheck(filePath) {
  return new Promise((resolve) => {
    const proc = spawn(FFMPEG, ["-hide_banner", "-v", "error", "-i", filePath, "-vn", "-ac", "1", "-ar", "22050", "-f", "f32le", "pipe:1"]);
    let bytes = 0;
    let stderr = "";
    proc.stdout.on("data", (c) => (bytes += c.length));
    proc.stderr.on("data", (c) => (stderr += c));
    proc.on("error", (err) => resolve({ ok: false, reason: `ffmpeg failed to start: ${err.message}` }));
    proc.on("close", (code) => {
      const samples = Math.floor(bytes / 4);
      if (code !== 0) return resolve({ ok: false, reason: `ffmpeg exit ${code}: ${stderr.trim().slice(0, 200)}` });
      if (stderr.trim()) return resolve({ ok: false, reason: `ffmpeg reported errors: ${stderr.trim().slice(0, 200)}` });
      if (samples === 0) return resolve({ ok: false, reason: "ffmpeg decoded 0 samples" });
      resolve({ ok: true, decodedSamples22050: samples });
    });
  });
}

// ---------------------------------------------------------------------------------------
// Pure selection logic (unit-tested in tools/test/download_corpus.test.js)
// ---------------------------------------------------------------------------------------

function slugify(scientificName) {
  return scientificName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function taxonMatches(taxonName, scientificName) {
  if (!taxonName) return false;
  if (taxonName === scientificName) return true;
  // Exactly one extra lower-case epithet: rejects hybrids such as "Corvus corone × cornix"
  // that a bare prefix check would accept.
  const escaped = scientificName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped} [a-z][a-z-]*$`).test(taxonName);
}

function extensionFromUrl(fileUrl) {
  const ext = path.extname(new URL(fileUrl).pathname).toLowerCase();
  return ext || ".bin";
}

// Turns one API observation into at most one candidate, or a pre-filter rejection reason.
function observationToCandidate(obs, scientificName) {
  if (obs.quality_grade !== SELECTION_RULES.qualityGrade) return { reject: `quality_grade=${obs.quality_grade}` };
  if (!obs.taxon || !taxonMatches(obs.taxon.name, scientificName)) {
    return { reject: `taxon mismatch (${obs.taxon ? obs.taxon.name : "none"})` };
  }
  if (obs.captive) return { reject: "captive/cultivated" };
  const sounds = Array.isArray(obs.sounds) ? obs.sounds : [];
  const sound = sounds.find(
    (s) =>
      s &&
      s.file_url &&
      ALLOWED_LICENSES.includes(String(s.license_code || "").toLowerCase()) &&
      !s.hidden &&
      !(Array.isArray(s.flags) && s.flags.length > 0),
  );
  if (!sound) {
    const codes = sounds.map((s) => s && s.license_code).join(",");
    return { reject: `no eligible sound (sound licences: ${codes || "none"})` };
  }
  const user = obs.user || {};
  return {
    candidate: {
      observationId: obs.id,
      soundId: sound.id,
      votes: Number(obs.cached_votes_total) || 0,
      userLogin: user.login || null,
      userName: user.name || null,
      license: String(sound.license_code).toLowerCase(),
      attribution: sound.attribution || null,
      fileUrl: sound.file_url,
      fileContentType: sound.file_content_type || null,
      observationUrl: obs.uri || `https://www.inaturalist.org/observations/${obs.id}`,
      taxonName: obs.taxon.name,
      commonName: obs.taxon.preferred_common_name || null,
      observedOn: obs.observed_on || null,
      placeGuess: obs.place_guess === undefined ? null : obs.place_guess,
    },
  };
}

function rankCandidates(candidates) {
  return [...candidates].sort((a, b) => b.votes - a.votes || a.observationId - b.observationId);
}

// Walks ranked candidates in two passes (distinct observers first, then up to
// maxPerUser). check(candidate) resolves {ok:true, record} or {ok:false, reason}; each
// candidate is checked at most once.
async function selectCandidates(ranked, check, { target, maxPerUser }) {
  const selected = [];
  const rejected = [];
  const perUser = new Map();
  const tried = new Set();
  const userKey = (c) => c.userLogin || `anon:${c.observationId}`;

  for (const allowedPerUser of [1, maxPerUser]) {
    for (const cand of ranked) {
      if (selected.length >= target) break;
      if (tried.has(cand.observationId)) continue;
      const used = perUser.get(userKey(cand)) || 0;
      if (used >= allowedPerUser) continue;
      tried.add(cand.observationId);
      const result = await check(cand);
      if (result.ok) {
        selected.push(result.record);
        perUser.set(userKey(cand), used + 1);
      } else {
        rejected.push({ observationId: cand.observationId, soundId: cand.soundId, reason: result.reason });
      }
    }
  }
  const notTriedDueToUserCap = ranked.filter((c) => !tried.has(c.observationId)).length;
  return { selected, rejected, untriedCandidates: notTriedDueToUserCap };
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Commons "Artist" is free HTML. Take the text of the first link that has visible text
// (a user page / external profile), else the whole stripped string.
function commonsArtistName(artistHtml) {
  const links = [...String(artistHtml || "").matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)];
  for (const m of links) {
    const text = stripHtml(m[1]);
    if (text) return text;
  }
  return stripHtml(artistHtml) || null;
}

// ---------------------------------------------------------------------------------------
// Checks that turn a candidate into a manifest record
// ---------------------------------------------------------------------------------------

async function checkAudioFile(localPath, rules) {
  let probe;
  try {
    probe = probeAudio(localPath);
  } catch (err) {
    return { ok: false, reason: `ffprobe failed: ${err.message.split("\n")[0]}` };
  }
  if (rules && probe.durationSeconds !== null) {
    const { min, max } = rules.durationSeconds;
    if (probe.durationSeconds < min || probe.durationSeconds > max) {
      return { ok: false, reason: `duration ${probe.durationSeconds.toFixed(2)} s outside ${min}-${max} s`, probe };
    }
  }
  if (rules && probe.durationSeconds === null) return { ok: false, reason: "ffprobe reported no duration", probe };
  const decode = await decodeCheck(localPath);
  if (!decode.ok) return { ok: false, reason: decode.reason, probe };
  return { ok: true, probe, decode };
}

function makeInatChecker(scientificName) {
  const slug = slugify(scientificName);
  return async (cand) => {
    const ext = extensionFromUrl(cand.fileUrl);
    const id = `inat_${cand.soundId}`;
    const localPath = path.join(CORPUS_DIR, slug, `${id}${ext}`);
    let download;
    try {
      if (fs.existsSync(localPath)) {
        download = { bytes: fs.statSync(localPath).size, sha256: hashFile(localPath), reused: true };
        if (download.bytes > SELECTION_RULES.maxBytes) throw Object.assign(new Error("too large (existing file)"), { oversize: true });
      } else {
        download = await downloadFile(cand.fileUrl, localPath, SELECTION_RULES.maxBytes);
      }
    } catch (err) {
      fs.rmSync(localPath, { force: true });
      return { ok: false, reason: err.oversize ? err.message : `download failed: ${err.message}` };
    }
    const audio = await checkAudioFile(localPath, SELECTION_RULES);
    if (!audio.ok) {
      fs.rmSync(localPath, { force: true });
      return { ok: false, reason: audio.reason };
    }
    console.log(
      `    + ${id}${ext}  ${audio.probe.durationSeconds.toFixed(1)} s  ${(download.bytes / 1e6).toFixed(2)} MB  ${cand.license}  ${cand.userLogin}${download.reused ? "  (reused local file)" : ""}`,
    );
    return {
      ok: true,
      record: {
        id,
        source: "inaturalist",
        sourceId: String(cand.soundId),
        observationId: String(cand.observationId),
        observationUrl: cand.observationUrl,
        fileUrl: cand.fileUrl,
        scientificName,
        taxonName: cand.taxonName,
        commonName: cand.commonName,
        license: cand.license,
        attribution: cand.attribution,
        recordist: cand.userName || cand.userLogin,
        recordistLogin: cand.userLogin,
        observedOn: cand.observedOn,
        placeGuess: cand.placeGuess,
        votes: cand.votes,
        localPath: path.relative(ROOT, localPath).split(path.sep).join("/"),
        sha256: download.sha256,
        bytes: download.bytes,
        durationSeconds: audio.probe.durationSeconds,
        sourceSampleRateHz: audio.probe.sourceSampleRateHz,
        channels: audio.probe.channels,
        codec: audio.probe.codec,
        decodedSamples22050: audio.decode.decodedSamples22050,
      },
    };
  };
}

// ---------------------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------------------

function inatQueryUrl(scientificName) {
  const params = new URLSearchParams({
    sounds: "true",
    taxon_name: scientificName,
    sound_license: ALLOWED_LICENSES.join(","),
    quality_grade: SELECTION_RULES.qualityGrade,
    per_page: String(SELECTION_RULES.candidatePoolPerSpecies),
    order_by: "votes",
    order: "desc",
  });
  return `https://api.inaturalist.org/v1/observations?${params.toString()}`;
}

async function collectSpecies(scientificName) {
  const url = inatQueryUrl(scientificName);
  console.log(`\n${scientificName}\n  GET ${url}`);
  const json = await getJson(url);
  const results = Array.isArray(json.results) ? json.results : [];
  const candidates = [];
  const preFilterRejects = {};
  for (const obs of results) {
    const out = observationToCandidate(obs, scientificName);
    if (out.candidate) candidates.push(out.candidate);
    else preFilterRejects[out.reject] = (preFilterRejects[out.reject] || 0) + 1;
  }
  const ranked = rankCandidates(candidates);
  console.log(`  API total_results=${json.total_results}; pool=${results.length}; eligible candidates=${ranked.length}`);
  const { selected, rejected, untriedCandidates } = await selectCandidates(ranked, makeInatChecker(scientificName), {
    target: SELECTION_RULES.targetPerSpecies,
    maxPerUser: SELECTION_RULES.maxPerUserPerSpecies,
  });
  for (const r of rejected) console.log(`    - obs ${r.observationId} sound ${r.soundId}: ${r.reason}`);
  const log = {
    scientificName,
    query: url,
    apiTotalResults: json.total_results,
    poolSize: results.length,
    eligibleCandidates: ranked.length,
    preFilterRejects,
    checkedAndRejected: rejected,
    selected: selected.length,
    untriedCandidates,
    meetsTarget: selected.length >= SELECTION_RULES.targetPerSpecies,
    meetsMinimum: selected.length >= SELECTION_RULES.minimumPerSpecies,
  };
  if (!log.meetsTarget) console.warn(`  ! only ${selected.length} of target ${SELECTION_RULES.targetPerSpecies} selected`);
  return { selected, log };
}

async function collectCommonsDemo() {
  const params = new URLSearchParams({
    action: "query",
    titles: COMMONS_DEMO_FILES.join("|"),
    prop: "imageinfo",
    iiprop: "url|size|mime|sha1|extmetadata",
    format: "json",
    formatversion: "2",
  });
  const apiUrl = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
  console.log(`\nWikimedia Commons demo files\n  GET ${apiUrl}`);
  const json = await getJson(apiUrl);
  const pages = (json.query && json.query.pages) || [];
  const byTitle = new Map(pages.map((p) => [p.title.replace(/ /g, "_"), p]));
  const demo = [];
  const problems = [];
  for (const title of COMMONS_DEMO_FILES) {
    const page = byTitle.get(title);
    const info = page && page.imageinfo && page.imageinfo[0];
    if (!info) {
      problems.push({ title, reason: "not returned by Commons API" });
      continue;
    }
    const meta = info.extmetadata || {};
    const val = (k) => (meta[k] ? meta[k].value : null);
    const fileUrl = info.url.split("?")[0];
    const baseName = path.basename(new URL(fileUrl).pathname);
    const ext = path.extname(baseName).toLowerCase();
    const sourceId = baseName.slice(0, -ext.length);
    const id = `commons_${sourceId}`;
    const localPath = path.join(CORPUS_DIR, "luscinia_svecica", `${id}${ext}`);
    let download;
    try {
      download = fs.existsSync(localPath)
        ? { bytes: fs.statSync(localPath).size, sha256: hashFile(localPath) }
        : await downloadFile(fileUrl, localPath);
    } catch (err) {
      problems.push({ title, reason: `download failed: ${err.message}` });
      continue;
    }
    const sha1 = hashFile(localPath, "sha1");
    if (info.sha1 && sha1 !== info.sha1) problems.push({ title, reason: `sha1 mismatch vs Commons API (${sha1} != ${info.sha1})` });
    const audio = await checkAudioFile(localPath, null);
    if (!audio.ok) problems.push({ title, reason: audio.reason });
    const licenseShort = val("LicenseShortName");
    const recordist = commonsArtistName(val("Artist"));
    const rulesCheck = audio.probe
      ? {
          durationWithinSelectionRange:
            audio.probe.durationSeconds >= SELECTION_RULES.durationSeconds.min &&
            audio.probe.durationSeconds <= SELECTION_RULES.durationSeconds.max,
          sizeWithinLimit: download.bytes <= SELECTION_RULES.maxBytes,
          decodes: audio.ok,
        }
      : null;
    demo.push({
      id,
      source: "wikimedia_commons",
      sourceId: baseName,
      observationUrl: info.descriptionurl,
      fileUrl,
      scientificName: "Luscinia svecica",
      commonName: "Bluethroat",
      license: val("License"),
      licenseShortName: licenseShort,
      licenseUrl: val("LicenseUrl"),
      attribution: `${recordist}, ${licenseShort}, via Wikimedia Commons (${info.descriptionurl})`,
      recordist,
      credit: stripHtml(val("Credit")),
      description: stripHtml(val("ImageDescription")),
      observedOn: stripHtml(val("DateTimeOriginal")) || null,
      placeGuess: null,
      placeGuessNote: "Commons has no place field; the location is only in the free-text description",
      localPath: path.relative(ROOT, localPath).split(path.sep).join("/"),
      sha256: download.sha256,
      sha1,
      commonsSha1: info.sha1 || null,
      bytes: download.bytes,
      commonsReportedBytes: info.size,
      durationSeconds: audio.probe ? audio.probe.durationSeconds : null,
      sourceSampleRateHz: audio.probe ? audio.probe.sourceSampleRateHz : null,
      channels: audio.probe ? audio.probe.channels : null,
      codec: audio.probe ? audio.probe.codec : null,
      decodedSamples22050: audio.decode ? audio.decode.decodedSamples22050 : null,
      selectionRulesCheck: rulesCheck,
    });
    console.log(`    + ${id}${ext}  ${licenseShort}  ${recordist}  ${audio.probe ? audio.probe.durationSeconds.toFixed(1) + " s" : "?"}`);
  }
  return { demo, problems, apiUrl };
}

// ---------------------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------------------

async function buildCorpus() {
  const recordings = [];
  const selectionLog = [];
  const errors = [];
  for (const species of SPECIES) {
    try {
      const { selected, log } = await collectSpecies(species);
      recordings.push(...selected);
      selectionLog.push(log);
    } catch (err) {
      console.error(`  ! ${species} failed: ${err.message}`);
      errors.push({ scientificName: species, error: err.message });
      selectionLog.push({ scientificName: species, error: err.message, selected: 0, meetsTarget: false, meetsMinimum: false });
    }
  }
  const { demo, problems, apiUrl } = await collectCommonsDemo();

  const manifest = {
    createdAt: new Date().toISOString(),
    tool: { path: "tools/download_corpus.js", userAgent: USER_AGENT, node: process.version },
    ffmpegVersion: ffmpegVersion(),
    ffprobeVersion: ffprobeVersion(),
    selectionRules: SELECTION_RULES,
    sources: [
      {
        name: "inaturalist",
        api: "https://api.inaturalist.org/v1/observations",
        apiKeyRequired: false,
        notes: "One request per species (order_by=votes, per_page=200). Files served from static.inaturalist.org/sounds/<soundId>.<ext>.",
      },
      {
        name: "wikimedia_commons",
        api: apiUrl,
        apiKeyRequired: false,
        notes: "Licence, author and sha1 read from prop=imageinfo extmetadata; downloaded file's sha1 compared against Commons' sha1.",
      },
    ],
    species: SPECIES.map((s) => ({ scientificName: s, slug: slugify(s) })),
    summary: {
      recordings: recordings.length,
      demo: demo.length,
      totalBytes: recordings.reduce((a, r) => a + r.bytes, 0) + demo.reduce((a, r) => a + r.bytes, 0),
      totalDurationSeconds: Number(recordings.reduce((a, r) => a + r.durationSeconds, 0).toFixed(3)),
      perSpecies: Object.fromEntries(SPECIES.map((s) => [s, recordings.filter((r) => r.scientificName === s).length])),
      perLicense: recordings.reduce((acc, r) => ((acc[r.license] = (acc[r.license] || 0) + 1), acc), {}),
      speciesBelowTarget: selectionLog.filter((l) => !l.meetsTarget).map((l) => l.scientificName),
      speciesBelowMinimum: selectionLog.filter((l) => !l.meetsMinimum).map((l) => l.scientificName),
      errors,
      demoProblems: problems,
    },
    selectionLog,
    recordings,
    demo,
  };
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\nWrote ${path.relative(ROOT, MANIFEST_PATH)}: ${recordings.length} recordings + ${demo.length} demo, ${(manifest.summary.totalBytes / 1e6).toFixed(1)} MB`);
  console.log(JSON.stringify(manifest.summary.perSpecies, null, 2));
  if (problems.length) console.warn("Demo problems:", problems);
  return manifest;
}

async function verifyCorpus() {
  if (!fs.existsSync(MANIFEST_PATH)) throw new Error(`No manifest at ${MANIFEST_PATH}; run without --verify first`);
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const entries = [...(manifest.recordings || []), ...(manifest.demo || [])];
  let ok = 0;
  let redownloaded = 0;
  const failures = [];
  for (const rec of entries) {
    const localPath = path.join(ROOT, rec.localPath);
    try {
      if (!fs.existsSync(localPath)) {
        console.log(`  downloading missing ${rec.localPath}`);
        await downloadFile(rec.fileUrl, localPath);
        redownloaded += 1;
      }
      const sha256 = hashFile(localPath);
      if (sha256 !== rec.sha256) failures.push({ id: rec.id, reason: `sha256 mismatch: ${sha256} != ${rec.sha256}` });
      else ok += 1;
    } catch (err) {
      failures.push({ id: rec.id, reason: err.message });
    }
  }
  console.log(`\nverify: ${ok}/${entries.length} files match manifest sha256; ${redownloaded} re-downloaded; ${failures.length} failures`);
  for (const f of failures) console.error(`  ! ${f.id}: ${f.reason}`);
  return { total: entries.length, ok, redownloaded, failures };
}

async function main() {
  const verify = process.argv.includes("--verify");
  if (verify) {
    const result = await verifyCorpus();
    process.exit(result.failures.length ? 1 : 0);
  }
  await buildCorpus();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  SPECIES,
  SELECTION_RULES,
  slugify,
  taxonMatches,
  extensionFromUrl,
  observationToCandidate,
  rankCandidates,
  selectCandidates,
  commonsArtistName,
  stripHtml,
  inatQueryUrl,
};
