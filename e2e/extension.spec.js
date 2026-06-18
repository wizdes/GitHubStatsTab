// Loads the real unpacked extension in Chromium and drives the new-tab page.
// Deterministic tests route-mock the one fetched origin (the contributions
// HTML) with the captured fixture; one opt-in live smoke (RUN_LIVE=1) proves
// the real host_permissions fetch.

import { test, expect, chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, mkdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const EXT = join(here, '..');
const SHOTS = join(EXT, 'gate-evidence');
const fixtureHtml = readFileSync(join(EXT, 'test', 'fixtures', 'contributions.html'), 'utf8');
mkdirSync(SHOTS, { recursive: true });

// MV3 service workers don't start in old headless mode, so we run headed
// (reliable for extension loading). HEADED=0 forces headless where the new
// headless mode does start the worker.
async function launch() {
  const context = await chromium.launchPersistentContext('', {
    headless: process.env.HEADED === '0',
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15_000 });
  const id = new URL(sw.url()).host;
  return { context, id };
}

function mockContributions(context) {
  context.route(/https:\/\/github\.com\/users\/[^/]+\/contributions/, (r) =>
    r.fulfill({ contentType: 'text/html', body: fixtureHtml }),
  );
}

async function openNewtab(context, id, username) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/newtab.html`);
  if (username !== undefined) {
    await page.evaluate((u) => chrome.storage.local.set({ 'ghs-username': u }), username);
  } else {
    await page.evaluate(() => chrome.storage.local.clear());
  }
  await page.reload();
  return page;
}

test('ready view shows only the heatmap — no avatar, name, or stat line', async () => {
  const { context, id } = await launch();
  mockContributions(context);
  const page = await openNewtab(context, id, 'torvalds');

  await expect(page.locator('.ghs-grid')).toBeVisible();
  await expect.poll(() => page.locator('.ghs-cell').count()).toBeGreaterThan(350);
  const rows = await page.locator('.ghs-grid').evaluate((el) => getComputedStyle(el).gridTemplateRows.split(' ').length);
  expect(rows).toBe(7);

  // The removed chrome must be gone.
  for (const sel of ['.ghs-identity', '.ghs-avatar', '.ghs-stats', '.ghs-updated', '.ghs-login']) {
    expect(await page.locator(sel).count(), sel).toBe(0);
  }
  // Controls remain.
  await expect(page.locator('.ghs-refresh')).toBeVisible();
  await expect(page.locator('.ghs-icon-btn[title="Settings"]')).toBeVisible();

  // Refresh glyph is green when data is fresh (just fetched).
  const rgb = await page.locator('.ghs-refresh').evaluate((el) => getComputedStyle(el).color);
  const [r, g, b] = rgb.match(/\d+/g).map(Number);
  expect(g, rgb).toBeGreaterThan(r);
  expect(g, rgb).toBeGreaterThan(b);

  await page.screenshot({ path: join(SHOTS, '01-ready.png'), fullPage: true });
  await context.close();
});

test('gear popover opens under the gear without reflowing the heatmap', async () => {
  const { context, id } = await launch();
  mockContributions(context);
  const page = await openNewtab(context, id, 'torvalds');
  await expect(page.locator('.ghs-grid')).toBeVisible();

  const before = await page.locator('.ghs-heatmap').boundingBox();
  await page.locator('.ghs-icon-btn[title="Settings"]').click();
  await expect(page.locator('.ghs-settings .ghs-input')).toBeVisible();
  const after = await page.locator('.ghs-heatmap').boundingBox();
  expect(Math.abs(after.y - before.y)).toBeLessThan(1); // heatmap did not move
  expect(Math.abs(after.x - before.x)).toBeLessThan(1);

  await page.screenshot({ path: join(SHOTS, '02-popover.png'), fullPage: true });
  await context.close();
});

test('settings changes the username (persists + re-renders)', async () => {
  const { context, id } = await launch();
  mockContributions(context);
  const page = await openNewtab(context, id, 'torvalds');
  await expect(page.locator('.ghs-grid')).toBeVisible();

  await page.locator('.ghs-icon-btn[title="Settings"]').click();
  await page.locator('.ghs-settings .ghs-input').fill('octocat');
  await page.locator('.ghs-settings .ghs-btn--primary').click();

  await expect
    .poll(() => page.evaluate(async () => (await chrome.storage.local.get('ghs-username'))['ghs-username']))
    .toBe('octocat');
  await expect(page.locator('.ghs-grid')).toBeVisible();
  await context.close();
});

test('first open with empty storage shows the prompt — no blank screen (regression)', async () => {
  const { context, id } = await launch();
  const errors = [];
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text());
  });
  // First and only navigation in a fresh profile (empty storage), NO reload —
  // this is what a real first new-tab open does.
  await page.goto(`chrome-extension://${id}/newtab.html`);
  await expect(page.locator('.ghs-card-title')).toBeVisible({ timeout: 6000 });
  expect(errors, errors.join('\n')).toEqual([]);
  await context.close();
});

test('recovers from an incompatible (v1) cached entry instead of going blank', async () => {
  const { context, id } = await launch();
  mockContributions(context);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/newtab.html`);
  // Seed a v1-shaped cache ({payload} wrapper) that the v2 renderer would misread.
  await page.evaluate(() =>
    chrome.storage.local.set({
      'ghs-username': 'torvalds',
      'ghs-cache': { username: 'torvalds', fetchedAt: Date.now(), payload: { contributions: { days: [], total: 0 } } },
    }),
  );
  await page.reload();
  // Must never be blank: either the (refetched) heatmap or a card.
  await expect(page.locator('.ghs-grid, .ghs-card')).toBeVisible({ timeout: 6000 });
  await context.close();
});

test('empty state prompts for a username', async () => {
  const { context, id } = await launch();
  const page = await openNewtab(context, id, undefined);

  await expect(page.locator('.ghs-card-title')).toHaveText('GitHub Stats Tab');
  await expect(page.locator('.ghs-input')).toBeVisible();

  await page.screenshot({ path: join(SHOTS, '03-empty.png'), fullPage: true });
  await context.close();
});

test('refresh icon shifts toward red as the data ages', async () => {
  const { context, id } = await launch();
  mockContributions(context);
  const page = await openNewtab(context, id, 'torvalds');
  await expect(page.locator('.ghs-grid')).toBeVisible();

  // Backdate the cached fetch to ~18h ago, then re-render from cache.
  await page.evaluate(async () => {
    const o = await chrome.storage.local.get('ghs-cache');
    o['ghs-cache'].fetchedAt = Date.now() - 18 * 60 * 60 * 1000;
    await chrome.storage.local.set(o);
  });
  await page.reload();
  await expect(page.locator('.ghs-grid')).toBeVisible();

  const rgb = await page.locator('.ghs-refresh').evaluate((el) => getComputedStyle(el).color);
  const [r, g, b] = rgb.match(/\d+/g).map(Number);
  expect(r, rgb).toBeGreaterThan(g); // 18h old → orange/red, red channel now leads
  expect(b, rgb).toBeLessThan(g);

  await page.screenshot({ path: join(SHOTS, '05-stale-color.png'), fullPage: true });
  await context.close();
});

const RUN_LIVE = process.env.RUN_LIVE === '1';
test('live: real github.com fetch for torvalds (set RUN_LIVE=1)', async () => {
  test.skip(!RUN_LIVE, 'live network test disabled — set RUN_LIVE=1 to run');
  const { context, id } = await launch();
  const page = await openNewtab(context, id, 'torvalds');

  await expect(page.locator('.ghs-grid')).toBeVisible({ timeout: 25_000 });
  await expect.poll(() => page.locator('.ghs-cell').count(), { timeout: 25_000 }).toBeGreaterThan(300);

  await page.screenshot({ path: join(SHOTS, '04-live.png'), fullPage: true });
  await context.close();
});
