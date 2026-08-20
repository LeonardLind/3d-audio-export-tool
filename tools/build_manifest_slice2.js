const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ASSET_ROOT = path.join(ROOT, "Assets", "slice_2_acoustic_data");
const OUTPUT = path.join(ROOT, "manifest_slice2_birdnet_150.csv");
const ROW_LIMIT = 150;

function walkFiles(dir, predicate, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(fullPath, predicate, files);
    else if (predicate(fullPath)) files.push(fullPath);
  }
  return files;
}

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
      } else if (char === '"') quoted = false;
      else value += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  if (value.length > 0 || row.length > 0) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }

  const [headers, ...records] = rows.filter((entry) => entry.length > 1);
  if (!headers) return [];
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])),
  );
}

function escapeCsv(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function main() {
  const wavByBase = new Map();
  for (const wavPath of walkFiles(ASSET_ROOT, (file) => path.extname(file).toLowerCase() === ".wav")) {
    wavByBase.set(path.basename(wavPath, ".wav"), wavPath);
  }

  const csvPaths = walkFiles(ASSET_ROOT, (file) => {
    if (path.extname(file).toLowerCase() !== ".csv") return false;
    return path.basename(path.dirname(file)).toLowerCase() === "output";
  }).sort();

  const bestByWindow = new Map();
  let readRows = 0;
  let eligibleRows = 0;

  for (const csvPath of csvPaths) {
    const rows = parseCsv(fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, ""));
    for (const row of rows) {
      readRows += 1;
      if ((row.model || "").trim().toLowerCase() !== "birdnet") continue;
      const confidence = Number(row.confidence);
      if (!(confidence > 0.5)) continue;
      const localAudioPath = wavByBase.get(row.audio_id);
      if (!localAudioPath) continue;

      eligibleRows += 1;
      const key = `${row.audio_id}\t${row.start_time}\t${row.end_time}`;
      const current = bestByWindow.get(key);
      if (current && Number(current.confidence) >= confidence) continue;

      bestByWindow.set(key, {
        audio_id: row.audio_id,
        source_csv: path.relative(ROOT, csvPath).replace(/\\/g, "/"),
        local_audio_path: path.relative(ROOT, localAudioPath).replace(/\\/g, "/"),
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

  const rows = [...bestByWindow.values()]
    .sort(
      (a, b) =>
        Number(b.confidence) - Number(a.confidence) ||
        a.audio_id.localeCompare(b.audio_id) ||
        Number(a.start_time) - Number(b.start_time) ||
        Number(a.end_time) - Number(b.end_time),
    )
    .slice(0, ROW_LIMIT)
    .sort(
      (a, b) =>
        a.audio_id.localeCompare(b.audio_id) ||
        Number(a.start_time) - Number(b.start_time) ||
        Number(a.end_time) - Number(b.end_time),
    );

  fs.writeFileSync(
    OUTPUT,
    `${[fieldnames.join(","), ...rows.map((row) => fieldnames.map((field) => escapeCsv(row[field])).join(","))].join("\n")}\n`,
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        output: path.relative(ROOT, OUTPUT).replace(/\\/g, "/"),
        csv_files_read: csvPaths.length,
        wav_files_available: wavByBase.size,
        csv_rows_read: readRows,
        eligible_rows_before_window_dedupe: eligibleRows,
        windows_after_dedupe: bestByWindow.size,
        manifest_rows: rows.length,
      },
      null,
      2,
    ),
  );
}

main();
