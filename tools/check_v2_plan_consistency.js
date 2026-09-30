"use strict";

// A structural check of the plans, not a substitute for methods review or a freeze.
const fs = require("node:fs");
const path = require("node:path");

function checkNotebooks(notebooks) {
  const issues = [];
  const amendments = new Map();
  const references = [];
  for (const notebook of notebooks) {
    const lines = notebook.text.replace(/\r\n/g, "\n").split("\n");
    const start = lines.findIndex((line) => line.startsWith("## Pre-run consistency amendments"));
    const end = lines.findIndex((line, i) => i > start && line === "## Results");
    if (start < 0 || end < 0) {
      issues.push(`${notebook.path}: missing amendment section or Results boundary`);
      continue;
    }
    let current = null;
    const seen = new Set();
    for (let i = start; i < end; i += 1) {
      const line = lines[i];
      const location = `${notebook.path}:${i + 1}`;
      const heading = line.match(/^### Amendment (C\d{2})\b/);
      if (heading) {
        current = heading[1];
        if (seen.has(current)) issues.push(`${location}: duplicate ${current} heading`);
        seen.add(current);
        if (!amendments.has(current)) amendments.set(current, []);
        amendments.get(current).push({ location, text: null, additions: [] });
      }
      const change = line.match(/^- \*\*Change:\*\* Amendment (C\d{2})\b/);
      if (change) {
        if (change[1] !== current) {
          issues.push(`${location}: Change paragraph does not match its heading`);
        } else {
          const rows = amendments.get(current);
          const entry = rows[rows.length - 1];
          if (entry.text !== null) issues.push(`${location}: duplicate Change paragraph`);
          entry.text = line;
        }
      }
      // Dated additions (for example "- **Addition (2026-09-30, before any run):** Amendment C02 ...")
      // are shared text too: every notebook that records the amendment carries the same lines.
      const addition = line.match(/^- \*\*Addition \(\d{4}-\d{2}-\d{2}\b[^)]*\):\*\* Amendment (C\d{2})\b/);
      if (addition) {
        if (addition[1] !== current) {
          issues.push(`${location}: Addition paragraph does not match its heading`);
        } else {
          const rows = amendments.get(current);
          rows[rows.length - 1].additions.push(line);
        }
      }
      for (const match of line.matchAll(/\bC\d{2}\b/g)) references.push({ id: match[0], location });
    }
  }
  for (const [id, entries] of amendments) {
    for (const entry of entries) {
      if (entry.text === null) issues.push(`${entry.location}: ${id} has no Change paragraph`);
    }
    if (new Set(entries.map((entry) => entry.text)).size > 1) {
      issues.push(`${id}: shared Change paragraphs differ (${entries.map((entry) => entry.location).join(", ")})`);
    }
    if (new Set(entries.map((entry) => JSON.stringify(entry.additions))).size > 1) {
      issues.push(`${id}: shared dated Addition paragraphs differ (${entries.map((entry) => entry.location).join(", ")})`);
    }
  }
  const additionCount = [...amendments.values()].reduce((sum, entries) => sum + (entries[0] ? entries[0].additions.length : 0), 0);
  const missing = new Set();
  for (const reference of references) {
    if (!amendments.has(reference.id) && !missing.has(reference.id)) {
      missing.add(reference.id);
      issues.push(`${reference.location}: references undefined ${reference.id}`);
    }
  }
  return { notebookCount: notebooks.length, amendmentCount: amendments.size, additionCount, issues };
}

function checkRepository(root) {
  const directory = path.join(root, "03_Research_Notebook");
  const filenames = fs.readdirSync(directory).filter((name) => /^Experiment_0(07|08|09|10|11|12)_.*\.md$/.test(name)).sort();
  const result = checkNotebooks(filenames.map((name) => ({
    path: `03_Research_Notebook/${name}`,
    text: fs.readFileSync(path.join(directory, name), "utf8"),
  })));
  if (filenames.length !== 6) result.issues.push(`Expected six experiment notebooks, found ${filenames.length}`);
  for (let id = 1; id <= 35; id += 1) {
    const label = `C${String(id).padStart(2, "0")}`;
    if (!filenames.some((name) => fs.readFileSync(path.join(directory, name), "utf8").includes(`### Amendment ${label} `))) {
      result.issues.push(`Missing planned amendment ${label}`);
    }
  }
  return result;
}

if (require.main === module) {
  const result = checkRepository(path.resolve(__dirname, ".."));
  if (result.issues.length) {
    for (const issue of result.issues) console.error(issue);
    process.exitCode = 1;
  } else {
    console.log(`PLAN STRUCTURE OK: ${result.notebookCount} notebooks, ${result.amendmentCount} amendments, ${result.additionCount} dated additions; shared texts agree and all cited IDs exist.`);
    console.log("This does not approve experiment rules, freeze inputs, or authorize a governing run.");
  }
}

module.exports = { checkNotebooks, checkRepository };
