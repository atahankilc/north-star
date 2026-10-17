// The board scene: every item type on one canvas (D-040), 2.5D (D-018) with pan/zoom camera, cards and connections.
import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MathUtils, MOUSE, TOUCH } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { WithId } from '../../data/hooks'
import { createEdge, linked } from '../../data/edges'
import { FOR, type CompetitorFeature, type Edge, type Label } from '../../data/model'
import { useCanvas } from '../../state/canvasStore'
import { isReducedMotion } from '../../state/motion'
import { defaultKind, type BoardItem } from './boardKinds'
import { BoardLabel, LABEL_SIZE } from './BoardLabel'
import { CARD_H, CARD_W } from './cardLayout'
import { EdgeLine } from './EdgeLine'
import { CHIP_H, CHIP_W, FeatureChip } from './FeatureChip'
import { boardPoint, NodeCard } from './NodeCard'

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

export function Board(props: Props) {
  // Pan/zoom listens on this wrapper, not the canvas. DOM events reach the canvas (and R3F's
  // handlers) first, so a card's pointerdown can switch the controls off before they react.
  const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null)

  return (
    <div ref={setWrapper} style={{ position: 'absolute', inset: 0, touchAction: 'none' }}>
      <Canvas
        dpr={[1, 2]}
        // `far` stays well past maxDistance, or zooming out clips everything away.
        camera={{ position: [0, 0, 11], fov: 40, near: 0.1, far: 1000 }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[-4, 6, 10]} intensity={1.6} />
        {wrapper && <Controls domElement={wrapper} />}
        <Scene {...props} />
      </Canvas>
    </div>
  )
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
    })
  }, [controls, camera, setViewCenter])

  // Glide toward the flight target; any pan or zoom of your own takes over.
  useEffect(() => {
    if (!controls) return
    const cancel = () => (flight.current = null)
    controls.addEventListener('start', cancel)
    return () => controls.removeEventListener('start', cancel)
  }, [controls])
  useFrame((_, dt) => {
    const to = flight.current
    if (!to || !controls) return
    const x = MathUtils.damp(controls.target.x, to[0], 5, dt)
    const y = MathUtils.damp(controls.target.y, to[1], 5, dt)
    camera.position.x += x - controls.target.x
    camera.position.y += y - controls.target.y
    controls.target.set(x, y, 0)
    controls.update()
    if (Math.hypot(to[0] - x, to[1] - y) < 0.01) flight.current = null
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
    if (!controls) return
    const boxes = [
      ...nodes.map((n) => [n.x - CARD_W / 2, n.y - CARD_H / 2, n.x + CARD_W / 2, n.y + CARD_H / 2]),
      ...labels.map((l) => [l.x - l.text.length * LABEL_SIZE * 0.32, l.y - LABEL_SIZE / 2, l.x + l.text.length * LABEL_SIZE * 0.32, l.y + LABEL_SIZE / 2]),
    ]
    if (boxes.length === 0) return
    const x0 = Math.min(...boxes.map((b) => b[0])) - MARGIN
    const y0 = Math.min(...boxes.map((b) => b[1])) - MARGIN
    const x1 = Math.max(...boxes.map((b) => b[2])) + MARGIN
    const y1 = Math.max(...boxes.map((b) => b[3])) + MARGIN
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
      if (useCanvas.getState().linkFrom) endLink()
      if (controls) controls.enabled = true
    }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [controls, endLink])

  // The competitor whose features are fanned out: the selected one, or the owner of a selected feature (D-058).
  const theirs = useMemo(() => {
    const map = new Map<string, WithId<CompetitorFeature>[]>()
    for (const f of [...competitorFeatures].sort((a, b) => a.createdAt - b.createdAt)) map.set(f.competitorId, [...(map.get(f.competitorId) ?? []), f])
    return map
  }, [competitorFeatures])
  const openId = useMemo(() => {
    if (!selectedId) return null
    if (theirs.has(selectedId)) return selectedId
    return competitorFeatures.find((f) => f.id === selectedId)?.competitorId ?? null
  }, [selectedId, theirs, competitorFeatures])

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

  const linkSource = linkFrom ? positions.get(linkFrom) : undefined

  return (
    <>
      <mesh
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

      {edges.map((edge) => {
        const a = positions.get(edge.fromId)
        const b = positions.get(edge.toId)
        if (!a || !b) return null
        // Customer tags are labels on the card; their lines show only while that customer is selected.
        if (edge.kind === FOR && edge.toId !== customerId) return null
        const active = selectedId === edge.fromId || selectedId === edge.toId
        return (
          <EdgeLine
            key={edge.id}
            from={a}
            to={b}
            fromHalf={chips.has(edge.fromId) ? CHIP_HALF : CARD_HALF}
            toHalf={chips.has(edge.toId) ? CHIP_HALF : CARD_HALF}
            kind={edge.kind}
            active={active}
          />
        )
      })}

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
          onLinkDrop={onLinkDrop}
        />
      ))}
    </>
  )
}

// Faint "+" marks every unit: an ASCII-flavoured grid for spatial memory.
function DotGridMaterial() {
  return (
    <shaderMaterial
      transparent
      depthWrite={false}
      vertexShader={/* glsl */ `
        varying vec2 vWorld;
        void main() {
          vWorld = (modelMatrix * vec4(position, 1.0)).xy;
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        }
      `}
      fragmentShader={/* glsl */ `
        varying vec2 vWorld;
        void main() {
          vec2 g = abs(fract(vWorld + 0.5) - 0.5);
          float w = fwidth(vWorld.x) * 1.2;
          float arm = 0.06;
          float plus = max(
            step(g.x, w) * step(g.y, arm),
            step(g.y, w) * step(g.x, arm)
          );
          gl_FragColor = vec4(vec3(0.3), plus * 0.4);
        }
      `}
    />
  )
}
