# BRIEF.md: Did You Actually Answer (v1)

## 1. What it is

A Chrome extension for Gmail. When you press Send on a reply, it checks in well under a second whether your reply answers everything the other person asked. If it is confident something was missed, Mae (the pixel mail carrier beside Send) looks unimpressed, the Send button shakes once, and a one-line pill names the missed question. Otherwise the email just sends.

- Decisions come from **Jev** (TypeSafe AI's System One model): typed yes/no answers with calibrated probabilities. Jev does not write text, and we never need it to.
- Design is locked and already built. Read `docs/DESIGN.md` before any UI work.

## 2. Scope

**v1 in scope:** Gmail web in Chrome, replies only (a draft with a thread above it), English, the latest incoming message as the source of questions, Mae's states (hidden by default), the pill, the one-time intro, the toolbar icon (on/paused), options page (on/off, sound), privacy notice.

**Not in v1:** new emails with no thread, Outlook, Slack, other languages, checking older messages or other threads, any LLM, accounts or login, analytics beyond anonymous counters.

## 3. Architecture

```
extension/                     Manifest V3
  manifest.json                host permission: https://mail.google.com/* and the relay origin only
  content/
    mae-sprite.js              copy of design/mae-sprite.js (build step copies it, never edit the copy)
    nudge.js                   copy of design/nudge.js
    gmail.js                   find compose windows, mount a nudge per compose, intercept Send
    extract.js                 thread + draft -> trimmed, redacted sentences (pure functions, unit tested)
    decide.js                  numbers -> missed questions (pure, unit tested)
  background/service-worker.js the only code that talks to the network (POST to the relay)
  options/                     on/off, sound + vibration, "pause on this thread"
  popup/                       toolbar popup: On/Pause, link to options
  icons/                       copies of design/icons/
relay/                         Cloudflare Worker or Vercel Function, stateless
tests/                         sprite + visual (provided), plus unit tests you add
design/, docs/                 provided, read-only
```

Content scripts are classic scripts listed in order in `manifest.json` (`mae-sprite.js`, `nudge.js`, `extract.js`, `decide.js`, `gmail.js`). A bundler is optional; if you add one, it must not change the output of `design/` files.

## 4. Gmail integration (`gmail.js`)

1. **Find compose windows.** Use a `MutationObserver` on `document.body`. A reply compose is an editable body (`div[contenteditable="true"][role="textbox"]`, or `g_editable="true"`) inside a compose container that sits under a thread. Gmail's class names are obfuscated and change, so key off roles, ARIA labels and structure, and keep every selector in one `SELECTORS` object with a comment on what it matches. Evaluate InboxSDK as an alternative and tell the user the trade-off before adopting it.
2. **Find the Send button** of that compose (`div[role="button"]` whose `data-tooltip` or `aria-label` starts with "Send", English only in v1). Mount one nudge per compose: `DYAANudge.createNudge({ anchor: sendButton })`. Mae starts `hidden`. Destroy it when the compose closes.
3. **Intercept sending.** Capture-phase `click` on the Send button and `keydown` for Ctrl/Cmd+Enter inside the compose. `preventDefault()` + `stopImmediatePropagation()`, run the check, then send by re-dispatching the click with a one-shot bypass flag so you do not intercept yourself.
4. **Timeout and fail open.** If there is no result in **800 ms**, or anything throws, send immediately and keep Mae `hidden`. The user must never be blocked by our bug or our server.
5. **States.** `checking` while in flight (invisible unless Mae is already out). Miss: `unimpressed` with `{ person, missed, total }` and `highlightRanges(rangesForMissed)`; Mae slides out from behind Send. No miss after a previous miss on this compose: `sealed`, and send when the seal lands (`MAE.SEAL_AT * timings.sealFrame`, about 1.2 s). No miss otherwise: send, Mae stays `hidden`.
6. **Pill events.** `answer`: keep the highlight, put the caret at the end of the user's last paragraph above their signature, set `waiting` (Mae stays out holding the envelope, no pill), wait for them to press Send again. If the re-check still misses something, set `unimpressed` again; she does not re-enter. `sendAnyway`: clear highlight, `shrug`, send with bypass. `dismiss` (Esc): clear, `hidden`, do not send.
7. **Theme.** Sample the compose background luminance; call `setTheme('dark')` when dark.
8. **Intro.** The first time a reply compose opens after install, call `setState('intro')`. On `introDone` set `hidden` and store `introSeen: true` in `chrome.storage.local`. Never show it again.
9. **Toolbar icon.** `chrome.action.setIcon` with `design/icons/mae-*.png` when on and `mae-paused-*.png` when paused. Clicking the icon opens a small popup with On/Pause and a link to options. No badge.

## 5. Extraction (`extract.js`, runs on the user's machine)

Input: the latest message from someone other than the user in the thread, and the user's draft.

1. Take the latest incoming message body text. Drop quoted history (`.gmail_quote`, "On ... wrote:" blocks), signatures (after `-- `, or a trailing block of short lines with name/phone/links), and disclaimers.
2. Take the draft text. Drop the quoted part and the user's signature.
3. **Redact before anything leaves the device:** emails -> `[EMAIL]`, phone numbers -> `[PHONE]`, URLs -> `[LINK]`, long digit runs (account, card, ID numbers) -> `[NUMBER]`. Keep money amounts and dates; the answer check needs them.
4. Split the incoming message into sentences. Keep at most 20. Keep a map from sentence index to a DOM `Range` for the highlight.
5. Get the sender's first name from the message header for the pill.
6. **Which replies are checked (v1): all of them.** Any reply or forward that has an incoming message above it is checked, so questions, decisions and polite requests without a question mark are all covered; Jev decides which sentences ask for something. Only skip when there is nothing to check against: a brand-new email with no thread, an empty draft, or an incoming message with no sentences. A smarter local skip rule can come later, after eval data.

## 6. The Jev call (relay + service worker)

Use the official JS SDK in the relay (`npm install @typesafe-ai/sdk`, key in `TYPESAFE_API_KEY`). Verify the exact API in the SDK's `src/types.ts` and at https://docs.typesafe.ai before writing code; do not guess field names. From the docs at the time of writing:

```js
import { TypeSafeClient, noul } from "@typesafe-ai/sdk";   // confirm the export name for yes/no questions
const client = new TypeSafeClient();
const res = await client.systemOne({
  state: { message: "<trimmed incoming message>", reply: "<trimmed draft>" },
  questions: {
    ask_0: noul('In `message`, does this sentence ask the recipient to answer, decide, confirm or do something: "<sentence 0>"'),
    ans_0: noul('Does `reply` answer or address this sentence from `message`: "<sentence 0>"'),
    // ...one ask_i and ans_i per sentence, all in ONE call
  },
});
// res.answers.ask_0.noul -> probability of "yes"
```

- Batch every question into one call (TypeSafe's docs report it is much cheaper and faster than separate calls).
- The relay returns **only** `{ ask: number[], ans: number[] }` to the extension.

### Decision (`decide.js`)

- A sentence is a question if `ask >= 0.85`.
- It is missed if it is a question and `ans <= 0.20`.
- `total` = number of questions, `missed` = the missed sentences (text comes from the page, not from Jev).
- Show nothing if `total == 0`. Keep thresholds in one config object; they get tuned in step 8.

## 7. Privacy (non-negotiable)

1. Nothing is read or sent before the user presses Send.
2. Only the trimmed, redacted incoming message and draft leave the device, once per send attempt.
3. The relay is stateless: no request body logging, no database, no analytics SDK, bodies only held in memory for the call. Open source.
4. Call Jev with zero data retention. Vercel AI Gateway exposes `providerOptions: { gateway: { zeroDataRetention: true } }`; a public issue reports the direct TypeSafe API has no retention flag. Either route through a gateway that supports it or get TypeSafe's no-retention terms in writing. **Do not launch until this is confirmed.** Tell the user which path you chose.
5. Only anonymous counters are kept: checks run, flags shown, flags fixed, sent anyway. No text, names, addresses, subjects or message IDs. Random install ID, no account.
6. The options page has a "Last check" section showing exactly what was sent for the most recent check only, stored in `chrome.storage.session` and cleared when the browser closes. No extra UI in Gmail for this.
7. The extension requests only `https://mail.google.com/*` and the relay origin. No `tabs`, no `history`, no `<all_urls>`.

## 8. Quality: evaluation before launch

- Build `eval/fixtures/*.json`: at least 40 real-shaped reply pairs (thread message, draft, labeled missed sentences). Include tricky ones: rhetorical questions, "let me know if you have questions", questions already answered earlier, polite requests without a question mark, one-line replies.
- `npm run eval` runs them through the relay and reports precision and recall of "missed".
- **Launch bar: precision >= 0.90** (a wrong flag is the worst outcome). Recall can be lower. Tune thresholds to hit it.

## 9. Milestones (stop and show the user after each)

1. **Setup + design lock.** Repo scaffold, copy step for `design/` files, `npm run test:design` passes.
2. **UI in Gmail with a fake checker.** Mae mounted beside Send in real Gmail, interception working, all states reachable with a stubbed `decide` result. Screenshot every state, light and dark, and compare to the reference page.
3. **Extraction.** `extract.js` with unit tests for trimming, redaction and sentence ranges.
4. **Relay + Jev.** Worker deployed, batched call, 800 ms fail-open, zero-retention path confirmed.
5. **Eval + tuning.** Fixtures, eval script, thresholds tuned to the launch bar.
6. **Polish.** Options page, counters, privacy policy page, final screenshot review. Distribution is this repository only, with no hosted relay.

## 10. Definition of done for any task

- `npm run test:design` passes and baselines were not updated without the user's approval.
- New logic has unit tests.
- No network call happens before Send (verify in DevTools Network tab).
- Screenshots of any UI change were compared to `design/reference/nudge-reference.html`.
