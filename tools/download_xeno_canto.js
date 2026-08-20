// Downloads multiple recordings of ONE species from Xeno-canto (the crowdsourced bird-
// sound archive that BirdNET's own training data draws from -- BirdNET itself is a
// classifier, not a downloadable recordings library). Requires a free Xeno-canto account
// + personal API key (registration required since their Oct 2025 API v3 change):
//   1. Create an account at https://xeno-canto.org/
//   2. Generate a key on your Account page
//   3. Run: node tools/download_xeno_canto.js <API_KEY> ["Scientific name"] [count]
//
// Writes audio files + a manifest.json (recordist, license, country, quality, source page
// per file -- Xeno-canto licenses are chosen per-uploader, so attribution is kept even
// though nothing here is filtered by license) into Assets/Multi-sample-Same-audio/.
//
// Response shape is based on the classic Xeno-canto API convention (numRecordings, page,
// numPages, recordings[]) -- v3 field names inside each recording are verified against the
// FIRST real response (dumped to console) before any file is downloaded, since the v3 docs
// page blocks automated fetches (Anubis anti-bot) and couldn't be confirmed ahead of time.

const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "Assets", "Multi-sample-Same-audio");
const DEFAULT_SPECIES = "Horornis acanthizoides"; // Yellowish-bellied Bush Warbler -- this project's field-recording benchmark
const DEFAULT_COUNT = 30;
const DELAY_MS = 400; // be a polite, non-hammering client

const API_KEY = process.argv[2];
const SPECIES = process.argv[3] || DEFAULT_SPECIES;
const COUNT = Number(process.argv[4]) || DEFAULT_COUNT;

if (!API_KEY) {
  console.error("Usage: node tools/download_xeno_canto.js <API_KEY> [\"Scientific name\"] [count]");
  console.error(`Example: node tools/download_xeno_canto.js abc123 "${DEFAULT_SPECIES}" ${DEFAULT_COUNT}`);
  process.exit(1);
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          let body = "";
          res.on("data", (c) => (body += c));
          res.on("end", () => reject(new Error(`GET ${url} -> ${res.statusCode}: ${body.slice(0, 300)}`)));
          return;
        }
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error(`Invalid JSON from ${url}: ${err.message}`));
          }
        });
      })
      .on("error", reject);
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const request = (targetUrl, redirects) => {
      if (redirects > 5) return reject(new Error(`Too many redirects: ${url}`));
      const fullUrl = targetUrl.startsWith("http") ? targetUrl : `https:${targetUrl}`;
      https
        .get(fullUrl, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            request(new URL(res.headers.location, fullUrl).toString(), redirects + 1);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`GET ${fullUrl} -> ${res.statusCode}`));
            res.resume();
            return;
          }
          const file = fs.createWriteStream(destPath);
          res.pipe(file);
          file.on("finish", () => file.close(resolve));
          file.on("error", reject);
        })
        .on("error", reject);
    };
    request(url, 0);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitize(value) {
  return String(value ?? "unknown").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40);
}

// Pull the first non-empty value out of a list of candidate field names -- v3 may have
// renamed fields from the classic v2 convention; this stays resilient either way and the
// raw-response dump below makes it easy to see if a mapping needs adjusting.
function pick(obj, candidates, fallback) {
  for (const key of candidates) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key];
  }
  return fallback;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const query = encodeURIComponent(`sp:"${SPECIES}"`);
  const searchUrl = `https://xeno-canto.org/api/3/recordings?query=${query}&key=${API_KEY}`;
  console.log(`Searching Xeno-canto for "${SPECIES}"...`);
  const response = await httpGetJson(searchUrl);

  const recordings = pick(response, ["recordings"], []);
  console.log(`Response top-level keys: ${Object.keys(response).join(", ")}`);
  console.log(`Found ${recordings.length} recording(s) (numRecordings reported: ${response.numRecordings ?? "?"})`);
  if (recordings.length === 0) {
    console.error("No recordings found -- check the species name and API key.");
    console.error("Raw response:", JSON.stringify(response).slice(0, 500));
    process.exit(1);
  }

  console.log("First recording's raw fields (for field-mapping sanity check):");
  console.log(JSON.stringify(recordings[0], null, 2));

  const targetCount = Math.min(COUNT, recordings.length);
  const manifest = [];

  for (let i = 0; i < targetCount; i += 1) {
    const rec = recordings[i];
    const id = pick(rec, ["id", "ID"], `unknown${i}`);
    const fileUrl = pick(rec, ["file", "fileUrl", "sound"], null);
    const recordist = pick(rec, ["rec", "recordist"], "unknown");
    const license = pick(rec, ["lic", "license"], "unknown");
    const country = pick(rec, ["cnt", "country"], "unknown");
    const quality = pick(rec, ["q", "quality"], "unknown");
    const lengthStr = pick(rec, ["length"], "unknown");
    const commonName = pick(rec, ["en", "englishName"], SPECIES);
    const genus = pick(rec, ["gen", "genus"], "");
    const sp = pick(rec, ["sp", "species"], "");

    if (!fileUrl) {
      console.warn(`  [${i}] id=${id}: no downloadable file URL found, skipping`);
      continue;
    }

    const ext = ".mp3";
    const filename = `${String(i + 1).padStart(2, "0")}_XC${id}_${sanitize(recordist)}${ext}`;
    const destPath = path.join(OUTPUT_DIR, filename);

    console.log(`  [${i + 1}/${targetCount}] XC${id} — ${recordist} (${country}, quality ${quality}) -> ${filename}`);
    // eslint-disable-next-line no-await-in-loop
    await downloadFile(fileUrl, destPath);
    manifest.push({
      file: filename,
      xenoCantoId: `XC${id}`,
      sourceUrl: `https://xeno-canto.org/${id}`,
      scientificName: `${genus} ${sp}`.trim() || SPECIES,
      commonName,
      recordist,
      license,
      country,
      quality,
      length: lengthStr,
    });
    // eslint-disable-next-line no-await-in-loop
    await sleep(DELAY_MS);
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`\nDownloaded ${manifest.length} recordings of "${SPECIES}" to ${path.relative(ROOT, OUTPUT_DIR)}`);
  console.log(`Attribution manifest written to ${path.relative(ROOT, path.join(OUTPUT_DIR, "manifest.json"))}`);
}

main().catch((err) => {
  console.error("Download failed:", err.message);
  process.exit(1);
});
