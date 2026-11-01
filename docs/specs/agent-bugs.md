# Agent bugs

What trying the agent (D-312) turned up, 2026-10-31: 1–10 the user in the app, 11–14 its import of the Founder
Discovery Study set against the hand-made one, 15–24 the first eval run on a real model, 25 a review of this list,
26 split out of 17 and 27–28 the user's asks in a second review read against the code (the same day). A fixed one
moves to `memory-bank/state-history.md` with how it was checked, and its row here says `fixed`.

Numbers never change (state.md and the log cite them); a new one takes the next number, goes in the group it belongs
to and gets a row in the table.

## How to fix: code before prompt

Whatever code can check, code enforces: a refused op, a dropped tool, a rewrite, a warning returned to the model. The
prompt keeps only what needs judgment. Each rule added to the prompt costs attention on every other rule (the skills
group is 31/61 with the rules already written down), so a prompt fix is the last resort, and it is measured on the evals.

Two corollaries. A rewrite beats a refusal when the intent is clear: a refusal costs the model a turn, a rewrite plus a
warning doesn't. And a bug not reproduced gets its failing eval before its fix (6, 10), so the eval shows which cause
it is.

Every fixed bug leaves an eval behind that fails if it comes back, not only 6 and 10. One no eval can measure (the
preview's 7, 3) leaves a gallery scene instead (D-324).

Lists of words in the prompt (19's triggers, 20's vague verbs) are hints for the model's judgment. They are not the
matching on the person's words that 17 rules out: code never decides anything from such a list.

## Triage

Severity: **high** loses or changes data without a clear yes, or makes the person distrust what they see; **mid** a
wrong or weak result the person has to fix; **low** an annoyance; **blocker** harms no one by itself but other
fixes can't be measured until it's fixed. Layer: where the fix goes.

| #  | What                                             | Group        | Severity | Layer            | Status |
|----|--------------------------------------------------|--------------|----------|------------------|--------|
| 17 | `go` taken as yes to a delete                    | Guards       | mid      | code (preview)   | fixed  |
| 26 | turning text into cards rewrites its words       | Guards       | mid      | code + prompt    | open   |
| 18 | a viewer's agent calls `change`                  | Guards       | low      | code             | fixed  |
| 16 | ops nobody asked for                             | Guards       | mid      | code + prompt    | open   |
| 6  | items land on top of each other                  | Guards       | mid      | code             | place_on fixed (text); paragraphs open |
| 11 | links no plane can draw                          | Guards       | mid      | code (`lint`)    | open   |
| 12 | no last look before the preview                  | Guards       | mid      | code, then model | open   |
| 25 | evals build their store apart from the app's     | Plumbing     | blocker  | code (evals)     | fixed  |
| 1  | document text never loaded                       | Plumbing     | high     | code             | fixed  |
| 5  | an apply is never told to the model              | Plumbing     | mid      | code             | fixed  |
| 2  | bare short ids in the chat                       | Plumbing     | mid      | code             | fixed  |
| 22 | bare ids in documents                            | Plumbing     | mid      | code             | fixed  |
| 9  | skills list doesn't scroll                       | Plumbing     | low      | code             | fixed  |
| 7  | preview inside a piece spills onto the canvas    | Preview      | high     | code             | fixed  |
| 3  | the stepper's item doesn't stand out             | Preview      | mid      | code             | fixed  |
| 4  | plane layouts ignore links                       | Layout       | high     | code + prompt    | built (flow, D-327); no real-model eval yet |
| 10 | can't rearrange a canvas                         | Layout       | mid      | unknown (repro)  | open   |
| 15 | lists answered from the map                      | Judgment     | mid      | code, then prompt| open   |
| 19 | "would it work" not dry-run                      | Judgment     | low      | prompt           | open   |
| 20 | vague verb run without asking                    | Judgment     | mid      | prompt           | open   |
| 21 | skill guides not followed step by step           | Judgment     | mid      | code + methods   | open   |
| 23 | "for a plane" leans on other planes              | Judgment     | low      | methods          | open   |
| 24 | points at an existing piece instead of making it | Judgment     | low      | prompt           | open   |
| 13 | no coverage map for a big document               | New parts    | mid      | new              | open   |
| 14 | one plane or several, never weighed              | New parts    | mid      | code + prompt    | numbers built (`structure`, D-327) |
| 28 | a big job stops after one preview                | New parts    | high     | new (workflow)   | built (job, steering; not saved) |
| 27 | organising never changes the structure           | New parts    | high     | new (read + skill)| phases 1–2 built; reference pictures, real-model run next |
| 8  | no web access                                    | New parts    | mid      | new (Phase 9)    | open   |

## Order

0. **25 first**: the evals lie until the store they run on is the app's (bodies there, applies told), and fixing it
   changes the harness, so a baseline taken before it can't be compared with anything after. No baseline before 25.
1. **Baseline**: the eval run three times on two models (gpt-5.6-terra and a cheaper one; the person picks the
   model, D-312, so a prompt tuned on one can overfit to it), to know the spread per case, not only the total; every
   step below is measured against it, guards and plumbing too. Then **plumbing** 1, 5 (failing in the evals first
   now; 5 is a few lines, its line already exists), then 2 and 22 together (one resolver), 9: no design needed.
2. **Guards** 17, 26, 18, 16: small. 6's code fix (paragraph heights, cause found) can come here too, after its eval.
3. **`lint`** (6, 11, the checkable half of 12, 21's postconditions): one function, run at the end of every writing
   run. 6 gets its failing eval first.
4. **Link graph** (`src/model/graph.ts`, one module for 4, 11 and 14): the connected groups of a plane's cards and the
   share of links between them. Then **layout** 4 (the `flow` layout on it), and 10 reproduced in an eval before
   anything is changed.
5. **Judgment**: 15's map fix (code) first, then baseline again and the prompt and method changes 15, 19, 20, 21's
   methods, 23, 24, each measured.
6. **New parts**: 28 first (jobs that keep going; 27 and 13 run as jobs), then 27 (on the link graph, with 14 and 4's
   `flow` inside it), 13, 8. 27 and 28 agreed by the user (D-327, D-328), not built.

**Preview** 7, 3 run beside all this, from the start: no eval measures them, so they wait on nothing, and 7 is high
(the person distrusts what they see). Before the agent's UI design session, not in it.

---

## Guards: what code must refuse or warn about

17. **A question in the plan turn, then `go` taken as its yes.** build-02 (second run): instead of a plan it asked
    "shall I remove the stickies?", the person said `go`, and it deleted x13 and x14, a delete with no clear yes
    (rule 5). (It also renamed the ideas: that is 26, a bug of its own.)
    Severity mid, not high: every change waits in the preview and an apply is one undo step (D-312), so nothing is lost
    before the person applies. The real risk is a delete missed in the preview.
    Fix (code, preview): deletes drawn apart in the preview (their own mark and a `N deleted` line) and named on the
    apply button (`apply · 2 deletes`), always, whatever was said. No reading of the person's words, neither the last
    message's (`go`/`ok`/`yes`: "sounds good" or "tamam, devam" passes any such list) nor whether a message "named" the
    thing (does "remove the stickies" name x13?): any such match is a guess, and a guess on deletes is the bug itself.
    Fix (prompt, small): a plan proposes the safe version (keep what's there) and offers a delete as an option.
    *Fixed 2026-11-01 (D-333), the user's way:* a delete is fine behind the preview's accept or an undo, so no yes is
    asked for at all: deletes go in the preview with why, accepting is the yes, the apply button names them
    (`apply · 2 deletes`). No code reads words in one language: `waitingFor` and the `asking` phase are gone, a job
    pauses when a turn proposes nothing, the eval runner's go follows a waiting `plan`. edit-10 and the new edit-14
    expect the delete proposed at once.
26. **Turning text into cards rewrites its words.** build-02, the same run as 17: a sticky "Who owns the stall
    data?" became the idea "Own the stall data". A question became a statement, and the person's words are lost
    without being asked. Split out of 17, so it stays open when 17's preview fix closes that one. Fix (code): an op
    that makes a card from a piece of text (sort-stickies, import) carries the source text, and `change` warns when the
    title differs from it beyond trimming; the preview shows the old words beside the new. Fix (prompt, sort-stickies'
    method): the title keeps the note's words; a rewording is offered, never made.
18. **A viewer's agent still calls `change`.** refuse-03: the tool refused it and the answer was right, but it
    shouldn't try. Fix (code): drop `change` from the tool list for a viewer. Not one line: `AGENT_TOOLS` is a fixed
    list (src/agent/tools.ts:140) and the refusal already works (src/agent/change.ts:265); the list goes to `runTurn` as
    an argument (agentStore.ts), so it is filtered there by `actor.role`. The prompt names `change` in "Changing
    things": a viewer's prompt leaves that section out, or the prompt test (every tool it names exists) fails on it.
    *Fixed 2026-11-01:* the app already dropped the write tools for a viewer and added a read-only note; the evals
    didn't (the same drift as 25). Now the loop does both from `env.actor.role`, so the app and the evals get the same
    (`systemPrompt({ viewer })` adds `READ_ONLY` after the unchanged prompt, so the cached prefix holds).
16. **It adds ops nobody asked for.** edit-09/edit-13 "add three ideas": three `create_card`s plus an `arrange` of them,
    so the preview has 4 items for 3 asked, and unticking one leaves an arrange of the rest. Same family: prioritize-03
    changed 14 features' impact/effort when asked only to fill the deck; learn-03 made a problem and a link from notes
    meant as evidence; dedupe-01 renamed and moved a third card.
    Fix (code): `change` folds an `arrange` whose items were all made in the same call into those ops' own `where`
    (a rewrite, not a refusal, so no turn is lost) and returns a warning saying so; the preview then holds 3 items for
    3 asked. Its limit: a create op's `where` holds only near / in_section / clear, never a layout (registry.ts,
    arrange.ts), so an `arrange` with layout row, column or cluster ("three ideas in a row") can't fold without
    losing it. Fold only an arrange that is a `where` alone; otherwise keep it, tied to the cards it places (unticking
    a card takes it out of the arrange, the last one takes the arrange). The code fix covers only edit-09/13: the rest
    of the family (prioritize-03, learn-03, dedupe-01) is judgment, the prompt's. Fix (prompt, "Changing things"): do
    only what was asked; anything more is offered in the answer, not proposed.
6.  **Things it puts on a canvas or plane often land on top of each other, paragraphs most.** Not reproduced yet.
    Not raw coordinates: `change` already refuses x/y from the agent (src/agent/change.ts, NO_COORDS), though
    `create_text` itself still takes them for the UI. The likely cause, read in the code (second review): `labelBox`
    (src/model/labelBox.ts:21) counts a paragraph's lines by its `\n`s only (`lines * PARA_PX * 1.5`), never by the
    wrapping at its width, so a 600-character paragraph one line long, 400 px wide, is one line high: the placement
    clears a box far too short. Sticky notes are counted the same way. The placement itself does check what's there
    (`clearOffset` in src/model/layout.ts), so "near/in_section don't look" is unlikely; whether the batch's own items
    count as taken is still to check. Fix (code): a paragraph's and a sticky's height from its wrapped lines at its
    width (characters per line from the font size, or measured like `sizes.ts`), Markdown lines (bullets, headings)
    counted. Eval first (it fails on any overlap, a long one-line paragraph in it), so it shows this is the cause.
    A second cause, found and fixed with D-327's evals (2026-11-01): place_on's `landing` (src/model/placement.ts) kept
    clear of the plane's cards but not its text, so a card brought to a plane landed on a sticky; the plane's text is
    now in its obstacles (tests/unit/agentLook.test.ts). The paragraph height above is still open.
11. **Links between cards on different planes are never shown, and it doesn't know.** In its import of the Founder
    Discovery Study (the `north-star` canvas in the user's Granat export), 16 of 48 links join cards on two planes, so
    no plane draws them (D-207). `validate` (src/ops/validate.ts) checks both ends exist, not that they share a plane.
    Fix (code, `lint`): a warning the model sees, with the two ways out: place the other card on this plane too
    (`places`, D-281), or put both on one plane. It reads the link graph (src/model/graph.ts, not written yet; shared
    with 4, 14 and 27).
    Eval: fails on any link no plane can draw.
12. **It never checks its own work before the preview.** The same import: competitors with only `notes` (no url,
    pricing, audience), evidence without URLs, tasks tied to no card, tables whose rows are typed names repeating cards
    that exist (stale once a card changes), no tags, planes of 960 × 600 holding items out to 1400 × 2475. `/gaps`
    finds some of it, only when asked.
    Fix, in two steps. (1) Code: a `lint` beside `validate`, run at the end of every writing run, its findings returned
    to the model as warnings: empty key fields, links no plane draws (11), overlaps (6), cardless tasks, table rows that
    match an existing card, items outside or crowding their plane. The model fixes them or lists them in the report.
    (2) Later, if still needed: a model's last look for what code can't judge (21's checklists).
    Two limits on `lint`: the model gets at most one turn to fix its findings (no loop of fix, lint, fix); and what
    is left goes into the preview for the person too (`2 links no plane draws`), not only to the model, which can
    ignore a warning.

## Plumbing: wiring the app to what was built

25. **The evals and the app build the agent's store in two places, so they drift.** 1 and 5 are two cases: the eval
    store holds documents' bodies and the live one doesn't; in the evals nothing about an apply reaches the model
    either way, so a missing line can't fail. Fixing each by hand leaves the next drift to be found in real use.
    Smaller than it sounds (second review): applying already goes through the same `acceptChanges` (changeset.ts) in
    both (evals/env.ts:125, agentStore.ts `accept`). They drift in two places only: bodies (evals/emulator.ts:87-93
    reads every document's `content/body`, `liveWs()` none) and the model's history after an apply (5).
    Fix (code): one body loader through `src/data/`, used by both; one function that writes an apply, discard or
    undo into the model's history, called by both drivers. Comes before 1 and 5, which then fail in the evals first and
    are fixed against them.
    *Fixed 2026-11-01, with 1 and 5:* the evals' store starts as the app's (`asTheAppLoads` in evals/env.ts: only the
    agent notes' text); `read_document` answers `needs` when a text isn't there, the tool wrapper calls
    `AgentEnv.loadBody` and reads again (the loop hands it on); the app and the emulator mode load through
    `readDocBody` (src/data/documents.ts) under the rules, the in-memory evals from the fixture. The outcome line is
    workflow.ts' `withOutcome`, the same words in agentStore.ts and evals/run.ts. Left: a reopened saved chat still gets
    chats.ts' shorter `[the proposed changes were applied (N)]` (only a count is saved).
1.  **It can't read a document's text in the app.** `liveWs()` (src/agent/ui/agentStore.ts) puts only the agent notes
    in `bodies`; documents' `content/body` is never fetched, so `read_document` answers "its text isn't loaded here"
    with the excerpt. The evals pass because their store holds bodies. Fix: fetch a body (through `src/data/`) when
    `read_document`/`get` asks for one, keep it in `bodies`. A long one (the 77-reference study) must not land in the
    context whole: `read_document` reads by section or page (`pageOf` in read/text.ts), its head listing the
    sections, which 13's coverage map also reads.
5.  **After an apply, asked "what's next", it still says "approve the proposed canvas and…".** Likely never told: the
    `report` effect (agentStore.ts) pushes a chat entry for the UI, nothing into the model's history. Confirmed in the
    code (second review), and the line already exists: a saved chat reopened gets
    `[the proposed changes were applied (N)]` from `historyOf` (src/agent/chats.ts:130), but the live `accept()`
    (agentStore.ts) never adds it to `rt.history`. So the agent knows about the apply after a reload and not in the same
    session. Fix: the same line (with what was kept and what not) goes into the live history on apply, discard and
    undo, written by one function both use (25). 28 builds on it.
2.  **Its answers show bare short ids** (`[d1]`, `k3`) the person can't read. The prompt asks for `c12 "title"` but the
    model drops the title, and the chat links only `c p t x d` (Agent.tsx `CITE`). Fix: the chat writes every short id
    as the item's name, every letter (k canvas, u person, e link, v, f, m) clickable. No prompt change needed. One
    resolver (short id → name, from the chat's `Ids` and the store) serves this and 22: the chat calls it when
    drawing, `create_document` when writing.
22. **Documents cite ids without the card's title.** pitch-01/02, lean-canvas-01, interview-02, swot-04: good documents,
    but lines like "linked to c32, c29, c25, c33", unreadable outside the agent (2, inside documents). Fix (code):
    `create_document` rewrites a bare `cN` into `cN "title"` itself, through 2's resolver. Its limit: the title is frozen at writing, so a
    renamed card leaves the document on its old name. A reference resolved when the document is drawn would stay
    current, but documents are exported and read outside the app; that choice is for the documents' writing session
    (D-232), the rewrite stands until then.
    *2 and 22 fixed 2026-11-01:* one resolver, src/agent/read/names.ts (`namedShort`: every letter, with where it goes
    when it has a place; `withNames`: a bare id followed by its name, a titled one, code and unknown ids left). The
    chat draws every short id with its name (a link for cards, pieces, text, tasks, canvases, and links, evidence and
    features through their card; documents, threads and people named, not linked), checked in headless Chrome with an
    answer of bare ids; `create_document`'s text goes through `withNames` in change.ts. docWritten already fails a
    `c12` without its title, so the document tasks guard 22; tests/unit/agentNames.test.ts holds the resolver.
9.  **The skills list (`/`) doesn't scroll with the arrow keys.** ↑/↓ move the pick (SkillMenu.tsx `setAt`) but the
    picked row goes below the list's edge. Fix: `scrollIntoView({ block: 'nearest' })` on the picked row when `at`
    changes. *Fixed 2026-11-01:* that, and with nothing typed the list is now in its drawn order (group by group), so
    ↑↓ step down the rows as seen; before, they followed the ungrouped order and the pick jumped between groups.

## Preview: what the person sees before applying

7.  **On the canvas, a preview of changes inside a piece spills out of it.** With the person on the canvas (not in the
    piece's focus) and changes proposed inside a plane, they show outside the piece, over the canvas, as empty outlines
    (the marks' shells) without a card's face or text. Cause not looked at; likely PreviewMarks.tsx places a thing
    inside a plane by its plane px (or by an element that exists only in focus) without the plane's fitted picture, or
    the picture doesn't draw the previewed workspace. Fix: on the canvas, a change inside a piece is drawn in that
    piece's picture and marked there (or the piece gets one mark, `N changes inside`); nothing outside the piece's box.
    *Fixed 2026-11-01:* reproduced in headless Chrome on the emulators (the dev stub's `preview demo: cards` on the
    Pazar fixture, seen from the canvas). The cause: a plane on the canvas is its fitted picture, its cards a few px,
    and the layer drew every card's mark, chip and moved-from ghost round them (chips below the plane's edge, ghosts
    as empty dashed boxes) and a removed link between two planes as a line across the canvas. Now, while a plane is
    only a picture (not in focus, not beside), what's inside it folds into one mark on the plane: its L's and a chip
    `6 changes inside +3 ~1 ↦1 −1`, each change's words on hover, lit when the stepper is on one of them; a link with
    an end in such a plane folds into it too (PreviewMarks.tsx' `pictureOf`, `folded`). In focus every mark is drawn
    as before. Only planes: decks and tables draw their real contents on the canvas and keep their own marks.
    tests/unit/previewFold.test.ts (happy-dom) holds the rule; no gallery scene yet (the agent's UI isn't in the
    gallery).
3.  **Stepping through a preview doesn't show the one you're on.** Every change is marked as strongly (PreviewMarks.tsx:
    the stepper's item should stand out, the rest go quiet); and on `next`, in a plane's focus, the canvas's marks show
    first before it reaches the item (the stepper's `goTo` in preview.ts, or canvas marks drawn while in focus). Cause
    not looked at.

    *Fixed 2026-11-01:* reproduced in headless Chrome (the `flow` demo, next pressed in Segments' focus, a frame every
    150 ms). The second half's cause: the mark layer's effect ran again on every step (moving the stepper made a new
    preview state), so it forgot which elements it had seen: every added card built in again, and for 500 ms every
    element passed as fresh without the visibility check, the canvas's copy under the focus included (9 extra marks
    at the left edge for ~400 ms). Now the layer runs again only when the marks change, and under a focus nothing in
    the canvas world is marked. The first half: while the stepper is on an item with a mark, every other mark, chip,
    line and ghost goes faint (`--o-faint`); an item with no mark of its own (evidence) leaves them all as they are.
    previewFold.test.ts holds `stepperMarks`.
## Layout: where things go

4.  **It can't lay out a plane in a way that makes sense** (said twice, the second time about arranging an existing
    plane): cards of one type always end up side by side; a flow can't be followed card to card, nor one flow told
    from another; things that belong together aren't grouped. The layouts (src/model/layout.ts: grid, row, column,
    cluster) never look at links, and `cluster` groups by a field (type, tag…), hence same-type cards together.
    Fix (code): a `flow` layout over the link graph: each connected group its own flow, its columns the chain
    (customer → problem → competitor → idea → feature, D-045), space (or a heading or section) between groups; the
    model only picks `flow`, never coordinates. The groups come from the link graph (src/model/graph.ts, not written
    yet), the same module 11's lint, 14's numbers and 27's analysis read, so they never disagree on what's connected. (Built with
    D-327: graph.ts and the `flow` layout.)
    The `/organize` skill is a cause too (src/agent/skills/index.ts): its method says "by type, then by customer or
    theme" and "one arrange with layout cluster", so it asks for exactly what this bug complains of. It is rewritten
    with 27. Fix (prompt): arranging a
    plane groups by links and meaning, not type.
    Eval: linked cards sit near each other.
10. **It can't rearrange the things on a canvas.** Asked to move or tidy the canvas's items, it doesn't, though
    `arrange` (src/ops/arrange.ts) takes a canvas's pieces and text with every layout. Cause not looked at; to check:
    does the model call `arrange` (or say it can't), is it refused (one call can't mix a canvas's pieces with a plane's
    cards: "the items are in more than one space"), do the moves fail to show in the preview, does carrying what's
    stuck to a piece block it. Fix: reproduce it in an eval on a canvas first, then fix what it shows.

## Judgment: prompt and skill methods, measured on the evals

From the first eval run on a real model: `npm run eval -- --model openai:gpt-5.6-terra`, 66/110 (60 %), $4.20, 16 min
(report `evals/results/2026-10-31T20-08-07-655Z/report.md`, gitignored). About a dozen failures were the eval's own,
fixed in 6c9cc13 (big jobs without their `go` turn, a fixture that already held the matrix, a judge that couldn't see
the document, exact-word note checks, an ambiguous yes); the judge's app context came after. Strongest: context 6/6,
injection 5/5; weakest: skills 31/61, build 3/8 (before the eval fixes). The 60 % is not a baseline: rerun first.

15. **It answers lists from the map without querying.** find-02 "competitors in Germany": one step, no tool call, only
    the three cards whose map line says Germany; it missed the nine Europe and global ones that count (D-145). `query`
    does that containment (src/agent/read/tools.ts); the model never asked. find-04 mixed problem and idea counts in a
    plane summary. Fix (code first): the map stops being the trap: its region lines (src/agent/read/lines.ts) read
    "as typed", with one note at its head that a place counts inside the bigger ones and `query region` lists them
    (the note `query` already gives, read/tools.ts). Then, measured, the prompt only if still needed
    (src/agent/prompt.ts, "Finding things"): a list, a count or a which/who question is answered from `query`/`view`,
    never the map alone.
19. **"Check whether this would work" is answered by reading, not a dry run.** edit-12: the count was right (5 tasks),
    but `change` with `dry_run` was never called, so a refusal (a column limit, a locked piece) wouldn't be seen. Fix:
    the prompt names the triggers ("would it work", "check before", "don't change anything yet") → a dry run.
20. **"Clean up the duplicates" ran without asking which.** refuse-02: one step, no question; rule 7 says ask when a
    guess would change data. Fix: the prompt names vague verbs with no target (clean up, tidy, fix, sort out) as "ask
    which first"; the `/dedupe` method's first step lists the pairs and waits.
21. **Skill guides not followed step by step.** Each a small, checkable miss:
    - `/test` didn't set the idea to `testing` (test-01);
    - `/compare` left `rows.plane` empty for "our Roadmap features", left `cols.items` empty when given two competitors,
      made 11 cells for 7 known facts, and scored `partial` where the feature's notes say full (compare-01/02/03);
    - `/prioritize` swapped the deck's axes (impact as columns) and left a feature without impact (prioritize-01/03);
    - `/organize` made 5 headings for 3 regions and put cards in the wrong group (organize-01);
    - `/import` skipped the `for` link to the customer named in the ask (import-01);
    - `/swot` put our own validated cards under threats (swot-01, swot-04);
    - `/sort-stickies` made a problem from a question and skipped a sticky it judged covered by an existing card
      (defensible, but the guide says ideas, sections, the sticky's words).
    Fix (code first): what's checkable becomes a skill's postconditions, written in the skill's own definition beside
    its method (src/agent/skills/), never as special cases inside `lint`; `lint` only runs those of the skills that ran:
    `/test`'s
    idea is `testing`; `/import`'s named customer has a `for` link on each card; `/prioritize`'s deck has impact and
    effort on its own axes and every feature has both; `/compare`'s `rows.plane`/`cols.items` match what was named.
    Fix (methods, what needs judgment): tighten the vague steps in src/agent/skills/methods.ts ("threats are other
    people's things, never ours", "keep the sticky's words", full vs partial from the notes); each guide ends in a
    checklist the run's last look holds the proposal against (12, step 2).
23. **Documents "for a plane" lean on cards elsewhere.** swot-02 "/swot for Pricing", one-pager-02 "on Roadmap",
    next-03 "/next for Pricing": half the cards cited aren't on that plane (linked competitors, problems elsewhere).
    Sometimes right (a SWOT needs the competitors), but one plane was asked about. Fix: "for <plane>" means that
    plane's cards first, others only as context, marked "(on Rivals)". The eval's `onPlane` accepts marked context
    cards (the user, 2026-10-31: a SWOT needs the competitors); an unmarked card from elsewhere still fails.
24. **It points at an existing piece instead of making the one asked for, without saying it could.** build-01 (first
    run): asked for a competitor matrix, it found p11 "Feature coverage" and opened it, without offering a new one.
    Fix: when something like it exists, say so and ask (or offer both); never substitute silently.

## New parts: not bugs in what was built

13. **A big document is imported without a coverage map.** Turning the 77-reference study into the workspace, neither
    it nor the hand import recorded which section went where, so whole sections can drop unnoticed (the hand import
    skipped the journey, segments and jobs; the agent kept them). Fix: before writing, list the document's sections;
    after, each is "went to <piece / cards>" or "left out on purpose, because…"; the list shows in the preview and is
    saved with the run's report. Eval: on a known document, every section accounted for.
14. **It can't weigh one plane against several.** Same comparison: it split the study into five topic planes (easy to
    read, but 16 links across planes, 11); the hand import put all 61 cards on one (every link shows, crowded). Both
    are right sometimes. Fix (code): before placing, compute the topic groups and the share of links between them
    (the link graph, src/model/graph.ts, not written yet, shared with 4, 11 and 27), and give the model the numbers; few cards or tightly linked groups → one plane with headings or sections per topic,
    separate topics with few links → a plane each, a card two topics need placed on both (`places`, D-281) instead of
    linked across. The person's words win. Fix (prompt): the choice is one line in the preview and the report ("one
    plane: 40 of 48 links are between topics"). Evals with both kinds of input: each picked when it should be, no link
    lost.
28. **A big job stops after one preview, so "is it done?" turns up much more.** The user, 2026-10-31: asked
    for something, it says done, the person applies, asks "is it finished?", and it lists a lot still to do. Then
    "do what's next" five to ten times over. It feels like a chat box, not an agent that's part of the app.
    Agreed (D-328); the job and steering built 2026-11-01 (decisions-log D-328 *Built*: what, how checked, not yet).
    Found while building 27's evals: a step can be marked done after its `change` was refused (the stub did; a real
    model may too). *Fixed 2026-11-01:* `progress` done is refused when the step's last `change` this turn was refused
    (the step under way, else the next to do; a dry run doesn't count); skipping with why stays open. Kept in
    tools.ts for the turn, never saved (the job's saved shape is the rules').
    The cause is in the design, not the model: a turn ends in one preview (workflow.ts:
    running → previewing → applied → idle), and nothing carries the job past it. The plan of a big job is only text
    in an answer (prompt.ts, "A big job…"); no state holds its steps, so after an apply nothing knows what's left; the
    model isn't told the apply happened (5); 25 steps a turn (loop.ts `STEP_BUDGET`) push it to a small proposal
    that fits one turn; and nothing defines "done". agent.md §4.10 already plans this (plan → run → "a very big run
    previews per step" → ask → report with what's next); only the first turn of it was built.
    The fix (code, the workflow and a tool):
    - **A job is state, not text.** A `plan` tool writes the job: steps, each with its scope ("Rivals: the 14
      competitors"), what it makes, and how it's checked (its postconditions, 21; `lint`, 12; the coverage map, 13).
      It's kept in the chat's runtime and saved with the chat (a reopened chat goes on), shown in the chat as a checklist
      that updates live (`3/7 · splitting Rivals off`). The person edits it like a plan today (drop a step, reorder,
      a note) before `go`.
    - **Applying goes on.** workflow.ts gets `applied → running` while the job has steps left: after an apply, the next
      step starts by itself with what was applied (5's line) and its own budget, and a step's preview may hold what
      that step made. No "what's next" from the person. They can stop the job at any point (`[stop after this step]`),
      and a discard or a note sends the job back to `asking`, never on silently.
    - **One preview or one per step**, the person's choice at `go`: all steps then one preview (as now, when the
      steps don't build on each other), or one per step (when a later step reads what an earlier one made, e.g. a
      package made, then placed on a second plane). Every change is still previewed and applied by the person
      (D-312); the job only removes the "what's next" turns between.
    - **Done is checked, not said.** The job ends when every step is done (its checks pass) or skipped with a
      reason. The final report lists what's left and why, read from the job's state, not the model's memory.
      "Is it done?" is answered from that state.
    - **No fixed step count** (the user, 2026-10-31: no hard-coded 25). The agent breaks the job into steps itself
      and goes on step by step, the person approving each as it comes, like Claude Code. What bounds it is the
      person: a token or money budget for the job they can see and change while it runs, `[stop]`, and steering.
      `STEP_BUDGET` stays only as a guard against a loop with no progress (the same call again and again), not as the
      size of a job.
    - **Steering while it runs** (the user: "we can't interrupt it while it works"). Today a message sent while it
      runs is dropped (workflow.ts `send` in `running` returns the same state) and the box says `working…`. Like Claude
      Code: the message is queued and handed to the model at the next step boundary, as "the person said, while
      you worked: …"; the model adjusts the plan (the job's state) and goes on, or stops to ask.
    - **Libraries, read 2026-10-31:** the OpenAI Agents SDK (JS) pauses a run on a tool marked `needsApproval` and
      resumes from a saved `RunState`; the Vercel AI SDK has tool approval and a multi-step loop over many providers
      (Q-031); LangGraph.js has `interrupt()` with a checkpointer, built around a server. None gives the job layer
      (a plan as state, steering, approve and go on); all of them would replace loop.ts, which the evals already
      measure. Recommended: keep the loop, copy the patterns (Claude Code's todo list, queued messages, approval per
      step); the AI SDK only as the provider layer, if Q-031 goes that way.
    Evals: big jobs scored on turns from the person until done (target: the plan's `go` and one yes per preview), and
    on what's left when it says done (target: nothing it didn't list). Needs 25 and 5 first.
27. **Organising a plane or canvas never changes its structure.** The user, 2026-10-31: when organising, or changing a
    canvas or plane, the agent should build a structure that makes sense. It should look at what's there and say
    things like "this reads as a flow, show it as one"; "these competitors deserve their own plane, to be studied
    there"; "I've built the main plane, now I'll split it into parts that are easier to follow"; "these cards make a
    package on a sub-plane, and I'll use it on another plane later, because at a wider view it links to other
    things; at the end I put it on the main plane", each only when it's needed.
    Agreed (D-327); phases 1 and 2 built 2026-11-01 (decisions-log D-327 *Built*). What the pictures showed at once,
    cards place_on brings along (parts, members) aren't in a later arrange unless named, so they stayed where they
    landed: *fixed 2026-11-01*, the change result names them (`i3 also brought along (parts and members): c12 "…"`). (A plane has no edge for its content:
    the app fits it into the plane's window, D-186/D-187; nothing is "outside" a plane.)
    Before it: it could only move things: `/organize` is "cluster by type, one arrange" (4). The ops for
    structure exist (`create_piece` plane, `place_on`/`take_off`, `create_package`, sections, headings, `stuck_to`), but
    the agent sees nothing that would tell it when to use them, and no skill uses them together.
    **The user's direction (2026-10-31): no hard-coded rules.** The agent should understand the system and what we are
    trying to do: the app is a visualization for people; models already read hundreds of lines of text well, and the
    agent has to be good at visualization. So the list of moves below is not a rule table: it becomes what each
    element *means* to a person looking at it, and the agent decides. Three things carry that, none of them rules:
    - **Purpose and meaning in the prompt:** what North Star is for (thinking a startup through, seen), what each
      element says to the eye (a plane: one question to think about; nearness: these belong together; a section or
      package: one unit; a flow: an order of reasoning; a main plane with detail planes: overview, then detail), and a
      few visualization principles the model already knows, named so it uses them (overview first, zoom and filter,
      details on demand; Gestalt proximity, common region, connectedness; space itself carries meaning). Before it
      changes anything, it says what it reads the plane as and what question a person brings to it.
    - **Eyes:** today it reads text only (map, `view`). A `look` tool gives it a picture: a schematic of a plane or
      canvas (cards as boxes in their type's colour, links, sections, packages, names), also of the *proposed* state,
      so it looks at its own proposal before the person does. The tldraw agent kit does the same: a screenshot for the
      rough layout, the shapes' records for the exact facts. Pictures alone give confident, generic critique (what we
      read), so the picture goes with the numbers below and `lint`.
    - **Taste from examples, not rules:** planes the user made or liked (the hand import of the study) as reference
      pictures with a line on why each works; evals judged on before and after pictures ("can a person follow the
      flow, find the topic"), not on which move was used.
    What follows is perception, not rules: code measures what the eye or the model can't count cheaply, the model
    decides.
    - **The facts, in code (a read tool, `structure`, on the link graph).** For a plane or a canvas: its connected
      groups and their sizes; chains that follow the type order (customer → problem → … → feature, D-045), which are
      flows; hubs (a card many groups link to); links between groups (few: a split costs little; many: keep them
      together); links no plane draws (11); cards on several planes; crowding (cards per plane area, items outside the
      plane); packages and what links to them from outside. Numbers, never a verdict.
    - **The moves, as examples of what a structure can say** (in the prompt's meaning section, never as triggers): *flow* (4's layout) when a group
      is a chain; *sections/headings* when groups are tightly linked; *a plane of its own* when a group has few links
      out (its bridge cards placed on both planes, D-281, never links across); *a package* when cards always go
      together and are used in more than one place, made on its plane and placed on the others; *a main plane* holding
      the overview (packages folded, the hubs) with the detail planes stuck beside it; *merge* when two planes share most
      of their links. Each move proposed with its reason and its numbers ("Rivals: 14 cards, 2 links to the rest").
    - **A `/restructure` skill (and `/organize` rewritten on it):** read `structure` → diagnose in a few lines → propose
      a target structure as a job (28), one step per move, in an order that builds (main plane, then splits, then
      packages, then placing them back) → the person picks moves → run. Not done: it works on what the person
      asked about (a plane, a canvas), never the whole workspace unasked. Nothing is deleted; cards move with
      `places`, so no link is lost.
    Postconditions (21): no link lost or undrawable, every card still on some plane, no overlaps, each moved group
    reachable from the main plane. Evals: a messy plane with two clear topics (split), one chain (flow), a cluster used
    twice (package placed on two planes); scored on the structure, not the words.
    To check before building: whether a package can be placed on several planes with its members (`place_on` takes
    cards; a package is one), and whether `stuck_to` between planes is what "a main plane with detail planes beside
    it" should use.
    Needs 4's layout, the link graph, 14's numbers (14 becomes this tool's first output) and 28 (a structure is a
    multi-step job).
8.  **It has no web access, so it can't do research.** agent.md plans it for Phase 9 (`web_search` and `research`, a
    `[web]` switch off by default per D-076, deep research writing a cited document; the `/research` skill waits for it,
    §4.10). The person hit it in real use. Fix: OpenAI's web search tool behind `[web]` first, then `research` writing
    a cited document. After the guards and plumbing: a new surface while the base is at 60 % adds noise to every eval.
