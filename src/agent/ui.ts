// The agent's UI facade (S9, D-312, R11; docs/specs/agent.md §4.4, agent-actions.md's "View state → UI tools"): go to,
// focus, select, open a panel, show beside, and what's on screen now, callable outside React. It moves the view only
// and writes no data. Every call goes the way the person's own action goes, through the stores and events the views
// already listen to, so nothing in the views had to change:
// - into a piece's focus, and to a place anywhere (on another canvas too): the finder's `findGo` (CanvasView hears
//   `useFind`'s `asked`: focusTo, with the ink; a place in a plane waits for the plane's focus, one on the canvas for
//   the focus to go);
// - out of focus: `focusLeaving`, as the dock's `[unfocus]` (CanvasView's FocusedPlane draws back, then leaves);
// - to another canvas, and what's beside a plane: the address (`?canvas=`, `beside=`), pushed as react-router pushes it
//   and announced with a popstate, which BrowserRouter listens to;
// - picks: the selection stores (selection.ts' setSelection, Kanban's task picks, the canvas's `selected`), a card
//   brought into view by CardPanel's goToCard, a task by Kanban's goToTask; decks and timelines open in the tasks side
//   view (sideState.ts).
// Each call is async (it waits for the view to get there), queued behind the one before (one at a time, a failure not
// stopping the next), and counted by agentDriving (driving.ts) from being asked until half a second after it settles,
// for onboarding. Dev only: `window.__agentUi` holds the facade once this module is loaded.
import { getWs } from '../state/wsStore'
import { useCanvasView } from '../state/canvasView'
import { canvasParams } from '../app/paths'
import { clearFound, findGo } from '../views/workspace/find'
import { goToCard } from '../views/workspace/CardPanel'
import { goToTask, selectTask, selectTasks, useKanbanUi } from '../views/workspace/Kanban'
import { selectedIds, setSelection } from '../views/workspace/selection'
import { useTasksSide } from '../views/workspace/sideState'
import { CANVAS, kindOf } from '../model/labels'
import { labelBox } from '../model/labelBox'
import { canvasOf, MAIN } from '../model/canvases'
import { piecesShown } from '../model/textPlace'
import { cardsOn } from '../model/placement'
import { isOnPlane } from '../model/cards'
import { kindOfPiece, sticks } from '../model/pieces'
import type { WorkspaceCtx } from '../state/wsStore'
import { agentDriving, queued } from './driving'

export { agentDriving }

export type View = {
  wid: string
  canvas: string
  // The piece in focus (null: the canvas), and whether it has arrived (the ink done).
  focus: string | null
  arrived: boolean
  // Cards and text picked in the focus, a piece picked on the canvas, tasks picked on a deck.
  selection: string[]
  piece: string | null
  tasks: string[]
  // The card or task whose panel is open.
  panel: { card: string } | { task: string } | null
  // What's open beside the focused plane (`beside=`), and the tasks side view.
  beside: string[]
  side: { tab: string; days: boolean; linked: string | null } | null
}

// ---- Waiting and the address

const TIMEOUT = 10000

function until(ok: () => boolean, what: string, ms = TIMEOUT): Promise<void> {
  return new Promise((resolve, reject) => {
    const t0 = Date.now()
    const look = () => {
      if (ok()) return resolve()
      if (Date.now() - t0 > ms) return reject(new Error(`agent ui: timed out waiting for ${what}`))
      setTimeout(look, 30)
    }
    look()
  })
}

function ws(): WorkspaceCtx {
  const w = getWs()
  if (!w) throw new Error('agent ui: no workspace is open')
  return w
}

const params = () => new URLSearchParams(location.search)
const focusNow = () => params().get('focus')
const arrived = () => useCanvasView.getState().focusArrived && !useCanvasView.getState().focusLeaving

// A new address on this page (the workspace's path kept), as react-router's own push writes it, then told to the
// router the way the back button tells it.
function push(search: Record<string, string>) {
  const q = new URLSearchParams(search).toString()
  const idx = ((history.state as { idx?: number } | null)?.idx ?? 0) + 1
  history.pushState({ usr: null, key: Math.random().toString(36).slice(2, 10), idx }, '', `${location.pathname}${q ? `?${q}` : ''}`)
  window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }))
}

const pieceOf = (id: string) => ws().pieces.find((p) => p.id === id)
// Whether a piece is shown on the canvas shown (its own, or a spot).
const shownHere = (id: string) => piecesShown(ws().canvas, ws().pieces, ws().spots).find((p) => p.id === id)
const canvasOfPiece = (id: string) => (shownHere(id) ? ws().canvas : canvasOf(pieceOf(id)!))

// ---- Canvas

async function toCanvas(c: string) {
  const w = ws()
  if (c !== MAIN && !w.canvases.some((x) => x.id === c)) throw new Error(`agent ui: there is no canvas ${c}`)
  if (w.canvas === c && !focusNow()) return
  push(canvasParams(c))
  await until(() => getWs()?.canvas === c && !focusNow() && useCanvasView.getState().size.w > 0, `canvas ${c}`)
}

// ---- Focus

async function focusOn(id: string | null) {
  if (id === null) {
    if (!focusNow()) return
    // As the dock's [unfocus]: draws back, then leaves (CanvasView's unfocus).
    if (!useCanvasView.getState().focusLeaving) {
      useCanvasView.setState({ focusLeaving: true })
      selectTask('', null)
    }
    try {
      await until(() => !focusNow(), 'the focus to close', 4000)
    } catch {
      // The ink didn't finish (a hidden tab pauses it): leave as the back button does.
      push(canvasParams(ws().canvas))
      await until(() => !focusNow(), 'the focus to close')
    }
    return
  }
  if (!pieceOf(id)) throw new Error(`agent ui: there is no piece ${id}`)
  if (focusNow() === id && arrived()) return
  findGo({ kind: 'space', space: id, k: 0, focus: id })
  await until(() => focusNow() === id && arrived(), `the focus of ${id}`)
  clearFound()
}

// ---- Go to

const placeOf = (id: string, space: string, box: { x: number; y: number; w: number; h: number }, whole: boolean, label: string) => ({ id, space, label, glyph: null, box, whole })

async function goToNow(id: string) {
  const w = ws()
  if (id === MAIN || w.canvases.some((c) => c.id === id)) return toCanvas(id)
  const task = w.tasks.find((t) => t.id === id)
  if (task) return goToTaskOf(task.id)
  const card = w.cards.find((c) => c.id === id)
  if (card) {
    const f = focusNow()
    const plane = f && isOnPlane(card, f) ? f : card.pieceId
    await focusOn(plane)
    setSelection([id])
    const shown = cardsOn(ws().cards, ws().places, plane).find((c) => c.id === id)
    if (shown) goToCard(shown)
    return
  }
  const piece = pieceOf(id)
  if (piece) {
    const c = canvasOfPiece(id)
    if (c !== ws().canvas) await toCanvas(c)
    const p = shownHere(id)!
    findGo({ kind: 'space', space: CANVAS, k: 0, place: placeOf(id, CANVAS, { x: p.x, y: p.y, w: p.w, h: p.h }, true, p.name ?? '') })
    await until(() => !focusNow(), 'the canvas')
    return
  }
  const l = w.labels.find((x) => x.id === id)
  if (l) {
    const k = kindOf(l)
    const whole = k === 'section' || k === 'title'
    if (l.pieceId === CANVAS) {
      if (canvasOf(l) !== ws().canvas) await toCanvas(canvasOf(l))
      findGo({ kind: 'space', space: CANVAS, k: 0, place: placeOf(id, CANVAS, labelBox(l), whole, l.text) })
      await until(() => !focusNow(), 'the canvas')
    } else {
      findGo({ kind: 'space', space: l.pieceId, k: 0, place: placeOf(id, l.pieceId, labelBox(l), whole, l.text) })
      await until(() => focusNow() === l.pieceId && arrived(), `the focus of ${l.pieceId}`)
    }
    return
  }
  throw new Error(`agent ui: there is nothing with the id ${id} (a canvas, piece, card, text or task)`)
}

// A task: into its deck's focus, landing on it, picked (Kanban's goToTask, as the finder and threads go).
async function goToTaskOf(id: string) {
  const w = ws()
  const task = w.tasks.find((t) => t.id === id)!
  const deck = pieceOf(task.pieceId)
  if (!deck) throw new Error(`agent ui: the deck of task ${id} is gone`)
  goToTask(deck, w.tasks, task, piecesShown(w.canvas, w.pieces, w.spots))
  await until(() => (focusNow() === deck.id && arrived() && useKanbanUi.getState().selected?.task === id) || useKanbanUi.getState().selected?.task === id, `task ${id}`)
}

// ---- Select

async function selectNow(ids: string[]) {
  const w = ws()
  if (!ids.length) {
    useCanvasView.setState({ cardMulti: [], cardSelected: null, labelSelected: null, linkSelected: null, selected: null })
    selectTask('', null)
    return
  }
  const tasks = ids.map((id) => w.tasks.find((t) => t.id === id))
  if (tasks.every(Boolean)) {
    const decks = new Set(tasks.map((t) => t!.pieceId))
    if (decks.size > 1) throw new Error('agent ui: tasks of one deck at a time')
    const deck = [...decks][0]
    if (!shownHere(deck) || (focusNow() && focusNow() !== deck)) await focusOn(deck)
    selectTasks(deck, ids)
    return
  }
  const pieces = ids.map((id) => pieceOf(id))
  if (pieces.every(Boolean)) {
    if (ids.length > 1) throw new Error('agent ui: one piece at a time is picked on the canvas')
    const c = canvasOfPiece(ids[0])
    if (c !== ws().canvas) await toCanvas(c)
    await focusOn(null)
    useCanvasView.setState({ selected: ids[0], cardSelected: null, labelSelected: null, cardMulti: [] })
    return
  }
  // Cards and text: the space they're all in (a card: the plane in focus when it's on it, else its home).
  const f = focusNow()
  const spaces = new Set(
    ids.map((id) => {
      const card = w.cards.find((c) => c.id === id)
      if (card) return f && isOnPlane(card, f) ? f : card.pieceId
      const l = w.labels.find((x) => x.id === id)
      if (!l) throw new Error(`agent ui: ${id} isn't a card, text, piece or task`)
      return l.pieceId === CANVAS ? `${CANVAS}:${canvasOf(l)}` : l.pieceId
    }),
  )
  if (spaces.size > 1) throw new Error('agent ui: the things picked together must be in one space (a plane, or one canvas)')
  const space = [...spaces][0]
  if (space.startsWith(`${CANVAS}:`)) {
    const c = space.slice(CANVAS.length + 1)
    if (c !== ws().canvas) await toCanvas(c)
    await focusOn(null)
    if (ids.length === 1) useCanvasView.setState({ labelSelected: ids[0], cardSelected: null, cardMulti: [], selected: null })
    else useCanvasView.setState({ cardMulti: ids, cardSelected: null, labelSelected: null, selected: null })
    return
  }
  await focusOn(space)
  setSelection(ids)
}

// ---- Panels

async function openPanelNow(id: string) {
  const w = ws()
  if (w.tasks.some((t) => t.id === id)) return goToTaskOf(id)
  if (!w.cards.some((c) => c.id === id)) throw new Error(`agent ui: only cards and tasks have a panel (${id} is neither)`)
  await goToNow(id)
  useCanvasView.setState({ panelShut: null, cardSelected: id, cardMulti: [], labelSelected: null })
}

// ---- Beside

async function showBesideNow(id: string) {
  const p = pieceOf(id)
  if (!p) throw new Error(`agent ui: there is no piece ${id}`)
  const kind = kindOfPiece(p)
  // Decks and timelines open in the tasks side view (D-300, D-314), never beside a plane.
  if (kind === 'kanban' || kind === 'timeline') {
    const host = p.stuckTo ? pieceOf(p.stuckTo) : undefined
    let tab = 'all'
    let days = kind === 'timeline'
    if (kind === 'kanban') tab = p.id
    else if (host?.kind === 'kanban') tab = host.id
    else if (host) tab = ws().pieces.find((x) => x.kind === 'kanban' && x.stuckTo === host.id)?.id ?? 'all'
    const plane = kind === 'kanban' ? host : host?.kind === 'kanban' ? (host.stuckTo ? pieceOf(host.stuckTo) : undefined) : host
    const linked = plane && focusNow() === plane.id ? plane.id : null
    if (tab === 'all') days = true
    useTasksSide.setState({ open: true, tab, days, linked, taskFull: false })
    await until(() => useTasksSide.getState().open, 'the tasks side view')
    return
  }
  if (!sticks(p) || !p.stuckTo) throw new Error(`agent ui: ${id} isn't stuck to a plane, so it has nowhere to open beside (focus it instead)`)
  const host = p.stuckTo
  await focusOn(host)
  const now = (params().get('beside') ?? '').split(',').filter(Boolean)
  if (!now.includes(id)) push(canvasParams(ws().canvas, { focus: host, beside: [...now, id].join(',') }))
  await until(() => (params().get('beside') ?? '').split(',').includes(id) && useCanvasView.getState().beside > 0, `${id} beside ${host}`)
}

// ---- What's on screen

function currentView(): View {
  const w = ws()
  const s = useCanvasView.getState()
  const k = useKanbanUi.getState()
  const side = useTasksSide.getState()
  const sel = selectedIds()
  return {
    wid: w.wid,
    canvas: w.canvas,
    focus: focusNow(),
    arrived: !!focusNow() && arrived(),
    selection: sel,
    piece: s.selected,
    tasks: k.many?.tasks ?? (k.selected ? [k.selected.task] : []),
    panel: s.cardSelected && !s.panelShut ? { card: s.cardSelected } : k.selected ? { task: k.selected.task } : null,
    beside: (params().get('beside') ?? '').split(',').filter(Boolean),
    side: side.open ? { tab: side.tab, days: side.days, linked: side.linked } : null,
  }
}

// ---- The facade

export const goTo = (id: string) => queued(() => goToNow(id))
export const focus = (planeId: string | null) => queued(() => focusOn(planeId))
export const select = (ids: string[]) => queued(() => selectNow(ids))
export const openPanel = (id: string) => queued(() => openPanelNow(id))
export const showBeside = (pieceId: string) => queued(() => showBesideNow(pieceId))
export { currentView }

export const agentUi = { goTo, focus, select, openPanel, showBeside, currentView, agentDriving }

if (import.meta.env.DEV) (window as unknown as { __agentUi: typeof agentUi }).__agentUi = agentUi
