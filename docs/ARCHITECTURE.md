# North Star: Architecture

> **D-177, D-248:** since 1.5 (on `main` since 2026-10-27) the 1.0 code (board, views, assistant, their data layer) is deleted
> (in git at `493bf87`), and no 1.0 data shape is supported: only old reports are moved to documents. Live: auth,
> workspaces, members, presence, settings, export/import and the canvas with its pieces. §8's assistant describes 1.0,
> for when it comes back as a piece; its server side (`functions/`) is kept.

Status: **accepted** unless marked. Items marked ⏳ wait on a decision in
[../memory-bank/open-questions.md](../memory-bank/open-questions.md).
Accepted decisions are listed in [../memory-bank/decisions.md](../memory-bank/decisions.md), in full in `decisions-log.md`.

## 1. Constraints

- The frontend is a **static SPA on GitHub Pages**: free, with no server we run.
- There is **no self-run backend**. Free backend hosts (Render, Railway free tiers, etc.) have cold
  starts or shut down, which is unacceptable.
- We still need: **auth, database, real-time sync, presence/cursors, file storage**.
- AI calls use the **user's own OpenAI key**, directly from the browser.

So: one managed **"database-with-batteries"** service that the browser talks to directly, with
access enforced by that service's permission rules.

## 2. High-level diagram

```
┌──────────────── Browser (GitHub Pages SPA) ────────────────┐
│ React + R3F (three.js)  ·  Zustand UI state  ·  Router     │
│   │                    │                       │           │
│   │ queries/tx,        │ presence/cursors      │ fetch     │
│   │ auth, files        │ (ephemeral)           │ (BYOK)    │
└───┼────────────────────┼───────────────────────┼───────────┘
    ▼                    ▼                       ▼
┌──────────────── Firebase (Spark, free) ─┐   ┌───────────┐
│ Auth (Google) · Firestore (data+rules)  │   │ OpenAI API│
│ Realtime DB (presence/cursors)          │   └───────────┘
│ Storage: later, needs Blaze (D-015)     │
└─────────────────────────────────────────┘
```

## 3. Backend choice: Firebase (D-014)

InstantDB was the first choice (D-010), but its hosted service is shutting down (no new sign-ups;
apps stop on 2027-08-31). That moved **longevity** to the top of the criteria.

| Option | Verdict |
|---|---|
| **Firebase** ✅ | Google-backed, never pauses, no cold starts. Firestore real-time listeners and offline cache. Realtime Database is ideal for cursors (cheap, `onDisconnect`). Native Google sign-in. Spark plan needs no card. |
| Convex | Good developer experience, but cursor updates count as function calls (1M/month free goes fast), and it's a startup (same risk as Instant). |
| Supabase | **Free projects pause after about a week of inactivity.** |
| InstantDB | Shutting down. Superseded. |

Firebase services used:
- **Auth**: Google provider, popup flow
- **Firestore**: all persistent data, security rules in `firestore.rules`
- **Realtime Database**: ephemeral presence and cursors only, rules in `database.rules.json`
- **Storage**: not yet. It needs the Blaze plan; decide in Phase 5 (D-015)

The app talks to Firebase only through **`src/data/`**, so another swap would stay contained.

## 4. Frontend stack

- **Vite + React + TypeScript**
- **three.js via @react-three/fiber** for the backdrop, with a hand-written ASCII effect (`src/three/AsciiEffect.ts`)
- **Zustand** for local UI state (selection, canvas view, display, motion)
- **React Router** with **BrowserRouter** (plain paths, no `#`, D-070). GitHub Pages has no rewrites, so the build copies
  `index.html` to `404.html`; every deep link boots the app. All paths come from `src/app/paths.ts`
- **motion** for DOM transitions; most entrances are the cell-by-cell build (`src/ui/cellReveal.ts`, D-034)
- **GitHub Actions** builds and deploys to Pages

### Rendering strategy (hybrid)
Fully WebGL text editing is painful and inaccessible. So:
- **WebGL (R3F):** the flowing ASCII backdrop and the welcome intro (`src/three/`), and the curtain's cell-by-cell reveal.
- **DOM:** the canvas and every piece on it (planes and their cards, links, text, matrices, tables, kanbans, documents),
  panels, menus and settings, styled in the same ASCII language. The canvas is a transformed DOM layer that pans and
  zooms (`CanvasView.tsx`); only what's on screen is drawn (`visible.ts`); a few dense things paint into a 2D `<canvas>`
  (a far-out matrix's cells, `CellDots`).
- The **ASCII post-processing** applies to the backdrop and transitions, never to text the user has to read or edit.
- 1.0's board was a 2.5D WebGL scene with SDF card text (troika, D-018, D-019); drei and troika
  were removed with it.

## 5. Data model (Firestore)

Source of truth: `src/data/model.ts`.

```
workspaces/{wid}        name, description (≤1000, D-082), ownerId (creator), memberIds[], roles{uid: owner|editor|viewer}, inviteCode, invitedEmails[]
  members/{uid}         name, email?, photo?, joinedAt                            (people list, D-098)
  pieces/{id}           kind (plane|matrix|table|documents|document|kanban|timeline), x, y, w, h (canvas px), name?,
                        stuckTo? (a plane's id, or a kanban's for a timeline; D-210, D-262), open? (out of its window on the
                        canvas; w/h stay the window's, D-228), and its kind's setup: matrix?, table?, documents?, docId?,
                        kanban?, timeline?                                       (D-176, D-180, D-204, D-209, D-232, D-251, D-262)
                        matrix = {rows, cols, cell (scale|number|text), steps[{id, glyph, label, tone}], unit?, notRelevant?,
                        confidence?, reading?}; an axis = {type?, plane?, hide?[], items[{id, name? | cardType, cardId}], noun?,
                        unfold? ('criteria'), open?[] (D-249)}
                        table = {rows: {rules[{field (plane|type|status|tag|title), not?, values[]}], hide?[], items[]},
                        manual?, cols[{id, field? | name, kind (scale|number|text|check), steps?, unit?}], sort?{col, desc?}} (D-209)
                        kanban = {cols[{id, name, done?, limit?}] (1–12), everyPlane? (D-255), rows? (assignee|card, D-258),
                        holds? ('cards'), source? (a table's rows), colField? (status|impact|effort|priority) (D-268),
                        rowField?, names?[{col, row, name ≤ 40, tone? (good|bad)}] (≤ 40) (D-269)}
                        timeline = {rows? (kanban|assignee|card)} (D-262); kanbans?[] (≤ 20) still allowed, ignored (D-289)
  customers/{id}        pieceId (its plane), title, x, y (plane px), body?, tags[]?, validation? (D-137)
  problems/{id}         the same
  ideas/{id}            the same
  features/{id}         pieceId, title, x, y, body?, tags[]?, priority?, status?, impact?, effort? (D-138),
                        criteria?[{id, text}] (≤ 8, D-133), folded? (its parts folded into it, D-164, D-225)
  competitors/{id}      pieceId, name, x, y, description?, audience?, pricing?, url?, regions[]? (D-145), notes?, tags[]?
  packages/{id}         pieceId, title, x, y, body?, tags[]?, memberIds (≤ 60), impact?, effort?, folded? (D-141, D-239)
  places/{id}           planeId, cardId, type, x, y (its spot there), folded?, createdAt: a card on a plane besides its home
                        (`pieceId`); the same card, fields and links shared (id = planeId_cardId; D-281, D-282)
  competitorFeatures/{id}  competitorId, name, description?, category?, availability? (free|paid|enterprise|beta), url? (D-164)
  comparisons/{id}      featureId, competitorId, competitorFeatureId? (their feature matching ours, D-164),
                        criteria? {criterionId: met|part|no} (D-133) (id = featureId_competitorId)
  edges/{id}            fromId, fromType, toId, toType, kind, label? (always straight: bend points dropped, D-292)
  evidence/{id}         nodeId, nodeType (customer|problem|idea), kind, text, stance (supports|contradicts), source?, url?,
                        date? (YYYY-MM-DD) (D-137)
  labels/{id}           pieceId (`canvas` or a plane's id), text, x, y, size? (heading|subheading|minor|note), bold?, italic?,
                        caps?, color?, kicker? (≤ 60), rotate? (90|-90), w?, scale? (D-156, D-161), kind?:
                        'section' + w, h, side? ('left') (D-130, D-157); 'title' (the project title, one per workspace, D-118);
                        'sticky' + uid, author, folded? (D-158, D-257, D-259)                   (D-188)
  cells/{id}            matrixId, row, col, value? (step id | number | text ≤ 200), notes?, notRelevant?, confidence?
                        (id = matrixId_row_col; a row or column is its card's id, its typed entry's id, or `card~criterion`
                        for what a feature unfolded into, D-249; a table's own columns' values too, matrixId = the table's id)
  tasks/{id}            pieceId (a kanban), col (its column's id), order (between its neighbours'), title (≤ 200),
                        notes?, assignee? (uid) + assigneeName?, start? ≤ due? (YYYY-MM-DD, D-304), cardId? + cardType?, checks?[{id, text,
                        done?}] (≤ 50), learned? (evidence id | 'skip', D-254), labels?[] (≤ 20) + priority? (P1–P3, D-256),
                        givenAt? + givenBy? (D-261), uid (who made it) (D-251)
  documents/{id}        kind (markdown|image|pdf|report), title, excerpt, origin, uid, name, shared, size, words?, path?…   (D-232)
    content/body        a .md's text, or a report's answer, sections, implications, openQuestions, sources (fetched when opened)
  reports/{id}          1.0's reports: only read and deleted, to be moved to documents once (D-090, D-248)
    content/body
  threads/{id}          on (card|label|link|plane|task), targetId, planeId (its space: `canvas`, a plane's or a kanban's id),
                        x, y, uid, name, count, lastAt, lastUid, lastName, lastText (≤ 160), mentions? (uids ≤ 50), resolved?,
                        resolvedBy?  (D-159, D-166, D-192, D-193: any member writes them as themselves, viewers too; not
                        undone, copied or exported; only a message's writer deletes it, an owner only with the whole thread)
    messages/{id}       uid, name, text (≤ 2000), mentions? (uids ≤ 20), createdAt, editedAt?
  threadReads/{uid}     seen {threadId: lastAt}, tasks? (when you last looked at your tasks, D-261), updatedAt (yours alone)
  ai/{docId}, aiUsage/{id}   the assistant's settings and usage log (D-079, D-104), kept for when it comes back
inviteCodes/{code}      workspaceId, createdBy
joinRequests/{wid}_{uid} workspaceId, uid, name, email, code, createdAt   (D-062)
aiSecrets/{wid}         the workspace key, encrypted; no client reads or writes it (D-079)

RTDB: presence/{wid}/{uid}   name, color, photo?, view ('canvas'), plane? (the plane in focus), x?, y? (that space's px),
                             sel?, more?, drag? (a task held, D-260), tasks? (the tasks side view's tab, D-300), since?, ts   (D-065, D-067, D-124, D-191)
```
- Entities are **subcollections of their workspace**, so one rule covers them: members (`memberIds`) read them; owners and
  editors write them (D-098).
- **Roles** (D-098): `owner` (any number, never none: people, roles, the invite code, the workspace key, deleting it),
  `editor` (all content), `viewer` (reads everything, keeps their own documents). Authority comes from `roles`; `ownerId` is
  only the creator. Viewers get the app locked (`editLocked`) and writes are refused in `history.ts`.
- **Loaded on demand** (D-098): opening a workspace loads its pieces, cards, links, text, cells and tasks once
  (`src/data/workspaceData.ts`, shared by every piece), nothing else.
  Documents, the people list and threads' messages load only where they're shown, paged (`usePaged` in
  `src/data/hooks.ts`: several queries merged, never skipping rows). Composite indexes in `firestore.indexes.json`.
- `edges` is one generic collection, so any card can link to any other; tagging a card with a customer is an edge
  `kind: 'for'` (card → customer) (D-044).
- Undo/redo: every write in `src/data/` goes through `tracked()` in `history.ts`, which snapshots the touched documents (D-046).
- No 1.0 shapes (D-248): cards, text and threads always have a space; `domains`, `groups`, `planes`, `placements`,
  `attachments` and `board` pieces are refused by the rules (not even read: old docs stay unseen in old workspaces).
- Rules allow only these collections and check each one's basic shape (`firestore.rules`, mirrors `model.ts` and the
  types in `src/data/`).
- "My workspaces" = `where('memberIds', 'array-contains', uid)`.
- **Joining (D-062).** Two ways in, both checked by the rules:
  - *Email invite:* the owner adds a lowercased address to `invitedEmails`. That person (signed in with a verified Google
    address) can read the workspace doc, so it shows on their workspaces page (`where('invitedEmails', 'array-contains', email)`).
    Accepting adds only yourself as `editor` and removes your address in the same write; declining only removes your address.
    No mail is sent (no server); the owner tells them.
  - *Code + approval:* read `inviteCodes/{code}` (get only) → create `joinRequests/{wid}_{uid}` carrying the code; the rules
    check it against the workspace's current `inviteCode`. The owner sees requests in Settings
    (`where('workspaceId', '==', wid)`) and approves (adds the member and deletes the request in one batch) or denies (deletes it).
    The requester can see and withdraw their own. A code alone never makes anyone a member.
  - The owner can swap in a new code (old `inviteCodes` doc deleted, new one created, `inviteCode` updated in one batch).

## 6. Real-time collaboration

- **Persistent data:** DB subscriptions. Every client re-renders on change.
  The conflict model is **last-write-wins per field**, which is enough for post-it fields.
  Simultaneous typing in the same field: last write wins, no lock or warning (D-071, answers Q-006).
- **Ephemeral data** (cursors, selection, what's held, the plane in focus): Realtime Database at
  `presence/{wid}/{uid}`, removed automatically with `onDisconnect()`. Sent about 10 times a second and
  smoothed only on the receiving side (D-169, D-193): each position is kept with the time it arrived, and the cursor is drawn
  200 ms in the past on a curve (Catmull-Rom) through them, bunched arrivals spread out again; cursor positions stay out of
  React state, so a moving pointer re-renders nothing but the canvas. Each tab writes its whole node, so a second tab survives
  the first one's disconnect (D-065). A cursor is in its space's px: the canvas's, or the focused plane's (`plane`, D-191); you see the cursors of people in
  your space. `sel` is the selected item (a card, text, piece, cell or task), shown wherever it is drawn (D-068, D-272), and
  taken as your own while you follow them (D-170); `more` is the rest of a selection of several, ids joined by spaces, ≤2048 characters (D-124). RTDB writes are free (billed by bandwidth),
  and Spark allows 100 simultaneous connections.
- RTDB rules can't read Firestore membership, so any signed-in user who knows a workspace ID could
  read its cursors (name, colour, coordinates only). The IDs are random. Accepted for now (D-016).
- Each collaborator has a colour from the accent palette, assigned in join order so up to five never clash (D-067; see [DESIGN.md](DESIGN.md)).

## 7. Authentication

Firebase Auth with the Google provider, popup flow (D-011). `localhost` and `atahankilc.github.io`
must be in Firebase Auth → Settings → Authorized domains. Workspaces are shared by email invite or by a code the owner approves (D-062).

## 8. AI (BYOK)

> 1.0's assistant: its client code (`src/ai`, the chat, the report screen) is deleted (D-248) and comes back as a piece.
> Live in the repo: the Cloud Functions (`functions/`: `setWorkspaceKey`, the `ai` proxy, cleanup) and the rules for
> `ai`, `aiUsage` and `aiSecrets`, waiting for Blaze. Below is how 1.0 worked, in short; the details are in
> `memory-bank/decisions-1.0.md` and the log, and the code in git at `493bf87` (`src/archive/ai/`).

**Keys and what stays live**
- **Your own key** lives only in your browser (localStorage), never in the DB; calls go straight to OpenAI (Responses
  API, streaming, `store: false`). Risk: a key in localStorage is exposed to XSS; mitigation: strict CSP, no untrusted
  HTML, no third-party scripts.
- **A workspace key** (D-079): the owner sends it once to `setWorkspaceKey`; it is kept encrypted in `aiSecrets/{wid}` (no
  client access) and used only by the `ai` function, which streams the answer back. Owners share it with everyone or
  chosen members, pick a model per task and an allowed list in `ai/config`, enforced by the proxy (D-104).
- **Usage log** (D-079): every call, on either key, lands in `workspaces/{wid}/aiUsage` (tokens, model, tools, time; never
  messages). You see your own; owners also see all workspace-key calls.

**How 1.0's assistant worked**
- **Brief** (D-082): each message sent a fresh plain-text brief of the workspace, every item with a short `[ref]`, the
  workspace's name and description first, wrapped in `<workspace>…</workspace>` as data, not instructions; North Star is
  the app, never the startup.
- **Changes** (D-074, D-075): one strict function tool, `propose_changes`. The model proposed, the chat showed a
  checklist, only what the user applied was written, as one undo step; deletes cascaded like a delete by hand. Rows
  grew to edit the project, competitor features, matrix cells, board text, planes, packages and criteria (D-120, D-122,
  D-123, D-134, D-142), and to lay out areas as section frames in shapes (columns, rows, grid, hub, cycle, orbit, tree,
  quadrant), packed ~1.7 : 1 with fewer link crossings (D-086, D-125, D-126, D-129, D-131).
- **Preview** (D-087): a proposal's writes played onto an in-memory copy that every view showed, writes refused meanwhile.
- **Agent loop** (D-084): up to 6 calls; the browser ran the tools the model called (`propose_changes`, `get_items`,
  `get_report`) and sent their output back; reasoning carried as `encrypted_content`; the last call `tool_choice: none`.
- **Modes** (D-085, D-099, D-134): `/validate /interview /swot /gaps /next /pitch /organize /analyze /criteria`, canned
  asks sent as a normal message.
- **Web and research** (D-076, D-088, D-089): OpenAI's `web_search` only while `[web]` is on, sources as links; `/research`
  planned questions, ran up to 3 web researchers and wrote one report.
- **Reports** (D-090, D-091, D-098, D-099): saved per person (summary + `content/body`), private until shared, listed on
  a reports tab, `.md` uploads too; the open report was in the brief. They are documents now (D-232).

## 9. Files, export and import

- **Documents** (D-232, `docs/specs/documents.md`, `src/data/documents.ts`): every file the workspace keeps (.md,
  images, PDFs, reports) as a summary + `content/body`, private until its author shares it; old `reports/*` are moved over
  once when a workspace opens. Pieces `documents` (a list, table or shelf) and `document` (one, `docId`). Files need
  Storage (Blaze): `filesAvailable` until then. 1.0's reports (§8) are only read, to be moved.
- **Attachments** (D-083) went with 1.0 (D-248): no `attachments` collection, `storage.rules` allow nothing. Files come back
  as documents' files (images, PDFs, D-232) once Storage is live, with their own rules.
- **Drawing:** upload only (Q-004 → D-083): draw elsewhere and upload the SVG/PNG/PDF as a document. A built-in sketch pad may come later.
- **Export** ✅ (D-080, D-246; Settings → workspace → export): a `.zip` holding `workspace.json` (`format:
  north-star.workspace`, `version: 2`) with every content collection read fresh (`BUNDLE_COLLECTIONS` in
  `src/io/bundle.ts`: pieces, the cards of every type and packages, competitor features, comparisons, edges, evidence,
  labels, cells, tasks; cards and text without a space stay out, D-248), plus the documents you can see (`.md` and
  reports) with their content, without the author's uid. Never members, roles, codes, threads (D-159) or anything AI.
  Images and PDFs stay behind until Storage is live, and the page says how many.
- **Import** ✅ (D-080, D-246; workspaces page, `src/data/importWorkspace.ts`): a bundle becomes a new workspace you own.
  Every doc is rebuilt from known fields in the shapes `firestore.rules` takes, with new ids, and everything that points
  somewhere follows (planes and spaces, links, evidence, competitor features and matches, package members, matrix axes,
  table and kanban rules, `stuckTo`, `docId`, cell ids re-derived from matrix, row and column). What points outside the
  file is left out and counted. Documents become yours, shared as they were. Written in batches (≤ 450 writes or ~4 MB;
  documents 6 to a batch); if one fails the half-made workspace is deleted. A version 1 (1.0) file is refused (D-248).
- **Matrix → TSV** and **board → PNG** (D-080) went with 1.0 (D-248). PDF later.

## 10. Repo layout

```
src/
  app/            App.tsx (routes), paths.ts (every URL, D-070)
  views/          landing/, workspaces/, workspace/ (the canvas and every piece, panel, dock, menu)
  three/          the ASCII backdrop and its effect (WebGL)
  ui/             ASCII-styled DOM components (Frame, Marks, Ink, Menu, Select, HazardConfirm, Settings, Hud…)
  data/           Firebase adapter, one file per collection, hooks, history (undo), export/import
  io/             the export bundle's format
  state/          canvas view, curtain, display, motion, theme
  styles/         tokens (tokens.css + tokens.ts), global.css
functions/        Cloud Functions: the workspace key (D-079), waiting for Blaze
tests/            rules tests (npm run test:rules)
scripts/          check-memory.mjs
docs/             product, architecture, design, roadmap, specs/
memory-bank/      state, decisions, open questions, the logs
```
