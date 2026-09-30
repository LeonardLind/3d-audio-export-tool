import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Integration checks against the owner's existing dev server and a built preview.
// No experiment runner, accepted evidence, or analysis code is changed.
const dev = process.env.VIEWER_DEV_URL ?? 'http://localhost:5183';
const prod = process.env.VIEWER_PROD_URL ?? 'http://127.0.0.1:5184';
const output = new URL('../output/viewer-check/', import.meta.url);
await mkdir(output, { recursive: true });
const report = { checkedAt: new Date().toISOString(), checks: [], errors: [], completed: false };
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', (error) => report.errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') report.errors.push(message.text()); });
const check = (name, value = true) => { assert.ok(value, name); report.checks.push(name); console.log(`PASS ${name}`); };
const delay = (ms) => page.waitForTimeout(ms);
// Vite may have an HMR timestamp on a module. Import the actual loaded instance.
async function app(action) {
  return page.evaluate(async (action) => {
    const url = performance.getEntriesByType('resource').find((entry) => entry.name.includes('/src/state/store.ts')).name;
    const store = await import(url);
    window.__viewerTestStore = store;
    if (action) store.dispatch(action);
    return { active: store.getState().active.status, key: store.getState().active.key,
      selection: store.getState().selection, view: store.getState().view, playback: store.getState().playback,
      compare: store.getState().compare, upload: store.getState().upload };
  }, action);
}
async function ready() {
  await page.waitForFunction(() => performance.getEntriesByType('resource').some((entry) => entry.name.includes('/src/state/store.ts')));
  await app();
  await page.waitForFunction(() => window.__viewerTestStore.getState().active.status === 'ready');
  await app({ type: 'SET_AUTO_ROTATE', enabled: false });
  await delay(150);
}
async function screenshot(name) { await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)) }); }
async function selectPair() {
  await app({ type: 'SELECT_CLEAR' });
  await app({ type: 'SELECT_CLICK', index: 30 });
  await app({ type: 'SELECT_CLICK', index: 80 });
  await delay(100);
}

try {
  await page.goto(`${dev}/?dataset=bluethroat_smoke`);
  await ready();
  check('title and whole cloud at rest', await page.title() === 'Acoustic Cloud' && (await app()).playback.reveal === 'all');
  check('40 label limit and zero measured overlaps', await page.locator('canvas[data-visible-labels]').evaluate((c) => +c.dataset.visibleLabels <= 40 && +c.dataset.visibleLabels > 0 && +c.dataset.labelOverlaps === 0));
  await screenshot('rest');

  // Click coloured WebGL pixels on real rendered dots, outside the screen controls.
  const hit = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const gl = canvas.getContext('webgl2');
    const pixel = new Uint8Array(4);
    const rect = canvas.getBoundingClientRect();
    for (let y = Math.floor(canvas.height * .25); y < canvas.height * .7; y += 3) {
      for (let x = Math.floor(canvas.width * .2); x < canvas.width * .8; x += 3) {
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        if (pixel[0] > 80 && pixel[0] > pixel[2] * 2 && pixel[1] < 210) return { x: rect.left + x / canvas.width * rect.width, y: rect.top + (1 - y / canvas.height) * rect.height };
      }
    }
    return null;
  });
  assert.ok(hit, 'a dot pixel exists');
  await page.mouse.click(hit.x, hit.y);
  check('real pointer click selects a rendered dot', (await app()).selection.a !== null);
  await selectPair();
  check('visitor compare has values with no playback or waveform', await page.getByRole('complementary', { name: 'Compare moments' }).count() === 1 && await page.getByRole('button', { name: 'Play moment A' }).count() === 0 && await page.locator('canvas').count() === 2);
  await screenshot('visitor-compare');
  await page.keyboard.press('Escape');
  check('Escape clears comparison', (await app()).selection.a === null);

  for (const axes of [3, 5, 6, 1, 2, 4, 7]) {
    await app({ type: 'SET_AXES', axes, startedAt: await page.evaluate(() => performance.now()) });
    await delay(820);
    check(`view ${axes} settles without label overlaps`, (await app()).view.transition === null && await page.locator('canvas[data-label-overlaps]').getAttribute('data-label-overlaps') === '0');
  }
  await app({ type: 'SET_AXES', axes: 1, reducedMotion: true });
  await page.getByRole('button', { name: 'X', exact: true }).click({ force: true });
  check('last axis remains enabled with a hint', (await app()).view.axes === 1 && (await app()).view.hint !== null);
  await app({ type: 'SET_AXES', axes: 7, reducedMotion: true });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await delay(350);
  check('main playback reveals by time and disables Show all', (await app()).playback.reveal === 'follow' && await page.getByRole('button', { name: 'Show all' }).isDisabled());
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const seek = page.getByRole('slider', { name: 'Seek' });
  await seek.focus();
  await page.keyboard.press('ArrowRight');
  await delay(80);
  check('seek updates accessible time', Number(await seek.getAttribute('aria-valuenow')) >= 1);
  await page.getByRole('button', { name: 'Show all' }).click();
  check('Show all restores the resting cloud', (await app()).playback.reveal === 'all');
  await page.evaluate(() => { const audio = document.querySelector('audio'); audio.currentTime = audio.duration - .12; return audio.play(); });
  await delay(500);
  check('natural end restores all dots', (await app()).playback.main === 'ended' && (await app()).playback.reveal === 'all');

  await page.goto(`${dev}/?dataset=bluethroat_smoke&preview`);
  await ready();
  await selectPair();
  await page.getByRole('button', { name: 'Play moment A', exact: true }).waitFor();
  check('preview shows two moment waveforms and full clip waveform', await page.locator('canvas').count() === 5);
  await page.getByRole('button', { name: 'Loop', exact: true }).first().click();
  await page.getByRole('button', { name: 'Play moment A', exact: true }).click();
  await delay(350);
  check('looped moment plays and main audio is paused', (await app()).compare.playing === 'a' && await page.locator('audio').evaluate((audio) => audio.paused));
  check('red playhead is visible during loop playback', await page.locator('[class*="playhead"]').first().evaluate((el) => getComputedStyle(el).display !== 'none'));
  await screenshot('preview-compare');
  await page.getByRole('button', { name: 'Play', exact: true }).last().click();
  await delay(100);
  check('main playback stops the moment', (await app()).compare.playing === null);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Play A, then B', exact: true }).click();
  await delay(1000);
  check('A then B sequence completes', (await app()).compare.playing === null);
  await page.getByRole('checkbox', { name: 'Same scale for A and B' }).uncheck();
  check('shared scale control updates state', (await app()).compare.sharedScale === false);
  await app({ type: 'REVEAL_ALL' });
  await delay(150);

  await page.getByRole('button', { name: 'More options' }).click();
  const [jsonDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download view (JSON)' }).click()]);
  const json = JSON.parse(await readFile(await jsonDownload.path(), 'utf8'));
  check('downloaded view JSON round trips without changing dots or edges', await page.evaluate(async (json) => {
    const { toCloudRecording } = await import('/src/data/normalize.ts');
    const url = performance.getEntriesByType('resource').find((entry) => entry.name.includes('/src/state/store.ts')).name;
    const original = (await import(url)).getState().active.recording;
    const result = toCloudRecording(json, { key: 'roundtrip', origin: 'published' });
    return result.ok && JSON.stringify(result.recording.points) === JSON.stringify(original.points) && JSON.stringify(result.recording.similarityEdges) === JSON.stringify(original.similarityEdges);
  }, json));
  await page.getByRole('button', { name: 'More options' }).click();
  const [pngDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save picture (PNG)' }).click()]);
  const png = await readFile(await pngDownload.path());
  await writeFile(new URL('downloaded-preview.png', output), png);
  check('PNG download contains a rendered image', png.length > 10000 && png.subarray(1, 4).toString() === 'PNG');
  check('preview PNG retains its warning footer', await page.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))]));
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
    const pixel = ctx.getImageData(0, canvas.height - 1, 1, 1).data;
    return pixel[0] === 48 && pixel[1] === 39 && pixel[2] === 25 && pixel[3] === 255;
  }, png.toString('base64')));

  await app({ type: 'REVEAL_ALL' });
  await page.setViewportSize({ width: 375, height: 812 });
  await delay(250);
  const bounds = await page.getByRole('complementary', { name: 'Compare moments' }).boundingBox();
  check('375 px compare sheet stays within viewport', bounds.x >= 0 && bounds.x + bounds.width <= 375 && bounds.y > 160 && bounds.y + bounds.height < 812);
  await screenshot('mobile-compare');
  await app({ type: 'SELECT_CLEAR' });
  await screenshot('mobile-rest');
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.locator('input[type=file]').last().setInputFiles(fileURLToPath(new URL('../Assets/smoke/Luscinia_svecica_song.ogg', import.meta.url)));
  await page.waitForFunction(() => window.__viewerTestStore.getState().active.key?.startsWith('up:'), null, { timeout: 30000 });
  check('upload renders in the same viewer and resets selection', (await app()).selection.a === null);
  const uploadCheck = await page.evaluate(async () => {
    const moduleUrl = (name) => performance.getEntriesByType('resource').find((entry) => entry.name.includes(name)).name;
    const recording = (await import(moduleUrl('/src/state/store.ts'))).getState().active.recording;
    const status = (await import(moduleUrl('/src/audio/clipStore.ts'))).getClipStatus(recording.key);
    const { verifyAnalysisSpans } = await import(moduleUrl('/src/audio/selfCheck.ts'));
    const bytes = await (await fetch(recording.audioUrl)).arrayBuffer();
    const decoded = await new OfflineAudioContext(1, 1, 22050).decodeAudioData(bytes);
    const retained = status.clip.mono;
    return { origin: status.clip.origin, rate: decoded.sampleRate, length: retained.length,
      identical: decoded.length === retained.length && decoded.getChannelData(0).every((x, i) => x === retained[i]),
      firstMismatch: retained.findIndex((x, i) => x !== decoded.getChannelData(0)[i]), maxSample: retained.reduce((m, x) => Math.max(m, Math.abs(x)), 0), decodedLength: decoded.length,
      selfCheck: verifyAnalysisSpans(retained, recording.points) };
  });
  report.upload = uploadCheck;
    check('upload retains PCM and plays exactly that mono 22050 Hz buffer', uploadCheck.origin === 'analysis-rate' && uploadCheck.rate === 22050 && uploadCheck.identical);
  check('upload self-check passes on every dot', uploadCheck.selfCheck.status === 'passed' && uploadCheck.selfCheck.matched > 0);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await delay(150);
  await page.getByText('Owner preview', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Preview available data' }).uncheck();
  await delay(80);
  check('closing preview stops upload audio and hides waveform', await page.locator('audio').evaluate((audio) => audio.paused) && await page.locator('canvas').count() === 2);

  let heldRoute;
  let requested;
  const requestArrived = new Promise((resolve) => { requested = resolve; });
  const stalePath = '**/data/dataset_blackcap_inat_376675.json';
  await page.route(stalePath, (route) => { heldRoute = route; requested(); });
  await page.locator('header button').first().click();
  await page.getByRole('menuitem', { name: 'Blackcap', exact: true }).click();
  await requestArrived;
  await page.locator('input[type=file]').last().setInputFiles(fileURLToPath(new URL('../Assets/smoke/Luscinia_svecica_song.ogg', import.meta.url)));
  await page.waitForFunction(() => window.__viewerTestStore.getState().active.key?.startsWith('up:'));
  const uploadKey = (await app()).key;
  await heldRoute.continue();
  await delay(350);
  check('a late recording response cannot replace a newer upload', (await app()).key === uploadKey);
  await page.unroute(stalePath);

  await page.locator('input[type=file]').last().setInputFiles(fileURLToPath(new URL('../app/public/assets/inat_376675.wav', import.meta.url)));
  await page.locator('input[type=file]').last().setInputFiles(fileURLToPath(new URL('../Assets/smoke/Luscinia_svecica_song.ogg', import.meta.url)));
  await page.waitForFunction(() => { const state = window.__viewerTestStore.getState(); return state.active.key === `up:${state.upload.runId}`; });
  check('a second upload supersedes the first', (await app()).upload.fileName === 'Luscinia_svecica_song.ogg');
  await page.locator('input[type=file]').last().setInputFiles(fileURLToPath(new URL('../app/public/assets/inat_376675.wav', import.meta.url)));
  await page.locator('header button').first().click();
  await page.getByRole('menuitem', { name: 'Blackbird', exact: true }).click();
  await page.waitForFunction(() => window.__viewerTestStore.getState().active.status === 'ready' && window.__viewerTestStore.getState().active.key?.includes('blackbird'));
  await delay(700);
  check('a pending upload cannot replace a later recording choice', (await app()).key.includes('blackbird'));

  for (const dataset of ['blackbird_inat_168505', 'blackcap_inat_376675']) {
    await page.goto(`${dev}/?dataset=${dataset}`);
    await ready();
    check(`${dataset} loads`, (await app()).key.includes(dataset));
    await screenshot(dataset);
  }

  const mobile = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  await mobile.goto(`${dev}/?dataset=bluethroat_smoke&view=xy`);
  await mobile.getByRole('button', { name: 'Bluethroat' }).waitFor();
  await mobile.getByRole('button', { name: 'Z', exact: true }).click();
  await mobile.waitForFunction(() => document.querySelector('canvas')?.width === innerWidth * devicePixelRatio);
  check('DPR 2 and reduced motion render', await mobile.locator('canvas').first().evaluate((c) => c.width === 750));
  await mobile.close();

  await page.goto(`${prod}/?dataset=bluethroat_smoke&preview`);
  await page.getByRole('button', { name: 'Bluethroat' }).waitFor();
  await delay(500);
  const body = await page.locator('body').innerText();
  check('production ignores preview query and has no owner UI or waveform', !/UNVERIFIED|Owner preview/.test(body) && await page.locator('canvas').count() === 2);
  check('production loads no dev module', await page.evaluate(() => !performance.getEntriesByType('resource').some((entry) => /OwnerPanel|devSpans|\/src\/dev\//.test(entry.name))));
  await screenshot('production');
  check('no browser console or runtime errors', report.errors.length === 0);
  report.completed = true;
} finally {
  await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
