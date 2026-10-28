// /workspaces/:wid: loads one workspace and its canvas (D-036, D-174). There are no pages: the old views are archived
// (src/archive/, D-177) and come back as pieces on the canvas.
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { WORKSPACES, workspacePath } from '../../app/paths'
import { useAuth } from '../../data/auth'
import { setReadOnly } from '../../data/history'
import type { WithId } from '../../data/hooks'
import type { JoinRequest, PieceKind } from '../../data/model'
import { addPiece, isBare, KIND_NAME, kindOfPiece } from '../../data/pieces'
import type { MatrixSetup } from '../../data/matrix'
import { matrixBounds, useMatrixUi } from './Matrix'
import { MatrixWizard } from './MatrixWizard'
import { TableWizard } from './TableWizard'
import { KanbanWizard } from './KanbanWizard'
import { useKanbanUi } from './Kanban'
import { tableBounds, useTableUi } from './Table'
import { shownPieces } from './shownBox'
import type { TableSetup } from '../../data/table'
import { addCard, CARD_TYPES, type CardType } from '../../data/cards'
import { cardsOn } from '../../data/places'
import { addLabel, CANVAS, PARA_W, STICKY_H, STICKY_W, TITLE_W } from '../../data/labels'
import { snap } from '../../data/grid'
import { labelBox, useAuthor } from './TextItems'
import { spaceBounds } from './spaceBounds'
import { TYPE_ACCENT } from './PlaneCards'
import { InboxButton } from './ThreadInbox'
import { MyTasks } from './MyTasks'
import { openFinder, useFind } from './find'
import { Finder } from './Finder'
import { PIECE_GLYPH, TEXT_GLYPH } from './glyphs'
import { usePresenceSession } from '../../data/presence'
import { useWorkspaceData } from '../../data/workspaceData'
import { documentsBounds, documentsOf, listed, pinnedView, readerLeft, useDocUi } from './Documents'
import { documentHome } from './DocumentPiece'
import {
  canEditIn,
  describeWorkspace,
  DESCRIPTION_MAX,
  ensureMemberEntry,
  isOwnerOf,
  renameWorkspace,
  useJoinRequests,
  useWorkspace,
} from '../../data/workspaces'
import { canvasCenter, fitCanvas, fitPlane, setEditing, useCanvasView, type PlaneCam } from '../../state/canvasView'
import { useHoldCurtain } from '../../state/curtain'
import { AsciiButton } from '../../ui/AsciiButton'
import { AutosaveField } from '../../ui/AutosaveField'
import { DecodeText } from '../../ui/DecodeText'
import { Hud } from '../../ui/Hud'
import { InlineEdit } from '../../ui/InlineEdit'
import { Menu } from '../../ui/Menu'
import { PeopleHere } from '../../ui/PeopleHere'
import { Note, Row, Section, type WorkspacePage } from '../../ui/Settings'
import { Toast } from '../../ui/Toast'
import { CanvasView } from './CanvasView'
import { useWs, WorkspaceContext, type WorkspaceCtx } from './context'
import { PeopleSettings } from './PeopleSettings'
import { exportWorkspace } from '../../data/exportWorkspace'
import { download, fileSlug, zipBundle } from '../../io/bundle'
import { useEditKeys } from './useEditKeys'
import styles from './WorkspaceLayout.module.css'

const VIEWER = "You're a viewer in this workspace: an owner can make you an editor."

export function WorkspaceLayout() {
  const { wid = '' } = useParams()
  const workspace = useWorkspace(wid)
  useHoldCurtain('workspace', workspace.isLoading)

  if (workspace.isLoading) return <Status text="Loading workspace" />
  if (workspace.error || !workspace.data) {
    return <Status text="Workspace not found, or you're not a member" back />
  }
  return <Loaded wid={wid} workspace={workspace.data} />
}

function Loaded({ wid, workspace }: { wid: string; workspace: WorkspaceCtx['workspace'] }) {
  const { user } = useAuth()
  const { data, isLoading } = useWorkspaceData(wid)
  useHoldCurtain('canvas', isLoading)
  const ctx = useMemo<WorkspaceCtx>(() => ({ ...data, wid, workspace }), [data, wid, workspace])
  const isOwner = isOwnerOf(workspace, user?.id)
  const editor = canEditIn(workspace, user?.id)
  // Only owners may list who's asking (D-098); any of them settles a request.
  const requests = useJoinRequests(isOwner ? wid : null)
  // Your name in the people list (D-098), written when it's missing or changed.
  useEffect(() => {
    if (user) ensureMemberEntry(wid, user).catch(() => {})
  }, [wid, user])
  // Viewers read only (D-098): tracked writes are refused with a toast, and the canvas makes and moves nothing.
  useEffect(() => {
    if (editor) return
    setReadOnly(VIEWER, 'viewer')
    return () => setReadOnly(null, 'viewer')
  }, [editor])
  // Presence (D-065): who's here. The canvas is the only view (D-174).
  usePresenceSession(wid, user, 'canvas')
  useEditKeys(wid)
  // A plane in focus (D-184) is the view: its name ends the breadcrumb, and the canvas's `+` goes away.
  const focusId = useSearchParams()[0].get('focus')
  const focused = focusId ? data.pieces.find((p) => p.id === focusId) : undefined

  return (
    <WorkspaceContext.Provider value={ctx}>
      <div className={styles.app} data-app>
        <Hud
          crumbs={[
            { label: 'workspaces', to: WORKSPACES },
            focused ? { label: workspace.name, to: workspacePath(wid) } : { label: workspace.name },
            // A document on its own goes by its document's title (D-232).
            ...(focused ? [{ label: focused.name || data.documents.find((d) => d.id === focused.docId)?.title || KIND_NAME[kindOfPiece(focused)] }] : []),
          ]}
          settings={(page) => <WorkspaceSettings page={page} wid={wid} workspace={workspace} requests={requests.data} />}
          settingsName={workspace.name}
          settingsBadge={requests.data.length}
          corner={
            <>
              {/* Who's here, then the threads, just above your square (D-193). */}
              <PeopleHere />
              <InboxButton wid={wid} threads={data.threads} />
            </>
          }
          mine={<MyTasks />}
          side={
            <>
              {/* A matrix or a table in focus takes its rows and columns from its setup (D-204, D-209), not from `+`. */}
              {editor && !(focused && isBare(focused)) && <AddToCanvas wid={wid} plane={focused?.id ?? null} />}
              <FitButton wid={wid} plane={focused?.id ?? null} />
              <FinderButton />
            </>
          }
        />
        {!isLoading && <CanvasView />}
        {!isLoading && <Finder />}
        <Toast />
      </div>
    </WorkspaceContext.Provider>
  )
}

// The side nav's fit (D-186), under the `+`; `0` does the same: everything on the canvas in view, or in focus the plane's
// contents centred and fitted.
function FitButton({ wid, plane }: { wid: string; plane: string | null }) {
  const { pieces, cards, edges, labels, documents, places } = useWs()
  const { user } = useAuth()
  const focused = plane !== null
  const matrix = pieces.find((p) => p.id === plane && kindOfPiece(p) === 'matrix')
  const table = pieces.find((p) => p.id === plane && kindOfPiece(p) === 'table')
  const docs = pieces.find((p) => p.id === plane && kindOfPiece(p) === 'documents')
  const reader = useDocUi((s) => s.readers.length > 0 && !s.listHidden)
  const docsBounds = (p: NonNullable<typeof docs>) => documentsBounds(p, listed(documents, documentsOf(p), user?.id).length)
  const setPlaneCam = (to: PlaneCam) => useCanvasView.setState({ planeCam: to })
  const one = pieces.find((p) => p.id === plane && kindOfPiece(p) === 'document')
  return (
    <button
      className={styles.fit}
      aria-label={focused ? 'Fit the plane to the screen' : 'Fit everything on the canvas'}
      title={focused ? 'fit the plane (0)' : 'fit everything (0)'}
      onClick={() =>
        focused
          ? docs && reader
            ? // The list beside its open document: pinned top-left in its part (D-232).
              setPlaneCam(pinnedView(docsBounds(docs), readerLeft(docsBounds(docs), useCanvasView.getState().size.w, useDocUi.getState().readerAt)))
            : one
              ? // A document: at 100 %, its top near the top.
                setPlaneCam(documentHome(one, useCanvasView.getState().size.w))
              : fitPlane(matrix ? matrixBounds(matrix, cards) : table ? tableBounds(table, cards) : docs ? docsBounds(docs) : spaceBounds(plane ? cardsOn(cards, places, plane) : [], edges, labels.filter((l) => l.pieceId === plane), [], plane ?? undefined))
          : fitCanvas(wid, [...shownPieces(pieces, cards), ...labels.filter((l) => l.pieceId === CANVAS).map(labelBox)])
      }
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <path d="M1 6V1h5M12 1h5v5M17 12v5h-5M6 17H1v-5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="6" y="6" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
    </button>
  )
}

// The side nav's compass, under fit: the finder (D-236), which is go to too (D-196): the places with nothing typed (↓),
// anything in the workspace once something is. ⌘F does the same.
function FinderButton() {
  const open = useFind((s) => s.open)
  return (
    <button className={styles.fit} data-on={open || undefined} aria-pressed={open} aria-label="Find and go to" title="find, go to (⌘F)" onClick={openFinder}>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        {/* A compass, its needle to the north. */}
        <circle cx="9" cy="9" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9 3.5 11 9H7z" fill="currentColor" />
        <path d="M7 9h4l-2 5.5z" fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

// Each card type's letter in the `+` prompt (D-222): `+` then `c` Enter makes a customer.
const CARD_LETTER: Record<CardType, string> = { customer: 'c', problem: 'r', competitor: 'o', idea: 'i', feature: 'f' }

// The side nav's `+` (D-176): on the canvas a plane (D-180) at the middle of the screen, selected; in a focused plane a
// card (D-187), at the middle of its view, its title ready to type. In both, text (D-188): a heading, a paragraph or a
// sticky note in the middle, typed at once; a section drawn with the crosshair; the project title (on the canvas, one).
// Viewers make nothing (D-098).
function AddToCanvas({ wid, plane }: { wid: string; plane: string | null }) {
  const { pieces, cards, labels, places } = useWs()
  const me = useAuthor()
  const hasTitle = labels.some((l) => l.kind === 'title')
  // The middle of the screen in the open space's px.
  const middle = (): [number, number] | null => {
    const { planeCam: c, size } = useCanvasView.getState()
    if (!plane) return canvasCenter(wid)
    return c ? [(size.w / 2 - c.ox) / c.zoom, (size.h / 2 - c.oy) / c.zoom] : null
  }
  const addText = async (what: 'heading' | 'paragraph' | 'sticky' | 'title') => {
    const at = middle()
    if (!at) return
    const space = plane ?? CANVAS
    const fields =
      what === 'heading'
        ? { size: 'heading' as const, w: undefined, dx: 150, dy: 30 }
        : what === 'paragraph'
          ? { size: 'note' as const, w: PARA_W.initial, dx: PARA_W.initial / 2, dy: 40 }
          : what === 'sticky'
            ? { kind: 'sticky' as const, w: STICKY_W.initial, color: 'yellow' as const, ...me, dx: STICKY_W.initial / 2, dy: STICKY_H / 2 }
            : { kind: 'title' as const, w: TITLE_W.initial, dx: TITLE_W.initial / 2, dy: 80 }
    const { dx, dy, ...rest } = fields
    const id = await addLabel(wid, { pieceId: space, text: '', ...rest, x: snap(at[0] - dx), y: snap(at[1] - dy) })
    useCanvasView.setState({ labelSelected: id, labelEditing: id, fresh: id, cardSelected: null, selected: null })
  }
  const text = [
    { key: 'text', heading: 'text' },
    { key: 'heading', label: 'heading', glyph: TEXT_GLYPH.heading, letter: 'h', onSelect: () => void addText('heading') },
    { key: 'paragraph', label: 'paragraph', glyph: TEXT_GLYPH.paragraph, letter: 'a', onSelect: () => void addText('paragraph') },
    { key: 'sticky', label: 'sticky note', glyph: TEXT_GLYPH.sticky, letter: 'n', tone: 'var(--accent-yellow)', onSelect: () => void addText('sticky') },
    { key: 'section', label: 'section', glyph: TEXT_GLYPH.section, letter: 's', hint: 'draw', onSelect: () => useCanvasView.setState({ drawing: plane ?? CANVAS }) },
    // The project title goes on the canvas only, once (D-190).
    ...(hasTitle || plane ? [] : [{ key: 'title', label: 'project title', glyph: TEXT_GLYPH.title, letter: 'i', onSelect: () => void addText('title') }]),
  ]
  const add = async (kind: PieceKind, template?: { name: string; setup: () => MatrixSetup | TableSetup }) => {
    const id = await addPiece(wid, kind, canvasCenter(wid), shownPieces(pieces, cards), template?.setup(), template?.name)
    // Where you're looking, in edit mode, to be moved where you want it.
    setEditing(id, true)
  }
  const bringHere = () => {
    const r = document.querySelector('[aria-label="Add to the plane"]')?.getBoundingClientRect()
    if (plane && r) useCanvasView.setState({ bringing: { plane, at: null, screen: [r.right + 8, r.top] } })
  }
  const addHere = async (type: CardType) => {
    const { planeCam: c, size } = useCanvasView.getState()
    if (!plane || !c) return
    const at: [number, number] = [(size.w / 2 - c.ox) / c.zoom, (size.h / 2 - c.oy) / c.zoom]
    const id = await addCard(wid, plane, type, at, cardsOn(cards, places, plane))
    useCanvasView.setState({ cardSelected: id, cardEditing: id, fresh: id })
  }
  return (
    <>
      <Menu
        icon
        right
        label={
          // Drawn, not a glyph: a font's `+` is small and sits off centre.
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
            <path d="M10 2v16M2 10h16" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        }
        ariaLabel={plane ? 'Add to the plane' : 'Add to the canvas'}
        prompt="add…"
        items={
          plane
            ? [
                { key: 'cards', heading: 'card' },
                ...CARD_TYPES.map((t) => ({ key: t, label: t, glyph: '▌', letter: CARD_LETTER[t], tone: TYPE_ACCENT[t], onSelect: () => void addHere(t) })),
                // One already on another plane (D-281): the menu turns into the list of them, opening where it did.
                { key: 'existing', label: 'existing card…', glyph: '⧉', letter: 'e', hint: 'from another plane', onSelect: () => bringHere() },
                // A package (D-240): picked from the plane's cards, as a section is drawn.
                { key: 'package', label: 'package', glyph: '▣', letter: 'k', tone: TYPE_ACCENT.package, hint: 'select', onSelect: () => useCanvasView.setState({ packing: plane, drawing: null }) },
                ...text,
              ]
            : [
                { key: 'canvas', heading: 'on the canvas' },
                { key: 'plane', label: 'plane', glyph: PIECE_GLYPH.plane, letter: 'p', onSelect: () => void add('plane') },
                // A matrix (D-204), made in its wizard (D-212); its setup changes all of it after.
                { key: 'matrix', label: 'matrix…', glyph: PIECE_GLYPH.matrix, letter: 'm', hint: 'two lists crossed', onSelect: () => useMatrixUi.setState({ wizard: true }) },
                // A table (D-209), made in its wizard (D-218), as a matrix is.
                { key: 'table', label: 'table…', glyph: PIECE_GLYPH.table, letter: 't', hint: 'rows by rules, any columns', onSelect: () => useTableUi.setState({ wizard: true }) },
                // The documents list (D-232); a document on its own comes out of it (or a file dropped on the canvas).
                { key: 'documents', label: 'documents', glyph: PIECE_GLYPH.documents, letter: 'd', hint: '.md, images, pdfs', onSelect: () => void add('documents') },
                // A kanban (D-251): the team's tasks in columns, or cards by a field (D-268), made in its wizard.
                { key: 'kanban', label: 'kanban…', glyph: PIECE_GLYPH.kanban, letter: 'k', hint: 'tasks or cards in columns', onSelect: () => useKanbanUi.setState({ wizard: true }) },
                // A timeline (D-262): the kanbans' tasks on a row of days.
                { key: 'timeline', label: 'timeline', glyph: PIECE_GLYPH.timeline, letter: 'l', hint: 'tasks by due day', onSelect: () => void add('timeline') },
                ...text,
              ]
        }
      />
      {/* A new matrix's wizard (D-212), opened from the item above. */}
      <MatrixWizard />
      {/* A new table's wizard (D-218). */}
      <TableWizard />
      {/* A new kanban's wizard (D-268). */}
      <KanbanWizard />
    </>
  )
}

// The workspace's pages in the settings modal (D-054, D-064, D-097): general (name, what we're building) and people
// (PeopleSettings.tsx: members and roles, requests, invites, the code; D-062, D-098) and export (D-080, D-246).
type SettingsProps = { page: WorkspacePage; wid: string; workspace: WorkspaceCtx['workspace']; requests: WithId<JoinRequest>[] }

function WorkspaceSettings({ page, wid, workspace, requests }: SettingsProps) {
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const editor = canEditIn(workspace, user?.id)

  if (page === 'people') return <PeopleSettings wid={wid} workspace={workspace} requests={requests} />
  if (page === 'export') return <ExportSection wid={wid} workspace={workspace} />

  const run = (p: Promise<unknown>) => {
    setError(null)
    p.catch((e: Error) => setError(e.message))
  }
  return (
    <>
      <Section label="about" note={editor ? undefined : "You're a viewer here: an owner can make you an editor."}>
        <Row label="name" hint="Shown in the breadcrumb and on the workspaces page.">
          {editor ? <InlineEdit label="workspace" value={workspace.name} onSave={(n) => renameWorkspace(wid, n)} /> : <span>{workspace.name}</span>}
        </Row>
        <Row label="what we're building" hint="A sentence or two. The assistant reads it first.">
          {editor ? (
            <AutosaveField
              multiline
              rows={3}
              className={`${styles.input} ${styles.about}`}
              label="what we're building"
              placeholder="e.g. Tablebook: shift scheduling for independent restaurants"
              maxLength={DESCRIPTION_MAX}
              value={workspace.description ?? ''}
              onSave={(d) => run(describeWorkspace(wid, d))}
            />
          ) : (
            <span>{workspace.description || 'not written yet'}</span>
          )}
        </Row>
      </Section>
      {error && <Note tone="error">! {error}</Note>}
    </>
  )
}

// The whole workspace as a .zip (D-246), read fresh when asked; what was packed is said after.
function ExportSection({ wid, workspace }: { wid: string; workspace: WorkspaceCtx['workspace'] }) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [packed, setPacked] = useState<string | null>(null)

  const run = async () => {
    if (!user) return
    setBusy(true)
    setError(null)
    setPacked(null)
    try {
      const { bundle, leftOut } = await exportWorkspace(wid, user.id, workspace)
      download(zipBundle(bundle), `${fileSlug(workspace.name)}-${new Date().toISOString().slice(0, 10)}.zip`)
      const cards = bundle.customers.length + bundle.problems.length + bundle.competitors.length + bundle.ideas.length + bundle.features.length + bundle.packages.length
      const n = (count: number, one: string) => `${count} ${one}${count === 1 ? '' : 's'}`
      setPacked(
        `Packed ${n(bundle.pieces.length, 'piece')}, ${n(cards, 'card')}, ${n(bundle.edges.length, 'link')}, ${n(bundle.labels.length, 'text item')}, ` +
          `${n(bundle.cells.length, 'cell')} and ${n(bundle.documents.length, 'document')}.` +
          (leftOut ? ` ${n(leftOut, 'file')} (images, PDFs) stayed behind: files can't travel until Storage is live.` : ''),
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Section
        label="files"
        note={
          <>
            <p>
              The .zip holds everything on the canvas: planes and their cards, links, evidence, competitor features, packages,
              text, matrices and tables with their cells, and the documents you can see. Import it from the workspaces page to
              make a copy you own. Members, invite codes and comment threads stay here.
            </p>
            {packed && <p>{packed}</p>}
          </>
        }
      >
        <Row label="workspace" hint="Everything, to import again later.">
          <AsciiButton accent="cyan" onClick={() => void run()} disabled={busy}>
            {busy ? 'packing' : 'download .zip'}
          </AsciiButton>
        </Row>
      </Section>
      {error && <Note tone="error">! {error}</Note>}
    </>
  )
}

function Status({ text, back }: { text: string; back?: boolean }) {
  return (
    <main className={styles.status}>
      <p>
        <DecodeText text={text} />
      </p>
      {back && (
        <Link to={WORKSPACES} className={styles.backLink}>
          ← back to workspaces
        </Link>
      )}
    </main>
  )
}
