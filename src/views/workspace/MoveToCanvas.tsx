// Moving pieces to another canvas (D-302's session 2, docs/specs/canvases.md): asked from a piece's right-click or its
// edit console (`move to…`), or from the canvas's text; the prompt (D-222) lists the other canvases, and a name typed
// that nobody has makes a new one to move them to. What's stuck to a piece goes with it, all the way down; a section
// takes what's wholly inside it. They land where they were, or the nearest clear place there; the toast offers `[go
// there]`. One undo step.
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { canvasPath } from '../../app/paths'
import { useAuth } from '../../data/auth'
import { addCanvas, alsoOnCanvas, canvasTextOn, CANVAS_NAME_MAX, moveToCanvas, piecesOn, takeOffCanvas, withStuck, type Canvas } from '../../data/canvases'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { KIND_NAME, kindOfPiece } from '../../data/pieces'
import { useHistory } from '../../data/history'
import { kindOf } from '../../data/labels'
import { camOf, setEditing, useCanvasView } from '../../state/canvasView'
import { isReducedMotion } from '../../state/motion'
import { runCells } from '../../ui/Appear'
import type { MenuEntry } from '../../ui/Menu'
import { ContextMenu } from './ContextMenu'
import { useWs, useWsNow, type WorkspaceCtx } from './context'
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
  if (!asked) return <CanvasKeys />
  const close = () => useCanvasView.setState({ toCanvas: null })
  return createPortal(
    <div className={styles.layer}>
      <CanvasKeys />
      {asked.where ? <WherePrompt key={`where ${asked.screen}`} asked={asked} onClose={close} /> : <Prompt key={`${asked.share} ${asked.screen}`} asked={asked} canvas={canvas} canvases={canvases} onClose={close} />}
    </div>,
    document.body,
  )
}

function Prompt({ asked, canvas, canvases, onClose }: { asked: { pieces: string[]; labels: string[]; screen: [number, number]; share?: boolean }; canvas: string; canvases: Canvas[]; onClose: () => void }) {
  const now = useWsNow()
  const { user } = useAuth()
  const navigate = useNavigate()
  const go = async (to: Canvas | string) => {
    onClose()
    const ws = now()
    const target = typeof to === 'string' ? await made(to) : to
    if (!target) return
    // What goes: the pieces asked for and what's stuck to them; the text, and what a section holds wholly.
    const here = shownPieces(piecesOn(canvas, ws.pieces, ws.spots), ws.cards)
    const text = ws.labels.filter(canvasTextOn(canvas))
    const labels = text.filter((l) => asked.labels.includes(l.id))
    const sections = labels.filter((l) => kindOf(l) === 'section').map(labelBox)
    const held = here.filter((p) => sections.some((s) => inside(p, s))).map((p) => p.id)
    const stuck = withStuck([...asked.pieces, ...held], here)
    // On another canvas as well (D-302's session 3): the same pieces, a spot each there; nothing leaves here.
    if (asked.share) {
      const landed = await alsoOnCanvas(ws.wid, target, stuck, stuck, piecesOn(target.id, ws.pieces, ws.spots))
      const n = stuck.length
      const name = n === 1 ? (stuck[0].name ? `"${stuck[0].name}"` : 'it') : `${n} things`
      if (!landed) return useHistory.getState().say(`${n === 1 ? "It's" : "They're"} on ${target.name} already`)
      return useHistory.getState().say(`Put ${name} on ${target.name} too`, { label: 'go there', run: () => goThere(ws.wid, target.id, landed) })
    }
    // A piece here only through a spot isn't moved from here (its own canvas keeps it): taken off, not moved.
    const shown = stuck.filter((p) => !p.spot)
    // Written from the pieces as stored (an unframed one's drawn box is only for where it lands).
    const pieces = shown.map((p) => ws.pieces.find((x) => x.id === p.id)!)
    const texts = [...labels, ...text.filter((l) => !labels.includes(l) && sections.some((s) => inside(labelBox(l), s)))]
    if (!pieces.length && !texts.length) return stuck.length ? useHistory.getState().say(`${stuck.length === 1 ? "It's" : "They're"} only shown here: its own canvas keeps it. Take it off instead (⌫ in edit mode)`) : undefined
    const boxes = [...shown, ...texts.map(labelBox)]
    // They break cell by cell where they were (as a canvas does when you leave it), then go.
    const gone = await leave([...pieces.map((p) => `plane:${p.id}`), ...texts.map((l) => `label:${l.id}`)])
    // What's in the way there, through its spots too.
    const landed = await moveToCanvas(ws.wid, target, pieces, texts, boxes, piecesOn(target.id, ws.pieces, ws.spots), ws.spots).catch(() => null)
    if (!landed) return gone.forEach((el) => (el.style.clipPath = ''))
    const moving = new Set([...pieces.map((p) => p.id), ...texts.map((l) => l.id)])
    useCanvasView.setState((s) => ({ editing: s.editing.filter((id) => !moving.has(id)), selected: s.selected && moving.has(s.selected) ? null : s.selected, labelSelected: s.labelSelected && moving.has(s.labelSelected) ? null : s.labelSelected }))
    // What was asked for by its name, and how many came with it (stuck to it, held by a section).
    const askedFor = [...pieces.filter((p) => asked.pieces.includes(p.id)).map((p) => p.name), ...texts.filter((l) => asked.labels.includes(l.id)).map((l) => l.text)]
    const extra = pieces.length + texts.length - askedFor.length
    const named = askedFor.length === 1 ? (askedFor[0] ? `"${askedFor[0].length > 30 ? `${askedFor[0].slice(0, 29)}…` : askedFor[0]}"` : 'it') : `${askedFor.length} things`
    useHistory.getState().say(`Moved ${named}${extra ? ` and ${extra} more with it` : ''} to ${target.name}`, {
      label: 'go there',
      run: () => goThere(ws.wid, target.id, landed),
    })
  }
  // That canvas's camera on where they landed, at the zoom you're at: it's brought back as you go (swapCam).
  const goThere = (wid: string, to: string, landed: Box) => {
    const zoom = camOf(wid).zoom
    const cx = landed.x + landed.w / 2
    const cy = landed.y + landed.h / 2
    useCanvasView.setState((s) => ({ cams: { ...s.cams, [`${wid} ${to}`]: { x: -cx * zoom, y: -cy * zoom, zoom } } }))
    navigate(canvasPath(wid, to))
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
      data-learn="prompt"
      at={asked.screen}
      what="canvas"
      items={items}
      onClose={onClose}
      prompt={asked.share ? (n > 1 ? `put ${n} things on…` : 'put it on… as well') : n > 1 ? `move ${n} things to…` : 'move to…'}
      keys={asked.share ? '↵ puts it there too · type a name for a new canvas' : '↵ moves · type a name for a new canvas'}
      more={(typed) => (typed && !taken(typed) ? [{ key: 'make', label: `new canvas "${typed.slice(0, CANVAS_NAME_MAX)}"`, glyph: '+', onSelect: () => void go(typed) }] : [])}
    />
  )
}

// A piece taken off the canvas shown, staying on the others it's on (D-302's session 3); the toast says where.
export function takeOffHere(ws: WorkspaceCtx, p: WithId<Piece>) {
  setEditing(p.id, false)
  void takeOffCanvas(ws.wid, p, ws.canvas, ws.spots).then((still) => {
    const names = still?.map((c) => ws.canvases.find((x) => x.id === c)?.name ?? 'another canvas')
    if (names) useHistory.getState().say(`Took ${p.name ? `"${p.name}"` : `the ${KIND_NAME[kindOfPiece(p)]}`} off this canvas · still on ${names.join(', ')}`)
  })
}

// Where a shared piece is (its console's `⧉ 2`, D-302's session 3): the canvases it's on, going there; putting it on
// one more; taking it off this one; deleting it everywhere.
function WherePrompt({ asked, onClose }: { asked: { pieces: string[]; screen: [number, number] }; onClose: () => void }) {
  const ws = useWs()
  const now = useWsNow()
  const navigate = useNavigate()
  const p = piecesOn(ws.canvas, ws.pieces, ws.spots).find((x) => x.id === asked.pieces[0])
  if (!p?.canvases) return null
  const items: MenuEntry[] = [
    { key: 'on', heading: `on ${p.canvases.length} canvases` },
    ...p.canvases.map((id, i) => ({
      key: id,
      label: ws.canvases.find((c) => c.id === id)?.name ?? id,
      glyph: id === ws.canvas ? '•' : '→',
      letter: i < 9 ? String(i + 1) : undefined,
      hint: id === ws.canvas ? 'here' : id === (p.canvasId || 'main') ? 'go there · made there' : 'go there',
      onSelect: () => id !== ws.canvas && navigate(canvasPath(ws.wid, id)),
    })),
    { key: 'rule', heading: '' },
    { key: 'also', label: 'also on canvas…', glyph: '⧉', letter: 'a', onSelect: () => (useCanvasView.setState({ toCanvas: { pieces: [p.id], labels: [], screen: asked.screen, share: true } }), 'keep' as const) },
    { key: 'off', label: 'take it off this canvas', glyph: '−', letter: 't', onSelect: () => takeOffHere(now(), p) },
    { key: 'delete', label: 'delete everywhere', glyph: '×', letter: 'x', danger: true, onSelect: () => useCanvasView.setState({ confirming: p.id }) },
  ]
  return <ContextMenu at={asked.screen} what="canvas" items={items} onClose={onClose} prompt={`where "${p.name || KIND_NAME[kindOfPiece(p)]}" is…`} />
}

// ⌥1–⌥9 go to the first nine canvases (D-302's session 4), anywhere in the workspace but a field being typed in. Not
// ⌘1–⌘9: the browser keeps those for its tabs.
function CanvasKeys() {
  const { wid, canvas, canvases } = useWs()
  const navigate = useNavigate()
  useEffect(() => {
    if (canvases.length < 2) return
    const onKey = (e: KeyboardEvent) => {
      const n = /^Digit([1-9])$/.exec(e.code)?.[1]
      if (!n || !e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return
      if ((e.target as HTMLElement | null)?.closest('input, textarea, [contenteditable=true]')) return
      const to = canvases[Number(n) - 1]
      if (!to) return
      e.preventDefault()
      if (to.id !== canvas) navigate(canvasPath(wid, to.id))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [wid, canvas, canvases, navigate])
  return null
}
