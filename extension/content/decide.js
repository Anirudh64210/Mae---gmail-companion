/*
 * Did You Actually Answer: decision step (pure, unit tested).
 * Turns Jev's probabilities into the missed questions shown in the pill.
 * See docs/BRIEF.md section 6, "Decision".
 */
(function (root) {
  'use strict';

  // One place for thresholds. Tuned in milestone 5 against eval/fixtures.
  var CONFIG = { askMin: 0.85, ansMax: 0.20 };

  // sentences: string[] from the page. ask, ans: number[] from the relay (same order).
  // Returns { total, missed: string[], missedIdx: number[] }. total 0 means show nothing.
  function decide(sentences, ask, ans, cfg) {
    cfg = cfg || CONFIG;
    var total = 0, missed = [], missedIdx = [];
    for (var i = 0; i < sentences.length; i++) {
      var a = Number(ask && ask[i]), r = Number(ans && ans[i]);
      if (!(a >= cfg.askMin)) continue;
      total++;
      if (r <= cfg.ansMax) { missed.push(sentences[i]); missedIdx.push(i); }
    }
    return { total: total, missed: missed, missedIdx: missedIdx };
  }

  // Checks a checker (relay) response before it is trusted: exactly { ask: number[n], ans: number[n] }, every value
  // a finite number in [0, 1]. Anything else is treated as a failure and the send falls open.
  function validate(res, n) {
    if (!res || typeof res !== 'object') return false;
    return ['ask', 'ans'].every(function (k) {
      var a = res[k];
      if (!Array.isArray(a) || a.length !== n) return false;
      for (var i = 0; i < a.length; i++) {
        if (typeof a[i] !== 'number' || !isFinite(a[i]) || a[i] < 0 || a[i] > 1) return false;
      }
      return true;
    });
  }

  var api = { decide: decide, validate: validate, CONFIG: CONFIG };
  root.DYAADecide = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
