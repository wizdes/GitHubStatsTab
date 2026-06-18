// Network edge. The only thing fetched is the public contributions HTML (the
// heatmap) — no auth token, no api.github.com. Fails loudly: a bad response or
// changed markup throws, and main.js renders the error state.

import { parseContributions } from './parse.js';

const CONTRIB_URL = (u) => `https://github.com/users/${encodeURIComponent(u)}/contributions`;

function ghError(message, code) {
  const e = new Error(message);
  e.code = code;
  return e;
}

export async function fetchContributions(username) {
  let res;
  try {
    res = await fetch(CONTRIB_URL(username));
  } catch {
    throw ghError('Network error reaching github.com', 'network');
  }
  if (res.status === 404) throw ghError(`@${username} not found`, 'not_found');
  if (!res.ok) throw ghError(`GitHub returned ${res.status}`, 'http');
  return parseContributions(await res.text()); // { days, total } — may throw on markup change
}
