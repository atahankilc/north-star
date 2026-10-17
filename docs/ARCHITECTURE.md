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
- **React Router** with **HashRouter**, because GitHub Pages has no server-side rewrites
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
workspaces/{wid}        name, description, ownerId, memberIds[], roles{uid: role}, inviteCode, invitedEmails[]
  customers/{id}        title, body, color, tags[], x, y                          (D-042, D-044)
  problems/{id}         title, body, color, tags[], x, y                          (D-041)
  ideas/{id}            title, body, color, tags[], status, x, y
  features/{id}         title, body, color, tags[], x, y, priority, status, effort   (same card fields as ideas, D-037)
  competitors/{id}      name, url, description, pricing, audience, notes, color, x, y
  labels/{id}           text, color, x, y                                         (text on the board, D-050)
  competitorFeatures/{id}  competitorId, name, description, category
  comparisons/{id}      featureId, competitorId, coverage?, notes, competitorFeatureId   (id = featureId_competitorId)
  edges/{id}            fromId, fromType, toId, toType, kind, label
inviteCodes/{code}      workspaceId, createdBy
joinRequests/{wid}_{uid} workspaceId, ownerId, uid, name, email, code, createdAt   (D-062)

RTDB: presence/{wid}/{uid}   name, color, photo?, view, x?, y?, sel?, edit?, field?, since?, ts   (D-065, D-067)
```
- Entities are **subcollections of their workspace**, so one rule covers them: the caller must be in `memberIds`.
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
  ⏳ Concurrent editing of the *same* long text body is a later concern; the option is Yjs.
- **Ephemeral data** (cursors, selection, "is typing", viewport): Realtime Database at
  `presence/{wid}/{uid}`, removed automatically with `onDisconnect()`. Throttled to about 15–20 Hz and
  interpolated on the receiving side for smooth motion. Each tab writes its whole node, so a second tab survives
  the first one's disconnect (D-065). Cursors are board world coordinates; other views report only which view you're on. `sel` is the selected item
  (or a matrix cell, `<featureId>_<competitorId>`), shown in every view (D-068). RTDB writes are free (billed by bandwidth),
  and Spark allows 100 simultaneous connections.
- RTDB rules can't read Firestore membership, so any signed-in user who knows a workspace ID could
  read its cursors (name, colour, coordinates only). The IDs are random. Accepted for now (D-016).
- Each collaborator has a colour from the accent palette, assigned in join order so up to five never clash (D-067; see [DESIGN.md](DESIGN.md)).

## 7. Authentication

Firebase Auth with the Google provider, popup flow (D-011). `localhost` and `atahankilc.github.io`
must be in Firebase Auth → Settings → Authorized domains. Workspaces are shared by email invite or by a code the owner approves (D-062).

## 8. AI (BYOK)

- The user pastes an **OpenAI API key on the Settings page**.
- The key is stored **only in the user's browser (localStorage)** and is **never written to the DB**,
  so collaborators can never see it. Each collaborator uses their own key.
- Calls go **directly from browser to OpenAI** (`fetch` or the SDK with `dangerouslyAllowBrowser`).
- **Default model: a cheap small model** (currently the "nano"/"mini" tier). It is configurable in
  Settings. ⏳ Pick the exact default model ID at implementation time from OpenAI's pricing page.
- Prompts live in `src/ai/prompts/` with structured JSON outputs where useful
  (for example, suggested links).
- Risk: a key in localStorage is exposed to XSS. Mitigation: strict CSP, no untrusted HTML, no
  third-party scripts. Settings explains this to the user.

## 9. Files, export and import

- **Attachments** (image/PDF/drawing) go to Firebase Storage, linked to a node. This needs the Blaze
  plan (card required, 5 GB free). Deferred to Phase 5 (D-015).
- **Drawing:** ⏳ either upload drawing files, or a built-in sketch pad (for example tldraw or a
  simple canvas) that saves as SVG/PNG.
- **Export:** a workspace bundle as `.zip` holding `workspace.json` (all entities and links) plus
  `attachments/`.
- **Import:** load a bundle into a new workspace, remapping IDs.
- Later: matrix → CSV, canvas → PNG/PDF.

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
