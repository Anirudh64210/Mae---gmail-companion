/*
 * Did You Actually Answer: checker bridge.
 * The content script never talks to the network. It hands the redacted text to the service worker,
 * which either posts it to the relay (when a relay URL is set) or runs the local stand-in.
 *   check({ sentences: string[], draft: string }) -> Promise<{ ask: number[], ans: number[] }>
 */
(function (root) {
  'use strict';
  function check(input) {
    return chrome.runtime.sendMessage({ type: 'check', payload: { sentences: input.sentences, draft: input.draft } })
      .then(function (r) {
        if (!r || !r.ok) throw new Error('check failed');
        return r.result;
      });
  }
  root.DYAAChecker = { check: check };
})(window);
