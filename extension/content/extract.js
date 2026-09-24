/*
 * Did You Actually Answer: extraction.
 * Thread + draft -> trimmed sentences with DOM Ranges for the highlight.
 * Pure text functions are exported for unit tests. DOM functions only run after the user presses Send.
 * Redaction (emails, phones, links, long numbers) lands in milestone 3. See docs/BRIEF.md section 5.
 */
(function (root) {
  'use strict';

  var MAX_SENTENCES = 20;
  var MAX_CHARS = 20000;   // hard cap on text handed to the regexes and the checker; a mail thread can be huge
  var BLOCK = /^(P|DIV|LI|TR|TD|H[1-6]|BLOCKQUOTE|PRE|TABLE|UL|OL|SECTION|ARTICLE)$/;
  // Where the user's own words stop: a "-- " signature line, or the "On <date>, <name> wrote:" quote header.
  var CUT = /^(-- ?|On .{6,200}wrote:)\s*$/m;

  // Pure. Sentences with their [start, end) offsets in `text`, so the caller can map them back to DOM nodes.
  // A sentence ends at . ! or ? followed by whitespace or the end, or at a line break. Keeps the last 20:
  // asks tend to sit at the end of a message.
  function splitSentences(text) {
    var out = [], re = /[^\n]+?(?:[.!?]+["')\]]*(?=\s|$)|(?=\n)|$)/g, m;
    while ((m = re.exec(text))) {
      var raw = m[0], s = raw.trim();
      if (s.length < 3) continue;
      var start = m.index + (raw.length - raw.replace(/^\s+/, '').length);
      out.push({ text: s, start: start, end: start + s.length });
    }
    return out.length > MAX_SENTENCES ? out.slice(-MAX_SENTENCES) : out;
  }

  // A closing line on its own: "Thanks,", "Best regards", "Cheers, Maya". What follows is signature.
  var SIGNOFF = /^(?:thanks|thank you|many thanks|best|all the best|best regards|kind regards|warm regards|regards|cheers|sincerely|yours sincerely|talk soon|speak soon)\b[,.!]?(?:\s+\w+){0,2}[,.]?\s*$/i;
  // Legal footers and forwarded headers: cut from here to the end.
  var FOOTER = /^(?:(?:this|the) (?:e-?mail|message|communication)(?: and any (?:attachments|files))? (?:is|are|may|contains?)|confidentiality notice|disclaimer|the information (?:contained|in this)|if you (?:are not|have received this)|-{3,} ?forwarded message ?-{3,}|begin forwarded message)/i;
  var CONTACT = /https?:\/\/|www\.|@|\+?\d[\d\s().-]{6,}\d|\b(?:tel|mobile|phone|fax)\b|\s\|\s/i;

  // Pure. Drops the tail nobody wrote for us: the "-- " signature, the "On ... wrote:" quote header, a legal footer or
  // forwarded message, a closing line and what follows it, and a trailing block of short contact lines.
  // Only the tail is cut, so character offsets in the kept part stay valid.
  function cutTail(text) {
    var m = CUT.exec(text);
    if (m) text = text.slice(0, m.index);
    var lines = text.split('\n'), i;
    for (i = 0; i < lines.length; i++) if (FOOTER.test(lines[i].trim())) { lines = lines.slice(0, i); break; }
    // a closing line within the last 8 lines
    for (i = lines.length - 1; i >= Math.max(0, lines.length - 8); i--) {
      if (SIGNOFF.test(lines[i].trim())) { lines = lines.slice(0, i); break; }
    }
    // trailing short lines after the last blank line, no question marks, carrying contact details: a signature block
    var end = lines.length;
    while (end > 0 && lines[end - 1].trim() === '') end--;
    var k = end, hasContact = false;
    while (k > 0 && k > end - 6) {
      var line = lines[k - 1].trim();
      if (line === '' || line.length > 56 || /[?!.]$/.test(line)) break;
      if (CONTACT.test(line)) hasContact = true;
      k--;
    }
    if (hasContact) lines = lines.slice(0, k);
    return lines.join('\n');
  }

  // ---- redaction: runs before anything leaves the device (docs/BRIEF.md section 5, step 3) ----
  // Kept as they are, because the answer check needs them: money, dates, times, and short numbers ("14th", "40 seats").
  var KEEP = [
    /(?:[$€£]|\b(?:USD|EUR|GBP|INR|Rs\.?)\s?)\d[\d,]*(?:\.\d+)?(?:\s?[kKmM]\b)?/g,
    /\b\d[\d,]*(?:\.\d+)?\s?(?:USD|EUR|GBP|INR|dollars|euros|pounds)\b/gi,
    /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}\b/g,
    /\b\d{1,2}:\d{2}(?:\s?[ap]\.?m\.?)?\b/gi
  ];
  // Order matters: emails before links (an address contains a domain), ID numbers before phones (a phone is digits too).
  var REDACT = [
    [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[EMAIL]'],
    [/\bhttps?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|io|ai|co|dev|app|edu|gov|uk|no|de)\b(?:\/\S*)?/gi, '[LINK]'],
    // account, card, order, tracking and ID numbers: 7 or more unbroken characters with at least 4 digits in a row
    [/(?<!\)\s?)\b(?=[A-Z0-9-]*\d{4})[A-Z]{0,4}-?\d[A-Z0-9-]{6,}\b/g, '[NUMBER]'],   // not the tail of a "(555) 010-2233" phone
    // phone: 7 to 15 digits, with optional +, brackets, spaces, dots or dashes between them
    [/(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d(?:[\s.-]?\d){6,14}\b/g, '[PHONE]']
  ];
  function redact(text) {
    var kept = [];
    var s = String(text);
    KEEP.forEach(function (re) {
      s = s.replace(re, function (m) { kept.push(m); return '\u0001' + (kept.length - 1) + '\u0002'; });
    });
    REDACT.forEach(function (pair) { s = s.replace(pair[0], pair[1]); });
    return s.replace(/\u0001(\d+)\u0002/g, function (_, i) { return kept[+i]; });
  }

  // Walks an element's text nodes (skipping `skipSel` matches, styles and scripts) and returns the plain text
  // plus a map of which node holds which character span. Block elements and <br> become line breaks.
  function textWithMap(el, skipSel) {
    var text = '', segs = [];
    (function walk(node) {
      if (node.nodeType === 3) {
        var v = node.nodeValue;
        if (!v) return;
        segs.push({ node: node, start: text.length, end: text.length + v.length });
        text += v;
        return;
      }
      if (node.nodeType !== 1) return;
      var tag = node.tagName;
      if (tag === 'STYLE' || tag === 'SCRIPT') return;
      if (skipSel && node.matches(skipSel)) return;
      if (tag === 'BR') { text += '\n'; return; }
      var block = BLOCK.test(tag);
      if (block && text && text.slice(-1) !== '\n') text += '\n';
      for (var c = node.firstChild; c; c = c.nextSibling) walk(c);
      if (block && text.slice(-1) !== '\n') text += '\n';
    })(el);
    return { text: text, segs: segs };
  }

  // Pure given `segs` from textWithMap. Builds a DOM Range for the [start, end) character span, or null.
  function spanToRange(segs, start, end, doc) {
    var a = null, b = null;
    for (var i = 0; i < segs.length; i++) {
      if (!a && start >= segs[i].start && start < segs[i].end) a = segs[i];
      if (end > segs[i].start && end <= segs[i].end) b = segs[i];
    }
    if (!a || !b) return null;
    var r = doc.createRange();
    r.setStart(a.node, start - a.start);
    r.setEnd(b.node, end - b.start);
    return r;
  }

  // The signed-in address, from the account button's label ("Google Account: Name (name@example.com)"). Null if not found.
  function userEmail(doc, sel) {
    var a = doc.querySelector(sel.account);
    var m = a && /\(([^()\s]+@[^()\s]+)\)/.exec(a.getAttribute('aria-label') || '');
    return m ? m[1].toLowerCase() : null;
  }

  // Latest message in the open conversation from someone other than the user. Null when there is none.
  function latestIncoming(composeRoot, body, sel, doc) {
    var conv = composeRoot.closest(sel.conversation) || doc.querySelector(sel.conversation);
    if (!conv) return null;
    var me = userEmail(doc, sel);
    var msgs = conv.querySelectorAll(sel.message);
    for (var i = msgs.length - 1; i >= 0; i--) {
      var msg = msgs[i];
      if (msg.contains(body)) continue;                 // the compose itself
      var content = msg.querySelector(sel.messageBody);
      if (!content) continue;                           // collapsed message, body not in the DOM
      var from = msg.querySelector(sel.sender);
      var email = from ? (from.getAttribute('email') || '').toLowerCase() : '';
      if (me && email === me) continue;
      var name = from ? (from.getAttribute('name') || '').trim() : '';
      return { content: content, person: name ? name.split(/\s+/)[0] : undefined };
    }
    return null;
  }

  // Runs on Send only. Returns null when there is nothing to check, else
  // { person, sentences: [{ text, safe, range }], draft }. `text` is what the page shows (pill and underline);
  // `safe` and `draft` are redacted and are the only strings that may leave the device.
  function extractContext(composeRoot, body, sel, doc) {
    var incoming = latestIncoming(composeRoot, body, sel, doc);
    if (!incoming) return null;

    var msg = textWithMap(incoming.content, sel.messageSkip);
    if (msg.text.length > MAX_CHARS) return null;   // far beyond any real message; do not spend time on it
    var msgText = cutTail(msg.text);
    var sentences = splitSentences(msgText).map(function (s) {
      return { text: s.text, safe: redact(s.text), range: spanToRange(msg.segs, s.start, s.end, doc) };
    });

    var draftText = textWithMap(body, sel.draftSkip).text.slice(0, MAX_CHARS);
    var draft = redact(cutTail(draftText).trim());
    return { person: incoming.person, sentences: sentences, draft: draft };
  }

  var api = {
    splitSentences: splitSentences,
    cutTail: cutTail,
    redact: redact,
    textWithMap: textWithMap,
    spanToRange: spanToRange,
    extractContext: extractContext,
    MAX_SENTENCES: MAX_SENTENCES,
    MAX_CHARS: MAX_CHARS
  };
  root.DYAAExtract = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
