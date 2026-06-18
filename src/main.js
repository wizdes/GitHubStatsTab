// Orchestrator: read the saved username, serve from the 24h cache or fetch
// fresh, and render one of four states (empty / loading / ready / error) into
// #app. The ready view is just the heatmap; a fixed top-right cluster holds the
// refresh button (color-coded by data age) and the settings gear (whose popover
// drops in under it without reflowing the page).

import { getUsername, setUsername, isValidUsername, normalizeUsername, getTheme, setTheme } from './settings.js';
import { getCache, setCache, clearCache, isFresh, isUsableEntry } from './cache.js';
import { fetchContributions } from './github.js';
import { renderHeatmap } from './heatmap.js';
import { staleColor, isExpired } from './freshness.js';

const app = document.getElementById('app');

const ICONS = {
  refresh:
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/><path fill="currentColor" d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>',
  gear:
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311a1.464 1.464 0 0 1-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/></svg>',
};

function h(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  return node;
}

function mount(node) {
  app.innerHTML = '';
  app.appendChild(node);
}

// Tracks the currently-displayed data's age so the periodic tick can recolor
// the refresh icon and auto-refresh once it crosses 1 day.
const current = { fetchedAt: null };
let loading = false;

function applyFreshness() {
  const btn = app.querySelector('.ghs-refresh');
  if (!btn || !current.fetchedAt) return;
  btn.style.color = staleColor(Date.now() - current.fetchedAt);
}

// ---- theme ---------------------------------------------------------------

let themeMql = null;

function resolveTheme(choice) {
  if (choice === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return choice;
}

async function applyTheme() {
  document.documentElement.dataset.theme = resolveTheme(await getTheme());
  // While on 'system', follow OS changes live.
  if (!themeMql) {
    themeMql = window.matchMedia('(prefers-color-scheme: light)');
    themeMql.addEventListener('change', async () => {
      if ((await getTheme()) === 'system') document.documentElement.dataset.theme = resolveTheme('system');
    });
  }
}

// Light/Dark/System, each a fixed-color swatch with a label under it.
function themeSelector() {
  const opts = [
    ['light', 'Light'],
    ['dark', 'Dark'],
    ['system', 'System'],
  ];
  const buttons = {};
  const mark = (active) => {
    for (const [val] of opts) buttons[val].setAttribute('aria-pressed', String(val === active));
  };
  const row = h(
    'div',
    { class: 'ghs-theme-options' },
    ...opts.map(([val, label]) => {
      const btn = h(
        'button',
        {
          class: 'ghs-theme-option',
          type: 'button',
          'data-theme-choice': val,
          'aria-pressed': 'false',
          onclick: async () => {
            await setTheme(val);
            await applyTheme();
            mark(val);
          },
        },
        h('span', { class: `ghs-swatch ghs-swatch--${val}` }),
        h('span', { class: 'ghs-theme-name' }, label),
      );
      buttons[val] = btn;
      return btn;
    }),
  );
  getTheme().then(mark);
  return h('div', { class: 'ghs-theme' }, h('label', { class: 'ghs-settings-label' }, 'Theme'), row);
}

// ---- settings popover (shared by ready + error states) -------------------

function settingsPanel(currentUsername) {
  const input = h('input', {
    type: 'text',
    class: 'ghs-input',
    placeholder: 'github username',
    value: currentUsername || '',
    spellcheck: 'false',
    autocomplete: 'off',
  });
  const error = h('p', { class: 'ghs-input-error' });

  const save = async () => {
    const name = normalizeUsername(input.value);
    if (!isValidUsername(name)) {
      error.textContent = 'Enter a valid GitHub username.';
      input.focus();
      return;
    }
    await setUsername(name);
    await clearCache();
    load(true);
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
  });

  const panel = h(
    'div',
    { class: 'ghs-settings' },
    h('label', { class: 'ghs-settings-label' }, 'Show heatmap for'),
    h('div', { class: 'ghs-settings-row' }, input, h('button', { class: 'ghs-btn ghs-btn--primary', onclick: save }, 'Save')),
    error,
    themeSelector(),
  );
  return { panel, focus: () => input.focus() };
}

// Fixed top-right cluster: refresh (color = data age) + gear (toggles the
// popover, which is positioned under the gear so it never reflows the heatmap).
function controls(username) {
  const settings = settingsPanel(username);
  settings.panel.hidden = true;

  const refreshBtn = h('button', {
    class: 'ghs-icon-btn ghs-refresh',
    title: 'Refresh',
    'aria-label': 'Refresh',
    html: ICONS.refresh,
    onclick: () => load(true),
  });

  const gearBtn = h('button', {
    class: 'ghs-icon-btn',
    title: 'Settings',
    'aria-label': 'Settings',
    html: ICONS.gear,
    onclick: () => {
      settings.panel.hidden = !settings.panel.hidden;
      if (!settings.panel.hidden) settings.focus();
    },
  });

  return h('div', { class: 'ghs-controls' }, refreshBtn, gearBtn, settings.panel);
}

// ---- states --------------------------------------------------------------

function renderEmpty() {
  current.fetchedAt = null;
  const input = h('input', {
    type: 'text',
    class: 'ghs-input',
    placeholder: 'github username',
    spellcheck: 'false',
    autocomplete: 'off',
  });
  const error = h('p', { class: 'ghs-input-error' });
  const save = async () => {
    const name = normalizeUsername(input.value);
    if (!isValidUsername(name)) {
      error.textContent = 'Enter a valid GitHub username.';
      input.focus();
      return;
    }
    await setUsername(name);
    load(true);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
  });

  mount(
    h(
      'div',
      { class: 'ghs-card' },
      h('h1', { class: 'ghs-card-title' }, 'GitHub Stats Tab'),
      h('p', { class: 'ghs-card-sub' }, 'Enter a GitHub username to see its contribution heatmap.'),
      h('div', { class: 'ghs-settings-row' }, input, h('button', { class: 'ghs-btn ghs-btn--primary', onclick: save }, 'Show')),
      error,
    ),
  );
  input.focus();
}

function renderReady(entry) {
  current.fetchedAt = entry.fetchedAt;
  const heatmapWrap = h('div', { class: 'ghs-heatmap' });
  mount(h('div', { class: 'ghs-ready' }, controls(entry.username), h('div', { class: 'ghs-heatmap-scroll' }, heatmapWrap)));
  renderHeatmap(heatmapWrap, entry.contributions.days);
  applyFreshness();
}

function renderLoading(username, cached) {
  if (cached && cached.username === username) {
    // Refresh in place: keep the (stale) data visible with a badge.
    renderReady(cached);
    app.querySelector('.ghs-ready')?.appendChild(h('div', { class: 'ghs-toast' }, 'Refreshing…'));
    return;
  }
  current.fetchedAt = null;
  mount(h('div', { class: 'ghs-card' }, h('div', { class: 'ghs-spinner' }), h('p', { class: 'ghs-card-sub' }, `Loading @${username}…`)));
}

function renderError(username, err, cached) {
  const reason =
    err.code === 'not_found'
      ? `@${username} not found — check the username in settings.`
      : err.code === 'rate_limit'
        ? 'GitHub rate limit reached. Try again later.'
        : err.code === 'network'
          ? 'Network error. Check your connection.'
          : err.message || 'Something went wrong.';

  if (cached && cached.username === username) {
    renderReady(cached);
    app.querySelector('.ghs-ready')?.appendChild(
      h('div', { class: 'ghs-toast ghs-toast--warn' }, `Showing cached data — couldn't refresh (${reason})`),
    );
    return;
  }

  current.fetchedAt = null;
  const settings = settingsPanel(username);
  mount(
    h(
      'div',
      { class: 'ghs-card' },
      h('h1', { class: 'ghs-card-title' }, "Couldn't load"),
      h('p', { class: 'ghs-card-sub' }, reason),
      h('div', { class: 'ghs-settings-row ghs-settings-row--center' }, h('button', { class: 'ghs-btn', onclick: () => load(true) }, 'Retry')),
      settings.panel,
    ),
  );
}

// ---- entry ---------------------------------------------------------------

async function load(force = false) {
  loading = true;
  try {
    let username = '';
    try {
      username = await getUsername();
    } catch (e) {
      console.error('[GitHubStatsTab] storage read failed', e);
      return renderEmpty();
    }
    if (!username) return renderEmpty();

    const raw = await getCache().catch(() => null);
    const cached = isUsableEntry(raw, username) ? raw : null;

    if (!force && cached && isFresh(cached.fetchedAt, Date.now())) {
      return renderReady(cached);
    }

    renderLoading(username, cached);
    try {
      const contributions = await fetchContributions(username);
      const entry = { username, fetchedAt: Date.now(), contributions };
      await setCache(entry).catch(() => {});
      renderReady(entry);
    } catch (err) {
      console.error('[GitHubStatsTab]', err);
      renderError(username, err, cached);
    }
  } catch (e) {
    // Last-resort guard: whatever went wrong, show the prompt, never a blank tab.
    console.error('[GitHubStatsTab] unexpected', e);
    renderEmpty();
  } finally {
    loading = false;
  }
}

// Keep the refresh color live and auto-refresh once data passes 1 day old,
// even on a tab that stays open across the threshold.
setInterval(() => {
  applyFreshness();
  if (current.fetchedAt && isExpired(Date.now() - current.fetchedAt) && !loading) load(true);
}, 60_000);

applyTheme();
load();
