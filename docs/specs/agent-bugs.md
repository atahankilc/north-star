# Agent bugs

Found by the user trying the agent (D-312) in the app, 2026-10-31. Not fixed yet. A fixed one moves to
`memory-bank/state-history.md` with how it was checked.

1. **It can't read a document's text in the app.** `liveWs()` (src/agent/ui/agentStore.ts) puts only the agent notes
   in `bodies`; documents' `content/body` is never fetched, so `read_document` answers "its text isn't loaded here"
   with the excerpt. The evals pass because their store holds bodies. Fix: fetch a body (through `src/data/`) when
   `read_document`/`get` asks for one, keep it in `bodies`.
2. **Its answers show bare short ids** (`[d1]`, `k3`) the person can't read. The prompt asks for `c12 "title"` but the
   model drops the title, and the chat links only `c p t x d` (Agent.tsx `CITE`). Fix: the chat writes every short id
   as the item's name, all letters (k canvas, u person, e link, v, f, m) clickable.
3. **Stepping through a preview's changes doesn't show the one you're on.** Every change is marked as strongly, so the
   current item can't be told apart (PreviewMarks.tsx: the stepper's item should stand out, the rest go quiet); and on
   `next`, while in a plane's focus, the canvas's change marks show first before it reaches the item (the stepper's
   `goTo` in preview.ts, or the marks drawn for the canvas while still in focus). Cause not looked at yet.
4. **It can't lay out a plane's items in a way that makes sense** (said twice, the second time about arranging a plane,
   not only a proposed one): cards of the same type always end up side by side; where there's a flow, you can't tell
   it from card to card, nor one flow apart from another; things that belong together aren't grouped. The layouts
   (src/model/layout.ts: grid, row, column, cluster) never look at links ("no link-ordering"), and `cluster` groups
   by a field (type, tag…), which is why same-type cards sit together. Fix: a flow layout that follows the chain
   (customer → problem → competitor → idea → feature, D-045) along the links, each connected group its own flow with
   space (or a heading, or a section round it) between groups; the prompt tells the model to group by links and
   meaning, not by type, when it arranges a plane; an eval that checks linked cards sit near each other.
5. **After the person applies a preview and asks "what's next", it still says "approve the proposed canvas and…".**
   Likely the model is never told: the `report` effect (agentStore.ts) only pushes a chat entry for the UI, nothing
   into the model's history. Fix: an apply (and a discard or undo) adds a line to the history (what was kept, what not).
6. **Things it puts on a canvas or plane often land on top of each other, paragraphs most.** Not checked yet; likely
   causes: `create_text` takes `where: { x, y }` as given, with no check against what's there (src/ops/text.ts), though
   layout.ts says the model never picks coordinates; a paragraph's height is guessed by `labelBox` (src/model/labelBox.ts)
   from its text, and long or Markdown text draws taller than the guess; text made earlier in the same batch may not be
   counted as taken. Fix: refuse or move raw x/y onto a clear spot, measure paragraphs like `sizes.ts` does, count the
   batch's own text; an eval that fails on any overlap.
7. **On the canvas, a preview of changes inside a piece spills out of it.** Seen with the person on the canvas (not in
   the piece's focus) and the agent proposing things inside a piece (a plane): the proposals show outside the piece,
   over the canvas, and only as empty outlines (their marks, the "shells"); what's inside them (a card's face, text)
   doesn't show. Cause not looked at yet; likely PreviewMarks.tsx places a thing inside a plane by its plane px (or by
   an element that only exists in focus) without the plane's fitted picture on the canvas, or the picture doesn't draw
   the previewed workspace. Fix: on the canvas, a change inside a piece is drawn in that piece's picture and marked
   there (or the piece gets one mark, `N changes inside`); nothing outside the piece's box.
8. **It has no web access, so it can't do research.** Not a bug in what was built but a missing part: agent.md plans
   it for Phase 9 (`web_search` and `research` tools, a `[web]` switch off by default per D-076, deep research writing a
   cited document; the `/research` skill waits for it, §4.10). The person hit it in real use, so it matters sooner than
   planned. Fix: OpenAI's web search tool behind the `[web]` switch first, then `research` writing a cited document.
9. **The skills list (`/`) doesn't scroll with the arrow keys.** ↑/↓ move the pick (SkillMenu.tsx `setAt`) but nothing
   scrolls the picked row into view, so it goes below the list's edge. Fix: `scrollIntoView({ block: 'nearest' })` on
   the picked row when `at` changes.
10. **It can't rearrange the things on a canvas.** Asked to move or tidy the canvas's items, it doesn't. The code says it
    should: `arrange` (src/ops/arrange.ts) takes a canvas's pieces and text, with every layout. Cause not looked at yet;
    to check: does the model call `arrange` at all (or say it can't), is it refused (one call can't mix a canvas's
    pieces with a plane's cards: "the items are in more than one space"), do the moves fail to show in the preview, or
    does carrying what's stuck to a piece block it. Fix: reproduce it in an eval on a canvas first, then fix what it shows.
11. **Links it draws between cards on different planes are never shown, and it doesn't know.** Found comparing its
    import of the Founder Discovery Study (the `north-star` canvas in the user's Granat export, 2026-10-31) with the
    same study imported by hand: 16 of its 48 links join cards on two different planes, so no plane draws them (a link
    shows only where both cards are on the plane, D-207). `validate` (src/ops/validate.ts) checks that both ends
    exist, not that they share a plane. Fix: `validate` reports such a link as a warning the model sees, with two ways
    out: place the other card on this plane too (`places`, D-281), or put the two on one plane; an eval that fails on
    any link no plane can draw.
12. **It never checks its own work before the preview.** The same import shows what a last look would have caught:
    competitors with only `notes` (no url, pricing, audience), evidence without URLs, tasks tied to no card, tables
    whose rows are typed names repeating cards that exist (the rows go stale when a card changes), no tags, and planes
    of 960 × 600 holding items out to 1400 × 2475. `/gaps` finds some of this but only when asked. Fix: a critic step
    at the end of every writing run, before the preview: empty fields, links no plane draws (11), cardless tasks, table
    rows that could be cards (by the table's rules), items outside or crowding their plane; what it finds it fixes or
    lists in the report.
13. **A big document is imported without a coverage map.** Turning a long document (the 77-reference study) into the
    workspace, neither it nor the hand-made import kept a record of which section went where, so whole sections can be
    dropped unnoticed (the hand import skipped the journey, segments and jobs; the agent kept them). Fix: before writing,
    list the document's sections; after, each section is either "went to <piece / cards>" or "left out on purpose,
    because…"; the list shows in the preview and is saved with the run's report; an eval on a known document checks
    every section is accounted for.
14. **It can't weigh one plane against several.** Same comparison: it split the study into five topic planes (easy to
    read, but 16 links ended up across planes, 11), the hand import put all 61 cards on one plane (every link shows, but
    crowded). Both are right sometimes; it should choose, and say why. Fix: before placing, the model looks at the
    groups the cards fall into and the links between them: few cards, or groups linked tightly to each other → one plane
    (with headings or sections per topic); separate topics with few links between them → a plane each, and a card two
    topics need is placed on both (`places`, D-281) instead of linked across; the person's words win when they say
    which. The choice is one line in the preview and the report ("one plane: 40 of 48 links are between topics"). Evals
    with both kinds of input check it picks each when it should, and that no link is lost either way.

## From the first eval run on a real model (gpt-5.6-terra, 2026-10-31)

`npm run eval -- --model openai:gpt-5.6-terra`: 66/110 (60 %), $4.20, 16 min (report
`evals/results/2026-10-31T20-08-07-655Z/report.md`, gitignored). About a dozen failures were the eval's own bugs, fixed
in 6c9cc13 (big jobs without their `go` turn, a fixture that already held the matrix, a judge that couldn't see the
document, exact-word note checks, an ambiguous yes); the judge's app context after it is uncommitted. What's left is
the agent. Strongest groups: context 6/6, injection 5/5; weakest: skills 31/61, build 3/8 (before the eval fixes).

15. **It answers lists from the map without querying.** find-02 "competitors in Germany": one step, no tool call, only
    the three cards whose map line says Germany; it missed the nine Europe and global ones that count for Germany
    (D-145). `query` already does that containment (src/agent/read/tools.ts), the model never asked. find-04 also
    mixed problem and idea counts in a plane summary. Fix: the prompt (src/agent/prompt.ts, "Finding things") says a
    list, a count or a "which/who" question is answered from `query`/`view`, never from the map alone (the map is an
    index, not the answer); the map's region lines could say "regions as typed; query counts the bigger ones".
16. **It adds ops nobody asked for.** edit-09/edit-13 "add three ideas": three `create_card`s plus an `arrange` of them,
    so the preview has 4 items for 3 asked, and unticking one leaves an arrange of the rest. Same family: prioritize-03
    changed 14 features' impact/effort when asked only to fill the deck; learn-03 made a problem and a link from notes
    meant as evidence; dedupe-01 renamed and moved a third card. Fix: the prompt's "Changing things": do only what was
    asked; placement goes in the op's own `where`, not a separate `arrange`; anything more is offered in the answer, not
    proposed. Maybe `change` warns when an `arrange` only moves things the same call just made.
17. **A question in the plan turn, then `go` taken as its yes.** build-02 (second run): instead of a plan it asked
    "shall I remove the stickies?", the person said `go`, and it deleted x13 and x14, a delete with no clear yes (rule 5).
    It also renamed the ideas ("Own the stall data" for "Who owns the stall data?"). Fix: the prompt says a plan proposes
    the safe version (keep what's there) and lists a delete as an option the person must name; `go` approves the plan,
    never a delete; when turning text into cards, keep its words. Maybe `change` refuses a delete when the last person
    message is only `go`/`ok`.
18. **A viewer's agent still calls `change`.** refuse-03: the tool refused it and the answer was right, but the prompt
    says no `change` call as a viewer. Fix: tell the model the person's role in the "where you are" block every turn
    (not only in the system prompt), or drop `change` from the tool list for a viewer (src/agent/tools.ts), so it can't.
19. **"Check whether this would work" is answered by reading, not a dry run.** edit-12: the count was right (5 tasks),
    but `change` with `dry_run` was never called, so a refusal (a column limit, a locked piece) wouldn't have been
    seen. Fix: the prompt names the trigger: "would it work", "check before", "don't change anything yet" → a dry run.
20. **"Clean up the duplicates" ran without asking which.** refuse-02: one step, no question. Rule 7 says ask when a
    guess would change data. Fix: name the vague verbs in the prompt (clean up, tidy, fix, sort out) with no target as
    "ask which first"; or the `/dedupe` method's first step lists the pairs and waits.
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
    Fix: tighten the methods in src/agent/skills/methods.ts where they're vague (axes spelled out with the field names,
    "threats are other people's things, never ours", "for <customer> means a `for` link on each", "keep the sticky's
    words"); a skill's last step re-reads its guide's checklist against what it proposed (ties in with 12).
22. **Documents cite ids without the card's title on the line.** pitch-01/02, lean-canvas-01, interview-02, swot-04:
    good documents, but lines like "linked to c32, c29, c25, c33" name cards by bare id, unreadable once the document
    is read outside the agent (same as 2, inside documents). Fix: the document skills' guides say every card is
    `c12 "title"`, never a bare id; or `create_document` rewrites a bare `cN` into `cN "title"` itself.
23. **Documents "for a plane" lean on cards elsewhere.** swot-02 "/swot for Pricing", one-pager-02 "on Roadmap",
    next-03 "/next for Pricing": half the cards cited aren't on that plane (linked competitors, problems on other
    planes). Sometimes right (a SWOT needs the competitors), but the person asked about one plane. Fix: the guide says
    "for <plane>" means that plane's cards first; others only as context, marked "(on Rivals)". Open: whether the
    eval's `onPlane` should allow linked cards; decide with the user.
24. **It points at an existing piece instead of making the one asked for, without saying it could.** build-01 (first
    run): asked for a competitor matrix, it found p11 "Feature coverage" and opened it. Reasonable, but it didn't offer
    to make a new one. Fix: when something like it exists, say so and ask (or offer both), don't silently substitute.
