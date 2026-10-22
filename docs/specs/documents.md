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

A window on the canvas like the table (D-208): name in the top edge, console in the corner, no `+` marks. Framed,
its console is only `[focus] [edit]`: table or shelf, upload, kinds and pages are set in its focus (or on it once
unframed).

- **Table**: kind · title (+ first words) · by (◐ = only you) · length (words, §, pages, size) · added; heads sort.
- **Shelf**: sheets of paper with a folded corner: kind, title (3 lines), first words, by, when.
- On the canvas a picture, except each row's `⇱` grip (editors), which drags the document out onto the canvas.
- In focus it's live. A click opens the document **beside** the list: the list is pinned to the top-left at its own
  size (fitted to its part's width, never over 100 %), the document takes the rest of the screen; the line between
  drags and the list refits at once. The document scrolls like a page, links work, "on this page" lists its sections
  (the one being read lit, a click scrolls there; a row on top when the part is narrow), its dock
  `DOCUMENT | [share] [place ↗] [download] [−] 100% [+] [close] esc` (ctrl+wheel zooms too, 50–200 %).
- `[⧉ side by side]` (the list's dock) makes a click open a document next to the ones open (up to four, equal columns,
  a narrow one's dock as marks), right-click `open next to the others` too. `[hide list]` puts the list away: the
  documents take the screen, `[≡ list] [unfocus] esc` top-left; Escape then goes straight to the canvas. Each
  document's dock has `[delete]` (its author, an owner a shared one; asks first).
- From an unframed list on the canvas, a click opens the document on the whole screen with the list put away.
- **Escape:** with the list there, it closes the last document opened. With the list put away: a framed list comes back
  (the documents close), an unframed one goes straight to the canvas. `[close]` on the last document does the same.
  The list's button is `[≡ list]` in the first document's dock; nothing stays down the left.
- **Row actions:** each row (and sheet) in the list's focus has its actions as marks on its right: ✎ rename (its
  author, typed over in place), ◐ share/unshare, ↗ place, ↓ download, ⌫ delete (asks first). Right-click has them too.
- Switching table and shelf (or kinds, a page) fits the list again. The table has no empty column at its end.
- The shelf is only as wide as its sheets (up to five a row). Framed, nothing on the list takes a click; the `⇱`
  grips show only once it's unframed.
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
- In focus: it arrives at 100 % with its top near the top; the wheel scrolls it (ctrl/pinch zooms), links work, an
  **outline** of its headings on the left (the one being read lit cyan, a click glides there). Dock:
  `[share]/[unshare]` (author), `[download]`, `[−] 100% [+]`, `[unfocus]`.
- Deleting the piece leaves the document in its list.

## Unframed (D-234)

Both pieces take D-228's `[unframe]` / `[frame]` (edit mode): out of the window onto the canvas, on a feathered page,
live there. The list sorts, drags documents out, shows all its tools in its console; a click on a document goes into
the list's focus with it beside. A document shows all of its text, links work. Their size there is measured as drawn.

## Not yet

- Images and PDFs (Storage, step 4): upload with thumbnails, pdf.js pages, `[◐ dark]`, an image taking its shape.
- Writing a document in the app (kind `note`); renaming from the UI; the assistant writing documents.
- Viewers uploading (the client's read-only mode refuses it).
- Comments on a document in a list; documents in the export.
