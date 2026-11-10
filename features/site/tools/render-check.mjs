// render-check.mjs: load every docs page in headless Chrome and fail on real problems.
// No WebGL is needed or used. Each page is opened at desktop (1280) and mobile (390) widths in three
// modes: normal, prefers-reduced-motion, and JavaScript disabled. Screenshots are saved for each.
//
// Fails on: console errors, page errors, failed requests, HTTP 4xx/5xx, broken internal links,
// missing or duplicate h1, horizontal overflow, small touch targets, and an install page
// without a Copy button per command (when JavaScript is on).
//
// Usage: node render-check.mjs --url http://127.0.0.1:8123/ --out render-out
// Needs: puppeteer-core (found via NODE_PATH) and Chrome at CHROME_PATH. CI tool; not deployed.

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire((process.env.NODE_PATH || process.cwd()) + '/');
const puppeteer = require('puppeteer-core');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
  return acc;
}, []));
const BASE = (args.url || 'http://127.0.0.1:8123/').replace(/\/?$/, '/');
const OUT = args.out || 'render-out';
const PAGES = ['', 'install/', 'architecture/', 'packs/', 'faq/', 'walkthrough/', 'game/'];
const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};
const MODES = ['normal', 'reduced-motion', 'no-js'];

mkdirSync(join(OUT, 'shots'), { recursive: true });
const report = { started: new Date().toISOString(), checks: [] };
let failed = 0;
function check(name, ok, detail) {
  report.checks.push({ name, ok: !!ok, detail: detail === undefined ? null : detail });
  if (!ok) { failed++; console.log('FAIL ' + name + ' :: ' + JSON.stringify(detail)); }
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
});

const linkStatus = new Map();
async function statusOf(url) {
  if (!linkStatus.has(url)) {
    try { linkStatus.set(url, (await fetch(url)).status); } catch (e) { linkStatus.set(url, 0); }
  }
  return linkStatus.get(url);
}

try {
  for (const pageName of PAGES) {
    for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
      for (const mode of MODES) {
        const label = `${pageName.replace(/\//g, '') || 'home'}-${vpName}-${mode}`;
        const page = await browser.newPage();
        const errors = [];
        page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
        page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
        page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
        page.on('response', (r) => { if (r.status() >= 400) errors.push('http ' + r.status() + ': ' + r.url()); });
        await page.setViewport(vp);
        if (mode === 'no-js') await page.setJavaScriptEnabled(false);
        if (mode === 'reduced-motion') await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
        await page.goto(BASE + pageName, { waitUntil: 'networkidle0' });

        const info = await page.evaluate(() => {
          const small = [...document.querySelectorAll('.site-nav a, .btn, .copy, summary, .g-switch, .gcopy, .done, .legend a')].filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.height < 43.5 || r.width < 43.5);
          }).map((el) => el.textContent.trim().slice(0, 30));
          const anim = document.querySelector('.sun-glow, .shimmer');
          return {
            h1: document.querySelectorAll('h1').length,
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            links: [...document.querySelectorAll('a[href]')].map((a) => a.href),
            small,
            codeBlocks: document.querySelectorAll('pre > code').length,
            copyButtons: document.querySelectorAll('button.copy').length,
            animation: anim ? getComputedStyle(anim).animationName : null,
            ids: [...document.querySelectorAll('[id]')].map((e) => e.id),
          };
        });

        check(`${label}: no console errors, failed requests or 4xx/5xx`, errors.length === 0, errors.slice(0, 5));
        check(`${label}: exactly one h1`, info.h1 === 1, info.h1);
        check(`${label}: no horizontal overflow`, info.overflow <= 1, info.overflow);
        check(`${label}: nav, buttons and summaries are 44px targets`, info.small.length === 0, info.small.slice(0, 5));
        if (pageName === 'install/') {
          if (mode === 'no-js') {
            check(`${label}: commands are still on the page without JS`, info.codeBlocks > 0, info.codeBlocks);
            const sel = await page.evaluate(() => getComputedStyle(document.querySelector('pre code')).userSelect);
            check(`${label}: command text is selectable`, sel !== 'none', sel);
          } else {
            check(`${label}: a Copy button for every command`, info.codeBlocks > 0 && info.copyButtons === info.codeBlocks, { code: info.codeBlocks, buttons: info.copyButtons });
          }
        }
        if (pageName === 'game/' && mode === 'normal') {
          // Keyboard: Tab must reach the first building link on the map.
          await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
          let reached = false;
          for (let i = 0; i < 8 && !reached; i++) {
            await page.keyboard.press('Tab');
            reached = await page.evaluate(() => document.activeElement === document.querySelector('a.bld'));
          }
          check(`${label}: Tab reaches the first building link`, reached);
          // Mark done flips aria-pressed and updates the progress text.
          const before = await page.evaluate(() => ({ p: document.querySelector('button.done').getAttribute('aria-pressed'), t: document.getElementById('progress').textContent }));
          await page.click('button.done');
          const after = await page.evaluate(() => ({ p: document.querySelector('button.done').getAttribute('aria-pressed'), t: document.getElementById('progress').textContent }));
          check(`${label}: Mark done flips aria-pressed and updates the progress text`, after.p !== before.p && after.t !== before.t && /^\d+ of \d+ quests done/.test(after.t), { before, after });
        }
        if (mode === 'reduced-motion' && info.animation !== null) {
          check(`${label}: animation is off under reduced motion`, info.animation === 'none', info.animation);
        }
        if (mode === 'normal' && vpName === 'desktop') {
          // Broken internal links: fetch every same-site link once and check in-page anchors.
          const here = new URL(BASE + pageName);
          for (const href of new Set(info.links)) {
            const u = new URL(href);
            if (u.origin !== here.origin) continue;
            if (u.pathname === here.pathname && u.hash) {
              check(`${label}: anchor ${u.hash} exists`, info.ids.includes(u.hash.slice(1)), u.hash);
              continue;
            }
            const st = await statusOf(u.origin + u.pathname);
            check(`${label}: link ${u.pathname} resolves`, st === 200, st);
          }
        }
        await page.screenshot({ path: join(OUT, 'shots', label + '.png'), fullPage: true });
        await page.close();
      }
    }
  }
} catch (e) {
  check('render check ran to the end', false, String((e && e.stack) || e));
} finally {
  await browser.close();
}

report.finished = new Date().toISOString();
report.failed = failed;
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(`${report.checks.length - failed}/${report.checks.length} checks passed`);
process.exit(failed ? 1 : 0);
