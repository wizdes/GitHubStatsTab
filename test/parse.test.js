import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DOMParser } from 'linkedom';

// parse.js uses the DOMParser global (the browser provides it; here linkedom does).
globalThis.DOMParser = DOMParser;
const { parseContributions } = await import('../src/parse.js');

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, 'fixtures', 'contributions.html'), 'utf8');

test('parses a full year of days from the real GitHub fragment', () => {
  const { days, total } = parseContributions(html);

  // A rolling year is ~52-53 weeks of cells.
  assert.ok(days.length >= 360 && days.length <= 372, `got ${days.length} days`);

  // Every day is well-formed.
  for (const d of days) {
    assert.match(d.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(d.level >= 0 && d.level <= 4, `level ${d.level}`);
    assert.ok(Number.isInteger(d.count) && d.count >= 0, `count ${d.count}`);
  }

  // Sorted ascending by date.
  for (let i = 1; i < days.length; i++) {
    assert.ok(days[i - 1].date <= days[i].date);
  }

  // Total equals the sum of per-day counts and is non-trivial for torvalds.
  const sum = days.reduce((s, d) => s + d.count, 0);
  assert.equal(total, sum);
  assert.ok(total > 0);
});

test('throws loudly when markup is missing', () => {
  assert.throws(() => parseContributions('<html><body>nope</body></html>'), /markup may have changed/);
});

test('throws loudly when day cells exist but tooltips are gone', () => {
  const html =
    '<table class="ContributionCalendar-grid">' +
    '<td class="ContributionCalendar-day" data-date="2025-01-01" data-level="2" id="c1"></td>' +
    '<td class="ContributionCalendar-day" data-date="2025-01-02" data-level="0" id="c2"></td>' +
    '</table>';
  assert.throws(() => parseContributions(html), /tooltips missing/);
});
