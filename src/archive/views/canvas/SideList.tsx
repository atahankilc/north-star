// Names beside a card (D-164). A competitor's features: the first four by name (in the open list's order) with
// `+N more` under them; selected, the full list by category, each category's name in small grey capitals over its
// rows (no tray round them), with what matches ours and how it's offered. A feature's parts folded into it: their
// names, indented under the part they belong to.
// Every row glides from where it is to where it should be (eased at both ends, ~280 ms), so opening runs forward,
// closing runs it backwards, and asking for what's already shown moves nothing. Poses are relative to the card's
// centre, so a dragged card carries its list with it exactly.
import { Text } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Color, ShaderMaterial, Vector2, type Group, type Mesh, type MeshBasicMaterial } from 'three'
import type { WithId } from '../../data/hooks'
import type { CompetitorFeature } from '../../data/model'
import { useCanvas } from '../../state/canvasStore'
import { isReducedMotion } from '../../state/motion'
import { usePalette } from '../../state/theme'
import { fontUrls } from '../../three/fonts'
import { CardCorners } from './CardCorners'
import { CARD_H, CARD_W, truncate } from './cardLayout'
import { SMALL_TEXT_PX, useDetail, useReadable } from './detail'

// Just clear of the card's `›` link handle, which sits just right of it (its glyph ends ~0.15 out).
const GAP = 0.18
export const ROW_H = 0.24
const STEP = 0.28
const ROW_W = 1.9
// Open, rows are wider, room for how a feature is offered.
const OPEN_W = 2.58
// Above an open list's category: its name, then the first row.
const CAT_H = 0.15
const CAT_GAP = 0.02
// An open list (and one still closing) lifts over every card, a dragged one too, and the other lists; still under the
// board's own overlays (select box, guides) at 0.08 above the board.
const OPEN_LIFT = 0.024
const TEXT = 0.095
// A name while the cards show only their bigger title (compact, D-153): as big as the row allows.
const COMPACT_TEXT = 0.16
const SMALL = 0.066
// Shown while closed.
const FIRST = 4
const PART_STEP = 0.26
const INDENT = 0.2
const DUR = 280
const UNCATEGORIZED = 'uncategorized'

// Decorations inside a row or the tray: the pointer only needs their plate, and every piece R3F tests costs time on
// every pointer move.
const noHit = () => null

const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)

// Where a piece sits, from the card's centre: its centre, width, height, opacity, and `a` for what only the open list
// shows (a row's tag).
export type Pose = { x: number; y: number; w: number; h: number; o: number; a: number }
const KEYS = ['x', 'y', 'w', 'h', 'o', 'a'] as const

// Glides `pose` to `target` whenever the target changes, and hands each step to `apply`; from `start` when it mounts.
function useGlide(target: Pose, apply: (p: Pose) => void, start: Pose = target) {
  const cur = useRef<Pose>({ ...start })
  const from = useRef<Pose>({ ...start })
  const to = useRef<Pose>({ ...start })
  const t0 = useRef(0)
  const first = useRef(true)
  const latest = useRef(target)
  latest.current = target
  useFrame(({ invalidate }) => {
    const t = latest.current
    if (first.current) {
      first.current = false
      apply(cur.current)
    }
    if (KEYS.some((k) => Math.abs(t[k] - to.current[k]) > 1e-4)) {
      from.current = { ...cur.current }
      to.current = { ...t }
      t0.current = performance.now()
    }
    const p = isReducedMotion() ? 1 : Math.min(1, (performance.now() - t0.current) / DUR)
    if (p >= 1 && KEYS.every((k) => cur.current[k] === to.current[k])) return
    const e = ease(p)
    for (const k of KEYS) cur.current[k] = p >= 1 ? to.current[k] : from.current[k] + (to.current[k] - from.current[k]) * e
    apply(cur.current)
    invalidate()
  })
}

// True while `on`, and for a glide's length after it turns off, so what closes is drawn until it's gone and then
// unmounted: a board with many competitors keeps only the rows that show.
function useLinger(on: boolean) {
  const [held, setHeld] = useState(on)
  useEffect(() => {
    if (on) {
      setHeld(true)
      return
    }
    const t = window.setTimeout(() => setHeld(false), isReducedMotion() ? 0 : DUR + 80)
    return () => window.clearTimeout(t)
  }, [on])
  return on || held
}

const samePose = (a?: Pose, b?: Pose) => a === b || (!!a && !!b && KEYS.every((k) => a[k] === b[k]))

type RowProps = {
  id: string
  pose: Pose
  // Where it comes from when it first shows; where it should be, if not given.
  start?: Pose
  name: string
  // The strip on its left and its corner marks when selected.
  accent: string
  // Matches one of ours (a competitor's feature): a cyan mark before the name.
  match?: boolean
  // Right-aligned, only in the open list: how it's offered.
  tag?: { text: string; color: string }
  selected?: boolean
  onPress: (id: string) => void
  // A link drawn from a card and let go here.
  onLinkDrop?: (id: string) => void
}

// One name: a slim plate with a strip in the accent, the name in mono.
const Row = memo(function Row({ id, pose, start, name, accent, match, tag, selected, onPress, onLinkDrop }: RowProps) {
  const group = useRef<Group>(null)
  const plate = useRef<Mesh>(null)
  const strip = useRef<Mesh>(null)
  const label = useRef<Mesh & { fillOpacity: number }>(null)
  const tagText = useRef<Mesh & { fillOpacity: number }>(null)
  const mark = useRef<Mesh>(null)
  const bar = useRef<Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const linking = useCanvas((s) => s.linkFrom !== null)
  const colors = usePalette()
  // Named as long as the cards' titles are (D-164): bigger with theirs, a bar only once they're bars too.
  const detail = useDetail((s) => s.card)
  const readable = detail !== 'far'
  const text = detail === 'full' ? TEXT : COMPACT_TEXT

  useGlide(pose, (p) => {
    const g = group.current
    if (!g) return
    g.position.set(p.x, p.y, 0)
    g.visible = p.o > 0.01
    plate.current?.scale.set(p.w, p.h, 1)
    if (strip.current) {
      strip.current.scale.set(1, p.h, 1)
      strip.current.position.x = -p.w / 2 + 0.02
    }
    for (const m of [plate, strip]) if (m.current) (m.current.material as MeshBasicMaterial).opacity = p.o
    if (label.current) {
      label.current.position.x = -p.w / 2 + 0.1 + (match ? 0.08 : 0)
      label.current.fillOpacity = p.o
    }
    if (mark.current) {
      mark.current.position.x = -p.w / 2 + 0.12
      ;(mark.current.material as MeshBasicMaterial).opacity = p.o
    }
    if (tagText.current) {
      tagText.current.position.x = p.w / 2 - 0.08
      tagText.current.fillOpacity = p.o * p.a
    }
    if (bar.current) {
      bar.current.position.x = -p.w / 2 + 0.1 + barW / 2
      ;(bar.current.material as MeshBasicMaterial).opacity = p.o
    }
  }, start)

  // Mono is 0.6 em a character: as much of the name as fits beside the tag.
  const fit = Math.max(6, Math.floor((pose.w - 0.3 - (tag && pose.a > 0.5 ? 0.6 : 0)) / (text * 0.6)))
  // Too small to read, the name is a grey bar as long as it, as a card's title is far out (D-153).
  const barW = Math.min(Math.max(1, (name || 'Untitled').length) * TEXT * 0.6, pose.w - 0.2)
  return (
    <group
      ref={group}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        // No menu of its own (D-117), and not the board's either.
        if (e.button === 2) e.stopPropagation()
        if (e.button !== 0 || !group.current?.visible) return
        e.stopPropagation()
        if (!useCanvas.getState().linkFrom) onPress(id)
      }}
      onPointerUp={(e) => {
        if (!useCanvas.getState().linkFrom || !onLinkDrop || !group.current?.visible) return
        e.stopPropagation()
        onLinkDrop(id)
        useCanvas.getState().endLink()
      }}
      // Hidden, it lets everything through to what's under it (R3F hits invisible objects too).
      onClick={(e) => group.current?.visible && e.stopPropagation()}
      onDoubleClick={(e) => group.current?.visible && e.stopPropagation()}
      onPointerOver={(e) => {
        if (!group.current?.visible) return
        e.stopPropagation()
        setHovered(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        if (!hovered) return
        setHovered(false)
        document.body.style.cursor = ''
      }}
    >
      {/* As a card is (D-148, D-150): no edge round it, its accent down the left, corner marks when hovered or selected. */}
      <CardCorners
        w={pose.w}
        h={pose.h}
        on={hovered || !!selected}
        out={selected ? 0.03 : 0.06}
        len={0.08}
        color={linking && hovered ? colors.cyan : selected ? accent : colors.hover}
        noHit
      />
      <mesh ref={plate}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={colors.card} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh ref={strip} position={[0, 0, 0.001]} raycast={noHit}>
        <planeGeometry args={[0.04, 1]} />
        <meshBasicMaterial color={accent} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      {match && (
        <mesh ref={mark} position={[0, 0, 0.002]} raycast={noHit}>
          <planeGeometry args={[0.035, TEXT * 1.1]} />
          <meshBasicMaterial color={colors.cyan} transparent toneMapped={false} depthWrite={false} />
        </mesh>
      )}
      {!readable && (
        <mesh ref={bar} position={[0, 0, 0.002]} raycast={noHit}>
          <planeGeometry args={[barW, ROW_H * 0.36]} />
          <meshBasicMaterial color={colors.fgDim} transparent toneMapped={false} depthWrite={false} />
        </mesh>
      )}
      <Text ref={label} raycast={noHit} visible={readable} font={fontUrls.mono} fontSize={text} color={colors.fg} anchorX="left" anchorY="middle" position={[0, 0.004, 0.002]}>
        {truncate(name || 'Untitled', fit)}
      </Text>
      {tag && (
        <Text ref={tagText} raycast={noHit} visible={readable} font={fontUrls.mono} fontSize={SMALL} letterSpacing={0.06} color={tag.color} anchorX="right" anchorY="middle" position={[0, 0.004, 0.002]}>
          {tag.text}
        </Text>
      )}
    </group>
  )
},
(a, b) =>
  a.id === b.id &&
  a.name === b.name &&
  a.accent === b.accent &&
  a.match === b.match &&
  a.selected === b.selected &&
  a.tag?.text === b.tag?.text &&
  a.tag?.color === b.tag?.color &&
  a.onPress === b.onPress &&
  a.onLinkDrop === b.onLinkDrop &&
  samePose(a.pose, b.pose) &&
  samePose(a.start, b.start),
)

// Small text that glides with the list: a category's name and count, `+N more`.
function Caption({ pose, start, children, color, size = SMALL, spacing = 0.12, right }: { pose: Pose; start?: Pose; children: ReactNode; color: string; size?: number; spacing?: number; right?: ReactNode }) {
  const group = useRef<Group>(null)
  const left = useRef<Mesh & { fillOpacity: number }>(null)
  const end = useRef<Mesh & { fillOpacity: number }>(null)
  const colors = usePalette()
  // Short mono words, read at a glance like a card's small text (D-111).
  const readable = useReadable(size, SMALL_TEXT_PX)
  useGlide(pose, (p) => {
    const g = group.current
    if (!g) return
    g.position.set(p.x, p.y, 0.002)
    g.visible = p.o > 0.01
    if (left.current) {
      left.current.position.x = -p.w / 2
      left.current.fillOpacity = p.o
    }
    if (end.current) {
      end.current.position.x = p.w / 2
      end.current.fillOpacity = p.o
    }
  }, start)
  return (
    <group ref={group} raycast={() => null}>
      <Text ref={left} raycast={() => null} visible={readable} font={fontUrls.mono} fontSize={size} letterSpacing={spacing} color={color} anchorX="left" anchorY="middle">
        {children}
      </Text>
      {right !== undefined && (
        <Text ref={end} raycast={() => null} visible={readable} font={fontUrls.mono} fontSize={size} color={colors.fgDim} anchorX="right" anchorY="middle">
          {right}
        </Text>
      )}
    </group>
  )
}

// Behind an open list: a soft shade in the page colour, so names never fight with the cards and lines they cover. No
// edge and no fill of its own: solid in the middle, fading out over its last FEATHER. One plate, no extra render (a
// real blur, drawing the board twice a frame, made the board lag). It fades and shrinks with the list.
const FEATHER = 0.12
const SHADE = 0.9
const shadeVertex = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const shadeFragment = `varying vec2 vUv;
uniform vec2 size;
uniform float feather;
uniform vec3 tint;
uniform float opacity;
void main() {
  vec2 d = min(vUv, 1.0 - vUv) * size;
  float edge = smoothstep(0.0, feather, min(d.x, d.y));
  gl_FragColor = vec4(tint, opacity * edge);
  #include <colorspace_fragment>
}`

function ListShade({ pose, start }: { pose: Pose; start?: Pose }) {
  const mesh = useRef<Mesh>(null)
  const colors = usePalette()
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { size: { value: new Vector2(1, 1) }, feather: { value: FEATHER }, tint: { value: new Color() }, opacity: { value: 0 } },
        vertexShader: shadeVertex,
        fragmentShader: shadeFragment,
        transparent: true,
        depthWrite: false,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  material.uniforms.tint.value.set(colors.bg)

  useGlide(pose, (p) => {
    const m = mesh.current
    if (!m) return
    m.position.set(p.x, p.y, -0.004)
    m.scale.set(p.w, p.h, 1)
    m.visible = p.o > 0.01
    material.uniforms.size.value.set(p.w, p.h)
    material.uniforms.opacity.value = p.o * SHADE
  }, start)

  return (
    <mesh ref={mesh} material={material} raycast={noHit}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
}

const pose = (x: number, y: number, w: number, h: number, o = 1, a = 0): Pose => ({ x, y, w, h, o, a })
// The left edge of what's beside a card, from its centre.
const X0 = CARD_W / 2 + GAP
const TOP = CARD_H / 2

// Grouped as the panel groups them: by category, A to Z, uncategorized last; oldest first within one.
export function byCategory(features: WithId<CompetitorFeature>[]): [string, WithId<CompetitorFeature>[]][] {
  const map = new Map<string, WithId<CompetitorFeature>[]>()
  for (const f of features) {
    const key = f.category?.trim() || UNCATEGORIZED
    map.set(key, [...(map.get(key) ?? []), f])
  }
  return [...map.entries()].sort(([a], [b]) => (a === UNCATEGORIZED ? 1 : b === UNCATEGORIZED ? -1 : a.localeCompare(b)))
}

// The order rows show in, closed and open alike, so opening only adds to the list and moves none of its rows up or
// down past another.
const inOrder = (features: WithId<CompetitorFeature>[]) => byCategory(features).flatMap(([, items]) => items)

// Where each of a competitor's features sits, from its card's centre, closed or open: for the rows here and for where
// links to them end. Closed, only the first few have a place; the rest are behind `+N more`.
export function featureSpots(features: WithId<CompetitorFeature>[], open: boolean): Map<string, Pose> {
  const spots = new Map<string, Pose>()
  if (open) {
    let y = TOP
    for (const [, items] of byCategory(features)) {
      y -= CAT_H
      for (const f of items) {
        spots.set(f.id, pose(X0 + OPEN_W / 2, y - ROW_H / 2, OPEN_W, ROW_H, 1, 1))
        y -= STEP
      }
      y -= CAT_GAP
    }
  } else {
    inOrder(features).forEach((f, i) => {
      const at = Math.min(i, FIRST)
      spots.set(f.id, pose(X0 + ROW_W / 2, TOP - ROW_H / 2 - at * STEP, ROW_W, ROW_H, i < FIRST ? 1 : 0))
    })
  }
  return spots
}

type FeatureListProps = {
  features: WithId<CompetitorFeature>[]
  open: boolean
  // Our feature each one matches, by its id (the matrix cell's `competitorFeatureId`).
  matches: Map<string, string>
  onLinkDrop: (targetId: string) => void
}

// A competitor's features beside its card; the group is placed at the card's centre by the board. Closed, only the
// first few rows (and `+N more`) are mounted; the rest and the category names mount as it opens, gliding out of where
// the closed list is, and unmount once closing has carried them back there.
export const FeatureList = memo(function FeatureList({ features, open, matches, onLinkDrop }: FeatureListProps) {
  const colors = usePalette()
  const selectedId = useCanvas((s) => s.selectedId)
  const full = useLinger(open)
  const closed = featureSpots(features, false)
  const spots = open ? featureSpots(features, true) : closed
  const groups = byCategory(features)
  const tags: Record<string, string> = { free: colors.green, paid: colors.yellow, enterprise: colors.blue, beta: colors.magenta }

  const more = features.length - FIRST

  // The shade round the open list, a little past its names and rows; closed, the closed rows' box, faded out.
  const PAD = 0.07 + FEATHER
  let bottom = TOP
  for (const p of spots.values()) if (p.o > 0) bottom = Math.min(bottom, p.y - p.h / 2)
  const shown = Math.min(FIRST, features.length)
  const shadeShut = pose(X0 + ROW_W / 2, TOP - (shown * STEP) / 2, ROW_W, shown * STEP, 0)
  const shadeOpen = pose(X0 + OPEN_W / 2, (TOP + PAD + bottom - PAD) / 2, OPEN_W + 2 * PAD, TOP - bottom + 2 * PAD)

  return (
    <group position={[0, 0, full ? OPEN_LIFT : 0]}>
      {full && <ListShade pose={open ? shadeOpen : shadeShut} start={shadeShut} />}
      {full &&
        groups.map(([category, items]) => {
          // Each category's name, in the gap over its first row; out of and back into where that row sits closed.
          const shut = pose(X0 + ROW_W / 2, closed.get(items[0].id)!.y, ROW_W, 0.1, 0)
          return (
            <Caption
              key={category}
              pose={open ? pose(X0 + OPEN_W / 2, spots.get(items[0].id)!.y + ROW_H / 2 + CAT_H / 2 - 0.01, OPEN_W, 0.1) : shut}
              start={shut}
              color={colors.fgDim}
              spacing={0.14}
            >
              {`${category.toUpperCase()}  ${items.length}`}
            </Caption>
          )
        })}
      {inOrder(features).map((f, i) =>
        full || i < FIRST ? (
          <Row
            key={f.id}
            id={f.id}
            pose={spots.get(f.id)!}
            start={closed.get(f.id)}
            name={f.name}
            accent={colors.yellow}
            match={matches.has(f.id)}
            tag={f.availability ? { text: f.availability, color: tags[f.availability] } : undefined}
            selected={selectedId === f.id}
            onPress={selectFeature}
            onLinkDrop={onLinkDrop}
          />
        ) : null,
      )}
      {more > 0 && (
        <Caption pose={pose(X0 + ROW_W / 2, TOP - FIRST * STEP - 0.12, ROW_W - 0.2, 0.1, open ? 0 : 1)} color={colors.fgDim} spacing={0.04}>
          {`+${more} more`}
        </Caption>
      )}
    </group>
  )
})

const selectFeature = (id: string) => useCanvas.getState().select(id)

// A folded feature's parts, in order, with how deep each sits under it (1: its own part).
export type Part = { id: string; title: string; depth: number }

// Where each folded part sits, from the card it's folded into.
export function partSpots(parts: Part[]): Map<string, Pose> {
  return new Map(
    parts.map((p, i) => {
      const w = ROW_W - (p.depth - 1) * INDENT
      return [p.id, pose(X0 + (p.depth - 1) * INDENT + w / 2, TOP - ROW_H / 2 - i * PART_STEP, w, ROW_H)]
    }),
  )
}

// The parts folded into a feature (`id`), beside it, fading in as the cards arrive and out as they leave (`shown`);
// mounted only while they show. Clicking one unfolds them all.
type PartListProps = { id: string; parts: Part[]; shown: boolean; onFold: (id: string) => void; onLinkDrop: (targetId: string) => void }
export const PartList = memo(function PartList({ id, parts, shown, onFold, onLinkDrop }: PartListProps) {
  const colors = usePalette()
  const mounted = useLinger(shown)
  if (!mounted) return null
  const spots = partSpots(parts)
  const unfold = () => onFold(id)
  return (
    <group>
      {parts.map((p) => {
        const at = spots.get(p.id)!
        return (
          <Row
            key={p.id}
            id={p.id}
            pose={{ ...at, o: shown ? 1 : 0 }}
            start={{ ...at, o: 0 }}
            name={p.title}
            accent={colors.link.part}
            onPress={unfold}
            onLinkDrop={onLinkDrop}
          />
        )
      })}
    </group>
  )
})
