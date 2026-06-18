import { test } from 'node:test';
import assert from 'node:assert/strict';
import { staleColor, isExpired, FRESH_MS, STALE_MS } from '../src/freshness.js';

const hueOf = (s) => Number(s.match(/^hsl\((\d+)/)[1]);
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

test('staleColor is full green at/under 10 minutes', () => {
  assert.equal(staleColor(0), 'hsl(120 55% 45%)');
  assert.equal(staleColor(5 * MIN), 'hsl(120 55% 45%)');
  assert.equal(staleColor(FRESH_MS), 'hsl(120 55% 45%)');
});

test('staleColor is red at/over 1 day', () => {
  assert.equal(hueOf(staleColor(STALE_MS)), 0);
  assert.equal(hueOf(staleColor(2 * STALE_MS)), 0);
});

test('staleColor hue decreases monotonically between fresh and stale', () => {
  const ages = [FRESH_MS, 1 * HOUR, 6 * HOUR, 12 * HOUR, 23 * HOUR, STALE_MS];
  const hues = ages.map((a) => hueOf(staleColor(a)));
  for (let i = 1; i < hues.length; i++) {
    assert.ok(hues[i] <= hues[i - 1], `hue should not increase: ${hues}`);
    assert.ok(hues[i] >= 0 && hues[i] <= 120);
  }
  assert.ok(hues[0] === 120 && hues[hues.length - 1] === 0);
});

test('isExpired flips at the 1-day threshold', () => {
  assert.equal(isExpired(23 * HOUR), false);
  assert.equal(isExpired(STALE_MS), true);
  assert.equal(isExpired(25 * HOUR), true);
});
