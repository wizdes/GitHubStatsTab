#!/usr/bin/env bash
# Build distributable packages for GitHub Stats Tab.
#
#   dist/github-stats-tab-<version>.zip   <- UPLOAD THIS to the Chrome Web Store
#                                            (the store packs + signs it itself)
#   dist/github-stats-tab-<version>.crx   <- self-host / archival only; modern
#                                            Chrome blocks drag-drop install of
#                                            off-store .crx files, so this is NOT
#                                            how you'd normally install it.
#
# Usage: npm run package   (or: bash scripts/package.sh)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VER="$(node -p "require('./manifest.json').version")"
NAME="github-stats-tab-$VER"
DIST="$ROOT/dist"
STAGE="$DIST/pkg"

# Runtime files only — never ship node_modules, tests, e2e, docs, or screenshots.
RUNTIME=(manifest.json newtab.html styles.css src icons)

rm -rf "$STAGE"
mkdir -p "$STAGE"
for item in "${RUNTIME[@]}"; do
  cp -R "$ROOT/$item" "$STAGE/"
done
find "$STAGE" -name '.DS_Store' -delete

# 1) Chrome Web Store package (zip of the extension files).
rm -f "$DIST/$NAME.zip"
( cd "$STAGE" && zip -rqX "$DIST/$NAME.zip" . -x '*.DS_Store' )
echo "✓ Web Store package: dist/$NAME.zip"

# 2) Optional local .crx. Needs Chrome; the private signing key is kept OUTSIDE
#    the repo (never commit a .pem).
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
KEYDIR="$HOME/.config/github-stats-tab"
KEY="$KEYDIR/key.pem"
if [ -x "$CHROME" ]; then
  mkdir -p "$KEYDIR"
  if [ -f "$KEY" ]; then
    "$CHROME" --pack-extension="$STAGE" --pack-extension-key="$KEY" >/dev/null 2>&1 || true
  else
    "$CHROME" --pack-extension="$STAGE" >/dev/null 2>&1 || true
    [ -f "$DIST/pkg.pem" ] && mv "$DIST/pkg.pem" "$KEY"
  fi
  if [ -f "$DIST/pkg.crx" ]; then
    mv "$DIST/pkg.crx" "$DIST/$NAME.crx"
    echo "✓ Local .crx:        dist/$NAME.crx  (key: $KEY — keep private)"
  else
    echo "• .crx skipped (Chrome pack failed). The .zip is all the Web Store needs."
  fi
else
  echo "• Chrome not at the default path — .crx skipped. The .zip is all the Web Store needs."
fi

rm -rf "$STAGE"
echo ""
echo "Next: upload dist/$NAME.zip at https://chrome.google.com/webstore/devconsole"
