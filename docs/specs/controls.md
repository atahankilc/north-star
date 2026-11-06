# Controls: empty buttons, a lamp for what's on (D-384)

Status: **look agreed 2026-11-06 (D-384); not built.** This is the build plan for the small parts only. Modals, dropdown
panels and docked panels are decided next, on top of this (see [What this leaves out](#what-this-leaves-out)).

Pictures of what was approved: [controls-preview/approved-dark.png](controls-preview/approved-dark.png),
[controls-preview/approved-light.png](controls-preview/approved-light.png). The demo itself is
[controls-preview/demo.patch](controls-preview/demo.patch) (how to run it: [The demo](#the-demo)). Where this text and the
demo's CSS differ, this text wins: the demo is an overlay, written fast, and its numbers aren't tokens.

## The idea

Today every button has a grey cell behind it (D-344). A row of five actions is five grey boxes, and nothing in it stands
out. The new rules:

1. **A control has nothing behind it at rest.** Its word is enough. A shade comes only under the pointer or the keyboard.
2. **Only the one go is filled.** `primary` (cyan) and `hazard` (magenta) stay solid, so the eye goes to them.
3. **What's on says so with a lamp:** a small round light beside the word, a hollow ring on the ones that are off.
4. **An icon has no room for a lamp, so the icon itself lights up:** it takes the lamp's colour and a soft glow.
5. **What's filled is fully round.** Pills and circles; nothing here uses a small radius, since small corners looked wrong
   beside round modals. Cards (squircle) and pieces (square) don't change.
6. **A state is never a line on one side.** The line under a pressed button goes: on a round shape it bends up at the
   corners. This holds for every part below.

## Each part

"Ink" is the text colour. `on` means pressed, picked or ticked.

| Part | At rest | Hover, keyboard focus | On | Notes |
|---|---|---|---|---|
| **Button `sm`** | no fill, `--fg-dim` | pill `--wash-3`, `--fg-strong` | lamp, `--fg-strong`, no fill | 24 px high, a little more room at the sides (`--pill-room`) |
| `tone="main"` | no fill, `--fg-strong` | as above | as above | was `--wash-4` |
| `tone="danger"` | no fill, **magenta ink** | pill `--wash-3` | | was dim until hover: with no cell it needs to read as danger at rest |
| `tone="primary"`, `"hazard"` | solid pill | as today | | |
| disabled | as today, no fill | none | | a disabled `primary` stays a dim solid pill |
| **Button `icon`** | no fill | circle `--wash-3` | **the glyph lights** (colour + glow), no lamp | see [Glyphs](#glyphs-two-bugs-to-fix) |
| **Button `md`** | white pill | as today | | keep its accent's wipe inside the pill (`overflow: hidden`) |
| **Button `link`** | unchanged | unchanged | | |
| **ButtonGroup** | no strip, no seam: a `--space-half` gap | | | stays the component that says "these belong together" |
| **ToolButton** | no fill, round | circle `--wash-3` | **the icon lights**: cyan + glow | its `dot` a circle, its badge a pill. See [To check first](#to-check-first) |
| **Tabs, Choice, Steps** | words, a hollow ring each | pill `--wash-3` | lamp, `--fg-strong` | no line under the current one; Steps keeps its lead `01` after the lamp |
| **Checkbox with a word** | hollow ring, no fill | pill `--wash-3` | lamp in its `tone`, no `✓` | `strike` stays. `.mark` goes |
| **Bare box, `CheckMark`, a prompt row's tick box** | hollow ring | | lamp, 8 px, in its `tone` | filters keep their colours: `customers` green, `problems` pink |
| **Select, Menu trigger** | no fill | pill `--wash-3` | `data-active`: lamp | open, `aria-expanded`: pill `--wash-3` |
| **Options** | pill, a line round it | line `--line-hover` | lamp, `--fg-strong`, no fill | a line all the way round is fine. `data-card` options: radius `--space-3`, not a pill |
| **Chip** | pill | as today | | |
| **Avatar** | a circle, any size, `.avatar` in `Settings.module.css` too | as today | | agreed 2026-11-06; PeopleHere's overlapping squares become circles, check their overlap |
| **CountBadge** | pill | | | |
| **Field** | a round well: pill, `--wash-1`, no line | `--wash-2` | focus: `--wash-2` and a 1 px cyan ring all the way round | see below |

**Field in detail.** `<textarea>`: radius `--radius-well`, not a pill. The padding is the same in every state, so nothing
jumps. `data-quiet`: no well at rest, the well only on hover and focus. Disabled: `dashed` has nothing to draw on now, so
it dims instead. A field inside `PromptField` stays as it is: no well, no padding, the prompt's own line. `InlineEdit`
is its own part (a dashed underline under text) and isn't touched.

## The lamp

One part, drawn in CSS on `::before` of the control, so no component's markup changes.

- Off: `--lamp` wide, round, a 1 px inset ring in `--fg-faint`, which is a quiet mark as D-366 allows (about 3.7:1 on
  black, 4.1:1 on the light page).
- On: filled with `var(--button-on, var(--accent-cyan))`, with a soft glow `0 0 var(--lamp-glow)` in the same colour.
- It sits before the word, `--lamp-gap` from it. Off and on take the same room, so a word never shifts.
- Sizes in `em`, so it scales with a console inside the zoomed canvas (`--cs`, D-264) with no special case.
- A tick row's lamp is 8 px (`--tick-lamp`), on the row's `--tone`.
- It has no animation of its own. Ink and fill keep today's `--dur-fast` change, which reduced motion already handles.
- A lamp shows only on a control with a state. An action like `edit` has `aria-pressed` unset and gets none: the
  selector is `[aria-pressed], [aria-checked], [aria-selected], [data-active]`, and one with no such attribute stays plain.

**The lit icon.** `color: var(--button-on, var(--accent-cyan))` and `filter: drop-shadow(0 0 0.3em …)`; on ToolButton the
filter goes on its `svg`, so the badge doesn't glow. It's the only state shown mostly by colour, so `aria-pressed` must
stay on it, as it is today.

## Glyphs: two bugs to fix

Found while checking the demo; both are in today's code.

1. **`Button icon` is too big.** `.sm[data-icon]` sets `--text-sm` (14 px), so its cell comes out 28 px, not the 24 × 24
   D-344 says, and `‹ back` has a bigger word than every other button. Fix: `--text-xs` like the rest, 24 × 24.
2. **`×` is a small drawing in JetBrains Mono.** At the same size as `‹ back` it looks much smaller. Fix: glyphs that stand
   for an action are drawn, not typed: add `close` to the set in `src/ui/primitives/hudIcons.tsx`, at 10 px with a
   1.5 px round stroke, and use it for every close. Do the same for `✓` and the `−` `+` of a zoom if they look off at
   12 px once the first fix is in. Only `×` is drawn in the demo, on buttons titled `close`.

Check every `<Button icon>` (about 50 in `src/`), since some hold words or numbers.

## Tokens

Add to `src/styles/tokens.css`, with a line in [tokens.md](tokens.md). Its "nothing rounded" row changes too.

| Token | Value | For |
|---|---|---|
| `--radius-full` | `999px` | every pill and circle |
| `--radius-well` | `var(--space-4)` | a `<textarea>` |
| `--pill-room` | `1.3` | times `--button-pad` at a pill's sides; 8 px would touch its ends |
| `--lamp` | `0.5em` | its width and height |
| `--lamp-gap` | `0.55em` | lamp to word |
| `--lamp-glow` | `0.55em` | its glow |
| `--tick-lamp` | `8px` | a tick row's lamp |

Field's padding: `var(--space-2) var(--space-3)`. The demo's 7 × 14 is off the scale (D-325); check the height against
24 px rows once it's on the scale. Everything else reuses `--wash-*`, `--fg-*`, `--accent-*`.

## One place

This look must never be written twice. Today's code had "on" copied into six files, so changing it meant six changes.
That's fixed already, before this work (2026-11-06):

- **"On" is written once:** the `:where(.sm[aria-pressed…], … .sm[data-on], .sm[data-active='true'])` rule in
  `Button.module.css`. ToolButton, Checkbox, CheckMark, Trigger, Menu's `+` and `PromptRow`'s tick box all compose `sm`
  and take it from there; each sets only its size and, by `--button-on`, its colour. `data-on` is for what has no aria
  state.
- **`check:kit` refuses a copy** (`onLook`, the kit too). When the line goes in step 2, take `Button` out of that rule's
  allowed files, so the line can't come back anywhere.

Keep it so: the lamp and the lit icon go in that one rule (or a shared rule right beside it), never into each part's file.
Where a part truly can't take it, write down why. `PromptRow`'s `.box` keeps a line all the way round only until step 5.
`InlineEdit`'s line is a field's underline and stays. Don't touch it.

## Steps

One commit each, gallery updated in the same commit (D-324). Rules first in the kit: most callers need nothing.

1. **Tokens and the lamp.** The tokens above; the lamp in `Button.module.css`'s one "on" rule (see [One place](#one-place)).
2. **Button.** Rest, hover, tones, `on`, `icon`'s size. `:where()` stays, so a caller's class still wins (D-334). Add `close`
   to `hudIcons.tsx`; swap the `×`s.
3. **ButtonGroup, Tabs, Choice, Steps.** The gap for the seam; `--seam` stays for what scales inside a console.
4. **ToolButton, Trigger, Menu's `+`.** They already take Button's look; what's left is their own size and any shade the
   real app needs. Menu's `+` lights in magenta through its `--button-on`.
5. **Checkbox, CheckMark, the tick box in `PromptRow.module.css`.** Delete `.mark` and the `✓` in `Checkbox.tsx`. The tick
   box's `✓` goes with it; the rest of the row stays until the surfaces are decided.
6. **Options, Chip, CountBadge, Field.**
7. **Sweep.** Go through what styles these parts from outside, or repeats their look:
   `PeopleHere.module.css`, `TextItems.module.css` (`.dot`), `TasksSide.module.css`, `Settings.module.css`, `Agent.module.css`,
   `Kanban.module.css`, `Timeline.module.css`, `Matrix.module.css`. Search for `--wash-2` on anything pressable and for
   `calc(-1 * var(--line-w))`. `CardPanel.module.css`'s use of that is a hairline between rows, not a state: leave it.
8. **Docs.** `DESIGN.md` §6 (*Buttons are cells*, *ButtonGroup*, *Controls are toggle cells*), `tokens.md`,
   `decisions.md`'s D-344 line; shrink what D-384 replaces in D-344's log entry.

## To check first

These weren't seen, because the demo drew the parts on a plain page. Check each in the real app at step 2 or 4, before
going further. If one fails, bring it to the user.

- **ToolButton over the backdrop.** Its CSS says the shade "keeps the icon readable over the moving backdrop" and now
  it's gone. The side nav and the corner sit over a moving ASCII backdrop and over pieces. If an icon gets lost, the
  likely answer is a faint round shade on the HUD's tools only, while keeping the page's and panels' ones empty.
- **A console on a piece.** It has its own `--bg`, so it should read, but check it at 25 %, 100 % and 400 % zoom, with
  its marks.
- **Buttons on a tinted or coloured surface:** a card's tinted panel head in the light theme (D-368), a sticky note. The
  dim ink lost its cell's help, and the off ring may be weak there.
- **"Can I press this?"** A row of dim words is calmer but says less. Watch for ones that read as labels, mostly a lone
  button in a panel's foot.
- **Steps.** The lamp takes room from words already short: in the demo `03 COLUMNS` cuts to `03 COLUM…`. A wizard's real width may fit; if not, Steps can go without the off rings.
- **Touch.** No hover means no shade at all. Hit areas stay 24 px as today.
- **The wider Button.** The sides grow by about 2 px, so a console or dock near its width may wrap sooner (D-354). The
  demo's dock wrapped in one mix that isn't the chosen one.

## What this leaves out

Decided later, with the user, on top of this (Q-035 lists them, with what was shown so far):

- Modals, `Window`, Dialog, WizardShell, Settings, HazardConfirm: corners, shade, line.
- Dropdown panels and `PromptPanel`: corners, the L's, a row's look (its corners, the band on a picked one, the `›`).
- Docked panels (`EdgeColumn`, `PanelHead`), the console and dock's own shape, Toast, Tip, Popover.

Not changing: cards and their bar (D-380), pieces and everything on the canvas (square), piece names and kind tabs,
Marks, `link` buttons, InlineEdit, scroll bars. The rejected list holds: no brackets on buttons.

## Rules for this work

- Tokens only, `npm run check:tokens`, `check:kit`, `check:gallery`; `npm run check:gallery:live` once at the end, since it
  presses real buttons (some look for words or titles).
- Dark, light and reduced motion, each part, before and after, the gallery's way: old and new from their own worktrees.
- Every commit that changes a kit part changes its `X.gallery.tsx`. Galleries worth a new state: a lit icon, a lamp with
  `--button-on`, a Field quiet and disabled.
- Onboarding (D-315): no new feature, but the look of every control changes. Read `lessons.ts` for words that describe the
  old look (`✓`, *cell*, *tick*) and bump what changes; one line in `releases.ts`. The lesson demos draw the real
  components, so they follow by themselves. A commit without a lesson change says why in a `Lessons:` line.
- Other sessions work in this tree (state.md): stage only your own hunks.

## The demo

The approved page and the undecided surfaces, as an overlay on the real components. It needs nothing in the repo:

```sh
git worktree add --detach /tmp/controls-demo 5c6824f
cd /tmp/controls-demo && git apply <repo>/docs/specs/controls-preview/demo.patch
ln -s <repo>/node_modules node_modules
VITE_USE_EMULATORS=true npx vite --port 5179 --strictPort   # then /round.html
```

The patch never goes into `main`: `src/roundDemo.ts` is a throwaway and doesn't follow the token rules.
