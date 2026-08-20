// Tiny registry of exported datasets, so the app's Audio Source Switch can list every
// dataset that's been exported (sample audio, real field recordings, diagnostics) without
// hardcoding paths. Each export script upserts its own entry after writing its JSON.

const fs = require("fs");
const path = require("path");

const MANIFEST_PATH = path.join(__dirname, "..", "..", "app", "public", "data", "manifest.json");

function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    return [];
  }
}

// entry: { id, label, kind ("sample" | "field" | "diagnostic"), path, durationSeconds }
function upsertDataset(entry) {
  const entries = readManifest().filter((e) => e.id !== entry.id);
  entries.push(entry);
  entries.sort((a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label));
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

module.exports = { upsertDataset };
