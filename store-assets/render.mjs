// Renders all Chrome Web Store images into store-assets/images/.
//
// Every graphic reuses the REAL extension assets so it is pixel-faithful:
//   - the live palette + classes from ../styles.css
//   - the real heatmap renderer from ../src/heatmap.js
//   - real contribution data parsed from the torvalds test fixture by
//     ../src/parse.js (the same parser the extension runs)
//   - the shipped icon ../icons/icon-128.png
//
// Screenshots are PNG (crisp UI); the two promo tiles are JPEG (the store wants
// 24-bit, no-alpha for promo art). Run with: npm run store-assets
//
// No extension load needed — we render the UI directly in headless Chromium, so
// none of the MV3 `--load-extension` flakiness applies.

import { chromium } from '@playwright/test';
import { DOMParser } from 'linkedom';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const OUT = join(here, 'images');
mkdirSync(OUT, { recursive: true });

// --- reused real assets -----------------------------------------------------

const stylesCss = readFileSync(join(ROOT, 'styles.css'), 'utf8');
// heatmap.js is an ES module; strip `export ` so addScriptTag exposes its
// functions (renderHeatmap, buildGrid, …) as page globals.
const heatmapJs = readFileSync(join(ROOT, 'src', 'heatmap.js'), 'utf8').replace(/^export\s+/gm, '');
const iconDataUri =
  'data:image/png;base64,' + readFileSync(join(ROOT, 'icons', 'icon-128.png')).toString('base64');

// Parse the fixture in Node exactly like the unit tests do (linkedom DOMParser).
globalThis.DOMParser = DOMParser;
const { parseContributions } = await import(join(ROOT, 'src', 'parse.js'));
const fixture = readFileSync(join(ROOT, 'test', 'fixtures', 'contributions.html'), 'utf8');
const { days } = parseContributions(fixture);

const REPO = 'github.com/wizdes/GitHubStatsTab';
const ABOUT = 'https://yili.dev/projects/github_stats_new_tab/';

// Exact SVGs from src/main.js so the controls match the product.
const ICON_REFRESH =
  '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/><path fill="currentColor" d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>';
const ICON_GEAR =
  '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311a1.464 1.464 0 0 1-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/></svg>';

// --- shared building blocks (reuse the real classes) ------------------------

const badge = (cls = 'shot-badge') => `<span class="${cls}"><span class="dot"></span>Open Source · MIT</span>`;

const controls = (popover = '') => `
  <div class="ghs-controls">
    <button class="ghs-icon-btn ghs-refresh" title="Refresh" aria-label="Refresh">${ICON_REFRESH}</button>
    <button class="ghs-icon-btn" title="Settings" aria-label="Settings">${ICON_GEAR}</button>
    ${popover}
  </div>`;

const settingsPopover = (activeTheme) => `
  <div class="ghs-settings">
    <label class="ghs-settings-label">Show heatmap for</label>
    <div class="ghs-settings-row">
      <input class="ghs-input" value="torvalds" spellcheck="false" autocomplete="off">
      <button class="ghs-btn ghs-btn--primary">Save</button>
    </div>
    <p class="ghs-input-error"></p>
    <div class="ghs-theme">
      <label class="ghs-settings-label">Theme</label>
      <div class="ghs-theme-options">
        ${[['light', 'Light'], ['dark', 'Dark'], ['system', 'System']]
          .map(
            ([v, l]) =>
              `<button class="ghs-theme-option" aria-pressed="${v === activeTheme}"><span class="ghs-swatch ghs-swatch--${v}"></span><span class="ghs-theme-name">${l}</span></button>`,
          )
          .join('')}
      </div>
    </div>
    <div class="ghs-about">
      <div class="ghs-about-name">Github Stats - New Tab</div>
      <div class="ghs-about-meta"><span>© Yi Li 2026–present</span><span class="ghs-about-sep" aria-hidden="true">·</span><a class="ghs-about-link" href="${ABOUT}">Learn more</a></div>
    </div>
  </div>`;

const emptyCard = () => `
  <div class="ghs-card">
    <p class="ghs-card-sub">Enter a GitHub username to see its contribution heatmap.</p>
    <div class="ghs-settings-row">
      <input class="ghs-input" placeholder="github username">
      <button class="ghs-btn ghs-btn--primary">Show</button>
    </div>
    <p class="ghs-input-error"></p>
  </div>`;

// Layout CSS for the marketing frames (scoped to .shot / .marq / .smtile so it
// never collides with the reused extension classes).
const LAYOUT_CSS = `
  html,body{background:#15161c;}
  .shot{width:1280px;height:800px;position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;padding:60px 64px 0;}
  .shot--dark{background:radial-gradient(120% 120% at 50% -8%, #2d2e3b 0%, #16171e 72%);}
  .shot--light{background:radial-gradient(120% 120% at 50% -8%, #fffaf0 0%, #f0e6c9 75%);}
  .shot-head{text-align:center;max-width:1040px;display:flex;flex-direction:column;align-items:center;}
  .shot-headline{margin:0;font-size:46px;line-height:1.08;font-weight:700;letter-spacing:-0.6px;}
  .shot--dark .shot-headline{color:#f0f3f6;}
  .shot--light .shot-headline{color:#1b1f24;}
  .shot-sub{margin:14px 0 0;font-size:20px;color:var(--text-dim);}
  .shot-badge,.marq-badge{display:inline-flex;align-items:center;gap:9px;padding:8px 16px;border-radius:999px;border:1.5px solid #2ea043;color:#39d353;font-size:15px;font-weight:600;}
  .shot--light .shot-badge{color:#1a7f37;}
  .shot-badge{margin-top:20px;}
  .shot-badge .dot,.marq-badge .dot{width:9px;height:9px;border-radius:50%;background:#39d353;}
  .shot--light .shot-badge .dot{background:#2ea043;}
  .shot-window{position:relative;margin-top:42px;width:1092px;height:432px;border-radius:16px;border:1px solid var(--border);background:var(--bg);box-shadow:0 30px 70px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;overflow:hidden;}
  .shot--light .shot-window{box-shadow:0 28px 64px rgba(120,90,20,.16);}
  .shot-window .ghs-controls{position:absolute;top:18px;right:18px;}

  .marq{width:1400px;height:560px;position:relative;overflow:hidden;display:flex;align-items:center;background:radial-gradient(135% 135% at 10% 12%, #31323f 0%, #161720 72%);}
  .marq-left{width:600px;flex:none;padding-left:80px;}
  .marq-brand{display:flex;align-items:center;gap:16px;}
  .marq-icon{width:62px;height:62px;border-radius:14px;box-shadow:0 6px 18px rgba(0,0,0,.4);}
  .marq-kicker{font-size:17px;color:var(--text-dim);font-weight:600;}
  .marq-title{margin:24px 0 0;font-size:50px;line-height:1.04;font-weight:800;letter-spacing:-1px;color:#f0f3f6;}
  .marq-sub{margin:18px 0 0;font-size:21px;line-height:1.42;color:#aeb6c0;max-width:500px;}
  .marq-row{display:flex;align-items:center;gap:18px;margin-top:28px;}
  .marq-url{font-size:16px;color:#58a6ff;font-weight:500;}
  .marq-right{flex:1;display:flex;align-items:center;justify-content:center;padding-right:36px;}
  .marq-panel{background:var(--bg);border:1px solid var(--border);border-radius:18px;box-shadow:0 26px 64px rgba(0,0,0,.5);padding:30px 34px;}

  .smtile{width:440px;height:280px;position:relative;overflow:hidden;background:radial-gradient(135% 135% at 22% 8%, #2f303d 0%, #161720 78%);padding:26px 26px 0;}
  .smtile-top{display:flex;align-items:center;gap:14px;}
  .smtile-icon{width:50px;height:50px;border-radius:12px;box-shadow:0 5px 14px rgba(0,0,0,.4);}
  .smtile-title{font-size:22px;font-weight:800;color:#f0f3f6;letter-spacing:-.3px;line-height:1.1;}
  .smtile-tag{margin-top:14px;font-size:16px;line-height:1.35;color:#aeb6c0;max-width:300px;}
  .smtile-badge{position:absolute;top:24px;right:22px;display:inline-flex;align-items:center;gap:7px;padding:5px 11px;border-radius:999px;border:1.4px solid #2ea043;color:#39d353;font-size:12px;font-weight:700;}
  .smtile-badge .dot{width:7px;height:7px;border-radius:50%;background:#39d353;}
  .smtile-strip{position:absolute;left:0;right:0;bottom:18px;display:flex;justify-content:center;}
  .smtile .ghs-months,.smtile .ghs-daylabels{display:none;}
  .smtile .ghs-heatmap{--cell:10px;--gap:3px;}
  .marq-right .ghs-months,.marq-right .ghs-daylabels span{}
`;

const doc = (themeAttr, body, extraCss = '') => `<!doctype html><html data-theme="${themeAttr}"><head><meta charset="utf-8">
<style>${stylesCss}${LAYOUT_CSS}${extraCss}</style></head><body>${body}</body></html>`;

// --- asset specs ------------------------------------------------------------

const heatmapBox = '<div class="ghs-heatmap-scroll"><div class="ghs-heatmap"></div></div>';

const shot = (theme, headline, sub, { popover = '', card = '' } = {}) =>
  doc(
    theme,
    `<div class="shot shot--${theme}">
       <div class="shot-head"><h1 class="shot-headline">${headline}</h1>${sub ? `<p class="shot-sub">${sub}</p>` : ''}${badge()}</div>
       <div class="shot-window">${controls(popover)}${card || heatmapBox}</div>
     </div>`,
  );

const assets = [
  {
    name: 'screenshot-1-dark.png',
    w: 1280, h: 800,
    html: shot('dark', 'Your year of commits, on every new tab', 'A pixel-faithful GitHub contribution heatmap — nothing else.'),
    fill: days,
  },
  {
    name: 'screenshot-2-light.png',
    w: 1280, h: 800,
    html: shot('light', 'Light, Dark &amp; System themes', 'Your new tab, the way you like it.'),
    fill: days,
  },
  {
    name: 'screenshot-3-settings.png',
    w: 1280, h: 800,
    html: shot('dark', 'Any public username, one click', 'Set it once in the gear — no login, no token.', { popover: settingsPopover('dark') }),
    fill: days,
  },
  {
    name: 'screenshot-4-setup.png',
    w: 1280, h: 800,
    html: shot('dark', 'No login. No token. Just a username.', 'Type a GitHub handle and you are done.', { card: emptyCard() }),
    fill: null,
  },
  {
    name: 'screenshot-5-open-source.png',
    w: 1280, h: 800,
    html: shot('dark', 'Free &amp; open source', 'MIT licensed · github.com/wizdes/GitHubStatsTab'),
    fill: days,
  },
  {
    name: 'promo-marquee-1400x560.jpg',
    w: 1400, h: 560,
    type: 'jpeg',
    html: doc(
      'dark',
      `<div class="marq">
         <div class="marq-left">
           <div class="marq-brand"><img class="marq-icon" src="${iconDataUri}"><span class="marq-kicker">New Tab extension</span></div>
           <h1 class="marq-title">Github Stats<br>— New Tab</h1>
           <p class="marq-sub">Your public GitHub contribution heatmap on every new tab. No login, no token.</p>
           <div class="marq-row"><span class="marq-badge"><span class="dot"></span>Open Source · MIT</span><span class="marq-url">${REPO}</span></div>
         </div>
         <div class="marq-right"><div class="marq-panel">${heatmapBox}</div></div>
       </div>`,
    ),
    fill: days.slice(-308), // ~44 weeks fits the right-hand panel
  },
  {
    name: 'promo-small-440x280.jpg',
    w: 440, h: 280,
    type: 'jpeg',
    html: doc(
      'dark',
      `<div class="smtile">
         <span class="smtile-badge"><span class="dot"></span>OPEN SOURCE</span>
         <div class="smtile-top"><img class="smtile-icon" src="${iconDataUri}"><div class="smtile-title">Github Stats<br>New Tab</div></div>
         <p class="smtile-tag">Your GitHub contribution heatmap on every new tab.</p>
         <div class="smtile-strip">${heatmapBox}</div>
       </div>`,
    ),
    fill: days.slice(-133), // ~19 weeks strip
  },
];

// --- render -----------------------------------------------------------------

const browser = await chromium.launch();
for (const a of assets) {
  const page = await browser.newPage({ viewport: { width: a.w, height: a.h }, deviceScaleFactor: 1 });
  await page.setContent(a.html, { waitUntil: 'load' });
  if (a.fill) {
    await page.addScriptTag({ content: heatmapJs });
    await page.evaluate((d) => {
      // eslint-disable-next-line no-undef
      renderHeatmap(document.querySelector('.ghs-heatmap'), d);
    }, a.fill);
  }
  await page.waitForTimeout(120); // let webfonts/layout settle
  const path = join(OUT, a.name);
  if (a.type === 'jpeg') await page.screenshot({ path, type: 'jpeg', quality: 95 });
  else await page.screenshot({ path, type: 'png' });
  await page.close();
  console.log('✓', a.name, `${a.w}×${a.h}`);
}
await browser.close();

// Store icon is the shipped icon, reused verbatim.
const fs = await import('node:fs');
fs.copyFileSync(join(ROOT, 'icons', 'icon-128.png'), join(OUT, 'store-icon-128.png'));
console.log('✓ store-icon-128.png 128×128 (copied from icons/icon-128.png)');
console.log('\nImages written to store-assets/images/');
