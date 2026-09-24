/*
 * Did You Actually Answer: Gmail integration.
 * Finds reply composes, mounts one nudge per compose (Mae starts hidden), intercepts Send, runs the check.
 * Reads no message text and makes no network call until the user presses Send. See docs/BRIEF.md section 4.
 * Globals from earlier content scripts: MAE, DYAANudge, DYAAExtract, DYAADecide, DYAAChecker.
 */
(function () {
  'use strict';
  if (window.top !== window) return;   // Gmail's UI lives in the top frame

  // Every Gmail selector lives here. Gmail's class names are obfuscated and change, so these key off roles,
  // ARIA labels, stable attributes and structure wherever possible.
  var SELECTORS = {
    // The editable body of a compose. Gmail marks it role=textbox; older markup uses g_editable.
    body: 'div[contenteditable="true"][role="textbox"], div[g_editable="true"]',
    // The Send button of a compose. Its tooltip and label start with "Send" (English only in v1).
    // The split-button arrow is labelled "More send options" and does not match.
    send: 'div[role="button"][data-tooltip^="Send"], div[role="button"][aria-label^="Send"]',
    // The open conversation: Gmail renders a thread's messages as a list inside the main region.
    conversation: 'div[role="main"] div[role="list"]',
    // One message in the conversation. Only expanded messages have their body in the DOM.
    message: 'div[data-message-id]',
    // The rendered body of a message. Class-based (long-lived in Gmail, but verify after Gmail updates).
    messageBody: 'div.a3s',
    // The sender chip in a message header, with email and name attributes.
    sender: 'h3 [email], [email][name]',
    // Parts of an incoming message we never read: quoted history and signatures.
    messageSkip: '.gmail_quote, .gmail_signature, [data-smartmail="gmail_signature"], blockquote',
    // Parts of the draft we never read: the quoted thread and the user's Gmail signature.
    draftSkip: '.gmail_quote, .gmail_signature, [data-smartmail="gmail_signature"]',
    // Quoted history inside a draft: present on replies, absent on new mail.
    quote: '.gmail_quote',
    // The account button in the top bar; its label carries the signed-in address.
    account: 'a[aria-label^="Google Account"]'
  };

  var TIMEOUT_MS = 800;
  var BYPASS_MS = 1000;          // a bypass that Gmail never consumed must not let a later user click through unchecked
  var RESCAN_MS = 2000;          // how long to ignore a textbox that turned out not to be a reply compose
  var MAX_CLIMB = 40;            // ancestors to search for the compose container before giving up
  var SEAL_AT = (window.MAE && window.MAE.SEAL_AT) || 14;
  var settings = { enabled: true, sound: false, introSeen: false };
  var composes = new Map();      // body element -> record
  var notCompose = new WeakMap();// body element -> time until which we do not re-examine it
  var bypass = new WeakMap();    // Send button -> timer; the next click on it is ours and goes through to Gmail
  var storage = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) || null;

  // ---- settings and counters (numbers only, never text) ----
  function loadSettings() {
    if (!storage) return;
    storage.get(['enabled', 'sound', 'introSeen'], function (v) {
      if (chrome.runtime.lastError) return;
      Object.keys(settings).forEach(function (k) { if (k in v) settings[k] = v[k]; });
      composes.forEach(function (rec) { rec.nudge.setSound(settings.sound); });
    });
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local') return;
      Object.keys(changes).forEach(function (k) { if (k in settings) settings[k] = changes[k].newValue; });
      if (changes.sound) composes.forEach(function (rec) { rec.nudge.setSound(settings.sound); });
    });
  }
  function bump(counter) {
    if (!storage) return;
    var key = 'count_' + counter;
    storage.get(key, function (v) {
      if (chrome.runtime.lastError) return;
      var next = {}; next[key] = (v[key] || 0) + 1;
      storage.set(next);
    });
  }

  // ---- finding composes ----
  // The compose container is the nearest ancestor of the body that holds a Send button. If that ancestor
  // holds several bodies or Send buttons we have climbed too far (page level), so give up.
  function composeRootOf(body) {
    var el = body.parentElement;
    for (var depth = 0; el && el !== document.body && depth < MAX_CLIMB; el = el.parentElement, depth++) {
      var sends = el.querySelectorAll(SELECTORS.send);
      if (!sends.length) continue;
      return sends.length === 1 && el.querySelectorAll(SELECTORS.body).length === 1 ? el : null;
    }
    return null;
  }
  // v1 checks replies only: an inline compose inside the conversation, or a compose whose draft quotes a thread.
  function isReply(rootEl, body) {
    return !!(rootEl.closest(SELECTORS.conversation) || body.querySelector(SELECTORS.quote));
  }

  function scan() {
    composes.forEach(function (rec, body) {
      if (!body.isConnected || !rec.send.isConnected) unmount(body);
    });
    var now = Date.now();
    document.querySelectorAll(SELECTORS.body).forEach(function (body) {
      if (composes.has(body) || (notCompose.get(body) || 0) > now) return;
      tryMount(body);
    });
  }
  function tryMount(body) {
    var rootEl = composeRootOf(body);
    if (!rootEl || !isReply(rootEl, body)) { notCompose.set(body, Date.now() + RESCAN_MS); return; }
    var send = rootEl.querySelector(SELECTORS.send);
    var nudge = DYAANudge.createNudge({ anchor: send, sound: settings.sound });
    var rec = { body: body, root: rootEl, send: send, nudge: nudge, hadMiss: false, busy: false, sealing: false, ranges: null };
    composes.set(body, rec);
    applyTheme(rec);
    nudge.on('answer', function () { onAnswer(rec); })
         .on('sendAnyway', function () { onSendAnyway(rec); })
         .on('dismiss', function () { onDismiss(rec); })
         .on('introDone', function () { onIntroDone(rec); });
    if (!settings.introSeen) {
      settings.introSeen = true;   // once per install, and once per session even if the write is slow
      nudge.setState('intro');
    }
  }
  function unmount(body) {
    var rec = composes.get(body);
    if (!rec) return;
    composes.delete(body);
    clearHighlight(rec);
    // Let a send-off finish (sealed envelope or shrug) before the nudge goes; the design holds Mae's last spot.
    var state = rec.nudge.getState(), T = rec.nudge.timings;
    var linger = state === 'sealed' ? T.sealed + T.exit : state === 'shrug' ? T.shrug + T.exit : 0;
    setTimeout(function () { rec.nudge.destroy(); }, linger);
  }

  // ---- theme: sample the compose background, dark when its luminance is low ----
  function applyTheme(rec) {
    var dark = false;
    for (var el = rec.root; el && el !== document.documentElement; el = el.parentElement) {
      var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(getComputedStyle(el).backgroundColor);
      if (!m || (m[4] !== undefined && +m[4] < 0.5)) continue;
      dark = (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) < 128;
      break;
    }
    rec.nudge.setTheme(dark ? 'dark' : 'light');
  }

  // ---- sending ----
  function doSend(rec) {
    clearTimeout(bypass.get(rec.send));
    bypass.set(rec.send, setTimeout(function () { bypass.delete(rec.send); }, BYPASS_MS));
    rec.send.click();
  }
  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error('timeout')); }, ms);
      promise.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
    });
  }
  function clearHighlight(rec) {
    if (rec.ranges) { rec.ranges = null; DYAANudge.highlightRanges([]); }
  }

  function attemptSend(rec) {
    if (rec.busy || rec.sealing) return;
    if (!settings.enabled) return doSend(rec);
    rec.busy = true;
    var ctx, texts;
    Promise.resolve().then(function () {
      ctx = DYAAExtract.extractContext(rec.root, rec.body, SELECTORS, document);
      if (!ctx || !ctx.sentences.length || !ctx.draft) return null;   // nothing to check against
      texts = ctx.sentences.map(function (s) { return s.text; });     // page text: pill copy and underline only
      var safe = ctx.sentences.map(function (s) { return s.safe; });  // redacted: the only text the checker sees
      bump('checks');
      rec.nudge.setState('checking');
      return withTimeout(DYAAChecker.check({ sentences: safe, draft: ctx.draft }), TIMEOUT_MS);
    }).then(function (res) {
      if (!res) return finishClean(rec);
      if (!DYAADecide.validate(res, texts.length)) throw new Error('bad checker response');   // fail open
      var d = DYAADecide.decide(texts, res.ask, res.ans);
      if (!d.missed.length) return finishClean(rec);
      bump('flags');
      rec.hadMiss = true;
      rec.ranges = d.missedIdx.map(function (i) { return ctx.sentences[i].range; }).filter(Boolean);
      DYAANudge.highlightRanges(rec.ranges);
      applyTheme(rec);
      rec.nudge.setState('unimpressed', { person: ctx.person, missed: d.missed, total: d.total });
      rec.nudge.focusPill();
    }).catch(function () {
      bump('failopen');       // never the error text: it could carry message content
      clearHighlight(rec);
      rec.nudge.setState('hidden');
      doSend(rec);
    }).then(function () { rec.busy = false; });
  }

  // No miss: send now. After an earlier miss on this compose, Mae seals the envelope first and the email
  // goes when the seal lands.
  function finishClean(rec) {
    clearHighlight(rec);
    if (!rec.hadMiss) { rec.nudge.setState('hidden'); return doSend(rec); }
    bump('fixed');
    rec.sealing = true;
    rec.nudge.setState('sealed');
    setTimeout(function () { doSend(rec); }, SEAL_AT * rec.nudge.timings.sealFrame);
  }

  // ---- pill events ----
  function onAnswer(rec) {
    placeCaret(rec.body);
    rec.nudge.setState('waiting');    // underline stays until the next Send
  }
  function onSendAnyway(rec) {
    bump('sentanyway');
    clearHighlight(rec);
    rec.nudge.setState('shrug');
    doSend(rec);
  }
  function onDismiss(rec) {
    clearHighlight(rec);
    rec.nudge.setState('hidden');
    rec.body.focus();
  }
  function onIntroDone(rec) {
    rec.nudge.setState('hidden');
    if (storage) storage.set({ introSeen: true });
  }

  // Caret at the end of the user's last line above their Gmail signature and the quoted thread. Never edits text.
  function placeCaret(body) {
    var stop = body.querySelector(SELECTORS.draftSkip);
    var walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (stop && (stop.contains(n) || (stop.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING))) return NodeFilter.FILTER_REJECT;
        return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    var last = null, n;
    while ((n = walker.nextNode())) last = n;
    body.focus();
    var range = document.createRange();
    if (last) range.setStart(last, last.nodeValue.length); else range.setStart(body, 0);
    range.collapse(true);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // ---- interception (capture phase, so we run before Gmail) ----
  function recForButton(el) {
    var found = null;
    composes.forEach(function (rec) { if (rec.send === el) found = rec; });
    return found;
  }
  document.addEventListener('click', function (e) {
    var send = e.target && e.target.closest ? e.target.closest(SELECTORS.send) : null;
    var rec = send && recForButton(send);
    if (!rec) return;
    if (bypass.has(send)) { clearTimeout(bypass.get(send)); bypass.delete(send); return; }
    e.preventDefault();
    e.stopImmediatePropagation();
    attemptSend(rec);
  }, true);

  document.addEventListener('keydown', function (e) {
    var body = e.target && e.target.closest ? e.target.closest(SELECTORS.body) : null;
    var rec = body && composes.get(body);
    if (!rec) return;
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      attemptSend(rec);
    } else if (e.key === 'Escape' && rec.nudge.getState() === 'unimpressed') {
      e.preventDefault();
      e.stopImmediatePropagation();
      onDismiss(rec);
    }
  }, true);

  // ---- start ----
  loadSettings();
  var pending = null;
  new MutationObserver(function () {
    if (pending) return;
    pending = setTimeout(function () { pending = null; scan(); }, 150);
  }).observe(document.body, { childList: true, subtree: true });
  scan();
})();
