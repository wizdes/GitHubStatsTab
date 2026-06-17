// Loads the real unpacked extension in Chromium and drives the new-tab page.
// Deterministic tests route-mock GitHub with the captured fixture; one opt-in
// live smoke (RUN_LIVE=1) proves the real host_permissions CORS-bypass fetch.

import { test, expect, chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, mkdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const EXT = join(here, '..');
const SHOTS = join(EXT, 'gate-evidence');
const fixtureHtml = readFileSync(join(EXT, 'test', 'fixtures', 'contributions.html'), 'utf8');
mkdirSync(SHOTS, { recursive: true });

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

// MV3 service workers don't start in old headless mode, so we run headed
// (reliable for extension loading). HEADED=0 can force headless for envs
// where the new headless mode does start the worker.
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

function mockGitHub(context) {
  context.route(/https:\/\/github\.com\/[^/]+\.png.*/, (r) => r.fulfill({ contentType: 'image/png', body: PNG_1x1 }));
  context.route(/https:\/\/github\.com\/users\/[^/]+\/contributions/, (r) =>
    r.fulfill({ contentType: 'text/html', body: fixtureHtml }),
  );
  context.route(/https:\/\/api\.github\.com\/users\/[^/]+$/, (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ login: 'torvalds', name: 'Linus Torvalds', public_repos: 8, followers: 241000 }),
    }),
  );
  context.route(/https:\/\/api\.github\.com\/users\/[^/]+\/repos.*/, (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify([{ stargazers_count: 190000 }]) }),
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

test('renders the heatmap, stats, and header from mocked GitHub data', async () => {
  const { context, id } = await launch();
  mockGitHub(context);
  const page = await openNewtab(context, id, 'torvalds');

  await expect(page.locator('.ghs-grid')).toBeVisible();
  await expect.poll(() => page.locator('.ghs-cell').count()).toBeGreaterThan(350);
  expect(await page.locator('.ghs-cell[data-level]').count()).toBeGreaterThan(300);

  // 7 rows: the grid template should declare 7 row tracks.
  const rows = await page.locator('.ghs-grid').evaluate((el) =>
    getComputedStyle(el).gridTemplateRows.split(' ').length,
  );
  expect(rows).toBe(7);

  await expect(page.locator('.ghs-login')).toHaveText('@torvalds');
  await expect(page.locator('.ghs-stats')).toContainText('contributions');

  await page.screenshot({ path: join(SHOTS, '01-ready.png'), fullPage: true });
  await context.close();
});

test('refresh re-fetches without breaking the page', async () => {
  const { context, id } = await launch();
  mockGitHub(context);
  const page = await openNewtab(context, id, 'torvalds');
  await expect(page.locator('.ghs-grid')).toBeVisible();

  await page.locator('.ghs-icon-btn[title="Refresh"]').click();
  // The transient "Refreshing…" toast is removed once the refetch re-renders.
  await expect(page.locator('.ghs-toast')).toHaveCount(0);
  await expect(page.locator('.ghs-grid')).toBeVisible();
  await expect(page.locator('.ghs-login')).toHaveText('@torvalds');

  await context.close();
});

test('settings changes the username and re-renders', async () => {
  const { context, id } = await launch();
  mockGitHub(context);
  const page = await openNewtab(context, id, 'torvalds');
  await expect(page.locator('.ghs-grid')).toBeVisible();

  await page.locator('.ghs-icon-btn[title="Settings"]').click();
  const input = page.locator('.ghs-settings .ghs-input');
  await expect(input).toBeVisible();
  await input.fill('octocat');
  await page.locator('.ghs-settings .ghs-btn--primary').click();
  await expect(page.locator('.ghs-login')).toHaveText('@octocat');

  await page.screenshot({ path: join(SHOTS, '02-after-settings.png'), fullPage: true });
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

test('stars degrade to "—" when the repos API is rate-limited', async () => {
  const { context, id } = await launch();
  // contributions + profile succeed, but the repos endpoint is rate-limited.
  context.route(/https:\/\/github\.com\/[^/]+\.png.*/, (r) => r.fulfill({ contentType: 'image/png', body: PNG_1x1 }));
  context.route(/https:\/\/github\.com\/users\/[^/]+\/contributions/, (r) =>
    r.fulfill({ contentType: 'text/html', body: fixtureHtml }),
  );
  context.route(/https:\/\/api\.github\.com\/users\/[^/]+$/, (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ login: 'torvalds', name: 'Linus Torvalds', public_repos: 8, followers: 241000 }),
    }),
  );
  context.route(/https:\/\/api\.github\.com\/users\/[^/]+\/repos.*/, (r) =>
    r.fulfill({ status: 403, contentType: 'application/json', body: '{"message":"rate limited"}' }),
  );
  const page = await openNewtab(context, id, 'torvalds');

  await expect(page.locator('.ghs-grid')).toBeVisible();
  // stat order: repos, stars, followers, contributions
  await expect(page.locator('.ghs-stat:nth-child(2) .ghs-stat-num')).toHaveText('—'); // stars unknown
  await expect(page.locator('.ghs-stat:nth-child(1) .ghs-stat-num')).toHaveText('8'); // repos still shown
  await context.close();
});

const RUN_LIVE = process.env.RUN_LIVE === '1';
test('live: real github.com fetch for torvalds (set RUN_LIVE=1)', async () => {
  test.skip(!RUN_LIVE, 'live network test disabled — set RUN_LIVE=1 to run');
  const { context, id } = await launch();
  const page = await openNewtab(context, id, 'torvalds');

  await expect(page.locator('.ghs-grid')).toBeVisible({ timeout: 25_000 });
  await expect.poll(() => page.locator('.ghs-cell').count(), { timeout: 25_000 }).toBeGreaterThan(300);
  await expect(page.locator('.ghs-login')).toHaveText('@torvalds');

  // Avatar comes from github.com/{user}.png — confirm the real image loads.
  await page.waitForFunction(
    () => {
      const img = document.querySelector('.ghs-avatar');
      return img && img.complete && img.naturalWidth > 1;
    },
    { timeout: 15_000 },
  );

  await page.screenshot({ path: join(SHOTS, '04-live.png'), fullPage: true });
  await context.close();
});
