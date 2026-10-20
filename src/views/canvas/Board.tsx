// The board scene: every item type on one canvas (D-040), 2.5D (D-018) with pan/zoom camera, cards and connections.
import { OrbitControls, Text } from '@react-three/drei'
import { ALL_FACES } from '../../three/fonts'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Color,
  MathUtils,
  MOUSE,
  OrthographicCamera,
  SRGBColorSpace,
  TOUCH,
  Vector2,
  WebGLRenderTarget,
  type PerspectiveCamera,
  type ShaderMaterial,
} from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { WithId } from '../../data/hooks'
import { createEdge, linked, updateEdge } from '../../data/edges'
import { type CompetitorFeature, type Edge, type Label, type Thread } from '../../data/model'
import type { NewThread } from '../../data/threads'
import { ThreadLayer, useThreadView, type PinnedThread } from './Threads'
import { ALL } from '../../data/planes'
import { selectionOf, usePresence } from '../../data/presence'
import { wasLine } from '../workspace/preview'
import { usePreviewFocus, useStage } from '../workspace/stage'
import { useCanvas } from '../../state/canvasStore'
import { useWsView } from '../../state/workspaceView'
import { editLocked, useViewer } from '../workspace/viewerLock'
import { isReducedMotion } from '../../state/motion'
import { usePalette } from '../../state/theme'
import { defaultKind, type BoardItem } from './boardKinds'
import { BoardLabel } from './BoardLabel'
import { BoardSection } from './BoardSection'
import { BoardTitle } from './BoardTitle'
import { isTitle, labelHalf, titleHalf } from './titleBlock'
import { DRAW_MIN, MIN_H, MIN_W, depths, drawSection, holdsRect, isSection, rectOf, sizeOf, useSectionDraw, type SectionRect } from './sections'
import { snapPoint } from './snap'
import { CARD_H, CARD_W, glideDt } from './cardLayout'
import { PackageFrame, type Frame } from './PackageFrame'
import { BoardLine } from './BoardLine'
import { EdgeLine, linePoints, linkChipAt } from './EdgeLine'
import { rightPress, useBoardMenu } from './rightClick'
import { setFoldedParts, setPieces } from './groupDrag'
import { useGuides } from './guides'
import { LabelBar } from './LabelBar'
import { LinkBar } from './LinkBar'
import { linkStyle } from './linkKinds'
import { FeatureList, PartList, featureSpots, partSpots, type Part, type Pose } from './SideList'
import { setFolded } from '../../data/nodes'
import { boardPoint, NodeCard } from './NodeCard'
import { GRID_STEP } from './snap'
import { BoardDetail } from './detail'
import { CursorReporter, FollowCamera, PeerCursors } from './PeerCursors'

type Props = {
  wid: string
  // Visible items only (filters applied).
  nodes: BoardItem[]
  edges: WithId<Edge>[]
  // Text written on the board (D-050).
  labels: WithId<Label>[]
  // Named beside their competitor, the full list while it's hovered or selected (D-164).
  competitorFeatures: WithId<CompetitorFeature>[]
  // Our feature each competitor's feature matches (the matrix cell's `competitorFeatureId`), by its id (D-164).
  matches?: Map<string, string>
  // Look here first instead of where this board was last left (e.g. a link jumped to a card).
  focus?: [number, number]
  // Where the camera is remembered between views: the workspace, or the focus view's card (D-127).
  cameraKey?: string
  // The card the focus view is on, ringed.
  centreId?: string | null
  // Sections (D-130) are only drawn, not moved or edited (the focus view).
  sectionsFixed?: boolean
  // Makes the section drawn with the crosshair (D-130); none where none can be made.
  onDrawSection?: (rect: SectionRect) => void
  // Packages whose home is this plane, framed round their members (D-141).
  frames?: Frame[]
  // Comment threads (D-159): pinned to what's on this board, or to spots on this plane.
  threads?: BoardThreads
}

export type BoardThreads = {
  list: WithId<Thread>[]
  // Whether what a thread is on still exists anywhere in the workspace (filtered out is not gone).
  exists: (id: string) => boolean
  // The open plane (D-139), for spot threads.
  plane: string
  // What a thread is on, for its heading.
  titleOf: (t: Pick<Thread, 'on' | 'targetId'>) => string
  // Owners delete any thread (D-166).
  isOwner: boolean
}

// Where each board's camera was left, so switching views and coming back doesn't lose your place.
const cameras = new Map<string, { target: [number, number]; distance: number }>()

// Opening a workspace starts from a view of everything, not where it was left (the workspace layout calls this).
export function forgetCamera(wid: string) {
  cameras.delete(wid)
}

const MIN_FIT = 9
const MAX_DISTANCE = 150
// Room left for the HUD and filters above, the toolbar below (in px), and a margin around the cards (in board units).
const CHROME_PX = 170

// Where the camera glides: a point, and a distance when it frames something.
type Flight = [number, number, number?]
const MARGIN = 1.2

const CARD_HALF: [number, number] = [CARD_W / 2, CARD_H / 2]
// Lists beside cards (D-164) sit just over every card, under one being dragged.
const LIST_Z = 0.046
// How long the pointer may be off a competitor and its list before the list closes: long enough to cross the gap.
const LEAVE_MS = 160
const NO_MATCHES = new Map<string, string>()

// Every card and label, with a margin: [x0, y0, x1, y1] in board units, or null on an empty board.
function boardBounds(nodes: BoardItem[], labels: WithId<Label>[]): [number, number, number, number] | null {
  const boxes = [
    ...nodes.map((n) => [n.x - CARD_W / 2, n.y - CARD_H / 2, n.x + CARD_W / 2, n.y + CARD_H / 2]),
    ...labels.map((l) => {
      const [hw, hh] = labelHalf(l)
      return [l.x - hw, l.y - hh, l.x + hw, l.y + hh]
    }),
  ]
  if (boxes.length === 0) return null
  return [
    Math.min(...boxes.map((b) => b[0])) - MARGIN,
    Math.min(...boxes.map((b) => b[1])) - MARGIN,
    Math.max(...boxes.map((b) => b[2])) + MARGIN,
    Math.max(...boxes.map((b) => b[3])) + MARGIN,
  ]
}

export function Board(props: Props) {
  // Pan/zoom listens on this wrapper, not the canvas. DOM events reach the canvas (and R3F's
  // handlers) first, so a card's pointerdown can switch the controls off before they react.
  const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null)
  // A crosshair while a section is being drawn (D-130).
  const drawing = useSectionDraw((s) => s.on) && !!props.onDrawSection

  return (
    // The browser's own menu gives way to the board's (D-117).
    <div
      ref={setWrapper}
      style={{ position: 'absolute', inset: 0, touchAction: 'none', cursor: drawing ? 'crosshair' : undefined }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        dpr={[1, 2]}
        // Draws only when something changes (D-063): React updates, the controls and text invalidate on their own,
        // and every glide below asks for frames until it settles.
        frameloop="demand"
        // near / far follow the camera's height from here on (BoardDetail), so the board's thin layers never z-fight.
        camera={{ position: [0, 0, 11], fov: 40, near: 0.1, far: 1000 }}
        gl={{ alpha: true, antialias: true }}
      >
        <BoardDetail />
        <ambientLight intensity={0.7} />
        <directionalLight position={[-4, 6, 10]} intensity={1.6} />
        {wrapper && <Controls domElement={wrapper} />}
        <FontWarmup />
        <Scene {...props} />
        {/* Live cursors (D-065): yours goes out, everyone else's comes in. */}
        <CursorReporter />
        <PeerCursors />
        <FollowCamera />
        <KeepLeftEdge />
        <Snapshot nodes={props.nodes} labels={props.labels} />
      </Canvas>
    </div>
  )
}

// Every face text can be set in (D-130), loaded while the board first loads. drei's <Text> suspends the first time it
// meets a font, and with no boundary of its own that remounts the whole board, whose cards then never play their
// entrance again: making text bold or italic for the first time emptied the board.
function FontWarmup() {
  return (
    <group visible={false}>
      {ALL_FACES.map((url) => (
        <Text key={url} font={url} fontSize={0.01}>
          x
        </Text>
      ))}
    </group>
  )
}

// When the canvas gets narrower or wider (the assistant's window opening or closing, D-081), keep the board's left
// edge where it is: the cards you're looking at stay put and the board is only revealed or covered on the right.
function KeepLeftEdge() {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const camera = useThree((s) => s.camera)
  const { width, height } = useThree((s) => s.size)
  const last = useRef(width)
  useEffect(() => {
    const dw = width - last.current
    last.current = width
    if (!controls || !dw || !height) return
    const fov = ((camera as { fov?: number }).fov ?? 40) * (Math.PI / 180)
    const perPixel = (2 * camera.position.z * Math.tan(fov / 2)) / height
    const dx = (dw / 2) * perPixel
    camera.position.x += dx
    controls.target.x += dx
    controls.update()
  }, [width, height, camera, controls])
  return null
}

function Controls({ domElement }: { domElement: HTMLElement }) {
  return (
    <OrbitControls
      domElement={domElement}
      makeDefault
      enableRotate={false}
      screenSpacePanning
      zoomToCursor
      enableDamping
      dampingFactor={0.12}
      minDistance={3}
      // Far enough out to see a whole workspace of areas at once; further, and cards are specks.
      maxDistance={MAX_DISTANCE}
      mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
      touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }}
    />
  )
}

// How many pixels of the board's right side a side panel covers (a card's details, D-040), or 0.
function coveredRight(canvas: HTMLElement): number {
  const panel = document.querySelector('[data-side-panel]')
  if (!panel) return 0
  const p = panel.getBoundingClientRect()
  const c = canvas.getBoundingClientRect()
  return p.width && p.left < c.right && p.right > c.left ? Math.max(0, c.right - p.left) : 0
}

function Scene({ wid, nodes, edges, labels, competitorFeatures, matches = NO_MATCHES, focus, cameraKey, centreId, sectionsFixed = false, onDrawSection, frames = [], threads }: Props) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  const gl = useThree((s) => s.gl)
  const selectedId = useCanvas((s) => s.selectedId)
  const dragging = useCanvas((s) => s.dragging)
  const linkFrom = useCanvas((s) => s.linkFrom)
  const linkPointer = useCanvas((s) => s.linkPointer)
  const { select, moveLink, endLink, setViewCenter } = useCanvas.getState()
  // Where the camera is gliding to, if anywhere (jump list).
  // A distance too when it frames something (D-096).
  const flight = useRef<Flight | null>(null)

  useEffect(() => {
    if (!controls) return
    setViewCenter(() => [controls.target.x, controls.target.y])
    const jump = ([x, y]: [number, number]) => {
      camera.position.set(x, y, camera.position.z)
      controls.target.set(x, y, 0)
      controls.update()
    }
    useCanvas.getState().setFocusOn(jump)
    const fly = (at: Flight) => {
      if (isReducedMotion()) {
        if (at[2] !== undefined) camera.position.z = at[2]
        return jump([at[0], at[1]])
      }
      flight.current = at
      // The board draws on demand: without a first frame the glide below never starts.
      invalidate()
    }
    useCanvas.getState().setFlyTo((at) => fly(at))
    useCanvas.getState().setFlyToFit((box) => fly(fitLatest.current(box)))
    useCanvas.getState().setFitAll(() => {
      const bounds = boundsLatest.current()
      if (bounds) fly(fitLatest.current(bounds))
    })
  }, [controls, camera, setViewCenter, invalidate])

  // Glide toward the flight target; any pan or zoom of your own takes over.
  useEffect(() => {
    if (!controls) return
    const cancel = () => (flight.current = null)
    controls.addEventListener('start', cancel)
    return () => controls.removeEventListener('start', cancel)
  }, [controls])
  useFrame(({ invalidate }, delta) => {
    const dt = glideDt(delta)
    const to = flight.current
    if (!to || !controls) return
    const x = MathUtils.damp(controls.target.x, to[0], 5, dt)
    const y = MathUtils.damp(controls.target.y, to[1], 5, dt)
    camera.position.x += x - controls.target.x
    camera.position.y += y - controls.target.y
    if (to[2] !== undefined) camera.position.z = MathUtils.damp(camera.position.z, to[2], 5, dt)
    controls.target.set(x, y, 0)
    controls.update()
    if (Math.hypot(to[0] - x, to[1] - y) < 0.01 && (to[2] === undefined || Math.abs(to[2] - camera.position.z) < 0.02)) flight.current = null
    else invalidate()
  })

  useEffect(() => {
    if (!controls) return
    const key = cameraKey ?? wid
    const saved = cameras.get(key)
    const at = focus ?? saved?.target
    if (at) {
      controls.target.set(at[0], at[1], 0)
      camera.position.set(at[0], at[1], saved?.distance ?? camera.position.z)
      controls.update()
    } else {
      fitAll()
    }
    return () => {
      cameras.set(key, { target: [controls.target.x, controls.target.y], distance: camera.position.z })
    }
    // Only on mount: `focus` is where to start, not something to follow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls])

  // Where the camera looks, and from how far, to frame a box as closely as the zoom limits allow, in the part of the
  // board a side panel (a card's details) doesn't cover.
  function fitView([x0, y0, x1, y1]: [number, number, number, number]): Flight {
    const fov = ((camera as { fov?: number }).fov ?? 40) * (Math.PI / 180)
    const tan = Math.tan(fov / 2)
    const usable = Math.max(0.3, (size.height - CHROME_PX) / size.height)
    const cover = coveredRight(gl.domElement)
    const open = Math.max(size.width * 0.3, size.width - cover)
    const distance = MathUtils.clamp(Math.max((y1 - y0) / 2 / (tan * usable), (x1 - x0) / 2 / (tan * (open / size.height))), MIN_FIT, MAX_DISTANCE)
    // The view's centre goes right by half the covered width, so the box sits in the middle of what's left.
    const perPixel = (2 * distance * tan) / size.height
    const cx = (x0 + x1) / 2 + ((size.width - open) / 2) * perPixel
    // The HUD covers more of the top than the toolbar covers of the bottom: nudge the view up a little.
    const cy = (y0 + y1) / 2 + ((y1 - y0) / 2) * (1 - usable) * 0.3
    return [cx, cy, distance]
  }

  const fitLatest = useRef(fitView)
  fitLatest.current = fitView
  const boundsLatest = useRef(() => boardBounds(nodes, labels))
  boundsLatest.current = () => boardBounds(nodes, labels)

  // Frame every card and label.
  function fitAll() {
    const bounds = boardBounds(nodes, labels)
    if (!controls || !bounds) return
    const [cx, cy, z] = fitView(bounds)
    controls.target.set(cx, cy, 0)
    camera.position.set(cx, cy, z!)
    controls.update()
  }

  // A link released anywhere but on a card is cancelled; controls always come back.
  useEffect(() => {
    const up = () => {
      if (useCanvas.getState().pressing) useCanvas.getState().setPressing(null)
      if (useCanvas.getState().linkFrom) endLink()
      if (controls) controls.enabled = true
    }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [controls, endLink])

  // A competitor's features, named beside it (D-164): the full list while it's selected (or one of its features is), or
  // while the pointer is on it or its list; closed again while it's dragged. Clicking it again changes nothing.
  const theirs = useMemo(() => {
    const map = new Map<string, WithId<CompetitorFeature>[]>()
    for (const f of [...competitorFeatures].sort((a, b) => a.createdAt - b.createdAt)) map.set(f.competitorId, [...(map.get(f.competitorId) ?? []), f])
    return map
  }, [competitorFeatures])
  const pressing = useCanvas((s) => s.pressing)
  const hoverId = useCanvas((s) => s.hoverId)
  const openId = useMemo(() => {
    if (!selectedId) return null
    if (theirs.has(selectedId)) return selectedId
    return competitorFeatures.find((f) => f.id === selectedId)?.competitorId ?? null
  }, [selectedId, theirs, competitorFeatures])
  const [hot, setHot] = useState<string | null>(null)
  const overList = useRef<string | null>(null)
  const leave = useRef(0)
  const closeLater = (id: string) => {
    window.clearTimeout(leave.current)
    leave.current = window.setTimeout(() => {
      if (overList.current !== id && useCanvas.getState().hoverId !== id) setHot((h) => (h === id ? null : h))
    }, LEAVE_MS)
  }
  useEffect(() => {
    if (hoverId && theirs.has(hoverId)) {
      window.clearTimeout(leave.current)
      setHot(hoverId)
    } else if (hot && overList.current !== hot) closeLater(hot)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverId, theirs])
  useEffect(() => () => window.clearTimeout(leave.current), [])
  const listHover = (id: string) => (on: boolean) => {
    if (on) {
      overList.current = id
      window.clearTimeout(leave.current)
      setHot(id)
    } else {
      if (overList.current === id) overList.current = null
      closeLater(id)
    }
  }
  // One function per competitor for the board's whole life, so its memoised list skips re-rendering on every hover.
  const listHoverLatest = useRef(listHover)
  listHoverLatest.current = listHover
  const listHovers = useMemo(() => new Map<string, (on: boolean) => void>(), [])
  const hoverOfList = (id: string) => {
    let f = listHovers.get(id)
    if (!f) listHovers.set(id, (f = (on: boolean) => listHoverLatest.current(id)(on)))
    return f
  }
  const isOpen = (id: string) => (openId === id || hot === id) && !(pressing === id && dragging[id])

  // Parts (D-164): a feature linked to another with `part of` is one of its parts; folded, a feature's parts (and theirs)
  // are names beside it. One parent each (the first link), and a link that would make a loop is left out.
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const family = useMemo(() => {
    const parent = new Map<string, string>()
    for (const e of edges) {
      if (e.kind !== 'part-of' || e.fromId === e.toId || parent.has(e.fromId)) continue
      if (byId.get(e.fromId)?.type === 'feature' && byId.get(e.toId)?.type === 'feature') parent.set(e.fromId, e.toId)
    }
    for (const id of [...parent.keys()]) {
      const seen = new Set([id])
      for (let p = parent.get(id); p; p = parent.get(p)) {
        if (seen.has(p)) {
          parent.delete(id)
          break
        }
        seen.add(p)
      }
    }
    const kids = new Map<string, string[]>()
    for (const [c, p] of parent) kids.set(p, [...(kids.get(p) ?? []), c])
    // Top to bottom, then left to right, as they sit on the board.
    for (const list of kids.values()) list.sort((a, b) => byId.get(b)!.y - byId.get(a)!.y || byId.get(a)!.x - byId.get(b)!.x)
    const tree = (id: string, depth = 1): Part[] => (kids.get(id) ?? []).flatMap((k) => [{ id: k, title: byId.get(k)!.title, depth }, ...tree(k, depth + 1)])
    // The card a feature is folded into: the highest folded one above it, if any.
    const topOf = (id: string) => {
      let top: string | null = null
      for (let p = parent.get(id); p; p = parent.get(p)) if (byId.get(p)?.folded) top = p
      return top
    }
    const lists = [...kids.keys()].map((id) => ({ id, parts: tree(id) }))
    const top = new Map<string, string>()
    for (const n of nodes) {
      const t = topOf(n.id)
      if (t) top.set(n.id, t)
    }
    const info = new Map([...kids.keys()].map((id) => [id, { own: kids.get(id)!.length, all: tree(id).length, folded: !!byId.get(id)?.folded }]))
    return { lists, top, info }
  }, [edges, byId, nodes])

  // Where everything is drawn, and how big what links end at is: cards, the names beside competitors (those shown), and
  // folded parts' names beside the card they're folded into.
  const { positions, halves } = useMemo(() => {
    const map = new Map<string, [number, number]>()
    const halves = new Map<string, [number, number]>()
    for (const n of nodes) map.set(n.id, dragging[n.id] ?? [n.x, n.y])
    const place = (at: [number, number], id: string, p: Pose) => {
      if (p.o <= 0) return
      map.set(id, [at[0] + p.x, at[1] + p.y])
      halves.set(id, [p.w / 2, p.h / 2])
    }
    for (const [cid, list] of theirs) {
      const at = map.get(cid)
      if (!at) continue
      const s = featureSpots(list, isOpen(cid))
      for (const [id, p] of s) place(at, id, p)
    }
    for (const { id, parts } of family.lists) {
      const at = map.get(id)
      const s = partSpots(parts)
      if (!at) continue
      for (const p of parts) if (family.top.get(p.id) === id) place(at, p.id, s.get(p.id)!)
    }
    return { positions: map, halves }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, dragging, theirs, family, openId, hot, pressing])

  // Older cards sit lower; newer ones on top.
  const layers = useMemo(
    () => new Map([...nodes].sort((a, b) => a.createdAt - b.createdAt).map((c, n) => [c.id, n])),
    [nodes],
  )

  const selected = selectedId ? byId.get(selectedId) : undefined
  // A selected customer lights up everything tagged for it (D-044).
  const customerId = selected?.type === 'customer' ? selected.id : null
  // What collaborators have selected: a ring per person in their colour, and their names (D-065, D-067).
  const peers = usePresence((s) => s.peers)
  const peerSelection = useMemo(() => {
    const map = new Map<string, { name: string; color: string }[]>()
    for (const p of peers) for (const id of selectionOf(p)) map.set(id, [...(map.get(id) ?? []), { name: p.name, color: p.color }])
    return map
  }, [peers])
  // The assistant's preview (D-096): marks, what edits replaced, where moved cards were, the lit checklist row.
  const palette = usePalette()
  const preview = useStage((s) => s.preview)
  const litN = usePreviewFocus((f) => f.lit)
  const litIds = useMemo(() => new Set(preview?.steps.find((st) => st.n === litN)?.ids ?? []), [preview, litN])

  const linkDrop = (targetId: string) => {
    const fromId = useCanvas.getState().linkFrom
    const from = fromId ? byId.get(fromId) : undefined
    // Onto one of a competitor's features: "inspired by" is the usual reason (D-058).
    const feature = competitorFeatures.find((f) => f.id === targetId)
    // The new link is selected, its bar open with the cursor in the label field: change its kind or name it right away.
    const made = (id: string) => useCanvas.getState().selectEdge(id, true)
    if (from && feature) {
      if (!linked(edges, from.id, feature.id)) made(createEdge(wid, { id: from.id, type: from.type }, { id: feature.id, type: 'competitorFeature' }, 'inspired-by'))
      return
    }
    const to = byId.get(targetId)
    if (!from || !to || from.id === to.id || linked(edges, from.id, to.id)) return
    // A tag always points item → customer, whichever card you dragged from.
    const [a, b] = to.type !== 'customer' && from.type === 'customer' ? [to, from] : [from, to]
    made(createEdge(wid, { id: a.id, type: a.type }, { id: b.id, type: b.type }, defaultKind(a.type, b.type)))
  }

  // One function for the board's whole life, so cards that didn't change skip re-rendering (NodeCard is memoised).
  const dropLatest = useRef(linkDrop)
  dropLatest.current = linkDrop
  const onLinkDrop = useMemo(() => (targetId: string) => dropLatest.current(targetId), [])
  // Folds a feature's parts into it, or unfolds them (D-164); not while only looking.
  const fold = (id: string) => {
    if (!editLocked()) void setFolded(wid, id, !byId.get(id)?.folded)
  }
  const foldLatest = useRef(fold)
  foldLatest.current = fold
  const onFold = useMemo(() => (id: string) => foldLatest.current(id), [])

  // Links to a competitor's stacked features point at the competitor, so they show without fanning it out (D-058).
  // Several links between the same pair of cards (both ways, or through a competitor's features) are drawn side by
  // side: `slot` is a line's place in its pair, direct links first, and `of` how many the pair has.
  const hiddenLinks = useWsView((s) => s.hiddenLinks)
  // A competitor's hidden `competes` lines also show while its card (or the card they reach) is under the pointer (D-135).
  const edgeId = useCanvas((s) => s.edgeId)
  const litEdge = useCanvas((s) => s.litEdge)
  const lines = useMemo(() => {
    const owner = new Map(competitorFeatures.map((f) => [f.id, f.competitorId]))
    const end = (id: string) => (positions.has(id) ? id : (owner.get(id) ?? id))
    const count = new Map<string, number>()
    const out: { edge: (typeof edges)[number]; from: string; to: string; touches: string[]; active: boolean; pair: string; slot: number; of: number }[] = []
    const viaStack = (e: (typeof edges)[number]) => end(e.fromId) !== e.fromId || end(e.toId) !== e.toId
    for (const edge of [...edges].sort((x, y) => Number(viaStack(x)) - Number(viaStack(y)))) {
      const from = end(edge.fromId)
      const to = end(edge.toId)
      // Inside one fold (D-164): a part and the card it's folded into, or two parts folded into the same one.
      if ((family.top.get(edge.fromId) ?? edge.fromId) === (family.top.get(edge.toId) ?? edge.toId)) continue
      if (from === to || !positions.has(from) || !positions.has(to)) continue
      // What the link counts as touching for focus: its ends, where it's drawn, and the competitor whose feature it
      // reaches, so selecting a competitor lights links to its features too, fanned out or not.
      const touches = [edge.fromId, edge.toId, from, to, owner.get(edge.fromId), owner.get(edge.toId)].filter((id): id is string => Boolean(id))
      // Hidden by the LINKS filter (D-108), unless it's the selected card's, the selected link (one just drawn), the one
      // the side panel points at, or one the assistant's preview adds; a competes line also for the hovered card (D-135).
      const active = touches.includes(selectedId ?? '')
      const group = linkStyle(edge.kind).group
      const shown =
        active || edge.id === edgeId || edge.id === litEdge || edge.id.startsWith('preview-') || (group === 'competes' && touches.includes(hoverId ?? ''))
      if (hiddenLinks.includes(group) && !shown) continue
      const pair = from < to ? `${from}|${to}` : `${to}|${from}`
      const slot = count.get(pair) ?? 0
      count.set(pair, slot + 1)
      out.push({ edge, from, to, touches, active, pair, slot, of: 0 })
    }
    for (const line of out) line.of = count.get(line.pair)!
    return out
  }, [edges, positions, competitorFeatures, family, selectedId, hiddenLinks, hoverId, edgeId, litEdge])

  // Focus (D-108): with a card under the pointer, or cards selected, links that don't touch them go faint; with a link
  // selected, every other one does.
  const selection = useCanvas((s) => s.selection)
  const focusIds = useMemo(() => {
    const ids = hoverId ? [hoverId] : selection.filter((id) => positions.has(id))
    return ids.length ? new Set(ids) : null
  }, [hoverId, selection, positions])
  const dimmed = (line: (typeof lines)[number]) =>
    edgeId ? line.edge.id !== edgeId : focusIds ? !line.touches.some((id) => focusIds.has(id)) : false

  // A link's bend points (D-155) are kept relative to the middle between its cards' centres: on the board they're there
  // plus that middle, and written back the other way.
  const middleOf = (line: (typeof lines)[number]): [number, number] => {
    const a = positions.get(line.from)!
    const b = positions.get(line.to)!
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  }
  const bendsOf = (line: (typeof lines)[number]): [number, number][] => {
    const m = middleOf(line)
    return (line.edge.bends ?? []).map((p) => [m[0] + p.x, m[1] + p.y])
  }
  const setBends = (line: (typeof lines)[number], points: [number, number][]) => {
    const m = middleOf(line)
    const round = (v: number) => Math.round(v * 1000) / 1000
    void updateEdge(wid, line.edge.id, { bends: points.length ? points.map(([x, y]) => ({ x: round(x - m[0]), y: round(y - m[1]) })) : undefined })
  }
  // Where a line runs on the board: through its bend points, or straight and moved beside the others of its pair.
  const lineOf = (line: (typeof lines)[number]) => {
    const fromHalf = halfOf(line.from)
    const toHalf = halfOf(line.to)
    const bends = bendsOf(line)
    const a = positions.get(line.from)!
    const b = positions.get(line.to)!
    const side = bends.length ? { from: a, to: b, chipShift: 0 } : sideBySide(line, a, b, Math.min(...fromHalf, ...toHalf))
    return { ...side, fromHalf, toHalf, bends }
  }

  // Where every card and label is, for dragging a selection together (groupDrag.ts); sections with their size, so
  // they carry what they hold (D-130).
  useEffect(() => {
    const map = new Map<string, { kind: BoardItem['type'] | 'label'; id: string; x: number; y: number; half?: [number, number]; section?: boolean }>()
    for (const n of nodes) map.set(n.id, { kind: n.type, id: n.id, x: n.x, y: n.y })
    for (const l of labels) {
      const [w, h] = sizeOf(l)
      map.set(l.id, isSection(l) ? { kind: 'label', id: l.id, x: l.x, y: l.y, half: [w / 2, h / 2], section: true } : { kind: 'label', id: l.id, x: l.x, y: l.y })
    }
    setPieces(map)
  }, [nodes, labels])

  // A folded card's parts move with it (D-164).
  useEffect(() => {
    const map = new Map<string, string[]>()
    for (const [part, top] of family.top) map.set(top, [...(map.get(top) ?? []), part])
    setFoldedParts(map)
  }, [family])

  // How deep each section sits in others, so inner ones draw over outer ones.
  const sectionDepth = useMemo(() => {
    const sections = labels.filter(isSection)
    const d = depths(sections)
    return new Map(sections.map((l, i) => [l.id, d[i]]))
  }, [labels])

  // The bars on a selected link or text label (D-108); none while only looking (viewers, the assistant's preview).
  const viewer = useViewer((s) => s.viewer)
  const editable = !viewer && !preview
  const selectedLine = edgeId ? lines.find((l) => l.edge.id === edgeId) : undefined
  // The title block (D-118) has no size or colour to pick.
  const selectedLabel = selection.length === 1 ? labels.find((l) => l.id === selection[0] && !isTitle(l)) : undefined
  const editingLabel = useCanvas((s) => s.editingLabel)
  // A right-click menu open on it stands in for its bar until it closes (D-117).
  const menuOn = useBoardMenu((s) => (s.open && s.open.target.kind !== 'board' ? s.open.target.id : null))

  // Alt+drag on empty board draws a box; what's inside is selected (shift keeps what was) (D-108).
  const [box, setBox] = useState<{ from: [number, number]; to: [number, number]; add: boolean } | null>(null)
  useEffect(() => {
    if (!box) return
    const up = () => {
      const x0 = Math.min(box.from[0], box.to[0])
      const x1 = Math.max(box.from[0], box.to[0])
      const y0 = Math.min(box.from[1], box.to[1])
      const y1 = Math.max(box.from[1], box.to[1])
      const inside = (x: number, y: number, hw: number, hh: number) => x + hw > x0 && x - hw < x1 && y + hh > y0 && y - hh < y1
      const ids = [
        ...nodes.filter((n) => inside(n.x, n.y, CARD_W / 2, CARD_H / 2)).map((n) => n.id),
        ...labels
          .filter((l) =>
            // A section only when the box goes all round it: touching one would pick up every big area.
            isSection(l)
              ? holdsRect([x0, y0, x1, y1], rectOf(l))
              : isTitle(l)
                ? inside(l.x, l.y, ...titleHalf())
                : inside(l.x, l.y, ...labelHalf(l)),
          )
          .map((l) => l.id),
      ]
      if (Math.abs(x1 - x0) > 0.05 || Math.abs(y1 - y0) > 0.05) useCanvas.getState().selectMany(ids, box.add)
      setBox(null)
      if (controls) controls.enabled = true
    }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [box, nodes, labels, controls])

  const linkSource = linkFrom ? positions.get(linkFrom) : undefined
  const halfOf = (id: string) => halves.get(id) ?? CARD_HALF
  const selectedLinkAt = (line: (typeof lines)[number]) => {
    const l = lineOf(line)
    return linkChipAt(linePoints(l.from, l.to, l.fromHalf, l.toHalf, l.bends), l.chipShift)
  }

  // Where a thread's pin goes (D-159): a card's or text's top-right corner, a section's, a link's chip, a spot; null
  // when what it's on isn't shown here (filtered, on another plane, a hidden link).
  const openThreadId = useThreadView((s) => s.openId)
  const draftThread = useThreadView((s) => s.draft)
  const anchorOf = (t: Pick<Thread, 'on' | 'targetId' | 'planeId' | 'x' | 'y'>): [number, number] | null => {
    if (t.on === 'spot') return (t.planeId ?? ALL) === (threads?.plane ?? ALL) ? [t.x, t.y] : null
    const id = t.targetId ?? ''
    if (t.on === 'card') {
      const p = positions.get(id)
      if (!p) return null
      const [hw, hh] = halfOf(id)
      return [p[0] + hw, p[1] + hh]
    }
    if (t.on === 'label') {
      const l = labels.find((o) => o.id === id)
      if (!l) return null
      const [x, y] = dragging[l.id] ?? [l.x, l.y]
      const [hw, hh] = labelHalf(l)
      return [x + hw, y + hh]
    }
    const line = lines.find((o) => o.edge.id === id)
    return line ? selectedLinkAt(line) : null
  }
  const pins: PinnedThread[] = (threads?.list ?? []).flatMap((t) => {
    // Which to show (resolved ones, only new ones) is the thread layer's choice (D-166).
    const gone = t.on !== 'spot' && !threads!.exists(t.targetId ?? '')
    // What it was on was deleted (D-171): no pin on the board; it stays in the threads panel, and opened from there it
    // shows where the thing was. Undoing the delete brings the pin back.
    if (gone && t.id !== openThreadId) return []
    const at = gone ? [t.x, t.y] as [number, number] : anchorOf(t)
    return at ? [{ thread: t, at, gone }] : []
  })
  const openThread = openThreadId ? (threads?.list.find((t) => t.id === openThreadId) ?? null) : null
  const openAt = openThread ? (pins.find((p) => p.thread.id === openThread.id)?.at ?? null) : draftThread ? anchorOf({ ...draftThread, x: draftThread.at[0], y: draftThread.at[1] }) : null


  return (
    <>
      <mesh
        // Hidden while the board is drawn as a picture (Snapshot).
        name="grid"
        position={[0, 0, -0.1]}
        onClick={(e) => {
          // A click (not the end of a pan) on empty board clears the selection.
          if (e.delta < 4 && !e.altKey) select(null)
        }}
        onPointerDown={(e) => {
          if (rightPress(e, { kind: 'board' })) return
          if (e.button !== 0 || !e.altKey) return
          const p = boardPoint(e)
          if (!p) return
          // Runs before the controls' own listener (on the wrapper), so the board doesn't pan.
          if (controls) controls.enabled = false
          setBox({ from: p, to: p, add: e.shiftKey })
        }}
        onPointerMove={(e) => {
          if (box) {
            const p = boardPoint(e)
            if (p) setBox((b) => b && { ...b, to: p })
            return
          }
          if (!useCanvas.getState().linkFrom) return
          const p = boardPoint(e)
          if (p) moveLink(p)
        }}
      >
        <planeGeometry args={[2000, 2000]} />
        <DotGridMaterial />
      </mesh>

      {frames.map((f) => (
        <PackageFrame key={f.id} frame={f} />
      ))}
      {labels.map((l) =>
        isSection(l) ? (
          <BoardSection key={l.id} wid={wid} label={l} depth={sectionDepth.get(l.id) ?? 0} fixed={sectionsFixed} />
        ) : isTitle(l) ? (
          <BoardTitle key={l.id} wid={wid} label={l} mark={preview?.marks.get(l.id)} was={wasLine(preview?.before.get(l.id))} />
        ) : (
          <BoardLabel key={l.id} wid={wid} label={l} mark={preview?.marks.get(l.id)} was={wasLine(preview?.before.get(l.id))} lit={litIds.has(l.id)} />
        ),
      )}

      {lines.map((line) => {
        const { edge, active } = line
        const l = lineOf(line)
        return (
          <EdgeLine
            key={edge.id}
            from={l.from}
            to={l.to}
            fromHalf={l.fromHalf}
            toHalf={l.toHalf}
            chipShift={l.chipShift}
            bends={l.bends}
            kind={edge.kind}
            label={edge.label}
            active={active || edge.id === litEdge}
            dim={dimmed(line) && edge.id !== litEdge}
            // The side panel's link (just added, or its row hovered) looks selected, so it's easy to find.
            selected={edge.id === edgeId || edge.id === litEdge}
            // The assistant's preview: links it adds in the new colour, links it edits (D-108) in the edited one.
            tint={edge.id.startsWith('preview-') ? palette.diff.new : preview?.marks.get(edge.id) === 'edited' ? palette.diff.edited : undefined}
            onSelect={preview ? undefined : () => useCanvas.getState().selectEdge(edge.id)}
            onRightPress={(e) => rightPress(e, { kind: 'link', id: edge.id })}
            // Only the selected link bends (D-155), not one the side panel lights.
            onBends={editable && edge.id === edgeId ? (points) => setBends(line, points) : undefined}
          />
        )
      })}
      {editable && selectedLine && menuOn !== selectedLine.edge.id && (
        <LinkBar
          wid={wid}
          edge={selectedLine.edge}
          at={selectedLinkAt(selectedLine)}
        />
      )}
      {editable && selectedLabel && !editingLabel && menuOn !== selectedLabel.id && (
        <LabelBar
          wid={wid}
          label={selectedLabel}
          // Under the text from its left edge (labelHalf, a turned one by its turned box); a section's under its
          // frame, where it covers nothing inside.
          at={
            isSection(selectedLabel)
              ? [rectOf(selectedLabel)[0], rectOf(selectedLabel)[1]]
              : [selectedLabel.x - labelHalf(selectedLabel)[0], selectedLabel.y - labelHalf(selectedLabel)[1] - 0.15]
          }
        />
      )}
      {box && <SelectBox from={box.from} to={box.to} color={palette.cyan} />}
      {onDrawSection && <SectionDrawer onDraw={onDrawSection} color={palette.magenta} />}
      <GuideLines color={palette.magenta} />
      {threads && (
        <ThreadLayer
          wid={wid}
          pins={pins}
          openAt={openAt}
          thread={openThread}
          title={threads.titleOf(openThread ?? draftThread ?? ({ on: 'spot' } as NewThread))}
          isOwner={threads.isOwner}
        />
      )}

      {linkSource && linkPointer && <EdgeLine from={linkSource} to={linkPointer} fromHalf={CARD_HALF} toHalf={[0, 0]} active />}

      {[...theirs].map(([cid, list]) => {
        const at = positions.get(cid)
        return at ? (
          <group key={cid} position={[at[0], at[1], LIST_Z + (isOpen(cid) ? 0.002 : 0)]}>
            <FeatureList features={list} open={isOpen(cid)} matches={matches} onHover={hoverOfList(cid)} onLinkDrop={onLinkDrop} />
          </group>
        ) : null
      })}
      {family.lists.map(({ id, parts }) => {
        const at = positions.get(id)
        return at && !family.top.has(id) ? (
          <group key={id} position={[at[0], at[1], LIST_Z]}>
            <PartList id={id} parts={parts} shown={!!byId.get(id)?.folded} onFold={onFold} onLinkDrop={onLinkDrop} />
          </group>
        ) : null
      })}

      {nodes.map((node) => (
        <NodeCard
          key={node.id}
          wid={wid}
          item={node}
          layer={layers.get(node.id) ?? 0}
          related={customerId !== null && node.forIds.includes(customerId)}
          parts={family.info.get(node.id)}
          onFold={onFold}
          tuck={family.top.has(node.id) ? (positions.get(node.id) ?? null) : null}
          peers={peerSelection.get(node.id)}
          mark={preview?.marks.get(node.id)}
          was={wasLine(preview?.before.get(node.id))}
          lit={litIds.has(node.id)}
          centre={node.id === centreId}
          onLinkDrop={onLinkDrop}
        />
      ))}

      {/* Where a moved card was: a dashed outline and a line to where it goes. */}
      {preview &&
        nodes.map((node) => {
          const was = preview.from.get(node.id)
          return was ? <MoveGhost key={`ghost-${node.id}`} from={was} to={[node.x, node.y]} color={palette.diff.moved} lit={litIds.has(node.id)} /> : null
        })}
    </>
  )
}

// Room between links drawn side by side: a chip's height and a little, so their chips don't overlap.
const LINK_SPACING = 0.32
// How far the chips of side-by-side links move along their lines, for steep lines, where the chips (wider than the
// spacing) would otherwise sit on each other.
const CHIP_STAGGER = 0.36

// Moves one of a pair's links sideways, square to the line, so the pair's links sit side by side centred on the cards'
// centres. The side comes from the pair (not the link's direction), so A → B and B → A part instead of swapping. The
// spread stays inside the smaller end (`half`, its smallest half size), so every line still leaves the card.
function sideBySide(
  line: { pair: string; from: string; slot: number; of: number },
  from: [number, number],
  to: [number, number],
  half: number,
): { from: [number, number]; to: [number, number]; chipShift: number } {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1])
  if (line.of < 2 || len === 0) return { from, to, chipShift: 0 }
  const step = Math.min(LINK_SPACING, (half * 1.6) / (line.of - 1))
  const sign = line.pair.startsWith(`${line.from}|`) ? 1 : -1
  const k = (line.slot - (line.of - 1) / 2) * sign
  const nx = (-(to[1] - from[1]) / len) * k * step
  const ny = ((to[0] - from[0]) / len) * k * step
  return {
    from: [from[0] + nx, from[1] + ny],
    to: [to[0] + nx, to[1] + ny],
    chipShift: k * CHIP_STAGGER * (Math.abs(to[1] - from[1]) / len),
  }
}

// What a dragged card lines up with (D-117): thin lines over the cards, gone when the drag ends.
function GuideLines({ color }: { color: string }) {
  const lines = useGuides((s) => s.lines)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => invalidate(), [lines, invalidate])
  return (
    <group position={[0, 0, 0.08]}>
      {lines.map((g) => (
        <BoardLine
          key={`${g.axis}${g.at}`}
          points={g.axis === 'x' ? [[g.at, g.from, 0], [g.at, g.to, 0]] : [[g.from, g.at, 0], [g.to, g.at, 0]]}
          color={color}
          lineWidth={1}
          toneMapped={false}
        />
      ))}
    </group>
  )
}

// The box being drawn round things to select them (D-108).
function SelectBox({ from, to, color }: { from: [number, number]; to: [number, number]; color: string }) {
  const points: [number, number, number][] = [
    [from[0], from[1], 0],
    [to[0], from[1], 0],
    [to[0], to[1], 0],
    [from[0], to[1], 0],
    [from[0], from[1], 0],
  ]
  return (
    <group position={[0, 0, 0.08]}>
      <mesh position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, -0.001]}>
        <planeGeometry args={[Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1])]} />
        <meshBasicMaterial color={color} transparent opacity={0.06} depthWrite={false} toneMapped={false} />
      </mesh>
      <BoardLine points={points} color={color} lineWidth={1} dashed dashSize={0.1} gapSize={0.07} toneMapped={false} />
    </group>
  )
}

// Drawing a section (D-130). While the crosshair is on, a sheet over the whole board takes the left button, so the
// press starts a frame even on a card; the right button and the wheel still pan and zoom. The frame follows the
// pointer from where it was pressed (corners on the grid while snapping is on, alt: freely) and becomes a section on
// release, at least the smallest size a section can be. A drag too short to mean anything draws nothing.
function SectionDrawer({ onDraw, color }: { onDraw: (rect: SectionRect) => void; color: string }) {
  const on = useSectionDraw((s) => s.on)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const invalidate = useThree((s) => s.invalidate)
  const [draft, setDraft] = useState<{ from: [number, number]; to: [number, number] } | null>(null)
  useEffect(() => invalidate(), [on, draft, invalidate])

  // Released anywhere, even off the canvas.
  useEffect(() => {
    if (!draft) return
    const up = () => {
      const [x0, x1] = [Math.min(draft.from[0], draft.to[0]), Math.max(draft.from[0], draft.to[0])]
      const [y0, y1] = [Math.min(draft.from[1], draft.to[1]), Math.max(draft.from[1], draft.to[1])]
      setDraft(null)
      if (controls) controls.enabled = true
      if (Math.max(x1 - x0, y1 - y0) < DRAW_MIN) return
      // Grown from the corner it was drawn from, if it's below the smallest size.
      const w = Math.max(MIN_W, x1 - x0)
      const h = Math.max(MIN_H, y1 - y0)
      const left = draft.to[0] < draft.from[0] ? draft.from[0] - w : draft.from[0]
      const bottom = draft.to[1] < draft.from[1] ? draft.from[1] - h : draft.from[1]
      drawSection(false)
      onDraw({ x: left + w / 2, y: bottom + h / 2, w, h })
    }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [draft, controls, onDraw])

  if (!on) return null
  const corners = draft && [
    [draft.from[0], draft.from[1], 0],
    [draft.to[0], draft.from[1], 0],
    [draft.to[0], draft.to[1], 0],
    [draft.from[0], draft.to[1], 0],
    [draft.from[0], draft.from[1], 0],
  ] as [number, number, number][]
  return (
    <>
      <mesh
        position={[0, 0, 0.3]}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.stopPropagation()
          const p = boardPoint(e)
          if (!p) return
          // Before the controls' own listener (on the wrapper), so the board doesn't pan.
          if (controls) controls.enabled = false
          const at = snapPoint(p, e.altKey)
          setDraft({ from: at, to: at })
        }}
        onPointerMove={(e) => {
          if (!draft) return
          const p = boardPoint(e)
          if (p) setDraft((d) => d && { ...d, to: snapPoint(p, e.altKey) })
        }}
        onClick={(e) => e.stopPropagation()}
        // Cards under it don't light up or show their grab hand meanwhile.
        onPointerOver={(e) => e.stopPropagation()}
      >
        <planeGeometry args={[2000, 2000]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {draft && corners && (
        <group position={[0, 0, 0.08]}>
          <mesh position={[(draft.from[0] + draft.to[0]) / 2, (draft.from[1] + draft.to[1]) / 2, -0.001]}>
            <planeGeometry args={[Math.abs(draft.to[0] - draft.from[0]), Math.abs(draft.to[1] - draft.from[1])]} />
            <meshBasicMaterial color={color} transparent opacity={0.05} depthWrite={false} toneMapped={false} />
          </mesh>
          <BoardLine points={corners} color={color} lineWidth={1.4} dashed dashSize={0.14} gapSize={0.09} toneMapped={false} />
        </group>
      )}
    </>
  )
}

// A moved card's old place in the assistant's preview (D-096).
function MoveGhost({ from, to, color, lit }: { from: [number, number]; to: [number, number]; color: string; lit: boolean }) {
  const [hw, hh] = CARD_HALF
  const corners: [number, number, number][] = [
    [from[0] - hw, from[1] + hh, 0],
    [from[0] + hw, from[1] + hh, 0],
    [from[0] + hw, from[1] - hh, 0],
    [from[0] - hw, from[1] - hh, 0],
    [from[0] - hw, from[1] + hh, 0],
  ]
  const far = Math.hypot(to[0] - from[0], to[1] - from[1]) > Math.hypot(hw, hh) * 2
  return (
    <group position={[0, 0, -0.06]}>
      <BoardLine points={corners} color={color} lineWidth={lit ? 2 : 1} dashed dashSize={0.12} gapSize={0.08} transparent opacity={lit ? 0.9 : 0.55} toneMapped={false} />
      {far && (
        <BoardLine
          points={[
            [from[0], from[1], 0],
            [to[0], to[1], 0],
          ]}
          color={color}
          lineWidth={lit ? 1.6 : 1}
          dashed
          dashSize={0.12}
          gapSize={0.12}
          transparent
          opacity={lit ? 0.8 : 0.35}
          toneMapped={false}
        />
      )}
    </group>
  )
}

// Board → PNG (D-080): the whole board as it's filtered, drawn once offscreen from straight above (no perspective), at
// PNG_PPU pixels per board unit (smaller for huge boards), on the plain page background without the grid. Cursors and names are DOM, so they stay out.
const PNG_PPU = 120
const PNG_MAX = 8192

function Snapshot({ nodes, labels }: { nodes: BoardItem[]; labels: WithId<Label>[] }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const latest = useRef({ nodes, labels })
  latest.current = { nodes, labels }

  useEffect(() => {
    const snapshot = async (): Promise<Blob> => {
      const { nodes, labels } = latest.current
      // Nothing on the board: what's in view.
      const view = camera as PerspectiveCamera
      const half = Math.tan(MathUtils.degToRad(view.fov / 2)) * view.position.z
      const [x0, y0, x1, y1] = boardBounds(nodes, labels) ?? [
        view.position.x - half * view.aspect, view.position.y - half, view.position.x + half * view.aspect, view.position.y + half,
      ]
      const ppu = Math.min(PNG_PPU, Math.min(PNG_MAX, gl.capabilities.maxTextureSize) / Math.max(x1 - x0, y1 - y0))
      const w = Math.round((x1 - x0) * ppu)
      const h = Math.round((y1 - y0) * ppu)
      const shot = new OrthographicCamera(x0, x1, y1, y0, 0.1, 1000)
      shot.position.set(0, 0, 100)
      shot.updateMatrixWorld()
      const target = new WebGLRenderTarget(w, h, { samples: 4, colorSpace: SRGBColorSpace })

      // Line widths are in screen pixels against a resolution: as if the board were shown at 2x.
      const lines: [{ resolution: Vector2 }, Vector2][] = []
      scene.traverse((o) => {
        const m = (o as { material?: { resolution?: Vector2 } }).material
        if (m?.resolution instanceof Vector2) lines.push([m as { resolution: Vector2 }, m.resolution.clone()])
      })
      for (const [m] of lines) m.resolution.set(w / 2, h / 2)
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#000'
      const clear = gl.getClearColor(new Color())
      const alpha = gl.getClearAlpha()
      const pixels = new Uint8Array(w * h * 4)
      // The picture is the cards, links and labels on a plain background: no "+" grid.
      const grid = scene.getObjectByName('grid')
      if (grid) grid.visible = false
      try {
        gl.setRenderTarget(target)
        gl.setClearColor(new Color(bg), 1)
        gl.clear()
        gl.render(scene, shot)
        gl.readRenderTargetPixels(target, 0, 0, w, h, pixels)
      } finally {
        if (grid) grid.visible = true
        gl.setRenderTarget(null)
        gl.setClearColor(clear, alpha)
        for (const [m, r] of lines) m.resolution.copy(r)
        target.dispose()
      }

      // WebGL rows run bottom-up.
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const image = new ImageData(w, h)
      const row = w * 4
      for (let y = 0; y < h; y++) image.data.set(pixels.subarray((h - 1 - y) * row, (h - y) * row), y * row)
      canvas.getContext('2d')!.putImageData(image, 0, 0)
      return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the picture.'))), 'image/png'))
    }
    useCanvas.getState().setSnapshot(snapshot)
    return () => useCanvas.getState().setSnapshot(null)
  }, [gl, scene, camera])
  return null
}

// Faint "+" marks, an ASCII-flavoured grid for spatial memory, and the points a dragged card lands on: one mark every
// GRID_STEP, so a snapped card has a mark on each corner (D-112, D-148). Zoomed out, each mark stays a small, thin "+"
// on screen instead of shrinking to a dot (D-151): every other mark fades once they crowd, then all but every fourth (a card's width),
// and the rest fade away before the zoom-out limit, so the board never turns into a speckle (D-110).
// The plane sits a little behind the cards, so each point is taken back to where the camera sees it on the cards'
// plane: otherwise perspective shifts the marks off the cards' corners, more the further from the screen's centre.
function DotGridMaterial() {
  const shade = usePalette().grid
  const material = useRef<ShaderMaterial>(null)
  const dpr = useThree((s) => s.viewport.dpr)
  const uniforms = useMemo(() => ({ uShade: { value: shade }, uDist: { value: 11 }, uDpr: { value: dpr } }), []) // eslint-disable-line react-hooks/exhaustive-deps
  // R3F copies the uniforms prop, so theme changes go through the material (D-028).
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    if (material.current) {
      material.current.uniforms.uShade.value = shade
      material.current.uniforms.uDpr.value = dpr
    }
    invalidate()
  }, [shade, dpr, invalidate])
  // The camera's distance decides when the grid goes, so it is gone at the limit on any screen.
  useFrame(({ camera }) => {
    if (material.current) material.current.uniforms.uDist.value = camera.position.z
  })
  const step = GRID_STEP.toFixed(4)
  return (
    <shaderMaterial
      ref={material}
      transparent
      depthWrite={false}
      vertexShader={/* glsl */ `
        varying vec3 vPos;
        void main() {
          vPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        }
      `}
      uniforms={uniforms}
      fragmentShader={/* glsl */ `
        varying vec3 vPos;
        uniform float uShade;
        uniform float uDist;
        uniform float uDpr;
        void main() {
          // Faded out between 80 and ${MAX_DISTANCE - 30} units away (limit ${MAX_DISTANCE}).
          float fade = 1.0 - smoothstep(80.0, ${(MAX_DISTANCE - 30).toFixed(1)}, uDist);
          if (fade <= 0.0) discard;
          // Where the camera's ray through this point meets the cards' plane (z = 0).
          vec2 world = cameraPosition.xy + (vPos.xy - cameraPosition.xy) * cameraPosition.z / (cameraPosition.z - vPos.z);
          // Everything below in CSS pixels, so the mark is the same size at any zoom and on any screen.
          float css = fwidth(world.x) * uDpr;
          vec2 d = abs(fract(world / ${step} + 0.5) - 0.5) * ${step} / css;
          // Zoomed in, the arms reach 0.06 out on the board; zoomed out they stop shrinking at 3 px, so the mark stays a
          // thin "+" instead of a blob. The stroke goes from 2.4 device pixels to 1 px as it gets there, edges smoothed over one.
          float aa = 0.5 / uDpr;
          float arm = max(0.06 / css, 3.0);
          float bar = mix(0.5, 1.2 / uDpr, clamp((arm - 3.0) / 2.0, 0.0, 1.0));
          vec2 thin = clamp((bar + aa - d) * uDpr, 0.0, 1.0);
          vec2 len = clamp((arm + aa - d) * uDpr, 0.0, 1.0);
          float plus = max(thin.y * len.x, thin.x * len.y);
          // Under 18 px apart every other mark fades, under 18 px at twice the step all but every fourth.
          float gap = ${step} / css;
          vec2 cell = floor(world / ${step} + 0.5);
          float odd2 = max(mod(cell.x, 2.0), mod(cell.y, 2.0));
          float odd4 = max(step(0.5, mod(cell.x, 4.0)), step(0.5, mod(cell.y, 4.0)));
          float crowd = (1.0 - odd2 * (1.0 - smoothstep(12.0, 18.0, gap)))
                      * (1.0 - odd4 * (1.0 - smoothstep(12.0, 18.0, gap * 2.0)));
          gl_FragColor = vec4(vec3(uShade), plus * crowd * 0.4 * fade);
        }
      `}
    />
  )
}
