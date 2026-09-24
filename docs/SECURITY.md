# SECURITY.md: Did You Actually Answer

What the extension can touch, what could go wrong, and what stops it. Kept short so it stays true.

## 1. Footprint

- Runs only on `https://mail.google.com/*`. Permissions: `storage`. No tabs, history, cookies, clipboard, downloads or `<all_urls>`.
- Extension pages (popup, options) have a strict CSP: scripts from the extension only, no inline scripts, no plugins, no forms.
- No network calls from the extension at all until the relay lands (milestone 4). Then exactly one: the service worker posts trimmed, redacted text to the relay and receives numbers.
- No `eval`, no dynamic code, no `console` output, no third-party libraries.

## 2. What leaves the device, and when

- Nothing is read or sent before the user presses Send.
- On Send: the latest incoming message and the draft are trimmed (quoted history, signatures, footers, forwards dropped), split, and redacted. Emails, links, phone numbers and long ID numbers are replaced with placeholders. Money, dates and times are kept.
- The checker sees only the redacted text. The pill and underline use the page's own text and never leave the page.
- The relay (when it exists) returns `{ ask: number[], ans: number[] }` and nothing else. Its reply is validated: right shape, right length, every value a finite number in 0 to 1. Anything else fails open.
- Stored locally: on or off, sound, whether the intro was shown, and four counters (checks, flags, fixed, sent anyway). Never text, names, addresses, subjects or message IDs.

## 3. Threats considered

| Threat | Handling |
|---|---|
| A malicious email tries to inject HTML or script through Mae's pill | All message text put into the pill goes through an HTML escaper in `nudge.js`. The pill lives in a shadow root. Gmail sanitises email HTML before we ever see it. |
| A malicious email tries to spoof structure (fake Send button, fake sender chip) | Compose detection requires an editable body and exactly one Send button in the same container. A spoofed sender name only changes the name in the pill, which is escaped. |
| Our bug or a slow relay blocks the user from sending | Every path fails open: any error, a bad response, or more than 800 ms, and the email sends normally with Mae hidden. The user's draft is never edited. |
| A bypass flag left behind lets a later click skip the check | The bypass is one-shot and clears itself after one second. |
| Huge messages used to stall the page (regex or DOM walking) | Message text over 20,000 characters skips the check. Drafts are cut at 20,000 characters before any regex runs. At most 20 sentences are kept. Non-compose text boxes (Chat) are ignored and re-examined at most every 2 seconds. |
| A tampered relay reply | Validated before use. Out-of-range or malformed values fail open. |
| Text in a message tries to steer the model (prompt injection) | The model answers typed yes/no questions only, so the worst case is a wrong flag, never an action. The relay will escape quotes and cap sentence length when building questions. |
| Secrets in the browser | The extension holds no API key. Keys live only on the relay, server side. Self-hosters deploy their own relay with their own key. |
| Other extensions or websites reading our storage | `chrome.storage.local` is isolated per extension. We never use sync storage. |

## 4. Relay rules (milestone 4)

- Stateless. No request body logging, no database, no analytics SDK. Bodies exist in memory only for the duration of the call.
- Returns numbers only. Never echoes text.
- Accepts requests only from the extension's origin, rate-limits per anonymous install ID, and has a hard monthly spend cap.
- Calls the model with zero data retention, confirmed in writing before launch.
- Open source, so anyone can read it and run their own.

## 5. Reporting

Open an issue on the repository, or email the maintainers. Please do not include real email content in a report.
