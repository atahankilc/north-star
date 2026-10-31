# Agent bugs

What trying the agent (D-312) turned up, 2026-10-31: 1–10 the user in the app, 11–14 its import of the Founder
Discovery Study set against the hand-made one, 15–24 the first eval run on a real model, 25 a review of this list
(the same day). None fixed yet. A fixed one
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

## Triage

Severity: **high** loses or changes data without a clear yes, or makes the person distrust what they see; **mid** a
wrong or weak result the person has to fix; **low** an annoyance. Layer: where the fix goes.

| #  | What                                             | Group        | Severity | Layer            | Status |
|----|--------------------------------------------------|--------------|----------|------------------|--------|
| 17 | `go` taken as yes to a delete                    | Guards       | mid      | code (preview)   | open   |
| 18 | a viewer's agent calls `change`                  | Guards       | low      | code             | open   |
| 16 | ops nobody asked for                             | Guards       | mid      | code + prompt    | open   |
| 6  | items land on top of each other                  | Guards       | mid      | code             | open   |
| 11 | links no plane can draw                          | Guards       | mid      | code (`lint`)    | open   |
| 12 | no last look before the preview                  | Guards       | mid      | code, then model | open   |
| 25 | evals build their store apart from the app's     | Plumbing     | high     | code (evals)     | open   |
| 1  | document text never loaded                       | Plumbing     | high     | code             | open   |
| 5  | an apply is never told to the model              | Plumbing     | mid      | code             | open   |
| 2  | bare short ids in the chat                       | Plumbing     | mid      | code             | open   |
| 22 | bare ids in documents                            | Plumbing     | mid      | code             | open   |
| 9  | skills list doesn't scroll                       | Plumbing     | low      | code             | open   |
| 7  | preview inside a piece spills onto the canvas    | Preview      | high     | code             | open   |
| 3  | the stepper's item doesn't stand out             | Preview      | mid      | code             | open   |
| 4  | plane layouts ignore links                       | Layout       | high     | code + prompt    | open   |
| 10 | can't rearrange a canvas                         | Layout       | mid      | unknown (repro)  | open   |
| 15 | lists answered from the map                      | Judgment     | mid      | code, then prompt| open   |
| 19 | "would it work" not dry-run                      | Judgment     | low      | prompt           | open   |
| 20 | vague verb run without asking                    | Judgment     | mid      | prompt           | open   |
| 21 | skill guides not followed step by step           | Judgment     | mid      | code + methods   | open   |
| 23 | "for a plane" leans on other planes              | Judgment     | low      | methods          | open   |
| 24 | points at an existing piece instead of making it | Judgment     | low      | prompt           | open   |
| 13 | no coverage map for a big document               | New parts    | mid      | new              | open   |
| 14 | one plane or several, never weighed              | New parts    | mid      | code + prompt    | open   |
| 8  | no web access                                    | New parts    | mid      | new (Phase 9)    | open   |

## Order

0. **25 first**: the evals lie until the store they run on is the app's (bodies there, applies told), and fixing it
   changes the harness, so a baseline taken before it can't be compared with anything after. No baseline before 25.
1. **Baseline**: the eval run three times on two models (gpt-5.6-terra and a cheaper one; the person picks the
   model, D-312, so a prompt tuned on one can overfit to it), to know the spread per case, not only the total; every
   step below is measured against it, guards and plumbing too. Then **plumbing** 1, 5 (failing in the evals first
   now), then 2, 9: no design needed.
2. **Guards** 17, 18, 16, 22's rewrite: small.
3. **`lint`** (6, 11, the checkable half of 12, 21's postconditions): one function, run at the end of every writing
   run. 6 gets its failing eval first.
4. **Link graph** (`src/model/graph.ts`, one module for 4, 11 and 14): the connected groups of a plane's cards and the
   share of links between them. Then **layout** 4 (the `flow` layout on it), and 10 reproduced in an eval before
   anything is changed.
5. **Judgment**: 15's map fix (code) first, then baseline again and the prompt and method changes 15, 19, 20, 21's
   methods, 23, 24, each measured.
6. **New parts** 13, 14 (on the link graph), 8.

**Preview** 7, 3 run beside all this, from the start: no eval measures them, so they wait on nothing, and 7 is high
(the person distrusts what they see). Before the agent's UI design session, not in it.

---

## Guards: what code must refuse or warn about

17. **A question in the plan turn, then `go` taken as its yes.** build-02 (second run): instead of a plan it asked
    "shall I remove the stickies?", the person said `go`, and it deleted x13 and x14, a delete with no clear yes
    (rule 5). It also renamed the ideas ("Own the stall data" for "Who owns the stall data?").
    Severity mid, not high: every change waits in the preview and an apply is one undo step (D-312), so nothing is lost
    before the person applies. The real risk is a delete missed in the preview.
    Fix (code, preview): deletes drawn apart in the preview (their own mark and a `N deleted` line) and named on the
    apply button (`apply · 2 deletes`), always, whatever was said. No reading of the person's words, neither the last
    message's (`go`/`ok`/`yes`: "sounds good" or "tamam, devam" passes any such list) nor whether a message "named" the
    thing (does "remove the stickies" name x13?): any such match is a guess, and a guess on deletes is the bug itself.
    Fix (prompt, small): a plan proposes the safe version (keep what's there) and offers a delete as an option; turning
    text into cards keeps its words.
18. **A viewer's agent still calls `change`.** refuse-03: the tool refused it and the answer was right, but it
    shouldn't try. Fix (code): drop `change` from the tool list for a viewer (src/agent/tools.ts). Nothing in the prompt.
16. **It adds ops nobody asked for.** edit-09/edit-13 "add three ideas": three `create_card`s plus an `arrange` of them,
    so the preview has 4 items for 3 asked, and unticking one leaves an arrange of the rest. Same family: prioritize-03
    changed 14 features' impact/effort when asked only to fill the deck; learn-03 made a problem and a link from notes
    meant as evidence; dedupe-01 renamed and moved a third card.
    Fix (code): `change` folds an `arrange` whose items were all made in the same call into those ops' own `where`
    (a rewrite, not a refusal, so no turn is lost) and returns a warning saying so; the preview then holds 3 items for
    3 asked. Fix (prompt, "Changing things"): do only what was asked; anything more is offered in the answer, not
    proposed.
6.  **Things it puts on a canvas or plane often land on top of each other, paragraphs most.** Not reproduced yet.
    Not raw coordinates: `change` already refuses x/y from the agent (src/agent/change.ts, NO_COORDS), though
    `create_text` itself still takes them for the UI. Likely causes: a paragraph's height is guessed by `labelBox`
    (src/model/labelBox.ts) from its text, and long or Markdown text draws taller; text made earlier in the same batch
    may not count as taken; `where: { near }` / `{ in_section }` may place without checking what's there. Fix (code):
    paragraphs measured like `sizes.ts` does; the batch's own items count as taken; `near`/`in_section` land on a
    clear spot. Eval first (it fails on any overlap), written before the fix so it shows which cause it is.
11. **Links between cards on different planes are never shown, and it doesn't know.** In its import of the Founder
    Discovery Study (the `north-star` canvas in the user's Granat export), 16 of 48 links join cards on two planes, so
    no plane draws them (D-207). `validate` (src/ops/validate.ts) checks both ends exist, not that they share a plane.
    Fix (code, `lint`): a warning the model sees, with the two ways out: place the other card on this plane too
    (`places`, D-281), or put both on one plane. It reads the link graph (src/model/graph.ts, shared with 4 and 14).
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
    Fix (code): one store builder, the one `liveWs()` uses (src/agent/ui/agentStore.ts), fed by the eval fixture
    instead of the live workspace, bodies fetched through the same path; apply, discard and undo go through the same
    history code in both. Comes before 1 and 5, which then fail in the evals first and are fixed against them.
1.  **It can't read a document's text in the app.** `liveWs()` (src/agent/ui/agentStore.ts) puts only the agent notes
    in `bodies`; documents' `content/body` is never fetched, so `read_document` answers "its text isn't loaded here"
    with the excerpt. The evals pass because their store holds bodies. Fix: fetch a body (through `src/data/`) when
    `read_document`/`get` asks for one, keep it in `bodies`.
5.  **After an apply, asked "what's next", it still says "approve the proposed canvas and…".** Likely never told: the
    `report` effect (agentStore.ts) pushes a chat entry for the UI, nothing into the model's history. Fix: an apply, a
    discard or an undo adds a line to the history (what was kept, what not).
2.  **Its answers show bare short ids** (`[d1]`, `k3`) the person can't read. The prompt asks for `c12 "title"` but the
    model drops the title, and the chat links only `c p t x d` (Agent.tsx `CITE`). Fix: the chat writes every short id
    as the item's name, every letter (k canvas, u person, e link, v, f, m) clickable. No prompt change needed.
22. **Documents cite ids without the card's title.** pitch-01/02, lean-canvas-01, interview-02, swot-04: good documents,
    but lines like "linked to c32, c29, c25, c33", unreadable outside the agent (2, inside documents). Fix (code):
    `create_document` rewrites a bare `cN` into `cN "title"` itself. Its limit: the title is frozen at writing, so a
    renamed card leaves the document on its old name. A reference resolved when the document is drawn would stay
    current, but documents are exported and read outside the app; that choice is for the documents' writing session
    (D-232), the rewrite stands until then.
9.  **The skills list (`/`) doesn't scroll with the arrow keys.** ↑/↓ move the pick (SkillMenu.tsx `setAt`) but the
    picked row goes below the list's edge. Fix: `scrollIntoView({ block: 'nearest' })` on the picked row when `at`
    changes.

## Preview: what the person sees before applying

7.  **On the canvas, a preview of changes inside a piece spills out of it.** With the person on the canvas (not in the
    piece's focus) and changes proposed inside a plane, they show outside the piece, over the canvas, as empty outlines
    (the marks' shells) without a card's face or text. Cause not looked at; likely PreviewMarks.tsx places a thing
    inside a plane by its plane px (or by an element that exists only in focus) without the plane's fitted picture, or
    the picture doesn't draw the previewed workspace. Fix: on the canvas, a change inside a piece is drawn in that
    piece's picture and marked there (or the piece gets one mark, `N changes inside`); nothing outside the piece's box.
3.  **Stepping through a preview doesn't show the one you're on.** Every change is marked as strongly (PreviewMarks.tsx:
    the stepper's item should stand out, the rest go quiet); and on `next`, in a plane's focus, the canvas's marks show
    first before it reaches the item (the stepper's `goTo` in preview.ts, or canvas marks drawn while in focus). Cause
    not looked at.

## Layout: where things go

4.  **It can't lay out a plane in a way that makes sense** (said twice, the second time about arranging an existing
    plane): cards of one type always end up side by side; a flow can't be followed card to card, nor one flow told
    from another; things that belong together aren't grouped. The layouts (src/model/layout.ts: grid, row, column,
    cluster) never look at links, and `cluster` groups by a field (type, tag…), hence same-type cards together.
    Fix (code): a `flow` layout over the link graph: each connected group its own flow, its columns the chain
    (customer → problem → competitor → idea → feature, D-045), space (or a heading or section) between groups; the
    model only picks `flow`, never coordinates. The groups come from the link graph (src/model/graph.ts), the same
    module 11's lint and 14's numbers read, so the three never disagree on what's connected. Fix (prompt): arranging a
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
    (the link graph, src/model/graph.ts, shared with 4 and 11), and give the model the numbers; few cards or tightly linked groups → one plane with headings or sections per topic,
    separate topics with few links → a plane each, a card two topics need placed on both (`places`, D-281) instead of
    linked across. The person's words win. Fix (prompt): the choice is one line in the preview and the report ("one
    plane: 40 of 48 links are between topics"). Evals with both kinds of input: each picked when it should be, no link
    lost.
8.  **It has no web access, so it can't do research.** agent.md plans it for Phase 9 (`web_search` and `research`, a
    `[web]` switch off by default per D-076, deep research writing a cited document; the `/research` skill waits for it,
    §4.10). The person hit it in real use. Fix: OpenAI's web search tool behind `[web]` first, then `research` writing
    a cited document. After the guards and plumbing: a new surface while the base is at 60 % adds noise to every eval.
