// render-check.mjs: load the Pages game in headless Chrome with software WebGL,
// play a scripted session through the game's test hooks, fail on console errors
// or failed assertions, take screenshots, and record the walkthrough video.
//
// Usage (CI): node render-check.mjs --url http://127.0.0.1:8123/ --out render-out
// Needs: puppeteer-core (found via NODE_PATH), Chrome at CHROME_PATH, ffmpeg on PATH.
// This file is a CI tool. It is not deployed to Pages.

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const require = createRequire((process.env.NODE_PATH || process.cwd()) + '/');
const puppeteer = require('puppeteer-core');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
  return acc;
}, []));
const BASE = args.url || 'http://127.0.0.1:8123/';
const OUT = args.out || 'render-out';
const VIDEO_SECONDS = Number(args.seconds || 24);
const FPS = 24;

mkdirSync(join(OUT, 'shots'), { recursive: true });

const report = { started: new Date().toISOString(), checks: [], consoleErrors: [], info: null };
let failed = 0;
function check(name, ok, detail) {
  report.checks.push({ name, ok: !!ok, detail: detail === undefined ? null : detail });
  if (!ok) failed++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? ' :: ' + JSON.stringify(detail) : ''));
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  headless: 'new',
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
  ],
});

async function openPage(viewport, query, { fakePad = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  page.on('console', (m) => {
    if (m.type() === 'error') report.consoleErrors.push({ where: query, text: m.text() });
  });
  page.on('pageerror', (e) => report.consoleErrors.push({ where: query, text: 'pageerror: ' + e.message }));
  page.on('requestfailed', (r) => report.consoleErrors.push({ where: query, text: 'requestfailed: ' + r.url() + ' ' + (r.failure() && r.failure().errorText) }));
  if (fakePad) {
    // A scriptable fake gamepad so controller mappings can be exercised.
    await page.evaluateOnNewDocument(() => {
      const pad = { id: 'Render check pad', index: 0, connected: true, mapping: 'standard', timestamp: 0,
        axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false })) };
      window.__fakePad = pad;
      navigator.getGamepads = () => [pad, null, null, null];
    });
  }
  await page.goto(BASE + query, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__oasisTest && window.__oasisTest.ready, { timeout: 60000 });
  return page;
}

const T = (page, fn, ...a) => page.evaluate(fn, ...a);
async function shot(page, name) {
  await page.screenshot({ path: join(OUT, 'shots', name + '.png') });
}
async function run(page, action) {
  return T(page, (a) => window.__oasisTest.run(a), action);
}
async function step(page, frames, dt = 1 / FPS) {
  return T(page, (n, d) => window.__oasisTest.step(n, d), frames, dt);
}
async function state(page) {
  return T(page, () => window.__oasisTest.state());
}
// Nothing of the HUD may spill outside the viewport.
async function overflow(page) {
  return T(page, () => {
    const bad = [];
    const vw = innerWidth, vh = innerHeight;
    document.querySelectorAll('[data-hud], [data-hud] button, .panel:not([hidden]) button').forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[hidden]')) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) bad.push((el.id || el.className || el.tagName) + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(','));
    });
    return bad.slice(0, 10);
  });
}

try {
  // ---------- Desktop session ----------
  const page = await openPage({ width: 1280, height: 720 }, '?test=1&quality=medium');
  report.info = await T(page, () => window.__oasisTest.info());
  check('WebGL context created', report.info.webgl, report.info);
  await step(page, 30);
  await shot(page, '01-title-desktop');
  check('title screen visible', await T(page, () => !document.getElementById('title').hidden));
  check('rendered frame is not blank', await T(page, () => window.__oasisTest.frameVariance() > 40), await T(page, () => window.__oasisTest.frameVariance()));

  await run(page, { type: 'newGame', mode: 'campaign', chapter: 0 });
  await step(page, 20);
  await shot(page, '02-chapter1-tutorial');
  check('tutorial shows on first play', await T(page, () => !document.getElementById('tutorial').hidden));
  await run(page, { type: 'tutorialSkip' });

  const s0 = await state(page);
  check('chapter 1 starts with a spring and water flowing', s0.wetCells > 0, s0);

  // Carve a canal from the spring and build around it.
  const plan = await T(page, () => window.__oasisTest.samplePlan());
  await run(page, { type: 'stroke', tool: 'carve', path: plan.canal, radius: 0.6 });
  await step(page, FPS * 6);
  const s1 = await state(page);
  check('carved canal fills with water over time', s1.wetCells > s0.wetCells + 4, { before: s0.wetCells, after: s1.wetCells });
  for (const p of plan.homes) await run(page, { type: 'place', item: 'home', x: p[0], z: p[1], rot: p[2] || 0 });
  for (const p of plan.palms) await run(page, { type: 'place', item: 'palm', x: p[0], z: p[1] });
  for (const p of plan.crops) await run(page, { type: 'place', item: 'crops', x: p[0], z: p[1] });
  await step(page, FPS * 8);
  const s2 = await state(page);
  check('homes, palms and crops were placed', s2.objects >= s1.objects + plan.homes.length + plan.palms.length + plan.crops.length - 1, { before: s1.objects, after: s2.objects });
  check('crops near the canal are irrigated', s2.irrigated >= 2, s2);
  check('residents walk the settlement', s2.residents > 0, s2.residents);
  await shot(page, '03-settlement-day');

  // Terrain tools.
  const hBefore = await T(page, (p) => window.__oasisTest.heightAt(p[0], p[1]), plan.sculpt);
  await run(page, { type: 'stroke', tool: 'raise', path: [plan.sculpt, plan.sculpt, plan.sculpt], radius: 2 });
  const hRaised = await T(page, (p) => window.__oasisTest.heightAt(p[0], p[1]), plan.sculpt);
  check('raise tool lifts terrain', hRaised > hBefore + 0.1, { hBefore, hRaised });
  await run(page, { type: 'undo' });
  const hUndone = await T(page, (p) => window.__oasisTest.heightAt(p[0], p[1]), plan.sculpt);
  check('undo restores terrain', Math.abs(hUndone - hBefore) < 1e-6, { hBefore, hUndone });
  await run(page, { type: 'redo' });
  const hRedone = await T(page, (p) => window.__oasisTest.heightAt(p[0], p[1]), plan.sculpt);
  check('redo reapplies terrain', Math.abs(hRedone - hRaised) < 1e-6, { hRaised, hRedone });
  await run(page, { type: 'undo' });

  // Rotate, duplicate and delete through the keyboard shortcuts.
  const nObj = (await state(page)).objects;
  await run(page, { type: 'select', x: plan.homes[0][0], z: plan.homes[0][1] });
  await page.keyboard.press('KeyR');
  const rotated = await T(page, () => window.__oasisTest.selectedRotation());
  check('R rotates the selected building', rotated !== null && rotated !== 0, rotated);
  await page.keyboard.down('Control'); await page.keyboard.press('KeyD'); await page.keyboard.up('Control');
  await run(page, { type: 'placeGhostAt', x: plan.free[0], z: plan.free[1] });
  check('Ctrl+D duplicates the selection', (await state(page)).objects === nObj + 1);
  await page.keyboard.press('Delete');
  check('Delete removes the selection', (await state(page)).objects === nObj);
  await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control');
  check('Ctrl+Z brings it back', (await state(page)).objects === nObj + 1);
  await page.keyboard.down('Control'); await page.keyboard.press('KeyY'); await page.keyboard.up('Control');
  check('Ctrl+Y removes it again', (await state(page)).objects === nObj);

  // Save, change, load.
  await run(page, { type: 'save', slot: 1 });
  const saved = await state(page);
  await run(page, { type: 'newGame', mode: 'sandbox' });
  await run(page, { type: 'load', slot: 1 });
  const loaded = await state(page);
  check('save and load round trip', loaded.objects === saved.objects && loaded.wetCells >= saved.wetCells - 2 && loaded.mode === saved.mode, { saved, loaded });
  const corrupt = await T(page, () => window.__oasisTest.loadCorrupt());
  check('a corrupt save is rejected without breaking the game', corrupt.rejected && corrupt.stillRunning, corrupt);

  // Night, weather, photo mode, gallery, menus.
  await run(page, { type: 'setTime', hours: 20.5 });
  await step(page, FPS * 2);
  await shot(page, '04-settlement-night');
  await run(page, { type: 'setTime', hours: 17.8 });
  await run(page, { type: 'ui', open: 'photo' });
  await step(page, 10);
  await shot(page, '05-photo-mode');
  check('photo mode hides the HUD', await T(page, () => document.body.classList.contains('photo')));
  const photo = await run(page, { type: 'photo' });
  check('photo is captured to the gallery', photo && photo.saved, photo);
  await run(page, { type: 'ui', open: 'gallery' });
  await step(page, 4);
  await shot(page, '06-gallery');
  await run(page, { type: 'ui', open: 'pause' });
  await step(page, 4);
  await shot(page, '07-pause');
  await run(page, { type: 'ui', open: 'settings' });
  await step(page, 4);
  await shot(page, '08-settings');
  await run(page, { type: 'ui', open: 'none' });
  check('desktop HUD fits the viewport', (await overflow(page)).length === 0, await overflow(page));

  // Chapter results.
  const res = await run(page, { type: 'completeChapter' });
  await step(page, 6);
  await shot(page, '09-results');
  check('results screen shows after a chapter', res && res.shown, res);
  await run(page, { type: 'ui', open: 'none' });

  // Sandbox options.
  await run(page, { type: 'newGame', mode: 'sandbox', options: { weather: 'breezy', water: 'high', boundary: 'large', hours: 9 } });
  await step(page, FPS * 2);
  const sb = await state(page);
  check('sandbox applies its options', sb.mode === 'sandbox' && sb.weather === 'breezy' && sb.waterAbundance === 'high' && sb.boundary === 'large', sb);
  await shot(page, '10-sandbox');
  await page.close();

  // ---------- Gamepad mappings ----------
  const padPage = await openPage({ width: 1280, height: 720 }, '?test=1&quality=low', { fakePad: true });
  await run(padPage, { type: 'newGame', mode: 'sandbox' });
  await run(padPage, { type: 'tutorialSkip' });
  const toolBefore = (await state(padPage)).tool;
  await T(padPage, () => { window.__fakePad.buttons[5].pressed = true; window.__fakePad.buttons[5].value = 1; });
  await step(padPage, 2);
  await T(padPage, () => { window.__fakePad.buttons[5].pressed = false; window.__fakePad.buttons[5].value = 0; });
  await step(padPage, 2);
  const toolAfter = (await state(padPage)).tool;
  check('gamepad RB cycles the tool', toolAfter !== toolBefore, { toolBefore, toolAfter });
  await T(padPage, () => { window.__fakePad.buttons[9].pressed = true; });
  await step(padPage, 2);
  await T(padPage, () => { window.__fakePad.buttons[9].pressed = false; });
  await step(padPage, 2);
  check('gamepad Start opens pause', await T(padPage, () => !document.getElementById('pause').hidden));
  await padPage.close();

  // ---------- Landscape phone ----------
  const phone = await openPage({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2, isLandscape: true }, '?test=1&quality=low');
  await step(phone, 20);
  await shot(phone, '11-title-phone');
  check('phone title fits the viewport', (await overflow(phone)).length === 0, await overflow(phone));
  await run(phone, { type: 'newGame', mode: 'campaign', chapter: 0 });
  await step(phone, 10);
  await shot(phone, '12-tutorial-phone');
  await run(phone, { type: 'tutorialSkip' });
  await step(phone, 10);
  await shot(phone, '13-play-phone');
  check('phone HUD fits the viewport', (await overflow(phone)).length === 0, await overflow(phone));
  await run(phone, { type: 'ui', open: 'pause' });
  await step(phone, 4);
  await shot(phone, '14-pause-phone');
  check('phone pause menu fits the viewport', (await overflow(phone)).length === 0, await overflow(phone));
  await phone.close();

  // ---------- Walkthrough video ----------
  const vid = await openPage({ width: 1280, height: 720 }, '?test=1&quality=high&tour=1');
  const framesDir = join(OUT, 'frames');
  mkdirSync(framesDir, { recursive: true });
  await T(vid, () => window.__oasisTest.tourStart());
  const total = Math.round(VIDEO_SECONDS * FPS);
  for (let i = 0; i < total; i++) {
    await step(vid, 1);
    await vid.screenshot({ path: join(framesDir, 'f' + String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 90 });
  }
  const events = await T(vid, () => window.__oasisTest.tourEvents());
  const wavB64 = await T(vid, (sec, ev) => window.__oasisTest.audioWav(sec, ev), VIDEO_SECONDS, events);
  writeFileSync(join(OUT, 'walkthrough.wav'), Buffer.from(wavB64, 'base64'));
  await vid.close();

  // Loudness QC: normalise to -16 LUFS integrated, -1.5 dBTP, then measure.
  execFileSync('ffmpeg', ['-hide_banner', '-y', '-framerate', String(FPS), '-i', join(framesDir, 'f%04d.jpg'),
    '-i', join(OUT, 'walkthrough.wav'),
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '128k', '-shortest', join(OUT, 'walkthrough.mp4')], { stdio: 'inherit' });
  execFileSync('ffmpeg', ['-hide_banner', '-y', '-i', join(framesDir, 'f' + String(Math.round(total * 0.62)).padStart(4, '0') + '.jpg'),
    '-vf', 'scale=1280:-2', '-q:v', '3', join(OUT, 'walkthrough-poster.jpg')], { stdio: 'inherit' });
  let ebur = '';
  try {
    execFileSync('ffmpeg', ['-hide_banner', '-nostats', '-i', join(OUT, 'walkthrough.mp4'), '-af', 'ebur128=peak=true', '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e) { ebur = String(e.stderr || ''); }
  const m = /Integrated loudness:\s*\n\s*I:\s*(-?[\d.]+) LUFS/.exec(ebur) || [];
  report.loudness = { integratedLUFS: m[1] ? Number(m[1]) : null };
  // ebur128 writes its summary to stderr and exits 0, so read it again when the first call did not throw.
  if (!report.loudness.integratedLUFS) {
    const r = require('node:child_process').spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', join(OUT, 'walkthrough.mp4'), '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
    const mm = /Integrated loudness:\s*\n\s*I:\s*(-?[\d.]+) LUFS/.exec(r.stderr || '');
    const pk = /True peak:\s*\n\s*Peak:\s*(-?[\d.]+) dBFS/.exec(r.stderr || '');
    report.loudness = { integratedLUFS: mm ? Number(mm[1]) : null, truePeakDBFS: pk ? Number(pk[1]) : null };
  }
  check('walkthrough loudness within 1 LU of -16 LUFS', report.loudness.integratedLUFS !== null && Math.abs(report.loudness.integratedLUFS + 16) <= 1, report.loudness);
  rmSync(framesDir, { recursive: true, force: true });
} catch (e) {
  check('render check ran to the end', false, String(e && e.stack || e));
} finally {
  await browser.close();
}

const real = report.consoleErrors.filter((e) => !/favicon\.ico/.test(e.text));
check('no console errors, page errors or failed requests', real.length === 0, real.slice(0, 20));
report.finished = new Date().toISOString();
report.failed = failed;
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(`\n${report.checks.length - failed}/${report.checks.length} checks passed`);
process.exit(failed ? 1 : 0);
