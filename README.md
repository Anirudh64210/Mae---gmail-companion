# Did You Actually Answer?

A small Chrome extension for Gmail. When you press Send on a reply, Mae, a pixel mail carrier who lives beside the Send button, checks whether your reply answers everything you were asked. If something was missed, she looks unimpressed, the Send button shakes once, and a one-line pill names the question. Otherwise the email just sends and you never see her.

Built by [ExpandRange](https://expandrange.com). Free and open source.

## How it works

1. Nothing is read until you press Send.
2. The latest incoming message and your draft are trimmed (quoted history, signatures, legal footers dropped) and redacted on your machine: emails, links, phone numbers and long ID numbers become placeholders.
3. A checker scores each sentence: is it asking for something, and does the reply address it. The checker returns numbers only.
4. Confident misses are underlined in the thread and named in the pill. You can answer, send anyway, or press Esc.
5. Anything slow (over 800 ms) or broken fails open: the email sends normally.

The intended checker is Jev, TypeSafe AI's typed yes/no model, behind a small stateless relay. Until that lands, a local word-matching stand-in runs with no network at all. It is a test tool, not the engine (see `npm run eval`).

## Try it

Requires Chrome.

1. Clone the repo.
2. Open `chrome://extensions`, turn on Developer mode, click Load unpacked, and pick the `extension` folder.
3. Open Gmail and reply to an email that asks you a few things. Leave one unanswered and press Send.

Type `dyaa:miss`, `dyaa:clean`, `dyaa:timeout` or `dyaa:error` anywhere in a draft to force an outcome while the stand-in checker is in use.

## Develop

Requires Node 20 or newer.

```
npm install
npx playwright install chromium   # for the visual test
npm test                          # build, copy check, unit tests, sprite guardrails, visual regression
npm run eval                      # precision and recall against eval/fixtures (add -- --verbose for details)
```

Layout:

- `extension/` the Chrome extension (Manifest V3). `content/gmail.js` does the Gmail wiring; every Gmail selector is in its `SELECTORS` object.
- `design/` Mae and the nudge UI. The design is locked: see `docs/DESIGN.md` before touching anything here. `npm run build` copies these files into `extension/`; never edit the copies.
- `eval/` labelled reply pairs across many domains, and the script that scores a checker against them.
- `docs/` the brief, the design spec and the security notes.
- `tests/` unit tests, sprite guardrails and the pixel baseline test.

## Privacy

- Permissions: `storage` and `https://mail.google.com/*`. Nothing else.
- Only trimmed, redacted text leaves the device, once per send attempt, and only after you press Send.
- The extension holds no API key. The relay holds it, server side, and returns numbers only.
- Stored locally: on or off, sound, whether the intro was shown, and four anonymous counters. Never text, names or subjects.

Details and the threat model are in `docs/SECURITY.md`.

## Status

- Done: Gmail integration, Mae and the pill, extraction and redaction, eval set, security pass.
- Next: the relay and the Jev checker, options page, privacy policy page, store listing.

## License

MIT. See `LICENSE`.

## Credits

Made by ExpandRange. Mae, the pixel companion, and the code were built with help from Claude, Anthropic's AI.
