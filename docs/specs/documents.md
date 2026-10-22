# Documents (D-232)

Every file the workspace keeps, under one word: **document**. A `.md`, an image, a PDF, and the old research
reports (moved over once). "Report" is no longer a word in the app; a report is a document of kind `report`.

Picked by the user on 2026-10-22 from a page of options (table lens + shelf of sheets for the list, a window for one
document, kind marks as a square + short name, "ask where it lands" before a private one goes on the canvas).

## Data

```
workspaces/{wid}/documents/{id}          Doc: the summary, listed (small)
  kind        markdown | image | pdf | report      later: note (written in the app)
  title ≤300, excerpt ≤400 (first words, the list's second line and a sheet's lines)
  origin      upload | assistant | moved           moved = an old report
  uid, name   who added it, their name then
  shared      false = only its author sees it (firestore.rules)
  contentType, size, words?, pages?, sections?, sources?, width?, height?
  path?, thumbPath?   a file in Storage under workspaces/{wid}/documents/{id}/
  topic?, model?, reportKind?   a moved report's
  createdAt, updatedAt
workspaces/{wid}/documents/{id}/content/body   DocBody, read only where it's shown
  markdown: { text ≤ 900 000 }   report: { answer, sections, implications, openQuestions, sources }
pieces/{id}  kind 'documents'  documents: { view: table | shelf, kinds?, sort?, pageSize? }
pieces/{id}  kind 'document'   docId
```

- **Private until shared.** A new document is its author's alone. Only the author shares, unshares or renames it;
  the author deletes it, an owner a shared one. Any member adds their own (the rules allow viewers too, but the client
  is read-only for viewers today, so they can't upload yet).
- Summaries load with the workspace (two live queries: shared, yours); a body only where it's read.
- **Files** (images, PDFs) need Storage, so the Blaze plan. Until then only `.md` uploads (`filesAvailable` =
  emulators or `FILES_LIVE`, the pattern of D-079/D-083); an image or PDF says "files come with Storage".
- **Old reports moved once:** on opening a workspace, each member's browser copies their own `reports/*` (and an
  owner's, the shared ones) to `documents/*` with the same id, author, date and sharing, then deletes the old ones.
  One report a batch (a body's rules read its summary). Not an undo step. Safe to run twice.

## The documents list (`+ → documents`)

A window on the canvas like the table (D-208): name in the top edge, console in the corner, no `+` marks. Its
console: `[table] [shelf]`, `[upload]`, `[focus] [edit]` (and pages when it has more than one).

- **Table**: kind · title (+ first words) · by (◐ = only you) · length (words, §, pages, size) · added; heads sort.
- **Shelf**: sheets of paper with a folded corner: kind, title (3 lines), first words, by, when.
- On the canvas a picture, except each row's `⇱` grip (editors), which drags the document out onto the canvas.
- In focus it's live. A click opens the document **beside** the list (the screen splits as for D-211; the line drags):
  it scrolls like a page, links work, its dock `DOCUMENT · title | [share] [place ↗] [download] [close] esc`.
  Right-click a row: open beside, place on the canvas, share / unshare, download .md, delete (hazard confirm; takes
  the pieces showing it). Focus dock: kinds filter, per page, table/shelf, upload, unfocus.
- Files dropped on it (or anywhere in its focus) are uploaded.

## A document on its own

A window showing one document's content directly: its kind's mark, who, when, length, its title, then its text at
reading size, as wide as the window, cut at the bottom with a fade. Named in its edge by the document's title (no name
of its own). By size on the screen: full → kind + title alone → grey bars; the text isn't read until it's near.

- Made by dragging a row's grip out of the list, from a row's right-click or the reader's `[place ↗]` (put beside the
  list), or by dropping a `.md` on the empty canvas (uploaded, then placed where it was dropped).
- **Private one: asked first.** The piece waits dashed where it was let go, a yellow-taped question inside it:
  `Show "…" to everyone?` with who will see it; `[cancel] esc`, `[share and place] ↵`. Sharing and placing are one undo
  step. A shared one is placed at once.
- In focus: the wheel scrolls it (ctrl/pinch zooms), links work, an **outline** of its headings on the left (the one
  being read lit cyan, a click glides there). Dock: `[share]/[unshare]` (author), `[download]`, `[unfocus]`.
- Deleting the piece leaves the document in its list.

## Not yet

- Images and PDFs (Storage, step 4): upload with thumbnails, pdf.js pages, `[◐ dark]`, an image taking its shape.
- Writing a document in the app (kind `note`); renaming from the UI; the assistant writing documents.
- Viewers uploading (the client's read-only mode refuses it).
- `[unframe]` for a document; comments on a document in a list; documents in the export.
