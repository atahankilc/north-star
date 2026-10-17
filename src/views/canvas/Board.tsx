// The board scene: every item type on one canvas (D-040), 2.5D (D-018) with pan/zoom camera, cards and connections.
import { OrbitControls } from '@react-three/drei'
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
import { FOR, type CompetitorFeature, type Edge, type Label } from '../../data/model'
import { usePresence } from '../../data/presence'
import { markTag, usePreview } from '../workspace/preview'
import { useCanvas } from '../../state/canvasStore'
import { isReducedMotion } from '../../state/motion'
import { usePalette } from '../../state/theme'
import { defaultKind, type BoardItem } from './boardKinds'
import { BoardLabel, LABEL_SIZE } from './BoardLabel'
import { CARD_H, CARD_W, glideDt } from './cardLayout'
import { EdgeLine } from './EdgeLine'
import { CHIP_H, CHIP_W, FeatureChip } from './FeatureChip'
import { boardPoint, NodeCard } from './NodeCard'
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
const MARGIN = 1.2

// Feature chips fan out to the right of their competitor, top-aligned with it.
function chipSpot(c: [number, number], i: number): [number, number] {
  return [c[0] + CARD_W / 2 + 0.3 + CHIP_W / 2, c[1] + CARD_H / 2 - CHIP_H / 2 - i * (CHIP_H + 0.1)]
}
const CARD_HALF: [number, number] = [CARD_W / 2, CARD_H / 2]
const CHIP_HALF: [number, number] = [CHIP_W / 2, CHIP_H / 2]

// Every card and label, with a margin: [x0, y0, x1, y1] in board units, or null on an empty board.
function boardBounds(nodes: BoardItem[], labels: WithId<Label>[]): [number, number, number, number] | null {
  const boxes = [
    ...nodes.map((n) => [n.x - CARD_W / 2, n.y - CARD_H / 2, n.x + CARD_W / 2, n.y + CARD_H / 2]),
    ...labels.map((l) => [l.x - l.text.length * LABEL_SIZE * 0.32, l.y - LABEL_SIZE / 2, l.x + l.text.length * LABEL_SIZE * 0.32, l.y + LABEL_SIZE / 2]),
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

  return (
    <div ref={setWrapper} style={{ position: 'absolute', inset: 0, touchAction: 'none' }}>
      <Canvas
        dpr={[1, 2]}
        // Draws only when something changes (D-063): React updates, the controls and text invalidate on their own,
        // and every glide below asks for frames until it settles.
        frameloop="demand"
        // `far` stays well past maxDistance, or zooming out clips everything away.
        camera={{ position: [0, 0, 11], fov: 40, near: 0.1, far: 1000 }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[-4, 6, 10]} intensity={1.6} />
        {wrapper && <Controls domElement={wrapper} />}
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

function Scene({ wid, nodes, edges, labels, competitorFeatures, focus }: Props) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  const selectedId = useCanvas((s) => s.selectedId)
  const dragging = useCanvas((s) => s.dragging)
  const linkFrom = useCanvas((s) => s.linkFrom)
  const linkPointer = useCanvas((s) => s.linkPointer)
  const { select, moveLink, endLink, setViewCenter } = useCanvas.getState()
  // Where the camera is gliding to, if anywhere (jump list).
  const flight = useRef<[number, number] | null>(null)

  useEffect(() => {
    if (!controls) return
    setViewCenter(() => [controls.target.x, controls.target.y])
    const jump = ([x, y]: [number, number]) => {
      camera.position.set(x, y, camera.position.z)
      controls.target.set(x, y, 0)
      controls.update()
    }
    useCanvas.getState().setFocusOn(jump)
    useCanvas.getState().setFlyTo((at) => {
      if (isReducedMotion()) return jump(at)
      flight.current = at
      // The board draws on demand: without a first frame the glide below never starts.
      invalidate()
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
    controls.target.set(x, y, 0)
    controls.update()
    if (Math.hypot(to[0] - x, to[1] - y) < 0.01) flight.current = null
    else invalidate()
  })

  useEffect(() => {
    if (!controls) return
    const key = wid
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

  // Frame every card and label, as close as the zoom limits allow.
  function fitAll() {
    const bounds = boardBounds(nodes, labels)
    if (!controls || !bounds) return
    const [x0, y0, x1, y1] = bounds
    const fov = ((camera as { fov?: number }).fov ?? 40) * (Math.PI / 180)
    const tan = Math.tan(fov / 2)
    const usable = Math.max(0.3, (size.height - CHROME_PX) / size.height)
    const distance = Math.max((y1 - y0) / 2 / (tan * usable), (x1 - x0) / 2 / (tan * (size.width / size.height)))
    const cx = (x0 + x1) / 2
    // The HUD covers more of the top than the toolbar covers of the bottom: nudge the view up a little.
    const cy = (y0 + y1) / 2 + ((y1 - y0) / 2) * (1 - usable) * 0.3
    controls.target.set(cx, cy, 0)
    camera.position.set(cx, cy, MathUtils.clamp(distance, MIN_FIT, MAX_DISTANCE))
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

  const positions = useMemo(() => {
    const map = new Map<string, [number, number]>()
    for (const n of nodes) map.set(n.id, dragging[n.id] ?? [n.x, n.y])
    const c = openId ? map.get(openId) : undefined
    if (c) (theirs.get(openId!) ?? []).forEach((f, i) => map.set(f.id, chipSpot(c, i)))
    return map
  }, [nodes, dragging, openId, theirs])
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
  // The assistant's preview (D-087) marks cards the same way, as the first ring.
  const peers = usePresence((s) => s.peers)
  const marks = usePreview((s) => s.marks)
  const peerSelection = useMemo(() => {
    const map = new Map<string, { name: string; color: string }[]>()
    for (const [id, m] of marks) map.set(id, [markTag(m)])
    for (const p of peers) if (p.sel) map.set(p.sel, [...(map.get(p.sel) ?? []), { name: p.name, color: p.color }])
    return map
  }, [peers, marks])

  const onLinkDrop = (targetId: string) => {
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

  // Links to a competitor's stacked features point at the competitor, so they show without fanning it out (D-058).
  // A pair of cards gets one line: a direct link wins, then the first feature link.
  const lines = useMemo(() => {
    const owner = new Map(competitorFeatures.map((f) => [f.id, f.competitorId]))
    const end = (id: string) => (positions.has(id) ? id : (owner.get(id) ?? id))
    const seen = new Set<string>()
    const out: { edge: (typeof edges)[number]; from: string; to: string; active: boolean }[] = []
    const viaStack = (e: (typeof edges)[number]) => end(e.fromId) !== e.fromId || end(e.toId) !== e.toId
    for (const edge of [...edges].sort((x, y) => Number(viaStack(x)) - Number(viaStack(y)))) {
      const from = end(edge.fromId)
      const to = end(edge.toId)
      if (from === to || !positions.has(from) || !positions.has(to)) continue
      // Customer tags are labels on the card; their lines show only while that customer is selected.
      if (edge.kind === FOR && edge.toId !== customerId) continue
      const pair = from < to ? `${from}|${to}` : `${to}|${from}`
      if (seen.has(pair)) continue
      seen.add(pair)
      const active = [edge.fromId, edge.toId, from, to].includes(selectedId ?? '')
      out.push({ edge, from, to, active })
    }
    return out
  }, [edges, positions, competitorFeatures, customerId, selectedId])

  const linkSource = linkFrom ? positions.get(linkFrom) : undefined

  return (
    <>
      <mesh
        // Hidden while the board is drawn as a picture (Snapshot).
        name="grid"
        position={[0, 0, -0.1]}
        onClick={(e) => {
          // A click (not the end of a pan) on empty board clears the selection.
          if (e.delta < 4) select(null)
        }}
        onPointerMove={(e) => {
          if (!useCanvas.getState().linkFrom) return
          const p = boardPoint(e)
          if (p) moveLink(p)
        }}
      >
        <planeGeometry args={[2000, 2000]} />
        <DotGridMaterial />
      </mesh>

      {labels.map((l) => (
        <BoardLabel key={l.id} wid={wid} label={l} />
      ))}

      {lines.map(({ edge, from, to, active }) => (
        <EdgeLine
          key={edge.id}
          from={positions.get(from)!}
          to={positions.get(to)!}
          fromHalf={chips.has(from) ? CHIP_HALF : CARD_HALF}
          toHalf={chips.has(to) ? CHIP_HALF : CARD_HALF}
          kind={edge.kind}
          active={active}
        />
      ))}

      {linkSource && linkPointer && <EdgeLine from={linkSource} to={linkPointer} fromHalf={CARD_HALF} toHalf={[0, 0]} active />}

      {openId &&
        positions.get(openId) &&
        (theirs.get(openId) ?? []).map((f, i) => (
          <FeatureChip key={f.id} feature={f} at={chipSpot(positions.get(openId)!, i)} from={positions.get(openId)!} onLinkDrop={onLinkDrop} />
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
          onLinkDrop={onLinkDrop}
        />
      ))}
    </>
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

// Faint "+" marks every unit: an ASCII-flavoured grid for spatial memory.
function DotGridMaterial() {
  const shade = usePalette().grid
  const material = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(() => ({ uShade: { value: shade } }), []) // eslint-disable-line react-hooks/exhaustive-deps
  // R3F copies the uniforms prop, so theme changes go through the material (D-028).
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    if (material.current) material.current.uniforms.uShade.value = shade
    invalidate()
  }, [shade, invalidate])
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
        void main() {
          vec2 g = abs(fract(vWorld + 0.5) - 0.5);
          float w = fwidth(vWorld.x) * 1.2;
          float arm = 0.06;
          float plus = max(
            step(g.x, w) * step(g.y, arm),
            step(g.y, w) * step(g.x, arm)
          );
          gl_FragColor = vec4(vec3(uShade), plus * 0.4);
        }
      `}
    />
  )
}
