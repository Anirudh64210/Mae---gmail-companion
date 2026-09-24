/*
 * Did You Actually Answer: nudge UI (design-locked).
 * Renders Mae beside a Send button and the one-line pill above it.
 * Classic script, no dependencies besides design/mae-sprite.js (global MAE).
 * Do not restyle. Tokens, sizes, copy and motion are specified in docs/DESIGN.md.
 */
(function (root) {
  'use strict';

  var STYLES = [
    ':host{all:initial}',
    '.root{',
    '  --surface:#FFFFFF; --line:#CFD5D2; --ink:#121715; --ink2:#3A4340; --muted:#6D7773;',
    '  --amber:#C26A12; --green:#2C8656; --focus:#2B59D1;',
    '  --shadow:0 1px 2px rgba(16,24,20,.08),0 8px 24px rgba(16,24,20,.12);',
    '  font-family:"Google Sans",Roboto,"Helvetica Neue",Arial,sans-serif;',
    '  -webkit-font-smoothing:antialiased;',
    '}',
    '.root.dark{',
    '  --surface:#1F2321; --line:#3A433F; --ink:#E8ECEA; --ink2:#C3CAC7; --muted:#8E9894;',
    '  --amber:#E79A4A; --green:#5FC48C; --focus:#7FA2F5;',
    '  --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.5);',
    '}',
    '.mae{position:fixed;left:0;top:0;width:40px;height:56px;image-rendering:pixelated;image-rendering:crisp-edges;pointer-events:none}',
    '.pill{position:fixed;left:0;top:0;box-sizing:border-box;display:flex;align-items:center;gap:10px;',
    '  max-width:min(560px,calc(100vw - 16px));background:var(--surface);color:var(--ink2);',
    '  border:1px solid var(--line);border-radius:10px;padding:7px 8px 7px 12px;',
    '  font-size:13px;line-height:18px;box-shadow:var(--shadow);',
    '  opacity:0;transform:translateY(6px);pointer-events:none;',
    '  transition:opacity .22s ease,transform .28s cubic-bezier(.2,.9,.3,1.2)}',
    '.pill.show{opacity:1;transform:none;pointer-events:auto}',
    '.tail{position:absolute;bottom:-6px;left:0;width:10px;height:10px;background:var(--surface);',
    '  border-right:1px solid var(--line);border-bottom:1px solid var(--line);transform:rotate(45deg)}',
    '.dots{display:flex;gap:3px;flex:none}',
    '.dots i{width:6px;height:6px;border-radius:50%;background:var(--green);display:block}',
    '.dots i.o{background:transparent;box-shadow:inset 0 0 0 1.5px var(--amber)}',
    '.msg{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.msg b{color:var(--ink);font-weight:600}',
    '.msg q{color:var(--ink);quotes:"\\201C" "\\201D"}',
    'button{font:inherit;border:0;margin:0;cursor:pointer}',
    '.answer{background:var(--ink);color:var(--surface);border-radius:7px;padding:5px 11px;font-weight:600;font-size:13px;line-height:18px;flex:none}',
    '.anyway{background:none;color:var(--muted);font-size:12.5px;padding:5px 6px;flex:none}',
    '.anyway:hover{color:var(--ink)}',
    'button:focus-visible{outline:2px solid var(--focus);outline-offset:2px}',
    '@media (prefers-reduced-motion:reduce){.pill{transition:none}}'
  ].join('\n');

  var PAGE_STYLES =
    '@keyframes dyaa-thud{0%{transform:translateX(0) scale(.97)}25%{transform:translateX(-3px)}50%{transform:translateX(3px)}75%{transform:translateX(-1.5px)}100%{transform:none}}' +
    '.dyaa-thud{animation:dyaa-thud .28s ease-out}' +
    '::highlight(dyaa-missed){text-decoration:underline 2px #C26A12;text-underline-offset:3px}';

  // Timings (ms). See docs/DESIGN.md, "Motion".
  var T = { frame: 125, sealFrame: 85, enter: 375, exit: 250, sealed: 2300, shrug: 1800, intro: 9000 };
  // sealed plays on its own quicker clock (sealFrame): the seal lands at SEAL_AT * sealFrame, about 1.2 s.
  var GAP = 2;          // px between Mae's canvas and Send (her 2 blank sprite columns add 4px: 6px visible)
  var DROP = 2;         // px Mae sits below the Send button's vertical centre
  var ENV_LIFT = 12;    // px 'sealed' rises so the envelope (canvas rows 16-27) sits centred on Send, 2px per frame from its start
  var PILL_GAP = 10;    // px between pill and Send
  var QUOTE_MAX = 60;   // characters before the quoted question is truncated
  // Shown once, the first time a reply is opened after install.
  var INTRO = 'Hi, I\u2019m <b>Mae</b>. I only show up if a question gets missed.';

  function ensurePageStyles(doc) {
    if (doc.getElementById('dyaa-page-styles')) return;
    var s = doc.createElement('style');
    s.id = 'dyaa-page-styles';
    s.textContent = PAGE_STYLES;
    (doc.head || doc.documentElement).appendChild(s);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function truncate(s, n) {
    s = String(s).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s;
  }
  function possessive(name) { return /s$/i.test(name) ? name + '’' : name + '’s'; }

  // Copy rules live here so they cannot drift. docs/DESIGN.md, "Copy".
  function pillMessage(d) {
    var person = esc(d.person || 'They');
    var n = (d.missed || []).length;
    if (n === 1) return '<b>' + person + '</b> asked <q>' + esc(truncate(d.missed[0], QUOTE_MAX)) + '</q>';
    return '<b>' + n + ' of ' + esc(possessive(d.person || 'their')) + ' questions</b> are unanswered';
  }

  function createNudge(opts) {
    var anchor = opts.anchor;
    var sprite = opts.sprite || root.MAE;
    var doc = anchor.ownerDocument;
    var win = doc.defaultView;
    var reduce = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var still = reduce || opts.freeze != null;
    var listeners = { answer: [], sendAnyway: [], dismiss: [], introDone: [] };
    // Mae is hidden by default. She comes out from behind Send only for: intro, unimpressed, sealed, shrug.
    // Once out after a miss she stays out: 'waiting' (holding the envelope while the user answers), then 'checking', then 'sealed'.
    var state = 'hidden', data = {}, tick = 1, sealT0 = 0, timer = null, raf = 0;
    var hideTimer = null, chimeTimer = null, audio = null;
    var shown = false, anim = null; // anim: { dir: 'in'|'out', t0: ms }
    var lastRect = null;            // the anchor's last known position, used once Gmail removes it

    ensurePageStyles(doc);
    var host = doc.createElement('div');
    host.setAttribute('data-dyaa', '');
    host.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:2147483000;';
    var shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML =
      '<style>' + STYLES + '</style>' +
      '<div class="root' + (opts.theme === 'dark' ? ' dark' : '') + '">' +
      '<canvas class="mae" width="' + sprite.W + '" height="' + sprite.H + '" aria-hidden="true"></canvas>' +
      '<div class="pill" role="status" aria-live="polite">' +
      '<span class="dots" aria-hidden="true"></span>' +
      '<span class="msg"></span>' +
      '<button class="answer" type="button">Answer</button>' +
      '<button class="anyway" type="button">Send anyway</button>' +
      '<span class="tail" aria-hidden="true"></span>' +
      '</div></div>';
    (opts.mount || doc.body).appendChild(host);

    var $ = function (sel) { return shadow.querySelector(sel); };
    var rootEl = $('.root'), canvas = $('.mae'), pill = $('.pill');
    var dots = $('.dots'), msg = $('.msg'), tail = $('.tail'), btnMain = $('.answer'), btnAlt = $('.anyway');

    btnMain.addEventListener('click', function () { emit(state === 'intro' ? 'introDone' : 'answer'); });
    btnAlt.addEventListener('click', function () { emit('sendAnyway'); });
    pill.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); emit(state === 'intro' ? 'introDone' : 'dismiss'); } });

    function emit(name) { listeners[name].forEach(function (fn) { fn(data); }); }

    var last = null; // last painted frame; held while sliding back behind Send so the exit never flashes a different pose
    function mood() { return state === 'intro' ? 'wave' : state; }
    function draw() {
      if (!shown) return;
      if (state === 'hidden') { if (last) sprite.paint(canvas, last.mood, last.t); return; }
      // "sealed" plays once from its own start; the other moods loop on the shared clock.
      var t = still ? (state === 'sealed' ? 20 : (opts.freeze != null ? opts.freeze : 1)) : (state === 'sealed' ? sealTick() : tick);
      last = { mood: mood(), t: t };
      sprite.paint(canvas, last.mood, t);
    }

    // Entrance: slides out from behind Send in 3 frames with a 2px hop. Exit: slides back in 2 frames.
    function progress(now) {
      if (!anim) return shown ? 1 : 0;
      var dur = anim.dir === 'in' ? T.enter : T.exit;
      var p = Math.min(1, (now - anim.t0) / dur);
      if (p >= 1) { if (anim.dir === 'out') { shown = false; canvas.style.visibility = 'hidden'; } anim = null; return shown ? 1 : 0; }
      return anim.dir === 'in' ? p : 1 - p;
    }
    function place(now) {
      // Gmail removes the compose on send; hold the button's last spot so a sealed envelope or shrug can finish there.
      var r = anchor.isConnected ? (lastRect = anchor.getBoundingClientRect()) : (lastRect || anchor.getBoundingClientRect());
      // Mae: 40 x 56, left of Send. Her figure spans canvas rows 4-26, so its centre is 31px down: centre it on Send, then drop DROP px.
      var mx = Math.round(r.left - GAP - 40), my = Math.round((r.top + r.bottom) / 2 - 31 + DROP);
      if (last && last.mood === 'sealed') my -= Math.min(ENV_LIFT, 2 * Math.max(0, last.t));
      var p = progress(now || win.performance.now());
      var e = 1 - Math.pow(1 - p, 3);                       // ease out
      var x = Math.round(r.left + 2 + (mx - r.left - 2) * e); // from tucked behind Send to her spot
      var hop = (anim && anim.dir === 'in' && p > .55 && p < 1) ? -2 : 0;
      canvas.style.transform = 'translate(' + x + 'px,' + (my + hop) + 'px)';
      var hiddenRight = Math.max(0, x + 40 - Math.round(r.left)); // the part still behind the button
      canvas.style.clipPath = hiddenRight > 0 ? 'inset(0 ' + hiddenRight + 'px 0 0)' : 'none';
      if (pill.classList.contains('show')) {
        var pw = pill.offsetWidth, ph = pill.offsetHeight, vw = win.innerWidth;
        var px = Math.round(Math.max(8, Math.min(r.right - pw, vw - 8 - pw)));
        var py = Math.round(r.top - PILL_GAP - ph);
        pill.style.left = px + 'px'; pill.style.top = py + 'px';
        var tx = Math.max(12, Math.min(pw - 22, mx + 20 - px - 5));
        tail.style.left = tx + 'px';
      }
    }
    function sealTick() { return Math.floor((win.performance.now() - sealT0) / T.sealFrame); }
    function loop(now) {
      if (state === 'sealed' && !still && shown && !doc.hidden && (!last || last.t !== sealTick())) draw();
      place(now); raf = win.requestAnimationFrame(loop);
    }

    function show() {
      if (shown && !(anim && anim.dir === 'out')) return;
      shown = true; canvas.style.visibility = 'visible';
      anim = still ? null : { dir: 'in', t0: win.performance.now() };
      draw();
    }
    function hide() {
      if (!shown) return;
      if (still) { shown = false; canvas.style.visibility = 'hidden'; anim = null; return; }
      anim = { dir: 'out', t0: win.performance.now() };
    }

    function renderPill() {
      if (state === 'intro') {
        dots.innerHTML = ''; dots.style.display = 'none';
        msg.innerHTML = INTRO;
        btnMain.textContent = 'Got it'; btnAlt.style.display = 'none';
        return;
      }
      dots.style.display = ''; btnMain.textContent = 'Answer'; btnAlt.style.display = '';
      var total = Math.max(data.total || 0, (data.missed || []).length);
      var answered = total - (data.missed || []).length;
      var html = '';
      for (var i = 0; i < total && i < 8; i++) html += '<i' + (i < answered ? '' : ' class="o"') + '></i>';
      dots.innerHTML = html;
      dots.setAttribute('aria-label', answered + ' of ' + total + ' answered');
      msg.innerHTML = pillMessage(data);
    }

    function setState(next, d) {
      clearTimeout(hideTimer); clearTimeout(chimeTimer);
      var wasOut = shown && !(anim && anim.dir === 'out');
      state = next; data = d || {}; sealT0 = win.performance.now();
      var withPill = next === 'unimpressed' || next === 'intro';
      if (withPill) { renderPill(); pill.classList.add('show'); } else pill.classList.remove('show');

      if (next === 'hidden') hide();
      else if (next === 'checking') { if (!wasOut) hide(); }   // invisible unless she is already out
      else show();

      if (next === 'unimpressed') { shake(); play('tick'); }
      if (next === 'intro' && opts.autoHide !== false) hideTimer = setTimeout(function () { emit('introDone'); }, T.intro);
      if (next === 'sealed') {
        // chime and a soft double tap when the seal lands (tick sprite.SEAL_AT)
        chimeTimer = setTimeout(function () { play('chime'); }, (reduce ? 0 : (sprite.SEAL_AT || 14) * T.sealFrame));
        if (opts.autoHide !== false) hideTimer = setTimeout(function () { setState('hidden'); }, T.sealed);
      }
      if (next === 'shrug' && opts.autoHide !== false) hideTimer = setTimeout(function () { setState('hidden'); }, T.shrug);
      draw(); place();
    }

    function shake() {
      if (still) return;
      anchor.classList.remove('dyaa-thud');
      void anchor.offsetWidth;
      anchor.classList.add('dyaa-thud');
      anchor.addEventListener('animationend', function h() { anchor.classList.remove('dyaa-thud'); anchor.removeEventListener('animationend', h); });
    }

    // Optional sound + vibration. Off by default; the options page turns it on.
    function play(kind) {
      if (!opts.sound) return;
      try { if (win.navigator.vibrate) win.navigator.vibrate(kind === 'tick' ? [14, 50, 14] : [8, 40, 8]); } catch (e) {}
      try {
        audio = audio || new (win.AudioContext || win.webkitAudioContext)();
        var t0 = audio.currentTime;
        var tones = kind === 'tick' ? [[190, 90, 0, .12, .22]] : [[660, 660, 0, .25, .08], [880, 880, .07, .25, .08]];
        tones.forEach(function (x) {
          var o = audio.createOscillator(), g = audio.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(x[0], t0 + x[2]);
          o.frequency.exponentialRampToValueAtTime(x[1], t0 + x[2] + x[3] * .75);
          g.gain.setValueAtTime(.0001, t0 + x[2]);
          g.gain.exponentialRampToValueAtTime(x[4], t0 + x[2] + .01);
          g.gain.exponentialRampToValueAtTime(.0001, t0 + x[2] + x[3]);
          o.connect(g).connect(audio.destination);
          o.start(t0 + x[2]); o.stop(t0 + x[2] + x[3] + .02);
        });
      } catch (e) {}
    }

    canvas.style.visibility = 'hidden';
    if (!still) timer = setInterval(function () { if (!doc.hidden) { tick++; draw(); } }, T.frame);
    loop();

    return {
      setState: setState,
      getState: function () { return state; },
      isShown: function () { return shown; },
      setTheme: function (t) { rootEl.classList.toggle('dark', t === 'dark'); },
      setSound: function (on) { opts.sound = !!on; },
      focusPill: function () { btnMain.focus(); },
      on: function (name, fn) { listeners[name].push(fn); return this; },
      destroy: function () { clearInterval(timer); clearTimeout(hideTimer); clearTimeout(chimeTimer); win.cancelAnimationFrame(raf); host.remove(); },
      timings: T
    };
  }

  // Underline missed sentences in the thread without touching Gmail's DOM (CSS Custom Highlight API).
  function highlightRanges(ranges) {
    if (!root.CSS || !CSS.highlights || typeof Highlight === 'undefined') return;
    if (!ranges || !ranges.length) { CSS.highlights.delete('dyaa-missed'); return; }
    var h = new Highlight();
    for (var i = 0; i < ranges.length; i++) h.add(ranges[i]);
    CSS.highlights.set('dyaa-missed', h);
  }

  var api = { createNudge: createNudge, highlightRanges: highlightRanges, pillMessage: pillMessage, truncate: truncate };
  root.DYAANudge = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
