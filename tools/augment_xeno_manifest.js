// One-off: enriches Assets/Multi-sample-Same-audio/manifest.json with the Xeno-canto
// "type" field (song / call / alarm call / etc.) for each already-downloaded recording.
// That recordist-supplied type is an INDEPENDENT behavioral cross-check for the
// experimental acoustic classifier in the Behavior Comparison feature -- it lets the UI
// honestly show "our acoustic guess vs. what the recordist tagged it as" instead of
// implying our classification is ground truth.
//
// Usage: node tools/augment_xeno_manifest.js <API_KEY> ["Scientific name"]

const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.resolve(__dirname, "..");
const MANIFEST = path.join(ROOT, "Assets", "Multi-sample-Same-audio", "manifest.json");
const API_KEY = process.argv[2];
const SPECIES = process.argv[3] || "Horornis acanthizoides";

if (!API_KEY) {
  console.error('Usage: node tools/augment_xeno_manifest.js <API_KEY> ["Scientific name"]');
  process.exit(1);
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode !== 200) return reject(new Error(`GET -> ${res.statusCode}: ${data.slice(0, 200)}`));
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", reject);
  });
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const query = encodeURIComponent(`sp:"${SPECIES}"`);
  const url = `https://xeno-canto.org/api/3/recordings?query=${query}&key=${API_KEY}`;
  const response = await httpGetJson(url);
  const byId = new Map((response.recordings || []).map((r) => [`XC${r.id}`, r]));

  let matched = 0;
  for (const entry of manifest) {
    const rec = byId.get(entry.xenoCantoId);
    if (rec) {
      entry.xcType = (rec.type || "unknown").toLowerCase();
      entry.callGroup = rec.grp || "";
      matched += 1;
    } else {
      entry.xcType = entry.xcType || "unknown";
    }
  }

  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Augmented ${matched}/${manifest.length} manifest entries with Xeno-canto type.`);
  const dist = manifest.reduce((acc, e) => ((acc[e.xcType] = (acc[e.xcType] || 0) + 1), acc), {});
  console.log("Type distribution:", JSON.stringify(dist));
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
