// 24h cache of the last successful fetch, in chrome.storage.local.
// isFresh is pure (no chrome dependency) so it is unit-testable.

const KEY = 'ghs-cache';
export const TTL = 24 * 60 * 60 * 1000; // 24h

export function isFresh(fetchedAt, now, ttl = TTL) {
  if (!fetchedAt) return false;
  return now - fetchedAt < ttl;
}

export async function getCache() {
  const obj = await chrome.storage.local.get(KEY);
  return obj[KEY] || null;
}

export async function setCache(entry) {
  await chrome.storage.local.set({ [KEY]: entry });
}

export async function clearCache() {
  await chrome.storage.local.remove(KEY);
}
