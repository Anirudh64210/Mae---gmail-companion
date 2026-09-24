# DESIGN.md: Did You Actually Answer

Status: **locked (v1.4)**. The design is already built as code in `design/`. Your job is to wire it into Gmail, not to redesign it.

## 1. Source of truth

| File | What it is | Can you edit it? |
|---|---|---|
| `design/mae-sprite.js` | Mae, the pixel companion. Every pixel is hand-placed. | No |
| `design/nudge.js` | The nudge UI: Mae beside Send, the pill, the Send shake, sounds, thread highlight. | No (bug fixes only, with user approval) |
| `design/reference/nudge-reference.html` | All states rendered from the two files above. Open it in Chrome to see the target. | No |
| `design/reference/mae-spec.html` | Mae's full spec page: moods, sprite sheet, palette, rules. | No |
| `design/reference/sprite-sheet.html` | Static sprite sheet used by the visual test. | No |
| `design/icons/` | Toolbar icons: `mae-*.png` (on) and `mae-paused-*.png` (paused), 16/32/48/128 px. | No |
| `design/baselines/*.png` | Pixel baselines. `npm run test:visual` compares against them. | Only with `--update` after the user approves a change |

If something in Gmail looks wrong, the fix is almost always in the integration (positioning, anchor, theme detection), not in these files.

## 2. Mae

- Canvas 20 x 28 pixels, drawn at **exactly 2x (40 x 56 CSS px)**. Never 1.5x, never 3x in product, never smoothing.
- `image-rendering: pixelated`. Integer scale only.
- Mirror-symmetric. Every facial feature sits at least 1px inside the outline. `npm run test:sprite` enforces this.
- **Hidden by default.** Mae is not on screen for normal sends. She comes out only when something is missing, and for the one-time intro.
- When out, she sits left of Send with a 6px visible gap (`GAP` 2px plus her 2 blank sprite columns), her figure centred on the Send button and 2px low (`DROP`). She is taller than the button on purpose and overflows it above and below.
- **Entrance:** she slides out from behind the Send button in 375 ms (3 frames) with a 2px hop, clipped at the button's edge so she looks like she was behind it. **Exit:** slides back behind it in 250 ms, holding the last frame exactly (after `sealed` that is the envelope, never Mae).
- Animates at 8 fps (125 ms per frame). Pauses when the tab is hidden.

### States

| State | Mae | When | Motion | Ends |
|---|---|---|---|---|
| `hidden` | Not shown | Default, and while a normal send is being checked | None | |
| `intro` | Out, `wave` mood + intro pill | Once, the first time a reply is opened after install | Waves, smiles | "Got it", Esc, or 9 s; then `hidden` |
| `waiting` | Stays out, `waiting` mood, no pill | After Answer, while the user writes the fix | Holds the envelope, eyes resting on it, one slow blink every 3 s. No eye movement while the user types. | Next Send |
| `checking` | Only if already out | Re-check after a fix | Holds envelope, eyes scan | Result or 800 ms timeout |
| `unimpressed` | Pops out | Confident miss | Arms crossed, flat stare, foot taps; Send shakes once; pill shows | Answer (then `waiting`, underline stays), Send anyway, Esc |
| `sealed` | Already out | Re-check passed after a miss was fixed | Hops, dives into an envelope, the flap folds shut with her gold badge as the seal (tick 14, about 1.2 s; `sealed` runs at 85 ms per frame, quicker than the other moods), one hop, glitter | Email sends when the seal lands. At 2.3 s the sealed envelope slides into the Send button. That is the end. |
| `shrug` | Out | User clicked Send anyway | Palms up | `hidden` after 1.8 s |

Sprite moods: `wave`, `asleep`, `checking`, `waiting`, `unimpressed`, `relieved`, `sealed`, `shrug`. `asleep` and `relieved` stay in the sprite for the spec page and future use; `relieved`'s face is the first beat of `sealed`.

A clean send with no miss is checked invisibly and goes out. No Mae, no animation. Rarity is the product.

Once Mae is out after a miss, she stays out until the email is sent or the user presses Esc. No ducking in and out: `unimpressed`, then `waiting` while the user fixes it, then `sealed` straight from the envelope she is holding. If the re-check still finds a miss, she goes back to `unimpressed` in place (no re-entrance).

`sealed` is the only mood that plays once instead of looping. The nudge passes it ticks counted from the moment the state started, on its own 85 ms clock. In frozen or reduced-motion renders it shows tick 20: the sealed envelope with glitter.

### Intro copy (exact, in `nudge.js` as `INTRO`)

Hi, I'm **Mae**. I only show up if a question gets missed. Button: `Got it`

### Toolbar icon

Mae's head at 16/32/48/128 px from `design/icons/`. `mae-*` when on, `mae-paused-*` (grey, translucent) when paused for the site or thread. No badge counts.

## 3. The pill

One line, floating above the toolbar, right-aligned to Send, tail pointing at Mae. Never inside the reply box.

- Surface `#FFFFFF`, border `#CFD5D2`, radius 10px, padding 7/8/7/12px, font 13px/18px Gmail's font stack (`"Google Sans", Roboto, ...`).
- Dots: one per question asked, green `#2C8656` for answered, amber ring `#C26A12` for missed.
- **Answer** button: ink `#121715` background, white text, radius 7px.
- **Send anyway**: text button, muted `#6D7773`.
- Dark variant (class `dark`, set via `nudge.setTheme('dark')`) when Gmail's theme is dark. Detect by sampling the compose background luminance.

### Copy (exact, already implemented in `pillMessage`)

- 1 missed: **Maya** asked "What's your day rate for the extra design sprint?" (quote truncated at 60 characters on a word boundary)
- 2+ missed: **2 of Maya's questions** are unanswered
- Buttons: `Answer`, `Send anyway`

Copy rules for anything new (options page, store listing, privacy notice): plain words, short sentences, no em dashes or en dashes, no exclamation marks, no emoji, never guilt ("you forgot", "oops").

### Thread highlight

Missed sentences get a 2px amber underline using the CSS Custom Highlight API (`DYAANudge.highlightRanges(ranges)`). It never mutates Gmail's DOM. It stays while the user writes the answer (Mae waits beside Send holding the envelope), and clears on a passing send, Send anyway, or Esc.

## 4. Motion and feel

- Send shake: 280 ms, 3px left/right, once per miss. Class `dyaa-thud` on Gmail's Send element.
- Pill enters with 220 ms fade and a 6px rise with slight overshoot.
- Sound + vibration: off by default, toggled in options. A soft 190 to 90 Hz tick and a [14, 50, 14] ms vibration on a miss. A two-note chime (660 then 880 Hz) and a lighter [8, 40, 8] ms vibration exactly when the seal lands. Vibration only works on Android.
- `prefers-reduced-motion`: no shake, no pill transition, no slide; Mae appears in place and holds a still frame.

## 5. Behavior rules

1. Mae reads nothing until Send is pressed.
2. Unimpressed is the worst mood. No sad, angry, crying, streaks or guilt.
3. One reaction per send attempt.
4. Send anyway always works in one click, gets a shrug, and is never mentioned again.
5. Never edit the user's draft. Answer only places the caret at the end of their last paragraph.
6. Fail open: if the check errors or exceeds 800 ms, send normally and Mae stays hidden.

## 6. Do not

- Do not add colors, shadows, gradients, fonts, icons or emoji that are not in these files.
- Do not redraw, recolor, resize or "improve" Mae.
- Do not add a settings gear, badge counts, toasts, confetti or extra onboarding to the Gmail UI. The one intro pill is the only onboarding.
- Do not use a framework's default component styles (no Tailwind, no MUI) for anything visible in Gmail.
- Do not update baselines to make a failing visual test pass. Stop and show the user the diff instead.

## 7. Verifying design

```
npm run test:design       # sprite guardrails + visual regression (must pass)
```
Then load the unpacked extension in Chrome, open Gmail, and take screenshots of each state at 100% zoom, light and dark theme. Put them next to `design/reference/nudge-reference.html` and check them against it before calling any UI task done.
