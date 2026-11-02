# Onboarding: every lesson

> **D-349 (2026-11-02): rewritten.** `src/onboarding/lessons.ts` is the source of every lesson's words. What holds:
> - **Every lesson is the centred modal** (Pages, the welcome's window), never a card beside an anchor; no nudges.
>   Small helpers kept: the kind guide beside the `+` menu, the empty states.
> - **One lesson per screen, panel or piece**, step by step, the first time it's opened or made. Limits: a title ≤ 6
>   words, a body ≤ 40, ≤ 8 pages (D-351); each page may carry a one-word `tab`. The kind guide's rows, empty lines and
>   release lines stay ≤ 25.
> - **No lesson over a menu, the finder, a wizard, typing, or Settings** (a native dialog): those wait until it closes,
>   or are taught by the piece's own lesson. Keys are shown nowhere in the app; a lesson may name one, and `?` → keys
>   lists them all.
>
> | id | when | pages (tabs) |
> |---|---|---|
> | `welcome` | first canvas | canvas · pieces (+ for editors) · (V: reading) · bar · inside · tools · people (D-351) |
> | `workspaces` | the workspaces page | workspaces · start · actions |
> | `join-pending` | a code sent | waiting for an owner |
> | `kind-guide` | `+` opened (beside the menu) | a row per kind |
> | `piece-made` | a piece made | edit · frame (lenses) · stick (sticking kinds) · done · undo |
> | `beside` | a piece opened beside a plane | beside · follow |
> | `focus-plane` | a plane focused | plane · kinds · make · links · many (V: cards) · filter |
> | `card-panel` | a card selected | panel · evidence · for · features (competitor) · parts (feature) · tasks |
> | `link-made` | a link made | kind · shown |
> | `package-made`, `brought` | a package made; a card brought from another plane | two pages each |
> | `text-made`, `sticky-made`, `section-draw` | a heading/paragraph, sticky, section made | writing · places (heading); one page each |
> | `matrix` | a matrix made or focused | matrix · window · score (V: reading) · sure · judged · setup |
> | `table` | a table made or focused | table · window · cells (V: reading) · columns |
> | `documents`, `doc-place` | a documents list / a document made or focused | files · beside; one page |
> | `deck` | a deck of tasks made, focused or unframed | deck · add · task · filter · beside |
> | `card-deck` | a deck of cards made or focused | cards · order |
> | `side-view`, `timeline`, `tasks-given` | the side view; a timeline made or focused; a task given to you | side view · mine; days · draw; one page |
> | `people-here` | someone joins | here · follow |
> | `comment` | threads or a thread opened (over the panel) | comments · threads |
> | `canvases` | the breadcrumb's prompt closed, a canvas made or switched, a piece moved | canvases · move · delete |
> | `settings`, `people-settings` | after Settings (its people page) closes | you · workspace; people · asking |
> | `viewer` | a viewer's change refused | one page |
> | empty states | `empty-canvas`, `workspaces-empty`, `empty-plane`, `empty-timeline` | one line or three choices |

## Where the rest lives

- **The words, triggers and scenes:** `src/onboarding/lessons.ts`, one entry per lesson (`id`, `v`, `format`, `roles`,
  `trigger`, `doneWhen`, `after`, `within`, `pages` with `title`, `body`, `tab`, `scene`, and per page `roles`,
  `audience`, `kinds`, `if`). Names filled in when shown: `{owner}`, `{peer}`, `{piece}`. `npm run check:lessons` holds
  the limits above, that every scene and anchor exists, and that every `since` names a decision in the log.
- **The voice:** plain, short, lowercase actions, keys as the app writes them. Never "board" or "kanban" on screen:
  "plane", "deck".
- **The demos:** one file per scene in `src/demo/scenes/` (its first line names the lessons and pages that show it),
  listed in `src/demo/sceneList.ts` and `src/onboarding/Demo.tsx`'s `BUILT`; 3–8 s each, made-up data (`pazar`).
- **What's new:** `src/onboarding/releases.ts` (only `launch` so far); a sample for tests and `?release=sample` in
  `releases.sample.ts`.
- **Where each feature's code is:** [onboarding-inventory.md](onboarding-inventory.md).
- **D-315's first draft** (an entry per feature, the anchored cards, the nudges, the first scene list), replaced by
  the above on 2026-11-02: `git show bddf074:docs/specs/onboarding-lessons.md`.
