// Did You Actually Answer: background service worker.
// Milestone 2: toolbar icon (on or paused) and default settings. Milestone 4 adds the relay call,
// the only network code in the extension. No message text is ever stored or logged here.

const TITLE = 'Did You Actually Answer';
// setIcon needs full extension URLs from a service worker; relative paths fail with "Failed to fetch".
const iconSet = (suffix) => Object.fromEntries([16, 32, 48, 128].map((n) => [n, chrome.runtime.getURL(`icons/mae${suffix}-${n}.png`)]));
const ICONS = { on: iconSet(''), paused: iconSet('-paused') };
const DEFAULTS = { enabled: true, sound: false, introSeen: false };

async function refreshIcon() {
  const { enabled = true } = await chrome.storage.local.get('enabled');
  await chrome.action.setIcon({ path: enabled ? ICONS.on : ICONS.paused });
  await chrome.action.setTitle({ title: enabled ? `${TITLE}: on` : `${TITLE}: paused` });
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const merged = {};
  for (const [k, v] of Object.entries(DEFAULTS)) merged[k] = k in current ? current[k] : v;
  await chrome.storage.local.set(merged);
  await refreshIcon();
});
chrome.runtime.onStartup.addListener(refreshIcon);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.enabled) refreshIcon();
});
