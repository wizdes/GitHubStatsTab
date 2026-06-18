// The one persisted setting: which GitHub username to show.

const KEY = 'ghs-username';

// GitHub usernames: alphanumeric or single hyphens, 1–39 chars, no leading/
// trailing hyphen. Used to reject junk before we hit the network.
const VALID = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export function normalizeUsername(raw) {
  return (raw || '').trim().replace(/^@/, '').replace(/^https?:\/\/github\.com\//i, '').replace(/\/$/, '');
}

export function isValidUsername(raw) {
  return VALID.test(normalizeUsername(raw));
}

export async function getUsername() {
  const obj = await chrome.storage.local.get(KEY);
  return (obj[KEY] || '').trim();
}

export async function setUsername(name) {
  await chrome.storage.local.set({ [KEY]: normalizeUsername(name) });
}

const THEME_KEY = 'ghs-theme';
export const THEMES = ['light', 'dark', 'system'];

export async function getTheme() {
  const obj = await chrome.storage.local.get(THEME_KEY);
  return THEMES.includes(obj[THEME_KEY]) ? obj[THEME_KEY] : 'dark';
}

export async function setTheme(theme) {
  if (THEMES.includes(theme)) await chrome.storage.local.set({ [THEME_KEY]: theme });
}
