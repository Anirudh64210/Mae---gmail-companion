/*
 * Did You Actually Answer: FAKE checker for milestone 2 only.
 * Stands in for Jev so every Mae state can be reached in real Gmail. Runs entirely on this machine, no network.
 * Milestone 4 replaces this file with the relay call; the interface stays the same:
 *   check({ sentences: string[], draft: string }) -> Promise<{ ask: number[], ans: number[] }>
 *
 * How it scores: a sentence is a question if it ends with "?" or starts with an asking word. It counts as
 * answered when a third or more of its longer words also appear in the draft. Crude on purpose.
 *
 * Test hooks, typed anywhere in the draft:
 *   dyaa:miss     every question is missed        dyaa:clean    everything is answered
 *   dyaa:timeout  the check never returns         dyaa:error    the check throws
 */
(function (root) {
  'use strict';

  var ASK = /\?["')\]]*$|^(can|could|would|will|do|did|does|are|is|should|may|might|please|what|when|where|which|who|how|why|let me know)\b/i;
  var STOP = { about: 1, after: 1, again: 1, also: 1, before: 1, being: 1, could: 1, please: 1, should: 1, there: 1, their: 1,
    these: 1, those: 1, through: 1, would: 1, which: 1, while: 1, where: 1, with: 1, when: 1, what: 1, your: 1, from: 1,
    have: 1, that: 1, this: 1, will: 1, just: 1, into: 1, then: 1, than: 1, them: 1, they: 1, here: 1, know: 1, make: 1,
    more: 1, some: 1, very: 1, want: 1, were: 1, been: 1, does: 1, thanks: 1, thank: 1, hello: 1, regards: 1, best: 1 };

  function words(s) {
    var found = String(s).toLowerCase().match(/[a-z][a-z']{3,}/g) || [];
    return found.filter(function (w) { return !STOP[w]; });
  }

  // Pure. Same shape the relay will return.
  function score(sentences, draft) {
    var have = {};
    words(draft).forEach(function (w) { have[w] = 1; });
    var ask = [], ans = [];
    sentences.forEach(function (s) {
      ask.push(ASK.test(String(s).trim()) ? 0.95 : 0.05);
      var w = words(s), hit = w.filter(function (x) { return have[x]; }).length;
      ans.push(w.length && hit / w.length >= 0.34 ? 0.9 : 0.05);
    });
    return { ask: ask, ans: ans };
  }

  function check(input) {
    var draft = String(input.draft || '');
    if (/dyaa:error/i.test(draft)) return Promise.reject(new Error('fake checker: forced error'));
    if (/dyaa:timeout/i.test(draft)) return new Promise(function () {});
    var res = score(input.sentences, draft);
    if (/dyaa:miss/i.test(draft)) res.ans = res.ans.map(function () { return 0; });
    if (/dyaa:clean/i.test(draft)) res.ans = res.ans.map(function () { return 1; });
    return new Promise(function (resolve) { setTimeout(function () { resolve(res); }, 150 + Math.random() * 150); });
  }

  var api = { check: check, score: score, words: words };
  root.DYAAChecker = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
