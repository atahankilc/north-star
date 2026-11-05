# Writing together (D-374)

Several people write in the same document at once, as in Google Docs: what each types merges with what the others type,
nothing is lost, and everyone sees where the others are (a caret in their colour with their name, their selection
shaded). Built on D-373's editor (DocEditor, Tiptap 3). **Built 2026-11-05** (steps 1–4 below; where it differs from
the plan, it says so).

## How

- **Yjs** (MIT, a library, not a service: no account, no server, no fees) holds the text while it's written. It merges
  changes in any order to the same result on every screen, so no server has to put them in order (Google Docs has one;
  we have none). Tiptap's own open-source extensions tie it to the editor: `@tiptap/extension-collaboration` (the text)
  and `@tiptap/extension-collaboration-caret` (others' carets), over `@tiptap/y-tiptap`, `yjs`, `y-protocols`. Never
  Tiptap Cloud or Hocuspocus (a paid service, a server).
- **The channel is Firestore for now**: each writer's changes go as small packets under the document; the others get
  them through a listener (~0.2–0.5 s). The rules that say who writes (D-373's `mayWrite`) guard the packets too.
- **Carets go through presence** (RTDB, the channel cursors already use): only positions, never text.
- **Markdown stays the document**: the body's `text` is written again from the shared text on a pause, so the reader,
  the agent, export, download and the finder read it as today. Dropping Yjs one day loses only writing together.
- **Once Blaze is on**, the channel moves to RTDB (~0.05–0.1 s, Google Docs' speed): a Cloud Function mirrors each
  workspace's roles to RTDB so its rules can check who writes. The transport is one file behind an interface
  (`listenState`, `listen`, `send`, `seed`, `compact`; `src/data/liveText.ts`' `LiveTransport`), so nothing else
  changes. `liveMemory.ts` is the same interface in memory, for the unit tests and the gallery.
- Only free text gets this. Cards, links, tables, cells, tasks, pieces and short fields stay last write wins per field
  (D-071): rules can't read inside a Yjs packet, and the agent, undo and export work on today's shapes.

## Data

Under each document (`workspaces/{wid}/documents/{id}`):

- `edits/{eid}`: a packet: `{ u: Bytes (a Yjs update, ≤ 64 KB), by: uid, at: serverTimestamp }`. Created, never
  updated; deleted only by a compaction or with the document.
- `live/state`: everything folded so far: `{ s: Bytes (Y.encodeStateAsUpdate, ≤ 900 KB), v: int, at }`. `v` counts
  compactions.
- `content/body.text`: the Markdown, as today.

The Y.Doc holds one `XmlFragment` (`default`), what Tiptap's Collaboration extension writes.

## The provider (`src/data/liveText.ts`)

Generic (a collection of packets and a state doc), so paragraphs, sticky notes and card notes can use it later.

1. **Open**: listen to `live/state` and to `edits`, apply both to a fresh Y.Doc as they come (`origin: 'remote'`). The
   state is listened to, not read once: every compaction's new state is applied too, so a packet deleted by someone
   else's fold before this tab read it is never missed. Applying twice is harmless (Yjs ignores what it has); own packets are known
   by their ids and skipped.
2. **Seed**: no `live/state` yet (a document written before D-374, or a new one): in a Firestore **transaction**,
   create `live/state` from the Markdown body (parsed by Tiptap into the fragment, encoded) only if it's still absent.
   Two people opening at once: one seeds, the other's transaction finds the state and loads it (two seeds would double
   the text). The editor stays read-only until open or seed has finished.
3. **Send**: local changes (`origin` ≠ remote) are gathered and sent as one packet every ~200 ms
   (`Y.mergeUpdates`). A change over 64 KB (a big paste) can't be split (a Yjs update isn't cut anywhere), so it goes
   straight into the state by a compaction instead; offline that fails and is tried again with the next change. Offline, Firestore queues them; coming back, they go and merge.
4. **Compact**: past ~200 packets or ~300 KB, the writer who sees it folds: in a transaction, read `live/state`, write
   `s = Y.mergeUpdates([old s, own Y.encodeStateAsUpdate])`, `v + 1`, and delete only the packets this tab has already
   applied (≤ 400 per batch). Merging with the old state, not overwriting it, keeps what another compactor folded.
5. **Markdown**: on a 2 s pause after a change (and on leaving, a hidden tab, closing), the writer writes `body.text` and
   the summary's counts (D-373's `writeDocumentText` minus `tracked`: undo is Yjs's own now, see below). Everyone's text
   is the same after merging, so whoever writes last writes the same thing.
6. **Close**: flush, stop listening, destroy the Y.Doc.

## The editor

- DocEditor gets `live?: LiveText`. With it: StarterKit's `undoRedo: false`, `Collaboration.configure({ document })`,
  `CollaborationCaret.configure({ provider: { awareness }, user: { name, color } })`; no `content`, no `setContent`
  from outside (D-373's "theirs wait while you type" goes away).
- **Undo is yours only**: Yjs's UndoManager (what Collaboration brings) undoes this person's changes, never someone
  else's. The workspace's ⌘Z (tracked) no longer holds document text; `write a document` steps go, `newDocument` stays
  one step (making it).
- **Carets**: `presence/{wid}/{uid}.doc = { id, a, h }` (the document, anchor and head as base64 Yjs relative positions,
  ≤ 300 characters), sent at most 10 a second like the cursor, cleared on `done`, close and leaving. A small adapter
  turns the presence of people with `doc.id` = this document into a y-protocols `Awareness` the caret extension reads
  (name, colour from `themeAccent` as cursors, D-067). Away people (D-331): no caret.
- **Who's here**: the reader's head shows the squares of the people writing in it (PeopleHere's look, `Avatar`), as a
  plane's console does.
- Reading (not editing), the page follows the body as it's written (the 2 s Markdown), nothing more.

## Rules

- firestore.rules, under `documents/{id}`:
  - `edits/{eid}`: read if `mayRead(summary())`; create if `mayWrite(summary())`, keys `u, by, at` only, `by ==
    request.auth.uid`, `u is bytes && u.size() <= 65536`, `at == request.time`; no update; delete if `mayWrite` or
    `mayDelete(summary())` (compaction, the document's delete).
  - `live/state`: read if `mayRead`; create and update if `mayWrite`, keys `s, v, at`, `s.size() <= 921600`, `v` up by
    one on update; delete if `mayDelete`.
- database.rules.json: `presence/$wid/$uid/doc` with `id` (≤ 128), `a`, `h` (strings ≤ 300); nothing else.
- `deleteDocument` and `deleteWorkspace` take `edits` and `live` too (batches, as bodies are), and the rules tests
  cover all of it (author, owner, editor, viewer, outsider; sizes; `by` someone else; a state's `v` going back).

## Steps (built 2026-11-05)

1. **Provider and rules**: `liveText.ts` (open, seed, send, listen, compact, close) behind the transport interface;
   the rules above; rules tests; unit tests on two in-memory Y.Docs through a fake transport (orders, duplicates, a
   compaction racing a packet, a seed race).
2. **Editor**: Collaboration and carets in DocEditor, the presence `doc` field, the people writing in the reader's head,
   Markdown on a pause; DocReader passes `live` when it edits. Gallery: a state with two others' carets (a fake
   awareness).
3. **Checked**, headless on the emulators, two browsers (Alice owner, Bob editor) on one document: both typing in the
   same paragraph at once, then the same word; carets and selections seen; Bob offline for a while, typing, back; 300
   edits (a compaction) and a reload; both opening a document written before D-374 at once (one seed); a viewer reading
   while they write; undo taking only your own change; delete takes `edits` and `live`. Light and dark.
4. **Then**: the documents lesson's `Write one` page says others write with you (`v` bumped); DESIGN.md's carets;
   documents.md; deploy firestore:rules and database after asking.

Checked: rules tests 696/0 (45 new); unit tests 1075/1075 (`tests/unit/liveText.test.ts`); headless on the emulators,
three Chromes (Alice owner, Bob editor, Carol viewer), 23/23: every item of step 3, plus moving the reader to another
document while writing (it opened the first one's text and would seed the second with it: fixed, one reader per
document) and undoing a delete (the text back, seeded again from the Markdown).

## Not in this plan

- Paragraphs, sticky notes, card and task notes written together (the same provider later, each with its own rule).
- RTDB as the channel (Blaze).
- Comments on a selection, suggestions, version history.
