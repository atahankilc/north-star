// The documents list (D-232): a piece on the canvas listing the documents you may see (the shared ones and your own),
// as a table (kind, title with its first words, by, length, added; heads sort) or a shelf of sheets (each its first
// lines), switched from its console or its focus dock. Drawn in its own px through a view, as a table is (D-209): on the
// canvas a picture, except each row's `⇱` grip, which drags the document out onto the canvas on its own (DocPlace); in
// focus live: a click opens the document beside the list (DocReader), a right-click has the rest (open, place on the
// canvas, share, download, delete). Paged like a table (D-213); which page is yours. Files dropped on it are uploaded.
import { useLayoutEffect, useMemo, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { create } from 'zustand'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { DocumentError, emptyDocuments, refusal, typeOfFile, uploadMarkdown, type Doc, type DocCol, type DocKind, type DocumentsSetup } from '../../data/documents'
import { setDocumentsSetup } from '../../data/pieces'
import { useHistory } from '../../data/history'
import { useAuth } from '../../data/auth'
import type { Bounds, PlaneCam } from '../../state/canvasView'
import { Select } from '../../ui/Select'
import { ago } from '../../ui/ago'
import { useWs } from './context'
import { KindMark, lengthOf } from './DocContent'
import { useOpenSize } from './shownBox'
import styles from './Documents.module.css'

// Its parts in its own px: the table's head and rows, the shelf's sheets.
export const D = { head: 40, row: 54, pad: 16, sheet: { w: 140, h: 186, gap: 16, cols: 5 } }
const COL_W: Record<DocCol | 'grip', number> = { kind: 70, title: 370, by: 130, size: 90, added: 96, grip: 36 }
const COLS: DocCol[] = ['kind', 'title', 'by', 'size', 'added']
const TABLE_W = COLS.reduce((s, c) => s + COL_W[c], 0) + COL_W.grip
const SHELF_W = 2 * D.pad + D.sheet.cols * D.sheet.w + (D.sheet.cols - 1) * D.sheet.gap
const PAGE_SIZES = [10, 20, 50]

const NO_SETUP = emptyDocuments()
export const documentsOf = (p: Pick<Piece, 'documents'>): DocumentsSetup => p.documents ?? NO_SETUP

// What's going on with documents here, not shared: the page each list is on, the document open beside a list in its
// focus, one being dragged out of a list, one waiting to be placed (asked to share first), one about to be deleted.
export const useDocUi = create<{
  pages: Record<string, number>
  reader: string | null
  drag: { docId: string; x: number; y: number } | null
  dropped: { docId: string; x: number; y: number } | null
  // Put on the canvas once it's shared: at `at` (canvas px), or beside `near` (a piece) when asked from a focus.
  placing: { docId: string; at?: [number, number]; near?: string } | null
  deleting: string | null
  uploads: { name: string; state: 'sending' | 'done' | 'refused'; why?: string }[]
}>(() => ({ pages: {}, reader: null, drag: null, dropped: null, placing: null, deleting: null, uploads: [] }))

// The documents a list shows, in its order: its kinds, sorted by a column (newest first when unset).
export function listed(docs: WithId<Doc>[], setup: DocumentsSetup, me?: string) {
  const out = setup.kinds?.length ? docs.filter((d) => setup.kinds!.includes(d.kind)) : [...docs]
  const s = setup.sort ?? { col: 'added', desc: true }
  const by = (d: Doc) => (d.uid === me ? 'you' : d.name).toLowerCase()
  const value = (d: Doc): number | string =>
    s.col === 'title' ? d.title.toLowerCase() : s.col === 'kind' ? d.kind : s.col === 'by' ? by(d) : s.col === 'size' ? (d.words ?? d.sections ?? d.size) : d.createdAt
  out.sort((a, b) => {
    const [x, y] = [value(a), value(b)]
    const c = x < y ? -1 : x > y ? 1 : 0
    return s.desc ? -c : c
  })
  return out
}

export function pagesOf(setup: DocumentsSetup, count: number, page: number | undefined) {
  const size = setup.pageSize
  const pages = size ? Math.max(1, Math.ceil(count / size)) : 1
  const at = Math.min(pages - 1, Math.max(0, page ?? 0))
  return { size, pages, at, from: size ? at * size : 0, to: size ? Math.min(count, (at + 1) * size) : count }
}

// The box round what a list shows on its page, in its px: what fit frames.
export function documentsBounds(piece: Pick<Piece, 'documents'>, count: number): Bounds {
  const setup = documentsOf(piece)
  const n = Math.max(1, setup.pageSize ? Math.min(count, setup.pageSize) : count)
  if (setup.view === 'shelf') {
    const rows = Math.ceil(n / D.sheet.cols)
    return { x: 0, y: 0, w: SHELF_W, h: 2 * D.pad + rows * D.sheet.h + (rows - 1) * D.sheet.gap }
  }
  return { x: 0, y: 0, w: TABLE_W, h: D.head + n * D.row + D.pad }
}

type Props = {
  piece: WithId<Piece>
  view: PlaneCam
  // In focus: rows open, heads sort, right-click works. On the canvas only the grips take the pointer.
  live: boolean
  editor: boolean
  // Opened onto the canvas (D-234): live there, nothing cut at its edge, its size measured for its drawn box; a click
  // on a document calls `onOpen` (the list goes into focus) and opens it beside the list.
  onCanvas?: boolean
  onOpen?: () => void
}

export function DocumentsView({ piece, view, live, editor, onCanvas = false, onOpen }: Props) {
  const { documents } = useWs()
  const { user } = useAuth()
  const me = user?.id
  const setup = documentsOf(piece)
  const all = useMemo(() => listed(documents, setup, me), [documents, setup, me])
  const page = pagesOf(setup, all.length, useDocUi((s) => s.pages[piece.id]))
  const shown = all.slice(page.from, page.to)
  const reader = useDocUi((s) => s.reader)
  const open = (d: WithId<Doc>) => {
    onOpen?.()
    useDocUi.setState({ reader: d.id })
  }
  // Open on the canvas, how big it came out: its box there (shownBox.ts).
  const world = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = world.current
    if (!el || !onCanvas) return
    const ro = new ResizeObserver(() => {
      const next = { w: el.offsetWidth, h: el.offsetHeight }
      const was = useOpenSize.getState()[piece.id]
      if (!was || was.w !== next.w || was.h !== next.h) useOpenSize.setState({ [piece.id]: next })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [onCanvas, piece.id])
  const style: CSSProperties = { transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.zoom})` }
  // A row's or sheet's grip drags it out onto the canvas (editors only): the canvas places it where it's let go.
  const grip = (d: WithId<Doc>) =>
    editor && (!live || onCanvas) ? (
      <span className={styles.grip} data-live title="drag out onto the canvas" aria-label={`Drag "${d.title}" onto the canvas`} onPointerDown={dragOut(d.id)}>
        ⇱
      </span>
    ) : null

  return (
    <div className={styles.layer} data-live={live || undefined} data-on-canvas={onCanvas || undefined}>
      <div ref={world} className={styles.world} style={style}>
        {all.length === 0 ? (
          <div className={styles.empty} style={{ width: TABLE_W }}>
            <p>No documents yet.</p>
            <p className={styles.emptyHint}>Drop .md files here{live ? ', or [upload] below' : ''}. Images and PDFs come with Storage.</p>
          </div>
        ) : setup.view === 'shelf' ? (
          <div className={styles.shelf} style={{ width: SHELF_W, padding: D.pad, gap: D.sheet.gap, gridTemplateColumns: `repeat(${D.sheet.cols}, ${D.sheet.w}px)` }}>
            {shown.map((d) => (
              <div
                key={d.id}
                className={styles.sheet}
                style={{ height: D.sheet.h }}
                data-lit={reader === d.id || undefined}
                data-target={live ? `doc:${d.id}` : undefined}
                // A press here is the row's until it moves (the focus's pan would take the click, D-217).
                data-cell={live || undefined}
                onClick={live ? () => open(d) : undefined}
                title={d.title}
              >
                <span className={styles.fold} aria-hidden />
                <span className={styles.sheetHead}>
                  <KindMark kind={d.kind} />
                  {!d.shared && <span className={styles.private}>◐</span>}
                </span>
                <span className={styles.sheetTitle}>{d.title}</span>
                <SheetLines d={d} />
                <span className={styles.sheetFoot}>
                  <span>{d.uid === me ? 'you' : d.name}</span>
                  <span>{ago(d.createdAt)}</span>
                </span>
                {grip(d)}
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.table} style={{ width: TABLE_W }}>
            <div className={styles.headRow} style={{ height: D.head }}>
              {COLS.map((c) => (
                <Head key={c} col={c} setup={setup} live={live && editor} piece={piece} />
              ))}
            </div>
            {shown.map((d) => (
              <div
                key={d.id}
                className={styles.row}
                style={{ height: D.row }}
                data-lit={reader === d.id || undefined}
                data-target={live ? `doc:${d.id}` : undefined}
                data-cell={live || undefined}
                onClick={live ? () => open(d) : undefined}
              >
                <span className={styles.cell} style={{ width: COL_W.kind }}>
                  <KindMark kind={d.kind} />
                </span>
                <span className={styles.cell} style={{ width: COL_W.title }}>
                  <span className={styles.title}>{d.title}</span>
                  {d.excerpt && <span className={styles.excerpt}>{d.excerpt}</span>}
                </span>
                <span className={styles.cell} style={{ width: COL_W.by }}>
                  <span className={styles.by}>{d.uid === me ? 'you' : d.name}</span>
                  {!d.shared && (
                    <span className={styles.private} title="only you see this until you share it">
                      ◐
                    </span>
                  )}
                </span>
                <span className={`${styles.cell} ${styles.num}`} style={{ width: COL_W.size }}>
                  {lengthOf(d)}
                </span>
                <span className={styles.cell} style={{ width: COL_W.added }}>
                  {ago(d.createdAt)}
                </span>
                <span className={styles.cell} style={{ width: COL_W.grip }}>
                  {grip(d)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// A sheet's lines: the first words of its text, a grey bar a line when there are none.
function SheetLines({ d }: { d: Doc }) {
  if (d.excerpt) return <span className={styles.sheetText}>{d.excerpt}</span>
  return (
    <span className={styles.bars} aria-hidden>
      {[90, 100, 70, 85, 60].map((w, i) => (
        <i key={i} style={{ width: `${w}%` }} />
      ))}
    </span>
  )
}

const COL_NAME: Record<DocCol, string> = { kind: 'kind', title: 'title', by: 'by', size: 'length', added: 'added' }

// A column's head: a click sorts by it (up, down, then back to newest first).
function Head({ col, setup, live, piece }: { col: DocCol; setup: DocumentsSetup; live: boolean; piece: WithId<Piece> }) {
  const { wid } = useWs()
  const s = setup.sort ?? { col: 'added' as DocCol, desc: true }
  const on = s.col === col
  const next = (): DocumentsSetup['sort'] => (!on ? { col, desc: col === 'added' || col === 'size' } : s.desc === (col === 'added' || col === 'size') ? { col, desc: !s.desc } : undefined)
  return (
    <button
      className={styles.head}
      style={{ width: COL_W[col] }}
      data-on={on || undefined}
      disabled={!live}
      onClick={live ? () => void setDocumentsSetup(wid, piece, { sort: next() }) : undefined}
      title={live ? `sort by ${COL_NAME[col]}` : undefined}
    >
      {COL_NAME[col]}
      {on && <span aria-hidden>{s.desc ? ' ↓' : ' ↑'}</span>}
    </button>
  )
}

// Dragging a document out of the list (D-232): the canvas draws it under the pointer and places it where it's let go.
const dragOut = (docId: string) => (e: ReactPointerEvent<HTMLElement>) => {
  if (e.button !== 0) return
  e.stopPropagation()
  e.preventDefault()
  const [sx, sy] = [e.clientX, e.clientY]
  let moving = false
  const move = (ev: PointerEvent) => {
    if (!moving && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return
    moving = true
    useDocUi.setState({ drag: { docId, x: ev.clientX, y: ev.clientY } })
  }
  const up = (ev: PointerEvent) => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    useDocUi.setState({ drag: null, dropped: moving && ev.type === 'pointerup' ? { docId, x: ev.clientX, y: ev.clientY } : null })
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}

// Files given to the workspace (dropped, or picked from `[upload]`): .md goes up now; anything else says why not.
// Each upload's line shows in the list's tools until it's done. The new documents' ids, in order.
export async function uploadFiles(wid: string, who: { uid: string; name: string }, files: File[]): Promise<string[]> {
  const say = useHistory.getState().say
  const ids: string[] = []
  for (const f of files) {
    const why = refusal(f)
    const line = { name: f.name, state: why ? ('refused' as const) : ('sending' as const), ...(why ? { why } : {}) }
    useDocUi.setState((s) => ({ uploads: [...s.uploads.filter((u) => u.name !== f.name), line] }))
    if (why) {
      say(`${f.name}: ${why}`)
      continue
    }
    if (typeOfFile(f) !== 'text/markdown') continue
    try {
      ids.push(await uploadMarkdown(wid, who, f))
      useDocUi.setState((s) => ({ uploads: s.uploads.map((u) => (u.name === f.name ? { ...u, state: 'done' } : u)) }))
    } catch (e) {
      const msg = e instanceof DocumentError ? e.message : "couldn't upload it"
      useDocUi.setState((s) => ({ uploads: s.uploads.map((u) => (u.name === f.name ? { ...u, state: 'refused', why: msg } : u)) }))
      say(`${f.name}: ${msg}`)
    }
  }
  // The lines go a moment after the last one's done.
  setTimeout(() => useDocUi.setState((s) => ({ uploads: s.uploads.filter((u) => u.state === 'sending') })), 2400)
  return ids
}

// `[upload]`: a hidden file input behind a bracketed action.
export function UploadAction({ className }: { className?: string }) {
  const { wid } = useWs()
  const { user } = useAuth()
  const input = useRef<HTMLInputElement>(null)
  if (!user) return null
  return (
    <>
      <button className={className ?? styles.tool} title="add .md files (images and PDFs come with Storage)" onClick={() => input.current?.click()}>
        upload
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept=".md,.markdown,text/markdown,image/*,application/pdf"
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          if (files.length) void uploadFiles(wid, { uid: user.id, name: user.name || user.email || 'someone' }, files)
        }}
      />
    </>
  )
}

const ALL = 'all'
const KIND_FILTER: { value: string; label: string; kinds?: DocKind[] }[] = [
  { value: ALL, label: 'every kind' },
  { value: 'markdown', label: 'md', kinds: ['markdown'] },
  { value: 'report', label: 'reports', kinds: ['report'] },
  { value: 'image', label: 'images', kinds: ['image'] },
  { value: 'pdf', label: 'pdfs', kinds: ['pdf'] },
]

// The list's tools, in its focus dock and in its console once unframed (D-234): its pages, which kinds, how many a
// page, table or shelf, upload. Framed, its console has none of them. `compact`: only the pages, table or shelf, upload.
export function DocumentsTools({ piece, editor, toolClass, compact = false }: { piece: WithId<Piece>; editor: boolean; toolClass?: string; compact?: boolean }) {
  const { wid, documents } = useWs()
  const { user } = useAuth()
  const setup = documentsOf(piece)
  const count = useMemo(() => listed(documents, setup, user?.id).length, [documents, setup, user?.id])
  const p = pagesOf(setup, count, useDocUi((s) => s.pages[piece.id]))
  const go = (at: number) => useDocUi.setState((s) => ({ pages: { ...s.pages, [piece.id]: at } }))
  const uploads = useDocUi((s) => s.uploads)
  const tool = toolClass ?? styles.tool
  const kindValue = setup.kinds?.length === 1 ? setup.kinds[0] : ALL
  return (
    <span className={styles.tools} role="group" aria-label="Documents">
      {uploads.map((u) => (
        <span key={u.name} className={styles.upload} data-state={u.state} title={u.why}>
          {u.state === 'sending' ? '◌' : u.state === 'done' ? '✓' : '×'} {u.name.length > 18 ? `${u.name.slice(0, 17)}…` : u.name}
          {u.why ? ` · ${u.why}` : ''}
        </span>
      ))}
      {p.size && p.pages > 1 && (
        <>
          <button className={tool} disabled={p.at === 0} aria-label="Page before" onClick={() => go(p.at - 1)}>
            ‹
          </button>
          <span className={styles.pageAt}>
            {p.at + 1} / {p.pages}
          </span>
          <button className={tool} disabled={p.at >= p.pages - 1} aria-label="Page after" onClick={() => go(p.at + 1)}>
            ›
          </button>
        </>
      )}
      {editor && (
        <>
          {!compact && <Select<string>
            ariaLabel="Which kinds"
            className={styles.pick}
            value={kindValue}
            options={KIND_FILTER.map((k) => ({ value: k.value, label: k.label }))}
            onChange={(v) => {
              go(0)
              void setDocumentsSetup(wid, piece, { kinds: KIND_FILTER.find((k) => k.value === v)?.kinds })
            }}
          />}
          {!compact && <Select<string>
            ariaLabel="Documents a page"
            className={styles.pick}
            value={p.size ? String(p.size) : ALL}
            options={[{ value: ALL, label: `all ${count}` }, ...PAGE_SIZES.map((n) => ({ value: String(n), label: `${n} a page` }))]}
            onChange={(v) => {
              go(0)
              void setDocumentsSetup(wid, piece, { pageSize: v === ALL ? undefined : Number(v) })
            }}
          />}
          {/* Table or shelf (D-232): shared, like its sort. */}
          <span className={styles.switch} role="radiogroup" aria-label="Show as">
            {(['table', 'shelf'] as const).map((v) => (
              <button key={v} className={tool} role="radio" aria-checked={setup.view === v} data-on={setup.view === v || undefined} onClick={() => setup.view !== v && void setDocumentsSetup(wid, piece, { view: v })}>
                {v}
              </button>
            ))}
          </span>
        </>
      )}
      <UploadAction className={tool} />
    </span>
  )
}
