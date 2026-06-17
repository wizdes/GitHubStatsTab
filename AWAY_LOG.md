# AWAY_LOG — GitHubStatsTab

Autonomous (away mode) build of the GitHub Stats Tab Chrome extension. Read this
first. Every assumption, judgment call, and failed approach is logged below.

## Standing directives (from kickoff)
- Mode: **away / autonomous.** Branches/local-only. No remote push, no deploy, no
  CI trigger. Never touch `~/keys` / prod. Worst case = `rm -rf` this one dir.
- Bypass permission prompts. Atomic commits. Merge/remote/deploy + human-eyeball QA
  **queued for Yi's return** (see Handoff at bottom).

## Decisions & assumptions (chronological)
1. **No personal GitHub handle available** (memory only has the `wizdes` org, which is
   an org, not a user → no contribution graph). Chose the simplest reasonable option:
   ship a **blank username empty-state** (user types theirs once on first load — also the
   better default for a general extension). Used **`torvalds`** as the fixture/test/visual-
   gate account (dense graph, exercises all 5 levels).
2. **Yearly-total `h2` is no longer in the `/contributions` HTML fragment** (verified
   against live markup 2026-06-16). Switched to **computing the total by summing per-day
   counts** parsed from each `<tool-tip>` ("N contributions on <date>." / "No
   contributions on <date>." → 0). This equals GitHub's displayed total for public
   profiles and is more robust than scraping a heading.
3. **Avatar via `https://github.com/{username}.png?size=160`** (img src, never rate-
   limited, no CORS) rather than the API `avatar_url`, so the photo always loads even if
   the unauthenticated API hits its 60/hr cap.
4. Cell `id` format is `contribution-day-component-{row}-{col}`; irrelevant to us since we
   rebuild the grid by `data-date` (column-major, Sunday-top), reproducing GitHub exactly.

## Failed approaches
- **Headless Playwright couldn't load the extension's MV3 service worker** (old
  headless mode never starts it → extension-id resolution timed out). Switched the E2E
  to headed Chromium (`HEADED=0` env can force headless where new-headless works).
- **First refresh/settings E2E raced its own async re-render** (clicking refresh kicked
  off a re-render that wiped the just-opened settings panel → `.fill()` hung). Split
  into two independent tests.

## Review (independent Opus agent, correctness-only) + fixes
- **Should-fix (fixed):** `fetchStars` returned a *partial* star sum on a mid-pagination
  rate-limit/error, showing a confidently-wrong smaller number. Now throws → caller
  renders stars as "—" (unknown). New E2E `stars degrade to "—" …` pins it.
- **Hardened (fixed):** `parse.js` now throws if >50% of day cells lack a tooltip (the
  total is the headline number; a silent under-count would violate fail-loud). New
  parser test pins it.
- Reviewer confirmed correct: MV3 host_permissions cover both fetched origins; default
  CSP doesn't block the avatar img + its 302 redirect; parser selectors match the real
  368-cell fixture with no off-by-one; cache TTL boundary; username regex; no stranding
  states; all 36 `ghs-*` classes used in JS exist in CSS.
- Declined (non-bugs / by-design): redundant `autofocus` attr (harmless); avatar load
  only covered by the opt-in live test (deterministic CI shouldn't depend on network —
  avatar load WAS verified live, see 04-live.png).

## Verification evidence (all green)
- `npm test` → 19/19 unit + parser tests.
- `npm run test:e2e` → 5/5 loaded-extension tests (render, refresh, settings, empty,
  stars-rate-limit-degrade), mocked + deterministic.
- `RUN_LIVE=1 npm run test:e2e -g live` → passed against real github.com (torvalds):
  real avatar, 12 repos / 249,171 stars / 307,734 followers / 3,144 contributions, no
  token. CORS bypass via host_permissions confirmed working.
- Visual gate (main thread, Read the PNGs): heatmap matches the reference — exact month
  labels Jun→Jun, Mon/Wed/Fri, 7×~53 grid, GitHub dark green palette, centered.
- Screenshot strip in `gate-evidence/`: 01-ready, 02-after-settings, 03-empty, 04-live.

## Handoff (queued for Yi's return — NOT done autonomously)
- **Merge/remote:** local commits only on branch `main`, no remote pushed. To publish:
  create `wizdes/GitHubStatsTab` and `git push` (outward-facing → deferred to you).
- **Real-Chrome eyeball (the one gate I can't drive):** `chrome://extensions` → enable
  Developer mode → **Load unpacked** → select `Projects/GitHubStatsTab/` → open a new
  tab → gear → enter your handle → confirm the heatmap matches github.com/{you} and
  refresh/settings work. (The `chrome://extensions` toggle isn't automatable; the
  Playwright loaded-extension run + live smoke + screenshot strip stand in as evidence.)
- **Default username:** ships blank (empty-state) by design — see decision #1. Say the
  word if you'd rather it prefill your handle.
- **Chrome Web Store:** not published (icons/manifest are store-clean if you want to).
