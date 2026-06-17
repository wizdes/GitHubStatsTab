// Orchestrator: read the saved username, serve from the 24h cache or fetch
// fresh, and render one of four states (empty / loading / ready / error) into
// #app. Wires the refresh button and the settings panel.

import { getUsername, setUsername, isValidUsername, normalizeUsername } from './settings.js';
import { getCache, setCache, clearCache, isFresh } from './cache.js';
import { fetchAll } from './github.js';
import { renderHeatmap } from './heatmap.js';

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

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString());

function agoLabel(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function mount(node) {
  app.innerHTML = '';
  app.appendChild(node);
}

// ---- settings panel (shared by ready/error states) ----------------------

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
    h('label', { class: 'ghs-settings-label' }, 'Show stats for'),
    h('div', { class: 'ghs-settings-row' }, input, h('button', { class: 'ghs-btn ghs-btn--primary', onclick: save }, 'Save')),
    error,
  );
  return { panel, focus: () => input.focus() };
}

function header(entry) {
  const { username, payload, fetchedAt } = entry;
  const name = payload?.profile?.name || `@${username}`;
  const profileUrl = `https://github.com/${encodeURIComponent(username)}`;

  const settings = settingsPanel(username);
  settings.panel.hidden = true;

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

  const refreshBtn = h('button', {
    class: 'ghs-icon-btn',
    title: 'Refresh',
    'aria-label': 'Refresh',
    html: ICONS.refresh,
    onclick: () => load(true),
  });

  const top = h(
    'div',
    { class: 'ghs-header' },
    h(
      'a',
      { class: 'ghs-identity', href: profileUrl, target: '_blank', rel: 'noopener noreferrer' },
      h('img', { class: 'ghs-avatar', src: payload.avatarUrl, alt: '', width: '44', height: '44' }),
      h('span', { class: 'ghs-names' }, h('span', { class: 'ghs-name' }, name), h('span', { class: 'ghs-login' }, `@${username}`)),
    ),
    h(
      'div',
      { class: 'ghs-actions' },
      fetchedAt ? h('span', { class: 'ghs-updated' }, `updated ${agoLabel(fetchedAt)}`) : null,
      refreshBtn,
      gearBtn,
    ),
  );

  return h('div', { class: 'ghs-headerwrap' }, top, settings.panel);
}

function statLine(payload) {
  const p = payload.profile;
  const stats = [
    ['repos', p ? p.repos : null],
    ['stars', payload.stars],
    ['followers', p ? p.followers : null],
    ['contributions', payload.contributions.total],
  ];
  return h(
    'div',
    { class: 'ghs-stats' },
    ...stats.map(([label, value]) =>
      h('div', { class: 'ghs-stat' }, h('span', { class: 'ghs-stat-num' }, fmt(value)), h('span', { class: 'ghs-stat-label' }, label)),
    ),
  );
}

// ---- states --------------------------------------------------------------

function renderEmpty() {
  const input = h('input', {
    type: 'text',
    class: 'ghs-input',
    placeholder: 'github username',
    spellcheck: 'false',
    autocomplete: 'off',
    autofocus: 'true',
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
  const { payload } = entry;
  const heatmapWrap = h('div', { class: 'ghs-heatmap' });
  mount(h('div', { class: 'ghs-page' }, header(entry), statLine(payload), h('div', { class: 'ghs-heatmap-scroll' }, heatmapWrap)));
  renderHeatmap(heatmapWrap, payload.contributions.days);
}

function renderLoading(username, cached) {
  if (cached && cached.username === username) {
    // Refresh in place: keep the (stale) data visible with a badge.
    renderReady(cached);
    app.querySelector('.ghs-page')?.appendChild(h('div', { class: 'ghs-toast' }, 'Refreshing…'));
    return;
  }
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
    app.querySelector('.ghs-page')?.appendChild(
      h('div', { class: 'ghs-toast ghs-toast--warn' }, `Showing cached data — couldn't refresh (${reason})`),
    );
    return;
  }

  const settings = settingsPanel(username);
  mount(
    h(
      'div',
      { class: 'ghs-card' },
      h('h1', { class: 'ghs-card-title' }, "Couldn't load"),
      h('p', { class: 'ghs-card-sub' }, reason),
      h(
        'div',
        { class: 'ghs-settings-row ghs-settings-row--center' },
        h('button', { class: 'ghs-btn', onclick: () => load(true) }, 'Retry'),
      ),
      settings.panel,
    ),
  );
}

// ---- entry ---------------------------------------------------------------

async function load(force = false) {
  const username = await getUsername();
  if (!username) return renderEmpty();

  const cached = await getCache();
  if (!force && cached && cached.username === username && isFresh(cached.fetchedAt, Date.now())) {
    return renderReady(cached);
  }

  renderLoading(username, cached);
  try {
    const payload = await fetchAll(username);
    const entry = { username, fetchedAt: Date.now(), payload };
    await setCache(entry);
    renderReady(entry);
  } catch (err) {
    console.error('[GitHubStatsTab]', err);
    renderError(username, err, cached);
  }
}

load();
