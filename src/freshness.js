// Maps "how old is the cached data" to the refresh icon's color and to the
// auto-refresh decision. Pure (no DOM / chrome), so it is unit-tested.
//
// < 10 min  → gentle green (hue 120). Drifts through yellow/orange to red at
// 1 day old (hue 0), which is also when we auto-refresh — so red is only ever
// a momentary state before the data reloads to green.

import { TTL } from './cache.js';

export const FRESH_MS = 10 * 60 * 1000; // full green at/under this age
export const STALE_MS = TTL; // 24h — red, and the auto-refresh threshold

const clamp01 = (x) => Math.max(0, Math.min(1, x));

export function staleColor(ageMs) {
  const t = clamp01((ageMs - FRESH_MS) / (STALE_MS - FRESH_MS));
  const hue = Math.round(120 * (1 - t)); // 120 (green) → 0 (red)
  return `hsl(${hue} 55% 45%)`;
}

export function isExpired(ageMs) {
  return ageMs >= STALE_MS;
}
