// Rebuilds the GitHub contribution grid from parsed { date, level, count }
// days. We render our own grid (rather than injecting GitHub's HTML) so the
// dark theme and spacing are exactly ours. buildGrid / monthLabels are pure
// and unit-tested; renderHeatmap touches the DOM.

// Level 0 (no contributions) is a touch lighter than the midnight page bg so
// the empty grid reads; levels 1–4 are GitHub's exact dark-mode greens.
export const LEVEL_COLORS = ['#2d2f3b', '#0e4429', '#006d32', '#26a641', '#39d353'];
export const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']; // rows 0..6 = Sun..Sat
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Weekday 0=Sun..6=Sat, computed in UTC so it never drifts by timezone.
function weekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function monthIndex(dateStr) {
  return Number(dateStr.split('-')[1]) - 1;
}

// Column-major grid: columns[col][row] = day | null. Sunday on top. The first
// column is padded with nulls up to the first day's weekday, exactly like
// GitHub's leading partial week.
export function buildGrid(days) {
  if (!days || days.length === 0) return { columns: [], leadingPad: 0 };
  const leadingPad = weekday(days[0].date);
  const columns = [];
  days.forEach((day, i) => {
    const cellIndex = leadingPad + i;
    const col = Math.floor(cellIndex / 7);
    const row = cellIndex % 7;
    if (!columns[col]) columns[col] = [null, null, null, null, null, null, null];
    columns[col][row] = day;
  });
  return { columns, leadingPad };
}

// One label per month, placed at the first column where that month appears.
export function monthLabels(columns) {
  const labels = [];
  let last = -1;
  columns.forEach((col, c) => {
    const firstDay = col.find(Boolean);
    if (!firstDay) return;
    const mi = monthIndex(firstDay.date);
    if (mi !== last) {
      labels.push({ col: c, text: MONTHS[mi] });
      last = mi;
    }
  });
  return labels;
}

export function renderHeatmap(container, days) {
  const { columns } = buildGrid(days);
  container.innerHTML = '';
  container.style.setProperty('--weeks', String(columns.length));

  const months = document.createElement('div');
  months.className = 'ghs-months';
  for (const { col, text } of monthLabels(columns)) {
    const span = document.createElement('span');
    span.textContent = text;
    span.style.gridColumnStart = String(col + 1);
    months.appendChild(span);
  }

  const dayLabels = document.createElement('div');
  dayLabels.className = 'ghs-daylabels';
  for (const t of DAY_LABELS) {
    const span = document.createElement('span');
    span.textContent = t;
    dayLabels.appendChild(span);
  }

  const grid = document.createElement('div');
  grid.className = 'ghs-grid';
  // Emit column-major (col0 rows 0..6, col1 rows 0..6, …) so grid-auto-flow:column
  // lays the cells out down each week, matching GitHub.
  for (const col of columns) {
    for (const day of col) {
      const cell = document.createElement('div');
      cell.className = 'ghs-cell';
      const level = day ? day.level : 0;
      cell.style.background = LEVEL_COLORS[level] || LEVEL_COLORS[0];
      if (day) {
        cell.dataset.level = String(day.level);
        cell.dataset.date = day.date;
        const noun = day.count === 1 ? 'contribution' : 'contributions';
        cell.title = `${day.count} ${noun} on ${day.date}`;
      } else {
        cell.classList.add('ghs-cell--empty');
      }
      grid.appendChild(cell);
    }
  }

  const body = document.createElement('div');
  body.className = 'ghs-body';
  body.appendChild(dayLabels);
  body.appendChild(grid);

  container.appendChild(months);
  container.appendChild(body);
}
