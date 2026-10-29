// The side nav (D-176, D-178): the canvas's tools down the middle of the left edge, top to bottom `+`, fit, find (with
// the guide's `?` under it), decks and days. Its own file so the onboarding's demo realm (src/demo/, D-315) mounts the
// same one the workspace does.
import type { WithId } from '../../data/hooks'
import type { Piece, PieceKind } from '../../data/model'
import { addPiece, isBare } from '../../data/pieces'
import type { MatrixSetup } from '../../data/matrix'
import type { TableSetup } from '../../data/table'
import { addCard, CARD_TYPES, type CardType } from '../../data/cards'
import { cardsOn } from '../../data/places'
import { addLabel, CANVAS, PARA_W, STICKY_H, STICKY_W, TITLE_W } from '../../data/labels'
import { snap } from '../../data/grid'
import { canvasCenter, fitHere, setEditing, useCanvasView } from '../../state/canvasView'
import { Menu } from '../../ui/Menu'
import { learn } from '../../onboarding/learn'
import { GuideButton } from '../../onboarding/GuideButton'
import { useMatrixUi } from './Matrix'
import { MatrixWizard } from './MatrixWizard'
import { TableWizard } from './TableWizard'
import { KanbanWizard } from './KanbanWizard'
import { useKanbanUi } from './Kanban'
import { useTableUi } from './Table'
import { shownPieces } from './shownBox'
import { useAuthor } from './TextItems'
import { TYPE_ACCENT } from './PlaneCards'
import { TasksButton } from './MyTasks'
import { openFinder, useFind } from './find'
import { PIECE_GLYPH, TEXT_GLYPH } from './glyphs'
import { useWs } from './context'
import styles from './WorkspaceLayout.module.css'

// `focused`: the piece in focus, if any; `editor`: whether you may make things (viewers make nothing, D-098).
export function SideNav({ wid, focused, editor }: { wid: string; focused?: WithId<Piece>; editor: boolean }) {
  return (
    <>
      {/* A matrix or a table in focus takes its rows and columns from its setup (D-204, D-209), not from `+`. */}
      {editor && !(focused && isBare(focused)) && <AddToCanvas wid={wid} plane={focused?.id ?? null} />}
      <FitButton plane={focused?.id ?? null} />
      <FinderButton />
      <TasksButton />
    </>
  )
}

// The side nav's fit (D-186), under the `+`; the same as `0` (CanvasView's fit): everything on the canvas in view, or in
// focus the piece's contents centred and fitted, whatever kind it is.
function FitButton({ plane }: { plane: string | null }) {
  const focused = plane !== null
  return (
    <button
      className={styles.fit}
      aria-label={focused ? 'Fit the plane to the screen' : 'Fit everything on the canvas'}
      title={focused ? 'fit the plane (0)' : 'fit everything (0)'}
      onClick={fitHere}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <path d="M1 6V1h5M12 1h5v5M17 12v5h-5M6 17H1v-5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="6" y="6" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
    </button>
  )
}

// The side nav's compass, under fit: the finder (D-236), which is go to too (D-196): the places with nothing typed (↓),
// anything in the workspace once something is. ⌘F does the same. Under it the guide's `?` (D-315).
function FinderButton() {
  const open = useFind((s) => s.open)
  return (
    <>
      <button className={styles.fit} data-on={open || undefined} aria-pressed={open} aria-label="Find and go to" title="find, go to (⌘F)" onClick={openFinder} data-learn="finder">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          {/* A compass, its needle to the north. */}
          <circle cx="9" cy="9" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9 3.5 11 9H7z" fill="currentColor" />
          <path d="M7 9h4l-2 5.5z" fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
        </svg>
      </button>
      <GuideButton />
    </>
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
        data-learn="plus"
        panelLearn={{ 'data-learn': 'plus-menu' }}
        onOpen={() => learn('plus-open', { plane: !!plane })}
        items={
          plane
            ? [
                { key: 'cards', heading: 'card' },
                ...CARD_TYPES.map((t) => ({ key: t, label: t, glyph: '▌', letter: CARD_LETTER[t], tone: TYPE_ACCENT[t], onSelect: () => void addHere(t) })),
                // A package (D-240): picked from the plane's cards, as a section is drawn.
                { key: 'package', label: 'package', glyph: '▣', letter: 'k', tone: TYPE_ACCENT.package, hint: 'select', onSelect: () => useCanvasView.setState({ packing: plane, drawing: null }) },
                ...text,
                // One already on another plane (D-281), last under a rule (D-291): the menu turns into the list of them,
                // opening where it did.
                { key: 'rule', heading: '' },
                { key: 'existing', label: 'existing card…', glyph: '⧉', letter: 'e', hint: 'from another plane', onSelect: () => bringHere() },
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
                { key: 'kanban', label: 'deck…', glyph: PIECE_GLYPH.kanban, letter: 'k', hint: 'tasks or cards in columns', onSelect: () => useKanbanUi.setState({ wizard: true }) },
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
