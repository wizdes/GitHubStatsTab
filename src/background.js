// Minimal service worker. All the real work happens in the new-tab page
// (newtab.html + src/main.js); this exists to give the extension an
// observable lifecycle (and a home for any future scheduled refresh).
chrome.runtime.onInstalled.addListener(() => {
  // no-op
});
