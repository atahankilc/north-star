// The board scene: every item type on one canvas (D-040), 2.5D (D-018) with pan/zoom camera, cards and connections.
import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MathUtils, MOUSE, TOUCH } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { WithId } from '../../data/hooks'
import { createEdge, linked } from '../../data/edges'
import { FOR, type Edge, type Label } from '../../data/model'
import { useCanvas } from '../../state/canvasStore'
import { isReducedMotion } from '../../state/motion'
import { colors } from '../../styles/tokens'
import { defaultKind, type BoardItem } from './boardKinds'
import { BoardLabel } from './BoardLabel'
import { EdgeLine } from './EdgeLine'
import { boardPoint, NodeCard } from './NodeCard'

type Props = {
  wid: string
  // Visible items only (filters applied).
  nodes: BoardItem[]
  edges: WithId<Edge>[]
  // Text written on the board (D-050).
  labels: WithId<Label>[]
  // Double-click on empty board.
  onCreate: (at: [number, number]) => void
  // Look here first instead of where this board was last left (e.g. a link jumped to a card).
  focus?: [number, number]
}

// Where each board's camera was left, so switching views and coming back doesn't lose your place.
const cameras = new Map<string, { target: [number, number]; distance: number }>()

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
      maxDistance={150}
      mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
      touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }}
    />
  )
}

function Scene({ wid, nodes, edges, labels, onCreate, focus }: Props) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const camera = useThree((s) => s.camera)
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
    }
    return () => {
      cameras.set(key, { target: [controls.target.x, controls.target.y], distance: camera.position.z })
    }
    // Only on mount: `focus` is where to start, not something to follow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls])

  // A link released anywhere but on a card is cancelled; controls always come back.
  useEffect(() => {
    const up = () => {
      if (useCanvas.getState().linkFrom) endLink()
      if (controls) controls.enabled = true
    }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [controls, endLink])

  const positions = useMemo(() => {
    const map = new Map<string, [number, number]>()
    for (const n of nodes) map.set(n.id, dragging[n.id] ?? [n.x, n.y])
    return map
  }, [nodes, dragging])

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
    const to = byId.get(targetId)
    if (!from || !to || from.id === to.id || linked(edges, from.id, to.id)) return
    // A tag always points item → customer, whichever card you dragged from.
    const [a, b] = to.type !== 'customer' && from.type === 'customer' ? [to, from] : [from, to]
    void createEdge(wid, { id: a.id, type: a.type }, { id: b.id, type: b.type }, defaultKind(a.type, b.type))
  }

  const onBoardDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    const p = boardPoint(e)
    if (p) onCreate(p)
  }

  const linkSource = linkFrom ? positions.get(linkFrom) : undefined

  return (
    <>
      <mesh
        position={[0, 0, -0.1]}
        onDoubleClick={onBoardDoubleClick}
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
        return <EdgeLine key={edge.id} from={a} to={b} color={active ? colors.cyan : '#4a4a4a'} width={active ? 2 : 1.5} />
      })}

      {linkSource && linkPointer && <EdgeLine from={linkSource} to={linkPointer} color={colors.cyan} width={2} />}

      {nodes.map((node) => (
        <NodeCard
          key={node.id}
          wid={wid}
          item={node}
          layer={layers.get(node.id) ?? 0}
          related={customerId !== null && node.forIds.includes(customerId)}
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
