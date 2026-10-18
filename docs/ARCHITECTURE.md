# North Star: Architecture

Status: **accepted** unless marked. Items marked ⏳ wait on a decision in
[../memory-bank/open-questions.md](../memory-bank/open-questions.md).
Accepted decisions are logged in [../memory-bank/decisions.md](../memory-bank/decisions.md).

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

## 4. Frontend stack (proposed)

- **Vite + React + TypeScript**
- **three.js via @react-three/fiber** with **@react-three/drei** helpers and
  **@react-three/postprocessing** for the ASCII/dither effect
- **Zustand** for local UI state (selection, tool mode, camera)
- **React Router** with **BrowserRouter** (plain paths, no `#`, D-070). GitHub Pages has no rewrites, so the build copies
  `index.html` to `404.html`; every deep link boots the app. All paths come from `src/app/paths.ts`
- **Framer Motion / motion** for DOM transitions, and R3F springs (`@react-spring/three`) for 3D
- **GitHub Actions** builds and deploys to Pages

### Rendering strategy (hybrid)
Fully WebGL text editing is painful and inaccessible. So:
- **3D layer (R3F):** scene, camera, post-it card meshes, connection curves, ambient ASCII-shaded
  backgrounds, transitions between views, and collaborator cursors in world space.
- **DOM layer:** all text editing (the detail panel), side panels, the matrix/table view, settings,
  and modals. These are styled in the same ASCII language.
- **Card text** is WebGL SDF text (troika), crisp at any zoom (D-019). The board is a 2.5D scene: pan and zoom, no rotation (D-018).
- The **ASCII post-processing** applies to decorative and ambient layers and transitions, never to
  text the user has to read or edit.

## 5. Data model (Firestore)

Source of truth: `src/data/model.ts`.

```
workspaces/{wid}        name, description (≤1000, D-082), ownerId (creator), memberIds[], roles{uid: owner|editor|viewer}, inviteCode, invitedEmails[]
  members/{uid}         name, email?, photo?, joinedAt                            (people list, D-098)
  reports/{id}          title, answer, sectionCount, sourceCount, kind, topic, uid, name, model, shared, createdAt   (summary, D-098)
    content/body        sections, implications, openQuestions, sources            (fetched when opened, D-098)
  customers/{id}        title, body, color, tags[], x, y                          (D-042, D-044)
  problems/{id}         title, body, color, tags[], x, y                          (D-041)
  ideas/{id}            title, body, color, tags[], status, x, y
  features/{id}         title, body, color, tags[], x, y, priority, status, effort   (same card fields as ideas, D-037)
  competitors/{id}      name, url, description, pricing, audience, notes, color, x, y
  labels/{id}           text, color, size, kind?, x, y                            (text on the board, D-050; kind 'title': the project title block, D-118)
  competitorFeatures/{id}  competitorId, name, description, category
  comparisons/{id}      featureId, competitorId, coverage?, notes, competitorFeatureId   (id = featureId_competitorId)
  edges/{id}            fromId, fromType, toId, toType, kind, label
inviteCodes/{code}      workspaceId, createdBy
joinRequests/{wid}_{uid} workspaceId, ownerId, uid, name, email, code, createdAt   (D-062)

RTDB: presence/{wid}/{uid}   name, color, photo?, view, x?, y?, sel?, more?, since?, ts   (D-065, D-067, D-124; edit/field retired, D-071)
```
- Entities are **subcollections of their workspace**, so one rule covers them: members (`memberIds`) read them; owners and
  editors write them (D-098).
- **Roles** (D-098): `owner` (any number, never none: people, roles, the invite code, the assistant key, deleting it),
  `editor` (all content), `viewer` (reads everything, keeps their own reports). Authority comes from `roles`; `ownerId` is
  only the creator. Viewers get the preview's lock in viewer mode (`viewerLock.ts`) and writes are refused in `history.ts`.
- **Loaded on demand** (D-098): opening a workspace loads its items, links, matrix and attachment records, nothing else.
  Reports (summaries, 20 at a time; a body when opened), the people list (20 at a time), the usage log (20 at a time; the
  month's totals once per visit) load only where they're shown. Paged live queries: `usePaged` in `src/data/hooks.ts`
  (several queries merged, never skipping rows). Composite indexes in `firestore.indexes.json`.
- `edges` is one generic edge collection, so any node type can connect to any other.
  Tagging an item with a customer is an edge with `kind: 'for'` (item → customer), drawn as a card label (D-044).
- Undo/redo: every write in `src/data/` goes through `tracked()` in `history.ts`, which snapshots the touched documents (D-046).
- `domains` and `groups` are retired (D-048, D-049): rules allow only reading and deleting them, so old workspaces can be cleaned up.
- Rules allow only these collections and check each one's basic shape (`firestore.rules`, mirrors `model.ts`).
- The workspace route loads every collection once (`src/data/workspaceData.ts`); all views share it (D-036).
- "My workspaces" = `where('memberIds', 'array-contains', uid)`.
- **Joining (D-062, replaces the direct join of D-012).** Two ways in, both checked by the rules:
  - *Email invite:* the owner adds a lowercased address to `invitedEmails`. That person (signed in with a verified Google
    address) can read the workspace doc, so it shows on their workspaces page (`where('invitedEmails', 'array-contains', email)`).
    Accepting adds only yourself as `editor` and removes your address in the same write; declining only removes your address.
    No mail is sent (no server); the owner tells them.
  - *Code + approval:* read `inviteCodes/{code}` (get only) → create `joinRequests/{wid}_{uid}` carrying the code; the rules
    check it against the workspace's current `inviteCode` and copy in `ownerId`. The owner sees requests in Settings
    (`where('ownerId', '==', uid)`) and approves (adds the member and deletes the request in one batch) or denies (deletes it).
    The requester can see and withdraw their own. A code alone never makes anyone a member.
  - The owner can swap in a new code (old `inviteCodes` doc deleted, new one created, `inviteCode` updated in one batch).

## 6. Real-time collaboration

- **Persistent data:** DB subscriptions. Every client re-renders on change.
  The conflict model is **last-write-wins per field**, which is enough for post-it fields.
  Simultaneous typing in the same field: last write wins, no lock or warning (D-071, answers Q-006).
- **Ephemeral data** (cursors, selection, "is typing", viewport): Realtime Database at
  `presence/{wid}/{uid}`, removed automatically with `onDisconnect()`. Throttled to about 15–20 Hz and
  interpolated on the receiving side for smooth motion. Each tab writes its whole node, so a second tab survives
  the first one's disconnect (D-065). Cursors are board world coordinates; other views report only which view you're on. `sel` is the selected item
  (or a matrix cell, `<featureId>_<competitorId>`), shown in every view (D-068); `more` is the rest of a selection of
  several on the board, ids joined by spaces, ≤2048 characters (D-124). RTDB writes are free (billed by bandwidth),
  and Spark allows 100 simultaneous connections.
- RTDB rules can't read Firestore membership, so any signed-in user who knows a workspace ID could
  read its cursors (name, colour, coordinates only). The IDs are random. Accepted for now (D-016).
- Each collaborator has a colour from the accent palette, assigned in join order so up to five never clash (D-067; see [DESIGN.md](DESIGN.md)).

## 7. Authentication

Firebase Auth with the Google provider, popup flow (D-011). `localhost` and `atahankilc.github.io`
must be in Firebase Auth → Settings → Authorized domains. Workspaces are shared by email invite or by a code the owner approves (D-062).

## 8. AI (BYOK)

- **Models per key** (D-104): own key: a default per task (chat, web answers, deep research) and per-workspace overrides
  in this browser; workspace key: owners' picks per task and an allowed list in `ai/config`, enforced by the `ai` proxy.
  `resolveModel` in `src/ai/models.ts` decides each call's model; the chat header can switch it for one conversation.
- **Two kinds of key** (D-079): your own (below), or a **workspace key** the owner sets once in Settings → ai → keys and
  shares with everyone or chosen members. The workspace key is held only by Cloud Functions (`functions/`): encrypted in
  `aiSecrets/{wid}` (no client access), used by the `ai` function, which streams the answer back and logs the call.
  Every call, on either key, goes through `callAi` (`src/ai/call.ts`) and lands in `workspaces/{wid}/aiUsage` (tokens, model,
  tools, time; never messages). You see your own calls; the owner also sees all workspace-key calls.
- The user pastes an **OpenAI API key on the Settings page**.
- The key is stored **only in the user's browser (localStorage)** and is **never written to the DB**,
  so collaborators can never see it. Each collaborator uses their own key.
- Calls go **directly from browser to OpenAI** with `fetch` (Responses API, streaming, `store: false`; `src/ai/openai.ts`).
- **Models** (D-077): one for chat and one for research (`[web]` on), picked in Settings → ai; both default to `gpt-6-luna`.
- **Context:** each message sends a fresh plain-text brief of the workspace (`src/ai/context.ts`), built from the data the page
  already holds; every item carries a short `[ref]`. It opens with the workspace name and `WHAT WE'RE BUILDING` (the workspace
  description, set in Settings → workspace), then whether the board has the project block (D-120), and is wrapped in `<workspace>…</workspace>` as data, not instructions. The prompt
  says North Star is the app, never the startup (D-082).
- **Changes** (D-074): one strict function tool, `propose_changes` (`src/ai/tools.ts`). The model proposes; the chat shows a
  checklist; only what the user applies is written, through `src/data/assistant.ts`, as one undo step. Deletes cascade like
  a delete by hand (D-075). `update_project` (D-120) edits the workspace's name and description (the project block, D-118);
  for the workspace doc `history.ts` snapshots only those two fields and puts them back merged, never roles or codes.
  New cards are placed clear of the project block; a label row never names a label with no text.
  Edits (D-122): `update_competitor_feature`; `set_matrix_cell` sets `their_feature` (`competitorFeatureId`) and clears
  coverage with `not assessed`; in update rows and cells `""` empties a field (a `null` write → `deleteField()`).
  Board text and moves (D-123): `add_label` / `edit_label` (size, colour by accent name, `above` a card; placed after the
  cards, stepping up until clear) and `move_card` (beside another card, then the nearest free spot).
- **Agent loop** (D-084): an answer is up to 6 calls. After each one, the browser runs the function tools the model called
  (`propose_changes`, and `get_items` in `src/ai/readTools.ts`, which reads a few items in full) and sends the step's output
  items plus the `function_call_output`s back. Reasoning carries over as `reasoning.encrypted_content` (still `store: false`).
  The last call uses `tool_choice: none`, so every answer ends in words. Each call is its own usage-log entry.
- **Analysis modes** (D-085): `/validate`, `/interview`, `/swot`, `/gaps`, `/next`, `/pitch`, `/organize`, `/analyze` (D-099) (`src/ai/modes.ts`) are canned
  asks sent as a normal message (the chat shows the short form); one-item modes use the selected card when it fits.
- **Board areas** (D-086, D-125): `arrange_area` rows name an area and its cards, and may give a `layout` (`columns`: a
  column per type, linked cards level; `rows`: one band per problem with its chain beside it; `grid`; `line`; `hub`: the
  first card ringed by the rest), make it a section `within` another area (its name a subheading), or put it `beside`
  another area on a side. `src/ai/arrange.ts` lays them out with room for link chips and packs the areas (and sections)
  about 1.7 : 1 wide, never one long row. Columns are ordered by sweeps that cut link crossings; an area without a place goes
  to the spot (first free, or beside an area or a staying card it links to) with the shortest links that keeps the whole
  compact; a lone area with an existing label is tidied in place (D-126). After a proposal with areas, `layoutReport`
  tells the model the outlines, crossings and long links, and it may propose once more. Labels are referred to by their text.
- **Preview** (D-087): `src/ai/simulate.ts` plays a proposal's writes onto an in-memory copy; while open, `useWs()` serves that copy
  to every view (not to the assistant window), marks show on items, and `tracked()` refuses writes.
- **Deep research** (D-088): `/research` → a planned set of questions you pick → one web-searching call per question (3 at a
  time) → the agent loop writes one report from the findings (`src/ai/research.ts`); the report comes through `write_report`
  and opens on the report screen (`src/ui/ReportView.tsx`, D-089).
- **Saved reports** (D-090; split into summary + `content/body` by D-098, older one-doc reports still read): `workspaces/{wid}/reports/{id}` (`SavedReport` in `src/data/model.ts`: the report, `kind`
  research | chat, `topic, uid, name, model, shared, createdAt`; data in `src/data/reports.ts`). A research report is saved
  as it's written; a chat write-up (`make_report`, any chat, when asked) when you press save. Only the author reads it until
  `shared`; then every member does. The client lists it with two queries (`shared == true`, `uid == me`). Author shares,
  unshares (only that field changes) and deletes; an owner may delete a shared one. Shown on the reports tab
  (`/workspaces/<id>/reports`, `?report=<id>` opens one in the tab's reader beside the table, `src/views/reports/ReportReader.tsx`, D-100/D-102/D-106; the table is paged 10 at a time with numbered pages and filters, `useReportPage`; only a report the chat just wrote opens on the assistant's stage); the brief lists the newest 10 by title and answer.
  `upload .md` (D-091) reads a Markdown file into the same shape (`src/io/reportMarkdown.ts`, `kind: 'upload'`).
- **Reports in the assistant** (D-099): the report open (on the stage, else the tab's reader, D-100) is in the brief in full; listed reports carry a
  `[report:…]` handle that `get_report` reads in full. `/analyze` turns a report into a proposal (new items, edits with sources,
  links, matrix cells, an area).
- **Web research** (D-076): OpenAI's `web_search` tool, only while the chat's `[web]` switch is on (about $0.01 per search on the
  user's account). Cited sources are shown as clickable links.
- Prompts live in `src/ai/prompts/`.
- Risk: a key in localStorage is exposed to XSS. Mitigation: strict CSP, no untrusted HTML, no
  third-party scripts. Settings explains this to the user.

## 9. Files, export and import

- **Attachments** ✅ on the emulators (D-083; live once Storage is deployed, which needs Blaze): images (PNG, JPEG, WebP, GIF),
  SVGs and PDFs on any card, up to 10 MB each. All access is in `src/data/attachments.ts`.
  - *Where:* the record in Firestore at `workspaces/{wid}/attachments/{id}` (`nodeId, nodeType, name, contentType, size, path,
    width?, height?, thumbPath?, uid, createdAt`, listed live with the workspace); the file in Storage at
    `workspaces/{wid}/attachments/{id}/{safe name}`, an image's 320 px WebP thumbnail beside it as `~thumb.webp`.
  - *Rules:* `firestore.rules` checks the record's shape (size < 10 MB, the type list, `path` under its own id); `storage.rules`
    lets members only (via `firestore.get` of the workspace) read, list and delete, and write < 10 MB of the same types.
  - *Before upload:* a PNG, JPEG or WebP over 2560 px on a side or over 2 MB is resized to fit 2560 px and saved as WebP (0.85),
    unless that comes out bigger. GIF, SVG and PDF go up as they are.
  - *Loading:* a workspace loads only the records, and they don't hold the loading screen. Files load when they're looked at:
    the panel shows thumbnails, the lightbox the full image, a PDF opens in a new tab; the board card shows only a count.
    Images and SVGs are shown only through `<img>`, so an SVG's scripts never run.
  - *Undo:* upload first, then the record with `tracked()`. Removing an attachment or deleting its item (it's in `cascadeOf`)
    removes only the record, so undo brings it back with its file. Files with no record and over a day old are swept when a
    member opens the workspace (once a day per browser); a record whose file is gone shows "file missing". Deleting a workspace
    deletes the whole Storage prefix first, while you're still a member.
  - *Live site:* hidden behind `ATTACHMENTS_LIVE = false` until `storage.rules` are deployed and the bucket has CORS (`cors.json`,
    for `getBytes` in export).
- **Drawing:** upload only (Q-004 → D-083): draw elsewhere and attach the SVG/PNG/PDF. A built-in sketch pad may come later.
- **Export** ✅ (D-080, Settings → workspace → export): a workspace bundle as `.zip` holding `workspace.json`
  (`format: north-star.workspace`, `version: 1`; every item, link, matrix cell and label, and the research reports you can
  see without their author's uid (D-090); never members, codes or AI keys and usage),
  plus each attachment's file at `attachments/<id>/<name>` with its record in `workspace.json`'s optional `attachments` (D-083;
  still version 1). Code: `src/io/bundle.ts`.
- **Import** ✅ (D-080, workspaces page; attachments D-083: files uploaded under new ids, or left out with a note where Storage isn't live): a bundle becomes a new workspace you own, docs rebuilt to the rules' shapes, IDs remapped,
  dangling references dropped (`src/data/importWorkspace.ts`).
- **Matrix → TSV** ✅ (`src/io/tsv.ts`; tabs, since Excel splits CSV by region) and **board → PNG** ✅ (offscreen render in `Board.tsx`). PDF later.

## 10. Repo layout (planned)

```
src/
  app/            routes, providers, layout
  views/          canvas/, features/, competitors/, matrix/, settings/
  three/          scene, cards, edges, cursors, ascii effect, transitions
  ui/             ASCII-styled DOM components
  data/           DB adapter, schema, hooks, permissions
  ai/             client, prompts
  io/             export/import
  styles/         tokens
docs/             product, architecture, design, roadmap
memory-bank/      project state, decisions, open questions
```
