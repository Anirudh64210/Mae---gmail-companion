# Did You Actually Answer?

<p align="center">
  <img src="docs/images/mae-wave.png" width="80" alt="Mae, a pixel mail carrier, waving">
</p>
<p align="center"><b>Hi, I'm Mae.</b> I only show up if a question gets missed.</p>

Mae is a Chrome extension for Gmail that checks your reply when you press Send and tells you if you left a question unanswered. Just a fun little idea.

## Why this exists

Nobody skips a question on purpose. Email just makes it easy.

Researchers have been describing the same pattern since the nineties. The inbox turns into a to-do list and an external memory, and the volume outruns what a person can hold in their head. Whittaker and Sidner called it email overload in 1996 [1]. A decade later, Dabbish and Kraut found that the more email people received, the more overloaded and strained they felt [2]. When Dabbish and colleagues watched how people handled new messages, they replied to roughly a third of them and left half sitting in the inbox, often meaning to come back later [3].

The questions inside those messages do not fare any better. In a survey of close to a thousand information workers, 80 percent said they had answered a question by email that they had already answered before, and more than a third of the time people could not clearly remember the message that held the answer, even though they knew it was in there somewhere [4]. And the more you ask in one email, the less likely you are to hear back at all. Boomerang's analysis of forty million emails found that a message with three questions was 20 percent more likely to get a reply than one with eight or more [5].

None of this is carelessness. A loaded email arrives, you answer the part you have an answer for, and the rest quietly drops out between reading and sending. The sender writes again, and everything slips by a day.

Mae exists for that one moment, right before Send, when a second look costs almost nothing.

1. Whittaker and Sidner, "Email overload: exploring personal information management of email", CHI 1996.
2. Dabbish and Kraut, "Email overload at work: an analysis of factors associated with email strain", CSCW 2006. https://www.researchgate.net/publication/220879068
3. Dabbish, Kraut, Fussell and Kiesler, "Understanding email use: predicting action on a message", CHI 2005. https://sfussell.hci.cornell.edu/pubs/Manuscripts/Dabbish_CHI2005.pdf
4. Yang, Awadallah, Khabsa, Wang and Wang, "Characterizing and supporting question answering in human-to-human communication", SIGIR 2018. https://www.microsoft.com/en-us/research/wp-content/uploads/2018/04/EmailQA_SIGIR18.pdf
5. Boomerang, "7 tips for getting more responses to your emails (with data)", 2016. https://blog.boomerangapp.com/2016/02/7-tips-for-getting-more-responses-to-your-emails-with-data/

## What Mae does

Mae is a small pixel mail carrier who lives beside Gmail's Send button. When you press Send on a reply, she checks whether your draft addresses everything you were asked. If a question went unanswered, she looks unimpressed, the Send button shakes once, the question is underlined in the thread, and a one-line note names it. Click Answer to fix it, or Send anyway to send as is. If nothing was missed, the email just sends and you never see her.

Scoring comes from TypeSafe's Jev, a typed yes/no model with confidence scores, behind a small relay you run yourself. Chrome and Gmail only for now.

Built by ExpandRange. Free and open source, repo only: https://github.com/Anirudh64210/Mae---gmail-companion

## How it works

1. Nothing is read until you press Send.
2. The latest incoming message and your draft are trimmed (quoted history, signatures, legal footers dropped) and redacted on your machine: emails, links, phone numbers and long ID numbers become placeholders.
3. A checker scores each sentence: is it asking for something, and does the reply address it. The checker returns numbers only.
4. Confident misses are underlined in the thread and named in the pill. You can answer, send anyway, or press Esc.
5. Anything slow (over 800 ms) or broken fails open: the email sends normally.

The intended checker is Jev, TypeSafe AI's typed yes/no model, behind a small stateless relay. Until that lands, a local word-matching stand-in runs with no network at all. It is a test tool, not the engine (see `npm run eval`).

## Try it

This is a repo-only project. You install it from this repo, and there is no hosted server. You run it yourself.

1. Clone the repo.
2. Open `chrome://extensions`, turn on Developer mode, click Load unpacked, and pick the `extension` folder.
3. Open Gmail and reply to an email that asks you a few things. Leave one unanswered and press Send.

Out of the box the check uses the built-in word matcher, which runs on your machine with no network calls. It is good enough to see Mae work, not good enough to trust (see `npm run eval`). Type `dyaa:miss`, `dyaa:clean`, `dyaa:timeout` or `dyaa:error` anywhere in a draft to force an outcome.

To use Jev, run your own relay with your own TypeSafe key (`relay/README.md`, about five minutes on a free Cloudflare account or locally with `npm run relay`), then paste its address into the extension's options page. Your key stays on your relay; the extension never holds it.

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

The full policy is in `PRIVACY.md`. The threat model is in `docs/SECURITY.md`.

## Status

- Done: Gmail integration, Mae and the pill, extraction and redaction, eval set, security pass, options page, relay (see `relay/README.md`).
- Waiting on: a Jev API key. The Jev provider is written from the brief and must be verified against the SDK before first use.
- Next: verify the Jev provider and tune thresholds once a key is available.

## License

MIT. See `LICENSE`.

## Credits

Made by ExpandRange. Mae, the pixel companion, and the code were built with help from Claude, Anthropic's AI.
