import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findLeaks } from './distLeaks.mjs';

const appRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const distRoot = resolve(appRoot, 'dist');
const files = {};

async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (entry.isFile()) files[relative(distRoot, path)] = await readFile(path);
  }
}

try {
  await scan(distRoot);
  const leaks = findLeaks(files);
  if (leaks.length) {
    console.error(`Owner-only content in dist: ${leaks.join(', ')}`);
    process.exitCode = 1;
  } else console.log(`dist guard OK (${Object.keys(files).length} files)`);
} catch (error) {
  console.error(`Cannot scan dist: ${error.message}`);
  process.exitCode = 1;
}
