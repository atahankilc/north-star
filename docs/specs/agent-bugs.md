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
