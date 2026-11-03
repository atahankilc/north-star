// One record per piece kind (D-361): what each kind that isn't a plane draws (in its window, open on the canvas, in
// focus), how big its contents are, how its focus fits them, its setup panel (and the store saying whose is open), and
// its tools in the focus dock and on its console. CanvasView and Beside read the record; a new kind is one more entry
// here, and TypeScript refuses it until every part is given. A plane is the canvas's own (its cards and text), not here.
import { memo, type ComponentType, type ReactNode } from 'react'
import type { StoreApi, UseBoundStore } from 'zustand'
import type { WithId } from '../../../data/hooks'
import type { Piece, PieceKind } from '../../../data/model'
import type { Doc } from '../../../data/documents'
import type { Card } from '../../../data/cards'
import type { Task } from '../../../data/tasks'
import { kindOfPiece } from '../../../data/pieces'
import type { Bounds, PlaneCam } from '../../../state/canvasView'
import type { Cell } from '../../../data/matrix'
import type { FindItem } from '../find/find'
import { M, matrixBounds, matrixFindItems, MatrixView, toggleMatrixSetup, useMatrixUi } from '../matrix/Matrix'
import { MatrixSetupPanel } from '../matrix/MatrixSetup'
import { tableBounds, tableFindItems, TablePager, TableView, useTableUi, type FieldText } from '../table/Table'
import { TableSetupPanel } from '../table/TableSetup'
import { kanbanBounds, KanbanDockTools, KanbanLanes, KanbanView, useKanbanUi } from '../deck/Kanban'
import { KanbanSetupPanel } from '../deck/KanbanSetup'
import { KanbanFilterDock } from '../deck/KanbanFilterDock'
import { timelineBounds, TimelineDockTools, TimelineView, TimelineWeeks } from '../deck/Timeline'
import { documentsBounds, documentsFindItems, documentsOf, DocumentsTools, DocumentsView, listed, useDocUi } from '../documents/Documents'
import { DocFocus, documentBounds, DocumentPieceView } from '../documents/DocumentPiece'
import { DockAction } from './FocusDock'

export type LensKind = Exclude<PieceKind, 'plane'>

// How a kind is drawn wherever it shows: in its window (`live` false), open on the canvas (`onCanvas`), in focus.
// `onFocus`: what takes it into focus (a documents list's row, a document's `[continue reading ↗]`, open on the canvas).
// `page`: a table's or list's page to show (the finder's preview, D-236).
export type ShownProps = { piece: WithId<Piece>; view: PlaneCam; live: boolean; editor: boolean; onCanvas?: boolean; onFocus?: () => void; page?: number }

// What its contents' box is worked out from.
export type BoundsCtx = { cards: Card[]; tasks: Task[]; pieces: WithId<Piece>[]; documents: WithId<Doc>[]; me?: string }
// And what the finder reads its matches from.
export type FindCtx = BoundsCtx & { cells: Cell[]; fieldText: FieldText }

type SetupStore = UseBoundStore<StoreApi<{ setup: string | null }>>
type PieceProps = { piece: WithId<Piece>; editor: boolean }

export type KindRecord = {
  Shown: ComponentType<ShownProps>
  // Its focus when it isn't its Shown on the focus's view (a document: its page with its own dock).
  Focused?: ComponentType<{ piece: WithId<Piece>; onUnfocus: () => void }>
  bounds: (piece: WithId<Piece>, ctx: BoundsCtx) => Bounds
  // Fitted whole in its window, a little room round it (a matrix, a timeline: two weeks are wider than any window), or at
  // its own size from the top-left (D-208, D-214).
  fitted: boolean
  setup?: { store: SetupStore; toggle: (id: string) => void; title: string; Panel: ComponentType<{ piece: WithId<Piece> }> }
  // Its tools in the focus dock (and beside a plane), before its setup.
  dock?: ComponentType<PieceProps>
  // Open on the canvas (D-228): its tools on its console, before its setup.
  console?: ComponentType<PieceProps & { toolClass: string }>
  // What the finder (D-236) looks through in it, every page: its matches (each with its box in its px), what a row says
  // it is, and the heads its landing keeps clear of (a matrix's stay on the screen when panned past).
  find?: { items: (piece: WithId<Piece>, ctx: FindCtx) => FindItem[]; hint: (it: FindItem) => string; heads?: { top: number; left: number } }
}

const pageOf = (it: FindItem) => (it.page !== undefined ? ` · page ${it.page + 1}` : '')

const toggleIn = (store: SetupStore) => (id: string) => store.setState((s) => ({ setup: s.setup === id ? null : id }))

// Drawn again only when what it shows changes, not as the camera moves (its view is the same object meanwhile).
const MatrixShown = memo(({ piece, view, live, editor, onCanvas }: ShownProps) => <MatrixView piece={piece} view={view} live={live} editor={editor} onCanvas={onCanvas} />)
const TableShown = memo(({ piece, view, live, editor, onCanvas, page }: ShownProps) => <TableView piece={piece} view={view} live={live} editor={editor} onCanvas={onCanvas} page={page} />)
// Open on the canvas (D-234), a row's click takes the list into focus with the document beside it.
const DocumentsShown = memo(({ piece, view, live, editor, onCanvas, onFocus, page }: ShownProps) => <DocumentsView piece={piece} view={view} live={live} editor={editor} onCanvas={onCanvas} onOpen={onCanvas ? onFocus : undefined} page={page} />)
const DocumentShown = memo(({ piece, view, live, onCanvas, onFocus }: ShownProps) => <DocumentPieceView piece={piece} view={view} live={live} onCanvas={onCanvas} onMore={onCanvas ? onFocus : undefined} />)
const KanbanShown = memo(({ piece, view, live, editor, onCanvas }: ShownProps) => <KanbanView piece={piece} view={view} live={live} editor={editor} onCanvas={onCanvas} />)
const TimelineShown = memo(({ piece, view, live, editor, onCanvas }: ShownProps) => <TimelineView piece={piece} view={view} live={live} editor={editor} onCanvas={onCanvas} />)

// A documents list's dock: its tools; several side by side (D-232: a click opens one next to the others); with one
// open, the list put away (the documents take the whole screen).
function DocumentsDock({ piece, editor }: PieceProps) {
  const sideBySide = useDocUi((s) => s.sideBySide)
  const readerOpen = useDocUi((s) => s.readers.length > 0)
  return (
    <>
      <DocumentsTools piece={piece} editor={editor} />
      <DockAction label="⧉ side by side" pressed={sideBySide} title={sideBySide ? 'a click opens a document in place of the one open' : 'a click opens a document next to the ones open'} onClick={() => useDocUi.setState((s) => ({ sideBySide: !s.sideBySide }))} />
      {readerOpen && <DockAction label="hide list" title="put the list away: the documents take the whole screen" onClick={() => useDocUi.setState({ listHidden: true })} />}
    </>
  )
}

function KanbanDock({ piece, editor }: PieceProps) {
  return (
    <>
      <KanbanFilterDock piece={piece} />
      <KanbanLanes piece={piece} editor={editor} />
      <KanbanDockTools piece={piece} editor={editor} />
    </>
  )
}

const pager = ({ piece, editor }: PieceProps) => <TablePager piece={piece} editor={editor} />

export const PIECE_KINDS: Record<LensKind, KindRecord> = {
  matrix: {
    Shown: MatrixShown,
    bounds: (p, c) => matrixBounds(p, c.cards),
    fitted: true,
    setup: { store: useMatrixUi, toggle: toggleMatrixSetup, title: 'its rows, columns and cells', Panel: MatrixSetupPanel },
    find: {
      items: (p, c) => matrixFindItems(p, c.cards, c.cells),
      hint: (it) => (it.key.startsWith('cols|') ? 'column' : it.key.startsWith('rows|') ? 'row' : `cell${pageOf(it)}`),
      heads: { top: M.top, left: M.head },
    },
  },
  table: {
    Shown: TableShown,
    bounds: (p, c) => tableBounds(p, c.cards),
    fitted: false,
    setup: { store: useTableUi, toggle: toggleIn(useTableUi), title: 'where its rows come from, its columns', Panel: TableSetupPanel },
    dock: pager,
    console: pager,
    find: {
      items: (p, c) => tableFindItems(p, c.cards, c.cells, c.fieldText),
      hint: (it) => (it.key.startsWith('h|') ? 'column' : it.key.startsWith('n|') ? 'row' : 'cell') + pageOf(it),
    },
  },
  documents: {
    Shown: DocumentsShown,
    bounds: (p, c) => documentsBounds(p, listed(c.documents, documentsOf(p), c.me).length),
    fitted: false,
    dock: DocumentsDock,
    console: ({ piece, editor, toolClass }) => <DocumentsTools piece={piece} editor={editor} toolClass={toolClass} />,
    find: {
      items: (p, c) => documentsFindItems(p, c.documents, c.me, true),
      hint: (it) => (it.key.startsWith('t|') ? 'title' : it.key.startsWith('e|') ? 'first words' : 'added by') + pageOf(it),
    },
  },
  document: {
    Shown: DocumentShown,
    // The same page as a document beside the list (D-232), its own dock with `[unfocus]`.
    Focused: DocFocus,
    bounds: (p) => documentBounds(p),
    fitted: false,
  },
  kanban: {
    Shown: KanbanShown,
    bounds: (p, c) => kanbanBounds(p, c.tasks),
    fitted: false,
    setup: { store: useKanbanUi, toggle: toggleIn(useKanbanUi), title: 'what it holds: tasks, or cards by a field', Panel: KanbanSetupPanel },
    dock: KanbanDock,
  },
  timeline: {
    Shown: TimelineShown,
    bounds: (p, c) => timelineBounds(p, c.pieces, c.tasks, c.cards),
    fitted: true,
    dock: TimelineDockTools,
    // Its weeks (D-289); its filter and rows are in its focus.
    console: ({ piece, toolClass }) => <TimelineWeeks piece={piece} toolClass={toolClass} />,
  },
}

// A piece's record; null for a plane.
export function kindRecord(p: Pick<Piece, 'kind'>): KindRecord | null {
  const kind = kindOfPiece(p as Piece)
  return kind === 'plane' ? null : PIECE_KINDS[kind]
}

// ---- Setups (a matrix's, a table's, a deck's): one open per kind, each store naming whose.

// What Escape closes first, in this order.
const SETUP_STORES: SetupStore[] = [useMatrixUi, useTableUi, useKanbanUi]

// Whether this piece's setup is open.
export function useSetupOn(id: string): boolean {
  const matrix = useMatrixUi((s) => s.setup === id)
  const table = useTableUi((s) => s.setup === id)
  const deck = useKanbanUi((s) => s.setup === id)
  return matrix || table || deck
}

// The pieces whose setups are open.
export function useOpenSetups(): string[] {
  const matrix = useMatrixUi((s) => s.setup)
  const table = useTableUi((s) => s.setup)
  const deck = useKanbanUi((s) => s.setup)
  return [matrix, table, deck].filter((x): x is string => !!x)
}

export const closeSetups = () => SETUP_STORES.forEach((s) => s.setState({ setup: null }))

// The first open setup closes (Escape); false when none was.
export function closeOneSetup(): boolean {
  const open = SETUP_STORES.find((s) => s.getState().setup)
  open?.setState({ setup: null })
  return !!open
}

// A focus's (or a pane's) own view of a kind, live.
export function LensLive({ piece, view, editor }: { piece: WithId<Piece>; view: PlaneCam; editor: boolean }): ReactNode {
  const rec = kindRecord(piece)
  return rec ? <rec.Shown piece={piece} view={view} live editor={editor} /> : null
}
