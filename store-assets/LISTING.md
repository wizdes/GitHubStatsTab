# Chrome Web Store listing — Github Stats - New Tab

Everything needed for the developer-console listing. Copy/paste the text; upload the
images from `store-assets/images/`. Regenerate images with `npm run store-assets`.

---

## Product details

**Item name**
```
Github Stats - New Tab
```

**Summary** (short description, max 132 chars)
```
Every new tab becomes your public GitHub contribution heatmap — no login, no token. Lightweight and open source.
```

**Description** (detailed)
```
Github Stats turns every new browser tab into a clean, pixel-faithful GitHub contribution heatmap for any public username — and nothing else. No dashboards, no clutter, no login. Open a new tab, see your year of green squares, and get back to work.

WHY YOU'LL LIKE IT
- Heatmap-only: just the contribution graph (last ~12 months, 5 activity levels, month + weekday labels), centered and distraction-free.
- No login, no token, no account — it reads the public GitHub profile page directly.
- Light, Dark, and System themes.
- Instant and offline-friendly: results are cached for 24 hours so a new tab opens immediately. The refresh button is color-coded by data age (green when fresh, shifting toward red as it ages) and auto-refreshes once a day.
- Private by design: no analytics, no tracking, no data collection. Your chosen username stays on your device.
- Featherweight: vanilla HTML/CSS/JS, no frameworks, no background polling.

HOW IT WORKS
The extension fetches a single public HTML fragment from github.com (the same contributions graph shown on your profile) and renders it locally. No GitHub API token, no backend server, no third parties.

OPEN SOURCE (MIT)
Github Stats - New Tab is fully open source under the MIT license. Read the code, file issues, or contribute:
https://github.com/wizdes/GitHubStatsTab

GETTING STARTED
1) Install and open a new tab.
2) Click the gear icon (top-right) and enter any public GitHub username.
3) Pick a theme. That's it.

Made by Yi Li · https://yili.dev/projects/github_stats_new_tab/
```

**Category:** Workflow & Planning
**Language:** English (United States)

---

## Privacy

**Single purpose**
```
Replace Chrome's new-tab page with a contribution heatmap for a chosen public GitHub username.
```

**Permission justifications**
- `storage` —
  ```
  Stores the user's chosen GitHub username and theme preference, plus a 24-hour local cache of the fetched heatmap, so new tabs open instantly. Nothing is transmitted.
  ```
- Host permission `https://github.com/*` —
  ```
  Fetches the public contributions graph HTML from github.com to render the heatmap. No authentication or API token is used; only the public profile page is requested.
  ```
- Remote code: **No.**

**Data usage / certifications** — the extension does **not** collect or use any of the disclosable
data categories (PII, location, financial, authentication, web history, user activity, website
content). Username + theme + cache live **only** on the device. Certify all three: data is not sold,
not used for unrelated purposes, not used for creditworthiness/lending.

**Privacy policy URL**
```
https://github.com/wizdes/GitHubStatsTab/blob/main/PRIVACY.md
```

---

## URLs

| Field | Value |
|-------|-------|
| Official / website URL | https://yili.dev/projects/github_stats_new_tab/ |
| Homepage URL | https://github.com/wizdes/GitHubStatsTab |
| Support URL | https://github.com/wizdes/GitHubStatsTab/issues |

---

## Images (in `store-assets/images/`)

| Field | File | Size |
|-------|------|------|
| Store icon | `store-icon-128.png` | 128×128 |
| Screenshot 1 | `screenshot-1-dark.png` — "Your year of commits, on every new tab" | 1280×800 |
| Screenshot 2 | `screenshot-2-light.png` — "Light, Dark & System themes" | 1280×800 |
| Screenshot 3 | `screenshot-3-settings.png` — "Any public username, one click" | 1280×800 |
| Screenshot 4 | `screenshot-4-setup.png` — "No login. No token. Just a username." | 1280×800 |
| Screenshot 5 | `screenshot-5-open-source.png` — "Free & open source" | 1280×800 |
| Small promo tile | `promo-small-440x280.jpg` | 440×280 |
| Marquee promo tile | `promo-marquee-1400x560.jpg` | 1400×560 |
