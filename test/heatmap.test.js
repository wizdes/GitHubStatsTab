import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGrid, monthLabels, LEVEL_COLORS, DAY_LABELS } from '../src/heatmap.js';

// Helper: a run of N consecutive days starting at `start`, all level 1.
function run(start, n) {
  const [y, m, d] = start.split('-').map(Number);
  const out = [];
  for (let i = 0; i < n; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    out.push({ date: dt.toISOString().slice(0, 10), level: 1, count: 1 });
  }
  return out;
}

test('LEVEL_COLORS maps the 5 GitHub levels', () => {
  assert.equal(LEVEL_COLORS.length, 5);
  assert.equal(LEVEL_COLORS[0], '#161b22');
  assert.equal(LEVEL_COLORS[4], '#39d353');
});

test('DAY_LABELS labels Mon/Wed/Fri on rows 1/3/5', () => {
  assert.deepEqual(DAY_LABELS, ['', 'Mon', '', 'Wed', '', 'Fri', '']);
});

test('buildGrid handles empty input', () => {
  assert.deepEqual(buildGrid([]), { columns: [], leadingPad: 0 });
});

test('buildGrid: Sunday start has no leading pad and fills columns of 7', () => {
  const days = run('2025-06-15', 14); // 2025-06-15 is a Sunday
  const { columns, leadingPad } = buildGrid(days);
  assert.equal(leadingPad, 0);
  assert.equal(columns.length, 2);
  assert.equal(columns[0][0].date, '2025-06-15'); // top of col 0 = Sunday
  assert.equal(columns[0][6].date, '2025-06-21'); // bottom = Saturday
  assert.equal(columns[1][0].date, '2025-06-22'); // next Sunday starts col 1
});

test('buildGrid: midweek start pads the first column with nulls', () => {
  const days = run('2025-06-18', 3); // Wed, Thu, Fri
  const { columns, leadingPad } = buildGrid(days);
  assert.equal(leadingPad, 3); // Sun,Mon,Tue empty
  assert.equal(columns[0][0], null);
  assert.equal(columns[0][1], null);
  assert.equal(columns[0][2], null);
  assert.equal(columns[0][3].date, '2025-06-18');
});

test('buildGrid: every column has exactly 7 rows', () => {
  const { columns } = buildGrid(run('2025-06-18', 60));
  for (const col of columns) assert.equal(col.length, 7);
});

test('monthLabels: a label at the first week each month begins (GitHub-style)', () => {
  // 120 days from mid-June reaches mid-October. A month is labelled at the
  // first column whose top (Sunday) cell falls in that month.
  const labels = monthLabels(buildGrid(run('2025-06-15', 120)).columns);
  const texts = labels.map((l) => l.text);
  assert.deepEqual(texts.slice(0, 4), ['Jun', 'Jul', 'Aug', 'Sep']);
  // labels are in strictly increasing column order
  for (let i = 1; i < labels.length; i++) assert.ok(labels[i].col > labels[i - 1].col);
});
