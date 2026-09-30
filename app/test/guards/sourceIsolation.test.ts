import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { GATED_COPY } from '../../src/copy/gated.ts';

const root = new URL('../../src/', import.meta.url);
const files = readdirSync(root, { recursive: true, encoding: 'utf8' }).filter((name) => /\.tsx?$/.test(name));

test('owner modules have one guarded production entry point', () => {
  for (const path of files) {
    const normalized = path.replaceAll('\\', '/');
    if (normalized.startsWith('dev/') || normalized === 'devHook.ts') continue;
    const source = readFileSync(new URL(normalized, root), 'utf8');
    assert.doesNotMatch(source, /(?:from\s*|import\s*\()\s*['"][^'"]*\/dev\//, normalized);
  }
  const hook = readFileSync(new URL('devHook.ts', root), 'utf8');
  assert.match(hook, /import\.meta\.env\.DEV\s*\?/);
});

test('only the gate evaluator can cast a value into an open gate', () => {
  for (const path of files) {
    const normalized = path.replaceAll('\\', '/');
    if (normalized === 'evidence/gates.ts') continue;
    const source = readFileSync(new URL(normalized, root), 'utf8');
    assert.doesNotMatch(source, /\bas\s+(?:unknown\s+as\s+)?OpenGate\s*</, normalized);
  }
});

test('retired unsupported claims stay out of the viewer', () => {
  for (const path of files) {
    const normalized = path.replaceAll('\\', '/');
    // The numerical browser port is frozen; its old comment is tracked in W21.
    if (normalized.startsWith('analysis/')) continue;
    const source = readFileSync(new URL(normalized, root), 'utf8');
    assert.doesNotMatch(source, /sound alike|sound similar|MULTI-SCALE|r\s*=\s*0\.29|0\.15 s|~1%/i, normalized);
  }
});

test('precommitted copy is verbatim at the cited current notebook lines', () => {
  for (const entry of Object.values(GATED_COPY)) {
    const notebook = new URL(`../../03_Research_Notebook/${entry.basis.notebook}`, root);
    const lines = readFileSync(notebook, 'utf8').split(/\r?\n/);
    assert.ok(lines[entry.basis.line - 1]?.includes(entry.en), entry.id);
  }
});
