// Did You Actually Answer: background service worker.
// The only code in the extension that talks to the network. It receives redacted text from the content
// script and returns numbers. No message text is ever logged. The most recent check is kept in
// chrome.storage.session (cleared when the browser closes) so the options page can show exactly what was sent.

importScripts('../shared/stand-in.js');   // sets globalThis.DYAAChecker: the local word matcher, no network
const LOCAL = globalThis.DYAAChecker;

const TITLE = 'Did You Actually Answer';
const RELAY_TIMEOUT_MS = 700;   // under the content script's 800 ms fail-open budget
const DEFAULTS = { enabled: true, sound: false, introSeen: false, relayUrl: '' };

// setIcon needs full extension URLs from a service worker; relative paths fail with "Failed to fetch".
const iconSet = (suffix) => Object.fromEntries([16, 32, 48, 128].map((n) => [n, chrome.runtime.getURL(`icons/mae${suffix}-${n}.png`)]));
const ICONS = { on: iconSet(''), paused: iconSet('-paused') };

async function refreshIcon() {
  const { enabled = true } = await chrome.storage.local.get('enabled');
  await chrome.action.setIcon({ path: enabled ? ICONS.on : ICONS.paused });
  await chrome.action.setTitle({ title: enabled ? `${TITLE}: on` : `${TITLE}: paused` });
}

// A random id per install, so the relay can rate-limit without knowing who you are. Never tied to an account.
async function installId() {
  const { installId } = await chrome.storage.local.get('installId');
  if (installId) return installId;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ installId: id });
  return id;
}

function validRelayUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1'));
  } catch (e) { return false; }
}

async function fetchRelay(url, payload) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), RELAY_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dyaa-install': await installId() },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
      credentials: 'omit',
      cache: 'no-store'
    });
    if (!r.ok) throw new Error('relay ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

async function check(payload) {
  const { relayUrl = '' } = await chrome.storage.local.get('relayUrl');
  const useRelay = relayUrl && validRelayUrl(relayUrl);
  const source = useRelay ? 'relay' : 'local';
  const result = useRelay ? await fetchRelay(relayUrl, payload) : await LOCAL.check(payload);
  await chrome.storage.session.set({ lastCheck: { at: Date.now(), source, sentences: payload.sentences, draft: payload.draft, result } });
  return result;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Only our own content script, and only from Gmail.
  if (!sender || sender.id !== chrome.runtime.id || !/^https:\/\/mail\.google\.com\//.test(sender.url || '')) return;
  if (!msg || msg.type !== 'check' || !msg.payload) return;
  check(msg.payload).then(
    (result) => sendResponse({ ok: true, result }),
    () => sendResponse({ ok: false })          // no error text: it could carry message content
  );
  return true;
});

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
