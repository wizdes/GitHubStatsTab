// Network edge. The contribution heatmap is the hero and fails loudly; the
// profile + star stats are secondary and degrade gracefully (the stat line
// just omits whatever the unauthenticated API couldn't give us, e.g. when
// the 60 req/hr limit is hit). No auth token anywhere.

import { parseContributions } from './parse.js';

const CONTRIB_URL = (u) => `https://github.com/users/${encodeURIComponent(u)}/contributions`;
const API_USER = (u) => `https://api.github.com/users/${encodeURIComponent(u)}`;
const API_REPOS = (u, page) =>
  `https://api.github.com/users/${encodeURIComponent(u)}/repos?per_page=100&page=${page}`;

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

export async function fetchProfile(username) {
  const res = await fetch(API_USER(username));
  if (res.status === 404) throw ghError(`@${username} not found`, 'not_found');
  if (res.status === 403) throw ghError('GitHub API rate limit reached', 'rate_limit');
  if (!res.ok) throw ghError(`GitHub API returned ${res.status}`, 'http');
  const j = await res.json();
  return { login: j.login, name: j.name, repos: j.public_repos, followers: j.followers };
}

// Sum stargazers across all public repos. Capped so a user with hundreds of
// repos can't stall the page. Throws if a page fails mid-pagination rather
// than returning a partial sum — a confidently-wrong smaller star count is
// worse than showing "—". The caller treats a throw as "stars unknown".
export async function fetchStars(username, maxPages = 10) {
  let stars = 0;
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(API_REPOS(username, page));
    if (res.status === 403) throw ghError('GitHub API rate limit reached', 'rate_limit');
    if (!res.ok) throw ghError(`GitHub API returned ${res.status}`, 'http');
    const repos = await res.json();
    if (!Array.isArray(repos) || repos.length === 0) break;
    stars += repos.reduce((s, r) => s + (r.stargazers_count || 0), 0);
    if (repos.length < 100) break; // last page
  }
  return stars;
}

export async function fetchAll(username) {
  const contributions = await fetchContributions(username); // hero — throws on failure
  let profile = null;
  let stars = null;
  try {
    profile = await fetchProfile(username);
    stars = await fetchStars(username);
  } catch (e) {
    console.warn('[GitHubStatsTab] profile/stars unavailable:', e.message);
  }
  return {
    username,
    avatarUrl: `https://github.com/${encodeURIComponent(username)}.png?size=160`,
    profile,
    stars,
    contributions,
  };
}
