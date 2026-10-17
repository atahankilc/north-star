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
| **Workspace** | One startup idea space; the unit of sharing | name, description, members, roles |
| **Idea** (post-it) | A thought, problem, insight or feature idea | title, body, color, tags, position (x,y,z), status, attachments |
| **Connection** | Typed link between any two nodes | from, to, type (`relates`, `depends-on`, `contradicts`, `part-of`, `inspired-by`, custom), label |
| **Group** | Cluster of ideas on the canvas | name, color, members |
| **Feature** (ours) | Something we plan to build; its own view, linked to the ideas it came from | name, detailed description, priority, status, effort, linked ideas |
| **Competitor** | A company or product in the space | name, URL, logo, description, pricing, audience, notes |
| **Competitor Feature** | One piece of a competitor's functionality | name, description, category, competitor |
| **Comparison** | How a competitor covers one of our features | feature, competitor, coverage (`none`/`partial`/`full`/`better`), notes, linked competitor feature |
| **Attachment** | Image, PDF or drawing attached to any node | file, type, name, owner node |

## 4. Views

1. **Idea Canvas.** A 3D/2.5D infinite board of post-its with connections, groups, zoom/pan,
   mini-map, and live collaborator cursors.
2. **Features View.** A separate space for our features. Each feature links back to its source
   ideas and forward to competitor comparisons.
3. **Competitor Maps.** One canvas per competitor, with their product broken down into feature
   nodes. Those nodes can be linked to our ideas and features.
4. **Comparison Matrix.** A spreadsheet-style view: rows are our features, columns are competitors,
   and each cell holds coverage plus notes. Extra columns hold description, priority and status.
   Shows gaps (opportunities) and table stakes.
5. **Detail Panel.** A side panel for any node: edit fields, see all links, attachments,
   and AI actions.
6. **Settings.** Profile, workspace members, AI config (OpenAI key, model), export/import.

## 5. Key flows

1. Brain-dump: create post-its quickly on the canvas
2. Structure: connect, group, tag
3. Research: add competitors and break their products into features
4. Link: ideas ↔ competitor features
5. Promote: idea or cluster → Feature
6. Compare: fill in the matrix
7. Decide: use gaps and differences to pick what to build
8. Collaborate: invite people, see live cursors, edit together

## 6. Feature scope

### In scope (confirmed by user)
- **Real-time collaboration**: live cursors, presence (who is here), live edits
- **Authentication**
- **AI assist with BYOK** (bring your own OpenAI key), using a cheap model for:
  - summarize a cluster or group
  - suggest connections between ideas
  - draft a competitor breakdown from a description or URL text
  - fill or suggest matrix notes
- **Settings page** where users enter their own API key and choose a model
- **Export / Import** of a workspace (JSON bundle)
- **Attachments**: images, PDFs, drawings on nodes
- **Web only**

### Later / nice to have
- Templates (Lean Canvas, SWOT, positioning map)
- Version history / snapshots
- Export to PDF, PNG or CSV (matrix)
- Comments and mentions

See [ROADMAP.md](ROADMAP.md) for phasing and [../memory-bank/open-questions.md](../memory-bank/open-questions.md)
for unresolved items.
