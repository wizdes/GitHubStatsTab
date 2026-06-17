import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFresh, TTL } from '../src/cache.js';

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
