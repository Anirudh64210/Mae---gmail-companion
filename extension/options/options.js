// Options page: on or off, sound, relay URL, the last check, counters, privacy.
// Everything shown here comes from extension storage. Text is inserted with textContent only.
const PRIVACY_URL = 'https://github.com/Anirudh64210/Mae---gmail-companion/blob/main/PRIVACY.md';
const { askMin, ansMax } = { askMin: 0.85, ansMax: 0.20 };   // same thresholds as content/decide.js CONFIG

const $ = (id) => document.getElementById(id);

function validRelayUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1'));
  } catch (e) { return false; }
}

function renderLastCheck(lc) {
  const box = $('lastCheck');
  box.textContent = '';
  if (!lc) { box.textContent = 'No check yet.'; return; }
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = `${new Date(lc.at).toLocaleString()} via ${lc.source === 'relay' ? 'the relay' : 'the built-in word matcher (no network)'}`;
  box.appendChild(meta);

  const h1 = document.createElement('h3'); h1.textContent = 'Their message, as sent'; box.appendChild(h1);
  const ol = document.createElement('ol');
  lc.sentences.forEach((s, i) => {
    const li = document.createElement('li');
    li.textContent = s;
    const ask = lc.result && lc.result.ask ? lc.result.ask[i] : undefined;
    const ans = lc.result && lc.result.ans ? lc.result.ans[i] : undefined;
    if (typeof ask === 'number') {
      const tag = document.createElement('i');
      tag.textContent = `ask ${ask.toFixed(2)}, answered ${typeof ans === 'number' ? ans.toFixed(2) : '?'}`;
      li.appendChild(tag);
      if (ask >= askMin && ans <= ansMax) li.classList.add('missed');
    }
    ol.appendChild(li);
  });
  box.appendChild(ol);

  const h2 = document.createElement('h3'); h2.textContent = 'Your draft, as sent'; box.appendChild(h2);
  const pre = document.createElement('pre'); pre.textContent = lc.draft; box.appendChild(pre);
}

async function load() {
  const local = await chrome.storage.local.get(['enabled', 'sound', 'relayUrl', 'count_checks', 'count_flags', 'count_fixed', 'count_sentanyway']);
  $('enabled').checked = local.enabled !== false;
  $('sound').checked = !!local.sound;
  $('relayUrl').value = local.relayUrl || '';
  for (const k of ['checks', 'flags', 'fixed', 'sentanyway']) $('c_' + k).textContent = String(local['count_' + k] || 0);
  const { lastCheck } = await chrome.storage.session.get('lastCheck');
  renderLastCheck(lastCheck);
  if (PRIVACY_URL) {
    const a = document.createElement('a'); a.href = PRIVACY_URL; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Full privacy policy';
    $('privacyLink').appendChild(a);
  }
}

$('enabled').addEventListener('change', (e) => chrome.storage.local.set({ enabled: e.target.checked }));
$('sound').addEventListener('change', (e) => chrome.storage.local.set({ sound: e.target.checked }));
$('saveRelay').addEventListener('click', async () => {
  const url = $('relayUrl').value.trim();
  const status = $('relayStatus');
  if (url && !validRelayUrl(url)) {
    status.textContent = 'Use an https address, or http://localhost for testing.';
    status.className = 'status bad';
    return;
  }
  await chrome.storage.local.set({ relayUrl: url });
  status.textContent = url ? 'Saved. Checks now go to the relay.' : 'Saved. Checks stay on this machine.';
  status.className = 'status good';
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && changes.lastCheck) renderLastCheck(changes.lastCheck.newValue);
  if (area === 'local') for (const k of ['checks', 'flags', 'fixed', 'sentanyway']) if (changes['count_' + k]) $('c_' + k).textContent = String(changes['count_' + k].newValue || 0);
});

load();
