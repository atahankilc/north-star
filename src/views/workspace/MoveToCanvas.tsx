// Moving pieces to another canvas (D-302's session 2, docs/specs/canvases.md): asked from a piece's right-click or its
// edit console (`move to…`), or from the canvas's text; the prompt (D-222) lists the other canvases, and a name typed
// that nobody has makes a new one to move them to. What's stuck to a piece goes with it, all the way down; a section
// takes what's wholly inside it. They land where they were, or the nearest clear place there; the toast offers `[go
// there]`. One undo step.
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { canvasPath } from '../../app/paths'
import { useAuth } from '../../data/auth'
import { addCanvas, canvasTextOn, CANVAS_NAME_MAX, moveToCanvas, onCanvas, withStuck, type Canvas } from '../../data/canvases'
import { useHistory } from '../../data/history'
import { kindOf } from '../../data/labels'
import { camOf, useCanvasView } from '../../state/canvasView'
import { isReducedMotion } from '../../state/motion'
import { runCells } from '../../ui/Appear'
import type { MenuEntry } from '../../ui/Menu'
import { ContextMenu } from './ContextMenu'
import { useWs, useWsNow } from './context'
import { shownPieces } from './shownBox'
import { labelBox } from './TextItems'
import styles from './CanvasSwitch.module.css'

type Box = { x: number; y: number; w: number; h: number }

const LEAVE_MS = 200
// Returns them, to show again if the move is refused.
function leave(targets: string[]): Promise<HTMLElement[]> {
  const els = targets.flatMap((t) => [...document.querySelectorAll<HTMLElement>(`[aria-label="Canvas"] [data-target="${t}"]`)])
  if (!els.length || isReducedMotion()) return Promise.resolve([])
  return new Promise((done) => {
    let left = els.length
    for (const el of els) runCells(el, 'exit', 0, LEAVE_MS, () => --left === 0 && done(els))
  })
}
const inside = (b: Box, s: Box) => b.x >= s.x && b.y >= s.y && b.x + b.w <= s.x + s.w && b.y + b.h <= s.y + s.h

export function MoveToCanvas() {
  const asked = useCanvasView((s) => s.toCanvas)
  const { canvas, canvases } = useWs()
  if (!asked) return null
  const close = () => useCanvasView.setState({ toCanvas: null })
  return createPortal(
    <div className={styles.layer}>
      <Prompt key={`${asked.screen}`} asked={asked} canvas={canvas} canvases={canvases} onClose={close} />
    </div>,
    document.body,
  )
}

function Prompt({ asked, canvas, canvases, onClose }: { asked: { pieces: string[]; labels: string[]; screen: [number, number] }; canvas: string; canvases: Canvas[]; onClose: () => void }) {
  const now = useWsNow()
  const { user } = useAuth()
  const navigate = useNavigate()
  const go = async (to: Canvas | string) => {
    onClose()
    const ws = now()
    const target = typeof to === 'string' ? await made(to) : to
    if (!target) return
    // What goes: the pieces asked for and what's stuck to them; the text, and what a section holds wholly.
    const here = shownPieces(ws.pieces.filter(onCanvas(canvas)), ws.cards)
    const text = ws.labels.filter(canvasTextOn(canvas))
    const labels = text.filter((l) => asked.labels.includes(l.id))
    const sections = labels.filter((l) => kindOf(l) === 'section').map(labelBox)
    const held = here.filter((p) => sections.some((s) => inside(p, s))).map((p) => p.id)
    const shown = withStuck([...asked.pieces, ...held], here)
    // Written from the pieces as stored (an unframed one's drawn box is only for where it lands).
    const pieces = shown.map((p) => ws.pieces.find((x) => x.id === p.id)!)
    const texts = [...labels, ...text.filter((l) => !labels.includes(l) && sections.some((s) => inside(labelBox(l), s)))]
    if (!pieces.length && !texts.length) return
    const boxes = [...shown, ...texts.map(labelBox)]
    // They break cell by cell where they were (as a canvas does when you leave it), then go.
    const gone = await leave([...pieces.map((p) => `plane:${p.id}`), ...texts.map((l) => `label:${l.id}`)])
    const landed = await moveToCanvas(ws.wid, target, pieces, texts, boxes, ws.pieces).catch(() => null)
    if (!landed) return gone.forEach((el) => (el.style.clipPath = ''))
    const moving = new Set([...pieces.map((p) => p.id), ...texts.map((l) => l.id)])
    useCanvasView.setState((s) => ({ editing: s.editing.filter((id) => !moving.has(id)), selected: s.selected && moving.has(s.selected) ? null : s.selected, labelSelected: s.labelSelected && moving.has(s.labelSelected) ? null : s.labelSelected }))
    // What was asked for by its name, and how many came with it (stuck to it, held by a section).
    const askedFor = [...pieces.filter((p) => asked.pieces.includes(p.id)).map((p) => p.name), ...texts.filter((l) => asked.labels.includes(l.id)).map((l) => l.text)]
    const extra = pieces.length + texts.length - askedFor.length
    const named = askedFor.length === 1 ? (askedFor[0] ? `"${askedFor[0].length > 30 ? `${askedFor[0].slice(0, 29)}…` : askedFor[0]}"` : 'it') : `${askedFor.length} things`
    useHistory.getState().say(`Moved ${named}${extra ? ` and ${extra} more with it` : ''} to ${target.name}`, {
      label: 'go there',
      run: () => {
        // That canvas's camera on where they landed, at the zoom you're at: it's brought back as you go (swapCam).
        const zoom = camOf(ws.wid).zoom
        const cx = landed.x + landed.w / 2
        const cy = landed.y + landed.h / 2
        useCanvasView.setState((s) => ({ cams: { ...s.cams, [`${ws.wid} ${target.id}`]: { x: -cx * zoom, y: -cy * zoom, zoom } } }))
        navigate(canvasPath(ws.wid, target.id))
      },
    })
  }
  const made = async (name: string) => {
    const id = await addCanvas(now().wid, name, now().canvases, user?.id)
    return now().canvases.find((c) => c.id === id) ?? { id, name: name.trim().slice(0, CANVAS_NAME_MAX), order: 0, createdAt: Date.now() }
  }
  const others = canvases.filter((c) => c.id !== canvas)
  const items: MenuEntry[] = [
    ...(others.length ? [{ key: 'canvases', heading: 'canvases' }] : []),
    ...others.map((c, i) => ({ key: c.id, label: c.name, glyph: '→', letter: i < 9 ? String(i + 1) : undefined, onSelect: () => void go(c) })),
    ...(others.length ? [{ key: 'rule', heading: '' }] : []),
    { key: 'new', label: 'new canvas', glyph: '+', hint: 'type its name', onSelect: () => 'keep' as const },
  ]
  const taken = (name: string) => canvases.some((c) => c.name.toLowerCase() === name.toLowerCase())
  const n = asked.pieces.length + asked.labels.length
  return (
    <ContextMenu
      at={asked.screen}
      what="canvas"
      items={items}
      onClose={onClose}
      prompt={n > 1 ? `move ${n} things to…` : 'move to…'}
      keys="↵ moves · type a name for a new canvas"
      more={(typed) => (typed && !taken(typed) ? [{ key: 'make', label: `new canvas "${typed.slice(0, CANVAS_NAME_MAX)}"`, glyph: '+', onSelect: () => void go(typed) }] : [])}
    />
  )
}
