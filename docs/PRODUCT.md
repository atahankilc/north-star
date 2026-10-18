# North Star: Product Spec

> A visual, real-time collaborative workspace for the startup ideation phase.
> Capture ideas as post-its, connect and structure them, break competitors down into features,
> and compare everything in one linked model.

## 1. Problem

Early-stage founders keep ideas, competitor research and feature planning in separate tools
(notes, Miro, spreadsheets, browser tabs). Nothing connects "my idea" to "who already does this,
and how well". North Star keeps all of it in one connected graph.

## 2. Core principle

**Everything can link to everything.** Ideas, our features, competitors and competitor features
are nodes in a single graph. Each view is a different lens on that same graph.

## 3. Entities

| Entity | Description | Key fields |
|---|---|---|
| **Workspace** | One startup idea space; the unit of sharing | name, description, members, roles (owners, editors, viewers; D-098) |
| **Customer** | Who it's for, at any breadth; doubles as the segment (D-044) | title, notes, position |
| **Problem** | A pain worth solving; ideas link to it (D-041) | title, notes, position |
| **Text label** | Text written on the board; names an area and is a place to jump to (D-050) | text, position |
| **Idea** (post-it) | A thought, problem, insight or feature idea | title, body, color, tags, position (x,y,z), status, attachments |
| **Connection** | Typed link between any two nodes | from, to, type (`relates`, `depends-on`, `contradicts`, `part-of`, `inspired-by`, custom), label |
| **Feature** (ours) | Something we plan to build; its own view, linked to the ideas it came from | name, detailed description, priority, status, effort, linked ideas |
| **Competitor** | A company or product in the space | name, URL, logo, description, pricing, audience, notes |
| **Competitor Feature** | One piece of a competitor's functionality | name, description, category, competitor |
| **Comparison** | How a competitor covers one of our features | feature, competitor, coverage (`none`/`partial`/`full`/`better`), notes, linked competitor feature |
| **Attachment** | Image, SVG or PDF on any card (D-083; upload only, no sketch pad) | file, type, name, size, owner item |

## 4. Views

> Now one board with every item type, text labels to jump between, and Board / Flow / Table / Matrix views (D-040, D-050):
> see [specs/board.md](specs/board.md). Items 1–3 below describe the earlier per-type pages. A built-in example workspace shows it all (D-052).

1. **Idea Canvas.** A 3D/2.5D infinite board of post-its with connections, groups, zoom/pan,
   mini-map, and live collaborator cursors.
2. **Features View.** A 3D board like the idea canvas, for our features (priority, status, effort).
   Each feature links back to its source ideas ("promote to feature") and forward to comparisons (D-037).
3. **Competitors.** A list of competitors; each has a profile (URL, pricing, audience, notes) and its
   features grouped by category. Those features can be linked to our ideas and features (D-038).
4. **Comparison Matrix.** A spreadsheet-style view: rows are our features, columns are competitors,
   and each cell holds coverage plus notes. Extra columns hold description, priority and status.
   Shows gaps (opportunities) and table stakes.
5. **Detail Panel.** A side panel for any node: edit fields, see all links, attachments,
   and AI actions.
6. **Reports.** Research reports, write-ups of assistant chats and uploaded `.md` files (D-091), saved per person and shared with the workspace by
   choice (D-090). One tab beside board, flow, table and matrix.
8. **Focus.** The board showing one card's chain only (customers → problems → ideas → features both ways from it, and the
   competitors around them), cards in place; the tab right of Board (D-127, [specs/board.md](specs/board.md)).
7. **Settings.** Profile, workspace members, AI config (OpenAI key, model), export/import.

## 5. Key flows

1. Brain-dump: create post-its quickly on the canvas
2. Structure: connect, tag, name areas with text labels
3. Research: add competitors and break their products into features
4. Link: ideas ↔ competitor features
5. Plan: add features and link them to the ideas and competitor features they come from
6. Compare: fill in the matrix
7. Decide: use gaps and differences to pick what to build
8. Collaborate: invite people, see live cursors, edit together

## 6. Feature scope

### In scope (confirmed by user)
- **Real-time collaboration**: live cursors, presence (who is here), live edits
- **Authentication**
- **AI assist with BYOK** (bring your own OpenAI key), using a cheap model for:
  - summarize an area (the cards under a text label)
  - suggest connections between ideas
  - draft a competitor breakdown from a description or URL text
  - fill or suggest matrix notes
- **Settings page** where users enter their own API key and choose a model
- **Export / Import** of a workspace (JSON bundle)
- **Attachments**: images, SVGs and PDFs on any card, up to 10 MB each, big photos shrunk before upload (D-083); drawings are uploaded as files, no built-in sketch pad
- **Web only**

### Later / nice to have
- Templates (Lean Canvas, SWOT, positioning map)
- Version history / snapshots
- Export to PDF, PNG or CSV (matrix)
- Comments and mentions

See [ROADMAP.md](ROADMAP.md) for phasing and [../memory-bank/open-questions.md](../memory-bank/open-questions.md)
for unresolved items.
