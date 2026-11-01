# Foundation audit (2026-10-31)

The user: "farklı componentler farklı kategoriler altında olmalı (animations: text animation, component animation; form
componentleri, hud componentleri)… bir çok şey individual componentlerden oluşturulmak yerine yeniden kodlanıyorsa bu
gallery'nin bir anlamı yok… bir bina gibi foundation'ımızın iyi olması lazım."

Two questions: (1) is the gallery's grouping bad because of the repo's structure; (2) is UI rebuilt by hand instead of
from shared components. Both: yes. Evidence below (read-only sweeps of src/views, src/onboarding, src/agent/ui, src/ui;
galleries, demo and tests left out). Proposal at the end; not decided yet.

---

## 1. The structure

| Folder | Components | Lines |
|---|---|---|
| `src/ui` (the shared kit) | 41 | 2 458 |
| `src/views/workspace` (one flat folder, 43 component files) | 242 | ~19 000 |
| `src/onboarding` | 41 | 6 110 |
| `src/agent/ui` | 32 | (part of 10 739) |

- The kit is an eighth of the UI code. Building blocks were made inside features and never moved to `src/ui`:
  `DockAction` (FocusDock.tsx, 32 uses in 8 files), `Pills` (CardPanel.tsx, 11 uses), `Choices` and `Toggle`
  (MatrixSetup.tsx, ~15 uses), a `Rule` (AgentMemory.tsx), the setup tabs (copied 3×), a `Spinner` (Agent.tsx).
- `src/ui` itself is one flat list: primitives (AsciiButton, Choice), patterns (Menu, SidePanel), motion (Appear,
  DecodeText), page parts (Hud, Settings, Curtain) and text (Markdown, Ink) side by side, so nothing says which layer
  a thing is.
- The gallery's sections (`ui | canvas | panels | screens | onboarding`) followed those folders, so it groups by where
  a file lives, not by what it is. A text animation and a component animation can't both be under "motion"; a form
  control in a panel isn't with the other form controls.

## 2. Rebuilt by hand

Outside `src/ui`: **281 raw `<button>`s in 44 files** against 9 `AsciiButton` and 10 `PanelAction`; 11 files with
buttons import nothing from `src/ui`. 19 of 42 CSS modules outside `src/ui` `composes` from it (21 of those uses are
one class, `small`); 23 never do (Kanban 966 lines, Threads 707, Timeline 620, PlaneCards 564, Guide, Pages, Lesson…).

| Pattern | Shared | Rebuilt | Drift |
|---|---|---|---|
| `[verb]` buttons | AsciiButton 9, PanelAction 10, `composes: small` 21 | ~250 raw buttons; own `::before '['` CSS in 7 places (Threads, CardPanel ×2, Pages, KindGuide, Toast); DockAction a third system; Kanban `.tool` a fourth | bracket colour `--fg-faint` vs `--line-hover`, text `--fg-dim` vs `--fg-muted` |
| Uppercase label | Frame `.fieldLabel` composed once | 63 rules in 27 files re-declare caps + tracking under ~55 names (.head, .kind, .k, .eyebrow…) | |
| `01 NAME ──` rule | PanelSection 32 (4 files) | 8 hand copies (Kanban, CardKanban ×2, AgentMemory, Agent, DocContent, TasksSide ×2, Timeline, Choices) | the magenta number under 5 names, the line under 5 |
| Text fields, `>` prompt | AutosaveField 10, InlineEdit 1, MenuPanel 3 | 40 `<input>` + 15 `<textarea>` with ~35 local classes; InlineEdit redone 3×; the `>` prompt redone 8× (6 different sign classes) | |
| Option pickers | Choice **1**, Select 17 | `Pills` (= Choice) 11, `Choices` 11, `Toggle` 4, hand `[x]` 4, ad-hoc segmented controls 6, setup tabs 3 | |
| Menus | Menu 16, ContextMenu→MenuPanel 6 | 6 own listboxes; FilterDock imports Menu's CSS directly | the best of the lot |
| Chips, badges | none | `.chip` in 5 files (different looks), 3 count badges (offset, magenta vs cyan), `9+` logic twice, `.count` 7× | |
| Panels, dialogs | SidePanel 4 (2 files) | 10+ own `role="dialog"`, 13 files with their own portal, 3 wizards ~60 % the same code, 24 own frame borders | 4 close-button variants (`[×] esc`, `[×]`, close + key, `cancel esc`) |
| Empty, loading | Loading 1 | ~20 local empty-state classes, different wording; Agent's braille spinner vs Loading's `▖▘▝▗` | |
| Kind colours | none | the card-type colour map 4× in TS (TYPE_ACCENT, TONE ×2, TYPE_TONE), placeholders 2×, name→var maps 3× | no CSS type tokens |

## 3. Motion

Entrances mostly use the shared pieces (`<Appear>` 25 uses, `runCells` 9, `DecodeText` 7). The rest is rebuilt:

- **Camera and glides:** `glide()` (16 uses) plus 5 own tweens (Timeline ×3, CanvasView morph, collab). The 420 ms
  glide has no token and is typed 13 times.
- **Helpers copied:** easeInOutCubic 4×, lerp 3×, the "t0 → progress → rAF" loop 8×, the cell clip-path builder 2×
  (Appear, FocusedPlane's ink), the "fully clipped" polygon 5×, the spinner 2× (Loading, Curtain) + a third (Agent).
- **Timings:** exit 200 in 3 places vs 192 (Appear) vs 170/90; 320/260/400/180/160/120 ms literals in TS and CSS where
  tokens exist (`--dur-cells`, `--dur-decode`, `--dur-quick`, `--dur-snap`); `cubic-bezier(0.65,0,0.35,1)` written
  out twice though it is `--ease-in-out`; tokens.css says durations are mirrored in tokens.ts `motion`, which doesn't
  exist.
- **Reduced motion gaps:** the light theme's colour transitions on `:root` (the global rule covers only descendants);
  Curtain's opacity fade (MotionConfig turns off transforms only); 7 entrance `@keyframes` rely only on the global
  0.01 ms rule.

## 4. Proposal (accepted as D-326)

Progress (D-326's log has each step): the map, motion, the kit, every area moved onto it, the patterns and
`check:kit` (2026-10-31 → 11-01). Left: folders, and the few areas noted in D-326's *Not yet*.

A building: foundations, then the kit, then patterns, then the rooms. The gallery shows each floor and is the safety net
for every move (before/after shots per state, as D-325 does).

1. **The gallery's map, now (small).** Each example names a `category` from a fixed list and any `tags`:
   Foundations (colour, type, spacing, motion tokens) · Motion (entrance, text, camera, feedback) · Actions (buttons)
   · Forms (fields, prompt, pickers, checkboxes) · Text and labels (labels, rules, ink, markdown) · Feedback
   (toast, loading, empty, confirm) · Overlays (menus, dialogs, panels, wizards) · HUD and navigation · Canvas pieces
   · Panels · Onboarding. A component shows under its category and every tag (DecodeText under Motion › text and
   Text). The list no longer follows folders.
2. **Foundations.** `src/ui/foundation/motion.ts`: `DUR` (with `glide` and `exit`), `easeOut`, `easeInOut`, `lerp` in step with
   tokens.css; one `tween()` (reduced motion inside); `runCells` with an order (random, sweep, from a rect) and an
   exported `HIDDEN`. One card-type token map (TS and CSS). The `:root` reduced-motion gap closed.
3. **The kit (primitives).** Button (`[verb]`, sizes, tone, pressed, key hint, icon-only: AsciiButton + `small` +
   DockAction + PanelAction + Kanban's tool), Label, Rule (`01 NAME ── count`), Field and PromptField (the `>` line),
   Choice + Checkbox + Tabs (Pills, Choices, Toggle, setup tabs), Chip, CountBadge, Spinner, Empty. Each with its
   gallery example.
4. **Patterns.** Dialog/Window (one close, portal, focus), WizardShell (the three wizards), SetupPanel (tabs),
   Dock (FocusDock's actions), on top of the kit.
5. **Move the rooms onto it,** one area at a time (panels, docks and setups, decks, timeline, onboarding, agent), each
   with before/after gallery shots; delete the local copies.
6. **A rule that keeps it so.** A `check:kit` like check:tokens: raw `<button>`, `<input>`, `<textarea>`,
   `role="dialog"`, own portals, `[`-bracket CSS and caps-label CSS outside `src/ui` counted per file against a
   baseline that only shrinks. CLAUDE.md: a new UI need is met from the kit, or the kit grows first.
7. **Folders, last.** `src/ui/{foundation,motion,primitives,patterns}`; `src/views/workspace` split by area
   (canvas, plane, matrix, table, deck, timeline, documents, panels, finder, threads). Moves are churn for the other
   sessions, so done once, when the migration has settled, in one commit.

Coordination: D-325 (tokens, another session) is converting the same CSS now; kit work starts after it or in step
with it, never on the same files at once.
