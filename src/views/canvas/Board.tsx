// A board scene (ideas or features, D-037): 2.5D (D-018) with pan/zoom camera, cards and connections.
import { OrbitControls } from '@react-three/drei'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import { MOUSE, TOUCH } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { WithId } from '../../data/hooks'
import { createEdge, linked } from '../../data/edges'
import type { BoardNode, BoardType, Edge } from '../../data/model'
import { createBoardNode } from '../../data/nodes'
import { useCanvas } from '../../state/canvasStore'
import { colors } from '../../styles/tokens'
import { cardMeta } from './boardKinds'
import { EdgeLine } from './EdgeLine'
import { boardPoint, NodeCard } from './NodeCard'

type Props = {
  wid: string
  type: BoardType
  nodes: WithId<BoardNode>[]
  edges: WithId<Edge>[]
  // Look here first instead of where this board was last left (e.g. a link jumped to a card).
  focus?: [number, number]
}

// Where each board's camera was left, so switching views and coming back doesn't lose your place.
const cameras = new Map<string, { target: [number, number]; distance: number }>()

// Where a board is looking (or was last left): new cards for a board you're not on go there.
export function boardCenter(wid: string, type: BoardType): [number, number] {
  return cameras.get(`${wid}/${type}`)?.target ?? [0, 0]
}

export function Board(props: Props) {
  // Pan/zoom listens on this wrapper, not the canvas. DOM events reach the canvas (and R3F's
  // handlers) first, so a card's pointerdown can switch the controls off before they react.
  const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null)

  return (
    <div ref={setWrapper} style={{ position: 'absolute', inset: 0, touchAction: 'none' }}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 11], fov: 40, near: 0.1, far: 200 }}
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
      minDistance={4}
      maxDistance={60}
      mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
      touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }}
    />
  )
}

function Scene({ wid, type, nodes, edges, focus }: Props) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const camera = useThree((s) => s.camera)
  const selectedId = useCanvas((s) => s.selectedId)
  const dragging = useCanvas((s) => s.dragging)
  const linkFrom = useCanvas((s) => s.linkFrom)
  const linkPointer = useCanvas((s) => s.linkPointer)
  const { select, moveLink, endLink, setViewCenter } = useCanvas.getState()

  useEffect(() => {
    if (!controls) return
    setViewCenter(() => [controls.target.x, controls.target.y])
    useCanvas.getState().setFocusOn(([x, y]) => {
      camera.position.set(x, y, camera.position.z)
      controls.target.set(x, y, 0)
      controls.update()
    })
  }, [controls, camera, setViewCenter])

  useEffect(() => {
    if (!controls) return
    const key = `${wid}/${type}`
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

  const onLinkDrop = (targetId: string) => {
    const from = useCanvas.getState().linkFrom
    if (!from || from === targetId) return
    if (!linked(edges, from, targetId)) void createEdge(wid, { id: from, type }, { id: targetId, type })
  }

  const onBoardDoubleClick = async (e: ThreeEvent<MouseEvent>) => {
    const p = boardPoint(e)
    if (!p) return
    const id = await createBoardNode(wid, type, { x: p[0], y: p[1] })
    select(id)
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

      {edges.map((edge) => {
        const a = positions.get(edge.fromId)
        const b = positions.get(edge.toId)
        if (!a || !b) return null
        const active = selectedId === edge.fromId || selectedId === edge.toId
        return <EdgeLine key={edge.id} from={a} to={b} color={active ? colors.cyan : '#4a4a4a'} width={active ? 2 : 1.5} />
      })}

      {linkSource && linkPointer && <EdgeLine from={linkSource} to={linkPointer} color={colors.cyan} width={2} />}

      {nodes.map((node) => (
        <NodeCard
          key={node.id}
          wid={wid}
          type={type}
          node={node}
          meta={cardMeta(type, node)}
          layer={layers.get(node.id) ?? 0}
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
