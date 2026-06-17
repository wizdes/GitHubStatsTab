import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUsername, isValidUsername } from '../src/settings.js';

test('normalizeUsername strips @, profile URL, slashes, whitespace', () => {
  assert.equal(normalizeUsername('  @octocat '), 'octocat');
  assert.equal(normalizeUsername('https://github.com/Bar/'), 'Bar');
  assert.equal(normalizeUsername('torvalds'), 'torvalds');
});

test('isValidUsername accepts real handles', () => {
  for (const u of ['octocat', 'torvalds', 'a', 'foo-bar', '@octocat', 'https://github.com/octocat']) {
    assert.equal(isValidUsername(u), true, u);
  }
});

test('isValidUsername rejects junk', () => {
  for (const u of ['', '-foo', 'foo-', 'foo_bar', 'foo bar', 'a'.repeat(40), 'foo--bar']) {
    assert.equal(isValidUsername(u), false, u);
  }
});
