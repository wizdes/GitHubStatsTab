// Parse GitHub's public /users/{username}/contributions HTML fragment into a
// clean { days, total } shape. This is the brittle, undocumented part of the
// extension, so it lives alone and fails loudly: if the markup ever changes,
// this throws (caught upstream and shown as an error) and the fixture test
// in test/parse.test.js goes red.
//
// Depends only on a DOMParser — the browser global in the extension, and
// linkedom's DOMParser injected onto globalThis in tests.

const COUNT_RE = /^([\d,]+)\s+contribution/i; // "2 contributions on June 15th."

export function parseContributions(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const cells = [...doc.querySelectorAll('.ContributionCalendar-day')].filter((el) =>
    el.getAttribute('data-date'),
  );
  if (cells.length === 0) {
    throw new Error('No contribution cells found — GitHub markup may have changed.');
  }

  // GitHub no longer ships the "N contributions in the last year" heading in
  // this fragment, so we read the exact per-day count from each <tool-tip>
  // ("No contributions on …" => 0) and sum them for the yearly total. This
  // equals GitHub's displayed total for public profiles.
  const counts = new Map();
  for (const tip of doc.querySelectorAll('tool-tip')) {
    const forId = tip.getAttribute('for');
    if (!forId) continue;
    const m = (tip.textContent || '').trim().match(COUNT_RE);
    counts.set(forId, m ? parseInt(m[1].replace(/,/g, ''), 10) : 0);
  }

  let matched = 0;
  const days = cells.map((el) => {
    const level = parseInt(el.getAttribute('data-level') || '0', 10);
    const id = el.getAttribute('id');
    const has = counts.has(id);
    if (has) matched++;
    return {
      date: el.getAttribute('data-date'),
      level: Number.isFinite(level) ? level : 0,
      count: has ? counts.get(id) : 0,
    };
  });

  // The total is the headline number; if tooltips have largely vanished it
  // would silently under-count, so fail loudly instead.
  if (matched < cells.length * 0.5) {
    throw new Error('Contribution tooltips missing — GitHub markup may have changed.');
  }

  days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const total = days.reduce((sum, d) => sum + d.count, 0);
  return { days, total };
}
