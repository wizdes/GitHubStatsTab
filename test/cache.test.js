import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFresh, TTL, isUsableEntry } from '../src/cache.js';

const HOUR = 60 * 60 * 1000;
const now = 1_700_000_000_000;

test('TTL is 24h', () => {
  assert.equal(TTL, 24 * HOUR);
});

test('isFresh: data 23h old is fresh', () => {
  assert.equal(isFresh(now - 23 * HOUR, now), true);
});

test('isFresh: data 25h old is stale', () => {
  assert.equal(isFresh(now - 25 * HOUR, now), false);
});

test('isFresh: exactly at TTL is stale (strict <)', () => {
  assert.equal(isFresh(now - TTL, now), false);
});

test('isFresh: missing timestamp is stale', () => {
  assert.equal(isFresh(undefined, now), false);
  assert.equal(isFresh(0, now), false);
});

test('isFresh: honors a custom ttl', () => {
  assert.equal(isFresh(now - 2 * HOUR, now, 1 * HOUR), false);
  assert.equal(isFresh(now - 0.5 * HOUR, now, 1 * HOUR), true);
});

// Reproduces the crash: "Cannot read properties of undefined (reading 'days')"
// in renderReady. The root cause is consuming a cache entry that lacks
// contributions.days (e.g. a v1 {payload} entry); isUsableEntry must reject it
// so the app refetches instead of crashing.
test('isUsableEntry rejects entries that would crash renderReady', () => {
  const v1 = { username: 'me', fetchedAt: now, payload: { contributions: { days: [] } } };
  assert.equal(isUsableEntry(v1, 'me'), false, 'legacy v1 {payload} entry');
  assert.equal(isUsableEntry(null, 'me'), false, 'no entry');
  assert.equal(isUsableEntry({ username: 'me' }, 'me'), false, 'no contributions');
  assert.equal(isUsableEntry({ username: 'me', contributions: {} }, 'me'), false, 'contributions but no days');
  assert.equal(isUsableEntry({ username: 'me', contributions: { days: 'x' } }, 'me'), false, 'days not an array');
  assert.equal(isUsableEntry({ username: 'me', contributions: { days: [] } }, 'you'), false, 'wrong username');
});

test('isUsableEntry accepts a current-shape entry', () => {
  const ok = { username: 'me', fetchedAt: now, contributions: { days: [{ date: '2025-01-01', level: 0, count: 0 }], total: 0 } };
  assert.equal(isUsableEntry(ok, 'me'), true);
});
