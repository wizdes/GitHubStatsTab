# Privacy Policy — Github Stats - New Tab

_Last updated: 2026-06-21_

Github Stats - New Tab is a Chrome extension that replaces the new-tab page with a
GitHub contribution heatmap for a public username you choose. It is built to be
private by default.

## What it stores

The extension stores three things **locally on your device** via Chrome's `storage` API:

- the GitHub username you enter,
- your theme preference (Light / Dark / System), and
- a 24-hour cache of the fetched heatmap, so new tabs open instantly.

That's it. This data never leaves your browser.

## What it sends

To draw the heatmap, the extension makes a single unauthenticated request to
`https://github.com/users/<username>/contributions` — the same public contributions
graph shown on a GitHub profile. No API token, no login, and no request to any server
other than github.com.

## What it does NOT do

- No accounts, logins, or authentication.
- No analytics, telemetry, tracking, cookies, or fingerprinting.
- No data is collected by, or transmitted to, the developer or any third party.
- No data is sold or shared, and none is used for advertising or creditworthiness.

## Open source

The full source code is public and MIT-licensed, so you can verify all of the above:
https://github.com/wizdes/GitHubStatsTab

## Contact

Questions or concerns? Open an issue:
https://github.com/wizdes/GitHubStatsTab/issues
