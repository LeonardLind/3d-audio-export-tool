const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const assetsDir = path.join(root, "Assets");
const outputPath = path.join(root, "manifest_birdnet_first_test.csv");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }

  const [headers, ...records] = rows.filter((entry) => entry.length > 1);
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])),
  );
}

function escapeCsv(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const bestByWindow = new Map();

for (const filename of fs.readdirSync(assetsDir).filter((name) => name.endsWith(".csv")).sort()) {
  const csvPath = path.join(assetsDir, filename);
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, ""));

  for (const row of rows) {
    if ((row.model || "").trim().toLowerCase() !== "birdnet") {
      continue;
    }

    const confidence = Number(row.confidence);
    if (!(confidence > 0.5)) {
      continue;
    }

    const key = `${row.audio_id}\t${row.start_time}\t${row.end_time}`;
    const current = bestByWindow.get(key);
    if (current && Number(current.confidence) >= confidence) {
      continue;
    }

    bestByWindow.set(key, {
      audio_id: row.audio_id,
      source_csv: filename,
      local_audio_path: path.posix.join("Assets", `${row.audio_id}.wav`),
      input_file_path: row.input_file_path,
      model: row.model,
      common_name: row.common_name,
      scientific_name: row.scientific_name,
      confidence: row.confidence,
      start_time: row.start_time,
      end_time: row.end_time,
    });
  }
}

const fieldnames = [
  "audio_id",
  "source_csv",
  "local_audio_path",
  "input_file_path",
  "model",
  "common_name",
  "scientific_name",
  "confidence",
  "start_time",
  "end_time",
];

const manifestRows = [...bestByWindow.values()].sort(
  (a, b) =>
    a.audio_id.localeCompare(b.audio_id) ||
    Number(a.start_time) - Number(b.start_time) ||
    Number(a.end_time) - Number(b.end_time) ||
    Number(b.confidence) - Number(a.confidence),
);

const output = [
  fieldnames.join(","),
  ...manifestRows.map((row) => fieldnames.map((field) => escapeCsv(row[field])).join(",")),
].join("\n");

fs.writeFileSync(outputPath, `${output}\n`, "utf8");
console.log(`Wrote ${manifestRows.length} rows to ${outputPath}`);
