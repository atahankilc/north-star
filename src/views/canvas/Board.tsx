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
import { createEdge, linked } from '../../data/edges'
import { type CompetitorFeature, type Edge, type Label } from '../../data/model'
import { selectionOf, usePresence } from '../../data/presence'
import { wasLine } from '../workspace/preview'
import { usePreviewFocus, useStage } from '../workspace/stage'
import { useCanvas } from '../../state/canvasStore'
import { useWsView } from '../../state/workspaceView'
import { useViewer } from '../workspace/viewerLock'
import { isReducedMotion } from '../../state/motion'
import { usePalette } from '../../state/theme'
import { defaultKind, type BoardItem } from './boardKinds'
import { BoardLabel, labelSize } from './BoardLabel'
import { BoardSection } from './BoardSection'
import { BoardTitle } from './BoardTitle'
import { isTitle, labelHalf, titleHalf } from './titleBlock'
import { DRAW_MIN, MIN_H, MIN_W, depths, drawSection, holdsRect, isSection, rectOf, sizeOf, useSectionDraw, type SectionRect } from './sections'
import { snapPoint } from './snap'
import { CARD_H, CARD_W, glideDt } from './cardLayout'
import { PackageFrame, type Frame } from './PackageFrame'
import { BoardLine } from './BoardLine'
import { EdgeLine } from './EdgeLine'
import { rightPress, useBoardMenu } from './rightClick'
import { setPieces } from './groupDrag'
import { useGuides } from './guides'
import { LabelBar } from './LabelBar'
import { LinkBar } from './LinkBar'
import { linkStyle } from './linkKinds'
import { CHIP_H, CHIP_W, FeatureChip } from './FeatureChip'
import { boardPoint, NodeCard } from './NodeCard'
import { SNAP_STEP, useSnap } from './snap'
import { BoardDetail, useDetail } from './detail'
import { NODE_R, SMALL_NODE_R } from './FarNode'
import { CursorReporter, FollowCamera, PeerCursors } from './PeerCursors'

type Props = {
  wid: string
  // Visible items only (filters applied).
  nodes: BoardItem[]
  edges: WithId<Edge>[]
  // Text written on the board (D-050).
  labels: WithId<Label>[]
  // Shown as a stack behind their competitor, fanned out while it's selected (D-058).
  competitorFeatures: WithId<CompetitorFeature>[]
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

// Feature chips fan out to the right of their competitor, top-aligned with it; far out, as small stars beside its star (D-111).
function chipSpot(c: [number, number], i: number, far = false): [number, number] {
  if (far) return [c[0] + NODE_R + 0.45 + SMALL_NODE_R, c[1] + NODE_R - SMALL_NODE_R - i * (SMALL_NODE_R * 2 + 0.15)]
  return [c[0] + CARD_W / 2 + 0.3 + CHIP_W / 2, c[1] + CARD_H / 2 - CHIP_H / 2 - i * (CHIP_H + 0.1)]
}
const CARD_HALF: [number, number] = [CARD_W / 2, CARD_H / 2]
const CHIP_HALF: [number, number] = [CHIP_W / 2, CHIP_H / 2]
// Far out a card is a star (D-111), and links end at its circle.
const NODE_HALF: [number, number] = [NODE_R, NODE_R]
const SMALL_NODE_HALF: [number, number] = [SMALL_NODE_R, SMALL_NODE_R]

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

function Scene({ wid, nodes, edges, labels, competitorFeatures, focus, cameraKey, centreId, sectionsFixed = false, onDrawSection, frames = [] }: Props) {
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

  // The competitor whose features are fanned out: the selected one, or the owner of a selected feature (D-058).
  // While the competitor itself is held down or dragged they stay stacked behind it, and fan out once the click is released.
  const theirs = useMemo(() => {
    const map = new Map<string, WithId<CompetitorFeature>[]>()
    for (const f of [...competitorFeatures].sort((a, b) => a.createdAt - b.createdAt)) map.set(f.competitorId, [...(map.get(f.competitorId) ?? []), f])
    return map
  }, [competitorFeatures])
  const pressing = useCanvas((s) => s.pressing)
  const openId = useMemo(() => {
    if (!selectedId) return null
    if (theirs.has(selectedId)) return selectedId === pressing ? null : selectedId
    return competitorFeatures.find((f) => f.id === selectedId)?.competitorId ?? null
  }, [selectedId, pressing, theirs, competitorFeatures])

  const far = useDetail((s) => s.card) === 'far'
  const positions = useMemo(() => {
    const map = new Map<string, [number, number]>()
    for (const n of nodes) map.set(n.id, dragging[n.id] ?? [n.x, n.y])
    const c = openId ? map.get(openId) : undefined
    if (c) (theirs.get(openId!) ?? []).forEach((f, i) => map.set(f.id, chipSpot(c, i, far)))
    return map
  }, [nodes, dragging, openId, theirs, far])
  const chips = new Set(openId ? (theirs.get(openId) ?? []).map((f) => f.id) : [])

  // Older cards sit lower; newer ones on top.
  const layers = useMemo(
    () => new Map([...nodes].sort((a, b) => a.createdAt - b.createdAt).map((c, n) => [c.id, n])),
    [nodes],
  )

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])

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
    if (from && feature) {
      if (!linked(edges, from.id, feature.id)) void createEdge(wid, { id: from.id, type: from.type }, { id: feature.id, type: 'competitorFeature' }, 'inspired-by')
      return
    }
    const to = byId.get(targetId)
    if (!from || !to || from.id === to.id || linked(edges, from.id, to.id)) return
    // A tag always points item → customer, whichever card you dragged from.
    const [a, b] = to.type !== 'customer' && from.type === 'customer' ? [to, from] : [from, to]
    void createEdge(wid, { id: a.id, type: a.type }, { id: b.id, type: b.type }, defaultKind(a.type, b.type))
  }

  // One function for the board's whole life, so cards that didn't change skip re-rendering (NodeCard is memoised).
  const dropLatest = useRef(linkDrop)
  dropLatest.current = linkDrop
  const onLinkDrop = useMemo(() => (targetId: string) => dropLatest.current(targetId), [])

  // Links to a competitor's stacked features point at the competitor, so they show without fanning it out (D-058).
  // Several links between the same pair of cards (both ways, or through a competitor's features) are drawn side by
  // side: `slot` is a line's place in its pair, direct links first, and `of` how many the pair has.
  const hiddenLinks = useWsView((s) => s.hiddenLinks)
  // A competitor's hidden `competes` lines also show while its card (or the card they reach) is under the pointer (D-135).
  const hoverId = useCanvas((s) => s.hoverId)
  const lines = useMemo(() => {
    const owner = new Map(competitorFeatures.map((f) => [f.id, f.competitorId]))
    const end = (id: string) => (positions.has(id) ? id : (owner.get(id) ?? id))
    const count = new Map<string, number>()
    const out: { edge: (typeof edges)[number]; from: string; to: string; touches: string[]; active: boolean; pair: string; slot: number; of: number }[] = []
    const viaStack = (e: (typeof edges)[number]) => end(e.fromId) !== e.fromId || end(e.toId) !== e.toId
    for (const edge of [...edges].sort((x, y) => Number(viaStack(x)) - Number(viaStack(y)))) {
      const from = end(edge.fromId)
      const to = end(edge.toId)
      if (from === to || !positions.has(from) || !positions.has(to)) continue
      // What the link counts as touching for focus: its ends, where it's drawn, and the competitor whose feature it
      // reaches, so selecting a competitor lights links to its features too, fanned out or not.
      const touches = [edge.fromId, edge.toId, from, to, owner.get(edge.fromId), owner.get(edge.toId)].filter((id): id is string => Boolean(id))
      // Hidden by the LINKS filter (D-108), unless it's the selected card's or one the assistant's preview adds; a
      // competes line also for the hovered card (D-135).
      const active = touches.includes(selectedId ?? '')
      const group = linkStyle(edge.kind).group
      const shown = active || edge.id.startsWith('preview-') || (group === 'competes' && touches.includes(hoverId ?? ''))
      if (hiddenLinks.includes(group) && !shown) continue
      const pair = from < to ? `${from}|${to}` : `${to}|${from}`
      const slot = count.get(pair) ?? 0
      count.set(pair, slot + 1)
      out.push({ edge, from, to, touches, active, pair, slot, of: 0 })
    }
    for (const line of out) line.of = count.get(line.pair)!
    return out
  }, [edges, positions, competitorFeatures, selectedId, hiddenLinks, hoverId])

  // Focus (D-108): with a card under the pointer, or cards selected, links that don't touch them go faint; with a link
  // selected, every other one does.
  const selection = useCanvas((s) => s.selection)
  const edgeId = useCanvas((s) => s.edgeId)
  const focusIds = useMemo(() => {
    const ids = hoverId ? [hoverId] : selection.filter((id) => positions.has(id))
    return ids.length ? new Set(ids) : null
  }, [hoverId, selection, positions])
  const dimmed = (line: (typeof lines)[number]) =>
    edgeId ? line.edge.id !== edgeId : focusIds ? !line.touches.some((id) => focusIds.has(id)) : false

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
                : inside(l.x, l.y, (l.text.length * labelSize(l) * 0.3) || 0.3, labelSize(l) / 2),
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
  const cardHalf = far ? NODE_HALF : CARD_HALF
  const chipHalf = far ? SMALL_NODE_HALF : CHIP_HALF
  const halfOf = (id: string) => (chips.has(id) ? chipHalf : cardHalf)
  const selectedLinkAt = (line: (typeof lines)[number]) => {
    const { from, to } = sideBySide(line, positions.get(line.from)!, positions.get(line.to)!, Math.min(...halfOf(line.from), ...halfOf(line.to)))
    return midpoint(from, to)
  }

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
        const { edge, from, to, active } = line
        const fromHalf = halfOf(from)
        const toHalf = halfOf(to)
        const { from: a, to: b, chipShift } = sideBySide(line, positions.get(from)!, positions.get(to)!, Math.min(...fromHalf, ...toHalf))
        return (
          <EdgeLine
            key={edge.id}
            from={a}
            to={b}
            fromHalf={fromHalf}
            toHalf={toHalf}
            chipShift={chipShift}
            kind={edge.kind}
            label={edge.label}
            active={active}
            dim={dimmed(line)}
            selected={edge.id === edgeId}
            // The assistant's preview: links it adds in the new colour, links it edits (D-108) in the edited one.
            tint={edge.id.startsWith('preview-') ? palette.diff.new : preview?.marks.get(edge.id) === 'edited' ? palette.diff.edited : undefined}
            onSelect={preview ? undefined : () => useCanvas.getState().selectEdge(edge.id)}
            onRightPress={(e) => rightPress(e, { kind: 'link', id: edge.id })}
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
          // Roughly where the text starts and ends (Geist at its size), so the bar sits under it; a section's under its
          // frame, where it covers nothing inside.
          at={
            isSection(selectedLabel)
              ? [rectOf(selectedLabel)[0], rectOf(selectedLabel)[1]]
              : [selectedLabel.x - selectedLabel.text.length * labelSize(selectedLabel) * 0.3, selectedLabel.y - labelSize(selectedLabel) * 0.7]
          }
        />
      )}
      {box && <SelectBox from={box.from} to={box.to} color={palette.cyan} />}
      {onDrawSection && <SectionDrawer onDraw={onDrawSection} color={palette.magenta} />}
      <GuideLines color={palette.magenta} />

      {linkSource && linkPointer && <EdgeLine from={linkSource} to={linkPointer} fromHalf={cardHalf} toHalf={[0, 0]} active />}

      {openId &&
        positions.get(openId) &&
        (theirs.get(openId) ?? []).map((f, i) => (
          <FeatureChip key={f.id} feature={f} at={chipSpot(positions.get(openId)!, i, far)} from={positions.get(openId)!} onLinkDrop={onLinkDrop} />
        ))}

      {nodes.map((node) => (
        <NodeCard
          key={node.id}
          wid={wid}
          item={node}
          layer={layers.get(node.id) ?? 0}
          related={customerId !== null && node.forIds.includes(customerId)}
          stack={node.type === 'competitor' && openId !== node.id ? (theirs.get(node.id)?.length ?? 0) : 0}
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

const midpoint = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]

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

// Faint "+" marks every unit: an ASCII-flavoured grid for spatial memory. Zoomed out they shrink to dots,
// then fade away before the zoom-out limit, so the board never turns into a dense speckle (D-110).
// While snapping is on (D-112), close up, faint dots between them show the points a dragged card lands on.
function DotGridMaterial() {
  const shade = usePalette().grid
  const snap = useSnap((s) => s.on)
  const material = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(() => ({ uShade: { value: shade }, uDist: { value: 11 }, uSnap: { value: snap ? 1 : 0 } }), []) // eslint-disable-line react-hooks/exhaustive-deps
  // R3F copies the uniforms prop, so theme changes go through the material (D-028).
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    if (material.current) {
      material.current.uniforms.uShade.value = shade
      material.current.uniforms.uSnap.value = snap ? 1 : 0
    }
    invalidate()
  }, [shade, snap, invalidate])
  // The camera's distance decides the shape, so the grid is gone at the limit on any screen.
  useFrame(({ camera }) => {
    if (material.current) material.current.uniforms.uDist.value = camera.position.z
  })
  return (
    <shaderMaterial
      ref={material}
      transparent
      depthWrite={false}
      vertexShader={/* glsl */ `
        varying vec2 vWorld;
        void main() {
          vWorld = (modelMatrix * vec4(position, 1.0)).xy;
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        }
      `}
      uniforms={uniforms}
      fragmentShader={/* glsl */ `
        varying vec2 vWorld;
        uniform float uShade;
        uniform float uDist;
        uniform float uSnap;
        void main() {
          // A full "+" up to 30 units away, a dot by 70, faded out between 80 and ${MAX_DISTANCE - 30} (limit ${MAX_DISTANCE}).
          float fade = 1.0 - smoothstep(80.0, ${(MAX_DISTANCE - 30).toFixed(1)}, uDist);
          if (fade <= 0.0) discard;
          vec2 g = abs(fract(vWorld + 0.5) - 0.5);
          float w = fwidth(vWorld.x) * 1.2;
          float arm = mix(0.06, w, smoothstep(30.0, 70.0, uDist));
          float plus = max(
            step(g.x, w) * step(g.y, arm),
            step(g.y, w) * step(g.x, arm)
          );
          // The snap points between the "+" marks: one-pixel dots, gone by 34 units away, where they'd crowd.
          vec2 s = abs(fract(vWorld / ${SNAP_STEP.toFixed(4)} + 0.5) - 0.5) * ${SNAP_STEP.toFixed(4)};
          float snapDot = uSnap * step(s.x, w * 1.5) * step(s.y, w * 1.5) * (1.0 - smoothstep(22.0, 34.0, uDist));
          gl_FragColor = vec4(vec3(uShade), max(plus * 0.4, snapDot * 0.35) * fade);
        }
      `}
    />
  )
}
