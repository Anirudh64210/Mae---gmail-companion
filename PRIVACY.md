# Privacy policy: Did You Actually Answer

Last updated: 24 September 2026

Did You Actually Answer is a Chrome extension for Gmail made by ExpandRange. When you press Send on a reply, it checks whether your reply answers the questions in the email you are replying to. This page says exactly what it reads, what leaves your computer, and what is kept.

## What it reads, and when

- Nothing is read until you press Send on a reply.
- When you press Send, the extension reads two things from the page: the most recent message in the thread from someone other than you, and your draft.
- It does not read other threads, your inbox, your contacts, or any other website. It only runs on mail.google.com.

## What leaves your computer

Before anything leaves your computer, the text is trimmed and redacted on your machine:

- Quoted history, signatures, legal footers and forwarded messages are removed.
- Email addresses, links, phone numbers and long ID numbers (account, card, order and tracking numbers) are replaced with placeholders such as `[EMAIL]` and `[NUMBER]`.
- At most 20 sentences of the incoming message are kept.

What remains of the incoming message and your draft is sent once per send attempt to a relay, the small server that scores it. The relay returns numbers only: for each sentence, how likely it is to be a question and how likely your draft answers it. No text comes back.

If you leave the relay address empty in the extension's options, the check runs entirely on your computer using a simple word-matching method, and nothing leaves your computer at all.

## What the relay does with the text

- It holds the text in memory only for the length of the call, then discards it.
- It does not log request contents, store them in a database, or send them to analytics.
- It passes the text to the scoring model with zero data retention where the provider supports it.
- The relay's code is open source in this repository, so anyone can read it or run their own.

## What is stored on your computer

The extension stores only these, in the browser's extension storage:

- Your settings: on or off, sound, the relay address, and whether the one-time intro was shown.
- Four counters: checks run, flags shown, flags fixed, and sent anyway.
- A random install ID, used so the relay can limit abuse. It is not linked to your account or email address.
- The most recent check (the redacted text that was sent and the numbers that came back), shown on the options page so you can see exactly what left your computer. It is kept in session storage and deleted when the browser closes.

It never stores message text, names, email addresses, subjects or message IDs beyond the current session.

## What it does not do

- No accounts, no sign-in.
- No analytics, tracking or advertising.
- No selling or sharing of data.
- No reading of other websites or tabs. The only permissions are `storage` and access to mail.google.com.
- The extension holds no API key.

## Your control

- Pause or turn off checking from the toolbar icon or the options page.
- Remove the extension from `chrome://extensions` to delete everything it stored.

## Changes and contact

If this policy changes, the date at the top changes with it and the history is in the repository. Questions: open an issue at https://github.com/Anirudh64210/Mae---gmail-companion.
