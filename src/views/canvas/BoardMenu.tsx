// The board's right-click menu (D-117), at the pointer: on a card or text, what you can do with it (or with everything
// selected, if it's one of several); on a link, its kind, reverse, remove; on the empty board, a new card or text right
// there, paste there, and the board's switches. Viewers and the assistant's preview get only what changes nothing.
// Arrow keys move, Escape or a click elsewhere closes, as in the dropdowns (Menu.tsx).
import { AnimatePresence } from 'motion/react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { focusPath } from '../../app/paths'
import { reverseEdge, updateEdge } from '../../data/edges'
import { BOARD_TYPES, FOR } from '../../data/model'
import { copied } from '../../data/selection'
import { useCanvas } from '../../state/canvasStore'
import type { NewThing } from '../../state/workspaceView'
import { Appear } from '../../ui/Appear'
import type { WorkspaceCtx } from '../workspace/context'
import { findItem, removeItem, removeLabel, removeLink, removeSelection } from '../workspace/useEditKeys'
import { editLocked } from '../workspace/viewerLock'
import { BOARD_KINDS, TYPE_ACCENT } from './boardKinds'
import { rightRelease, useBoardMenu, type MenuTarget } from './rightClick'
import { CARD_H, CARD_W } from './cardLayout'
import { copySelection, duplicateSelection, pasteClip } from './clipboard'
import { pieceOf } from './groupDrag'
import { useGuides } from './guides'
import { EDGE_KINDS, LINK_TONE, linkStyle } from './linkKinds'
import { snapPoint, useSnap } from './snap'
import { editTitle, isTitle } from './titleBlock'
import styles from './BoardMenu.module.css'

const MOD = navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl+'
// Room kept between the menu and the window's edges.
const EDGE_PX = 8

type Row =
  | { key: string; heading: string }
  | { key: string; rule: true }
  | {
      key: string
      label: string
      run: () => void
      glyph?: string
      tone?: string
      hint?: string
      // A switch: [x] / [ ], and the menu stays open.
      checked?: boolean
      danger?: boolean
      disabled?: boolean
    }

type Props = {
  ws: WorkspaceCtx
  // Makes a card or text at a board point (BoardView's create); none in the focus view, where it would vanish (D-127).
  create?: (type: NewThing, at: [number, number]) => void
}

export function BoardMenu({ ws, create }: Props) {
  const open = useBoardMenu((s) => s.open)
  const close = useBoardMenu((s) => s.close)
  // Re-reads the switches while open, so their checks follow.
  useSnap((s) => s.on)
  useGuides((s) => s.on)

  // A right press anywhere ends here; still enough, it opens the menu.
  useEffect(() => {
    window.addEventListener('pointerup', rightRelease)
    return () => window.removeEventListener('pointerup', rightRelease)
  }, [])

  // What it's opened on becomes the selection, unless it's already part of it (so a group keeps together).
  useEffect(() => {
    if (!open) return
    const t = open.target
    const { selection, select, selectEdge } = useCanvas.getState()
    if (t.kind === 'link') selectEdge(t.id)
    else if (t.kind !== 'board' && !selection.includes(t.id)) select(t.id)
  }, [open])

  // Leaving the board or the workspace closes it.
  useEffect(() => close, [close])

  const navigate = useNavigate()
  const rows = open ? rowsFor(open.target, open.at, ws, create, (id) => navigate(focusPath(ws.wid, id))) : []
  return (
    <AnimatePresence>
      {open && rows.length > 0 && (
        <MenuPanel key={`${open.x},${open.y}`} x={open.x} y={open.y} rows={rows} onClose={close} />
      )}
    </AnimatePresence>
  )
}

function MenuPanel({ x, y, rows, onClose }: { x: number; y: number; rows: Row[]; onClose: () => void }) {
  const panel = useRef<HTMLElement>(null)

  // At the pointer, flipped left or up where it would run off the window.
  useLayoutEffect(() => {
    const el = panel.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const left = x + width + EDGE_PX > window.innerWidth ? Math.max(EDGE_PX, x - width) : x
    const top = y + height + EDGE_PX > window.innerHeight ? Math.max(EDGE_PX, y - height) : y
    el.style.transform = `translate(${left}px, ${top}px)`
  }, [x, y])

  // Focus the first row; a press outside, the wheel, or the window changing closes it.
  useEffect(() => {
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('[role^=menuitem]:not(:disabled)')?.focus())
    const onDown = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node)) onClose()
    }
    const shut = () => onClose()
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('wheel', shut, { passive: true })
    window.addEventListener('resize', shut)
    window.addEventListener('blur', shut)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('wheel', shut)
      window.removeEventListener('resize', shut)
      window.removeEventListener('blur', shut)
    }
  }, [onClose])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const all = [...(panel.current?.querySelectorAll<HTMLElement>('[role^=menuitem]:not(:disabled)') ?? [])]
    const at = all.indexOf(document.activeElement as HTMLElement)
    const go = (i: number) => all[(i + all.length) % all.length]?.focus()
    // Keys stay in the menu: the board's own shortcuts (Delete, 1–9, g) don't fire.
    e.stopPropagation()
    if (e.key === 'ArrowDown') (e.preventDefault(), go(at + 1))
    else if (e.key === 'ArrowUp') (e.preventDefault(), go(at - 1))
    else if (e.key === 'Home') (e.preventDefault(), go(0))
    else if (e.key === 'End') (e.preventDefault(), go(all.length - 1))
    else if (e.key === 'Escape' || e.key === 'Tab') (e.preventDefault(), onClose())
  }

  return (
    <Appear
      elRef={panel}
      className={styles.panel}
      role="menu"
      aria-label="Board"
      onKeyDown={onKeyDown}
      // A right click on the menu itself is just a click.
      onContextMenu={(e: React.MouseEvent) => e.preventDefault()}
    >
      {rows.map((row) =>
        'heading' in row ? (
          <div key={row.key} className={styles.heading} role="presentation">
            {row.heading}
          </div>
        ) : 'rule' in row ? (
          <div key={row.key} className={styles.rule} role="separator" />
        ) : (
          <button
            key={row.key}
            className={styles.item}
            role={row.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
            aria-checked={row.checked}
            tabIndex={-1}
            disabled={row.disabled}
            data-tone={row.danger ? 'danger' : undefined}
            style={row.tone ? { ['--tone' as string]: row.tone } : undefined}
            onClick={() => {
              row.run()
              if (row.checked === undefined) onClose()
            }}
          >
            {row.checked !== undefined && (
              <span className={styles.check} data-on={row.checked} aria-hidden>
                {row.checked ? '[x]' : '[ ]'}
              </span>
            )}
            {row.glyph && (
              <span className={styles.glyph} aria-hidden>
                {row.glyph}
              </span>
            )}
            <span className={styles.label}>{row.label}</span>
            {row.hint && <span className={styles.hint}>{row.hint}</span>}
          </button>
        ),
      )}
    </Appear>
  )
}

// Glide so these cards and labels fill the view (as far as the zoom limits allow).
function zoomTo(ids: string[]) {
  const at = ids.flatMap((id) => {
    const p = pieceOf(id)
    return p ? [p] : []
  })
  if (!at.length) return
  const hw = CARD_W / 2 + 0.6
  const hh = CARD_H / 2 + 0.6
  useCanvas
    .getState()
    .flyToFit([Math.min(...at.map((p) => p.x)) - hw, Math.min(...at.map((p) => p.y)) - hh, Math.max(...at.map((p) => p.x)) + hw, Math.max(...at.map((p) => p.y)) + hh])
}

// `focusOn`: opens the focus view on a card (D-127).
function rowsFor(target: MenuTarget, at: [number, number], ws: WorkspaceCtx, create: Props['create'], focusOn: (id: string) => void): Row[] {
  const locked = editLocked()
  const { selection } = useCanvas.getState()

  if (target.kind === 'board') {
    const board: Row[] = [
      { key: 'board', heading: 'board' },
      { key: 'fit', label: 'fit all', hint: '0', run: () => useCanvas.getState().fitAll() },
    ]
    if (locked || !create) return board
    // Where the pointer is, on the grid if snapping's on (D-112).
    const here = snapPoint(at, false)
    return [
      { key: 'add', heading: 'add here' },
      ...BOARD_TYPES.map((t): Row => ({ key: t, label: BOARD_KINDS[t].label, glyph: '▌', tone: TYPE_ACCENT[t], run: () => create(t, here) })),
      { key: 'text', label: 'text', glyph: 'T', run: () => create('text', here) },
      ...(copied() ? [{ key: 'paste', label: 'paste here', hint: `${MOD}V`, run: () => void pasteClip(ws, at) } as Row] : []),
      ...board,
      { key: 'snap', label: 'snap to grid', hint: 'g', checked: useSnap.getState().on, run: () => useSnap.getState().toggle() },
      { key: 'guides', label: 'alignment guides', hint: 'a', checked: useGuides.getState().on, run: () => useGuides.getState().toggle() },
    ]
  }

  if (target.kind === 'link') {
    const edge = ws.edges.find((e) => e.id === target.id)
    if (!edge || locked) return []
    return [
      { key: 'kind', heading: 'link' },
      ...EDGE_KINDS.map((k): Row => ({
        key: k,
        label: linkStyle(k).label,
        glyph: edge.kind === k ? '●' : '○',
        tone: LINK_TONE[linkStyle(k).group],
        run: () => edge.kind !== k && void updateEdge(ws.wid, edge.id, { kind: k }),
      })),
      { key: 'r', rule: true },
      // A customer tag always points item → customer (D-044).
      { key: 'reverse', label: 'reverse', glyph: '⇄', disabled: edge.kind === FOR, run: () => void reverseEdge(ws.wid, edge.id, edge) },
      { key: 'remove', label: 'remove', glyph: '×', hint: '⌫', danger: true, run: () => removeLink(ws.wid, edge.id) },
    ]
  }

  // A card or text: the whole selection if it's one of several.
  const many = selection.length > 1 && selection.includes(target.id)
  const ids = many ? selection : [target.id]
  const label = target.kind === 'label' ? ws.labels.find((l) => l.id === target.id) : undefined
  const item = target.kind === 'card' ? findItem(ws, target.id) : null
  if (!label && !item) return []
  // The title block (D-118): edit its name or description; it isn't copied (one per board), and deleting takes it off the board only.
  const title = !many && !!label && isTitle(label)
  const heading = many ? `${ids.length} selected` : title ? 'project title' : label ? 'text' : BOARD_KINDS[item!.type].label
  const zoom: Row = { key: 'zoom', label: 'zoom to', run: () => zoomTo(ids) }
  // The card's chain in the focus view (D-127).
  const focus: Row[] = item && !many ? [{ key: 'focus', label: 'focus', glyph: '◎', run: () => focusOn(target.id) }] : []
  if (locked) return [{ key: 'h', heading }, zoom, ...focus]
  return [
    { key: 'h', heading },
    ...(title
      ? [
          { key: 'edit', label: 'edit name', run: () => editTitle('name') } as Row,
          { key: 'about', label: 'edit description', run: () => editTitle('description') } as Row,
        ]
      : label && !many
        ? [{ key: 'edit', label: 'edit text', run: () => useCanvas.getState().setEditingLabel(label.id) } as Row]
        : []),
    // The selection is what's copied; opening the menu made it this.
    ...(title
      ? []
      : [
          { key: 'copy', label: 'copy', hint: `${MOD}C`, run: () => copySelection(ws) } as Row,
          { key: 'dup', label: 'duplicate', hint: `${MOD}D`, run: () => void duplicateSelection(ws) } as Row,
        ]),
    zoom,
    ...focus,
    { key: 'r', rule: true },
    {
      key: 'delete',
      label: title ? 'remove from board' : 'delete',
      hint: '⌫',
      danger: true,
      run: () => {
        if (many) removeSelection(ws, ids)
        else if (label) removeLabel(ws.wid, label.id, label.text)
        else removeItem(ws.wid, item!.type, target.id, item!.title)
      },
    },
  ]
}
