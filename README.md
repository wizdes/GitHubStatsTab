# Github Stats — New Tab

A minimal Chrome extension (Manifest V3) that turns every new tab into a
pixel-faithful GitHub contribution heatmap for one username. **No login, no auth
token** — it reads the public profile page.

![The heatmap on a new tab](docs/screenshot.png)

## Features

- **Heatmap-only new tab** — the contribution grid (5-level squares, 7 rows × ~53
  week columns, with month and Mon/Wed/Fri labels), centered and nothing else.
- **No login or token** — reads the public profile HTML directly; no backend, no API key.
- **Light / Dark / System theme** — pick it from the settings gear.
- **24h cache with a smart refresh** — the refresh button's color encodes data age
  (green when fresh → red at a day old) and it auto-refreshes once data is a day old.

## Install

This isn't on the Chrome Web Store yet, so load it unpacked:

1. Clone or download this repository.
2. Go to `chrome://extensions` and enable **Developer mode** (top right).
3. Click **Load unpacked** and select the project folder.
4. Open a new tab, click the gear, and enter a GitHub username.

## How it works (no token)

The new-tab page fetches a single public HTML fragment —
`https://github.com/users/{username}/contributions` — using the manifest's lone
`host_permissions` entry for `github.com`. That HTML is parsed in `src/parse.js`
(the grid and per-day counts) with no token, no backend, and no `api.github.com`.
The endpoint is undocumented and can change, so parsing is isolated and **fails
loudly** — you get an on-page error and `test/parse.test.js` goes red against the
saved fixture.

## Development

Vanilla HTML/CSS/JS ES modules, no build step.

```bash
npm install
npm test                       # unit + parser tests (node:test)
npm run test:e2e               # Playwright: loads the unpacked extension, mocked GitHub
RUN_LIVE=1 npm run test:e2e    # also run the live real-endpoint smoke test
npm run icons                  # regenerate icons/ (only if you change the generator)
```

### Project layout

```
manifest.json   MV3: new-tab override, github.com host_permission, background SW
newtab.html     page shell → src/main.js
styles.css      theme + centered layout
src/parse.js    contributions HTML → { days, total }   (pure, fixture-tested)
src/heatmap.js  buildGrid / monthLabels (pure) + renderHeatmap
src/cache.js    24h chrome.storage cache (isFresh pure)
src/freshness.js  data-age → refresh color + auto-refresh threshold (pure)
src/settings.js username get/set + validation
src/github.js   fetch contributions (no auth)
src/main.js     orchestrator + empty/loading/ready/error states
src/background.js  minimal service worker
test/           node:test unit + parser tests (+ fixture)
e2e/            Playwright loaded-extension tests
```

## Privacy

No accounts, no tracking, no data collection — your username and theme stay on your
device. The extension only fetches the public GitHub profile page to draw the heatmap.
See [PRIVACY.md](PRIVACY.md).

## License

MIT — see [LICENSE](LICENSE).
