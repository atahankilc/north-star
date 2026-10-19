// Names beside a card (D-164). A competitor's features: the first three by name with `+N more` under them; hovered or
// selected, the full list in a framed tray, by category, with what matches ours and how it's offered. A feature's parts
// folded into it: their names, indented under the part they belong to.
// Every row glides from where it is to where it should be (eased at both ends, ~280 ms), so opening runs forward,
// closing runs it backwards, and asking for what's already shown moves nothing. Poses are relative to the card's
// centre, so a dragged card carries its list with it exactly.
import { Text } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRef, useState, type ReactNode } from 'react'
import type { Group, Mesh, MeshBasicMaterial } from 'three'
import type { WithId } from '../../data/hooks'
import type { CompetitorFeature } from '../../data/model'
import { useCanvas } from '../../state/canvasStore'
import { isReducedMotion } from '../../state/motion'
import { usePalette } from '../../state/theme'
import { fontUrls } from '../../three/fonts'
import { CARD_H, CARD_W, truncate } from './cardLayout'
import { SMALL_TEXT_PX, useReadable } from './detail'

// Clear of the card's `›` link handle, which sits just right of it.
const GAP = 0.36
export const ROW_H = 0.24
const STEP = 0.28
const ROW_W = 1.9
const TRAY_W = 2.7
const TEXT = 0.095
const SMALL = 0.066
// Shown while closed.
const FIRST = 3
const PART_STEP = 0.26
const INDENT = 0.2
const DUR = 280
const UNCATEGORIZED = 'uncategorized'

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

type RowProps = {
  pose: Pose
  // Where it comes from when it first shows; where it should be, if not given.
  start?: Pose
  name: string
  // The strip on its left and its edge when selected.
  accent: string
  // Matches one of ours (a competitor's feature): a cyan mark before the name.
  match?: boolean
  // Right-aligned, only in the open list: how it's offered.
  tag?: { text: string; color: string }
  selected?: boolean
  onPress: () => void
  // A link drawn from a card and let go here.
  onLinkDrop?: () => void
  onHover?: (on: boolean) => void
}

// One name: a slim plate with a strip in the accent, the name in mono.
function Row({ pose, start, name, accent, match, tag, selected, onPress, onLinkDrop, onHover }: RowProps) {
  const group = useRef<Group>(null)
  const plate = useRef<Mesh>(null)
  const edge = useRef<Mesh>(null)
  const strip = useRef<Mesh>(null)
  const label = useRef<Mesh & { fillOpacity: number }>(null)
  const tagText = useRef<Mesh & { fillOpacity: number }>(null)
  const mark = useRef<Mesh>(null)
  const bar = useRef<Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const linking = useCanvas((s) => s.linkFrom !== null)
  const colors = usePalette()
  const readable = useReadable(TEXT)

  useGlide(pose, (p) => {
    const g = group.current
    if (!g) return
    g.position.set(p.x, p.y, 0)
    g.visible = p.o > 0.01
    plate.current?.scale.set(p.w, p.h, 1)
    edge.current?.scale.set(p.w + 0.02, p.h + 0.02, 1)
    if (strip.current) {
      strip.current.scale.set(1, p.h, 1)
      strip.current.position.x = -p.w / 2 + 0.02
    }
    for (const m of [plate, edge, strip]) if (m.current) (m.current.material as MeshBasicMaterial).opacity = p.o * (m === strip ? 0.7 : 1)
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

  const edgeColor = selected ? colors.yellow : linking && hovered ? colors.cyan : hovered ? colors.hover : colors.hairline
  // Mono is 0.6 em a character: as much of the name as fits beside the tag.
  const fit = Math.max(6, Math.floor((pose.w - 0.3 - (tag && pose.a > 0.5 ? 0.6 : 0)) / (TEXT * 0.6)))
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
        if (!useCanvas.getState().linkFrom) onPress()
      }}
      onPointerUp={(e) => {
        if (!useCanvas.getState().linkFrom || !onLinkDrop || !group.current?.visible) return
        e.stopPropagation()
        onLinkDrop()
        useCanvas.getState().endLink()
      }}
      // Hidden, it lets everything through to what's under it (R3F hits invisible objects too).
      onClick={(e) => group.current?.visible && e.stopPropagation()}
      onDoubleClick={(e) => group.current?.visible && e.stopPropagation()}
      onPointerOver={(e) => {
        if (!group.current?.visible) return
        e.stopPropagation()
        setHovered(true)
        onHover?.(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        if (!hovered) return
        setHovered(false)
        onHover?.(false)
        document.body.style.cursor = ''
      }}
    >
      <mesh ref={edge} position={[0, 0, -0.002]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={edgeColor} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh ref={plate}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={colors.chip} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh ref={strip} position={[0, 0, 0.001]}>
        <planeGeometry args={[0.04, 1]} />
        <meshBasicMaterial color={accent} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      {match && (
        <mesh ref={mark} position={[0, 0, 0.002]}>
          <planeGeometry args={[0.035, TEXT * 1.1]} />
          <meshBasicMaterial color={colors.cyan} transparent toneMapped={false} depthWrite={false} />
        </mesh>
      )}
      {!readable && (
        <mesh ref={bar} position={[0, 0, 0.002]}>
          <planeGeometry args={[barW, ROW_H * 0.36]} />
          <meshBasicMaterial color={colors.fgDim} transparent toneMapped={false} depthWrite={false} />
        </mesh>
      )}
      <Text ref={label} visible={readable} font={fontUrls.mono} fontSize={TEXT} color={colors.fg} anchorX="left" anchorY="middle" position={[0, 0.004, 0.002]}>
        {truncate(name || 'Untitled', fit)}
      </Text>
      {tag && (
        <Text ref={tagText} visible={readable} font={fontUrls.mono} fontSize={SMALL} letterSpacing={0.06} color={tag.color} anchorX="right" anchorY="middle" position={[0, 0.004, 0.002]}>
          {tag.text}
        </Text>
      )}
    </group>
  )
}

// Small text that glides with the list: a category's name and count, `+N more`, the tray's heading.
function Caption({ pose, children, color, size = SMALL, spacing = 0.12, right }: { pose: Pose; children: ReactNode; color: string; size?: number; spacing?: number; right?: ReactNode }) {
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
  })
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

// The open list's frame: a dark plate with a line in the accent along its top.
function Tray({ pose, accent, onHover }: { pose: Pose; accent: string; onHover: (on: boolean) => void }) {
  const group = useRef<Group>(null)
  const plate = useRef<Mesh>(null)
  const edge = useRef<Mesh>(null)
  const top = useRef<Mesh>(null)
  const colors = usePalette()
  useGlide(pose, (p) => {
    const g = group.current
    if (!g) return
    g.position.set(p.x, p.y, -0.004)
    g.visible = p.o > 0.01
    plate.current?.scale.set(p.w, p.h, 1)
    edge.current?.scale.set(p.w + 0.02, p.h + 0.02, 1)
    if (top.current) {
      top.current.scale.set(p.w + 0.02, 1, 1)
      top.current.position.y = p.h / 2
    }
    for (const m of [plate, edge, top]) if (m.current) (m.current.material as MeshBasicMaterial).opacity = p.o
  })
  return (
    <group
      ref={group}
      // Between rows the pointer is on the tray, and the list stays open.
      onPointerOver={(e) => {
        if (!group.current?.visible) return
        e.stopPropagation()
        onHover(true)
      }}
      onPointerOut={() => onHover(false)}
      onPointerDown={(e) => {
        if (group.current?.visible) e.stopPropagation()
      }}
      onClick={(e) => group.current?.visible && e.stopPropagation()}
    >
      <mesh ref={edge} position={[0, 0, -0.001]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={colors.hairline} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh ref={plate}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={colors.cardBehind} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh ref={top} position={[0, 0, 0.001]}>
        <planeGeometry args={[1, 0.03]} />
        <meshBasicMaterial color={accent} transparent toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
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

// Where each of a competitor's features sits, from its card's centre, closed or open: for the rows here and for where
// links to them end. Closed, only the first few have a place; the rest are behind `+N more`.
export function featureSpots(features: WithId<CompetitorFeature>[], open: boolean): Map<string, Pose> {
  const spots = new Map<string, Pose>()
  if (open) {
    let y = TOP - 0.3
    for (const [, items] of byCategory(features)) {
      y -= 0.2
      for (const f of items) {
        spots.set(f.id, pose(X0 + TRAY_W / 2, y, TRAY_W - 0.12, ROW_H, 1, 1))
        y -= STEP
      }
      y -= 0.06
    }
  } else {
    features.forEach((f, i) => {
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
  onHover: (on: boolean) => void
  onLinkDrop: (targetId: string) => void
}

// A competitor's features beside its card; the group is placed at the card's centre by the board.
export function FeatureList({ features, open, matches, onHover, onLinkDrop }: FeatureListProps) {
  const colors = usePalette()
  const selectedId = useCanvas((s) => s.selectedId)
  const spots = featureSpots(features, open)
  const groups = byCategory(features)
  const tags: Record<string, string> = { free: colors.green, paid: colors.yellow, enterprise: colors.blue, beta: colors.magenta }

  // The tray round the open list, and each category's heading over its rows.
  let bottom = TOP
  for (const p of spots.values()) if (p.o > 0) bottom = Math.min(bottom, p.y - p.h / 2)
  const trayH = TOP - bottom + 0.08
  const tray = open ? pose(X0 + TRAY_W / 2, TOP - trayH / 2, TRAY_W, trayH) : pose(X0 + ROW_W / 2, TOP - 0.5, ROW_W, 1, 0)
  const more = features.length - FIRST

  return (
    <group>
      <Tray pose={tray} accent={colors.yellow} onHover={onHover} />
      <Caption pose={open ? pose(X0 + TRAY_W / 2, TOP - 0.14, TRAY_W - 0.2, 0.1) : pose(X0 + ROW_W / 2, TOP - 0.14, ROW_W - 0.2, 0.1, 0)} color={colors.yellow} right={String(features.length)}>
        FEATURES
      </Caption>
      {groups.map(([category, items]) => {
        const first = spots.get(items[0].id)!
        return (
          <Caption
            key={category}
            pose={open ? pose(X0 + TRAY_W / 2, first.y + 0.2, TRAY_W - 0.2, 0.1) : pose(X0 + ROW_W / 2, first.y, ROW_W - 0.2, 0.1, 0)}
            color={colors.fgDim}
            size={0.062}
            right={String(items.length)}
          >
            {category.toUpperCase()}
          </Caption>
        )
      })}
      {features.map((f) => (
        <Row
          key={f.id}
          pose={spots.get(f.id)!}
          name={f.name}
          accent={colors.yellow}
          match={matches.has(f.id)}
          tag={f.availability ? { text: f.availability, color: tags[f.availability] } : undefined}
          selected={selectedId === f.id}
          onPress={() => useCanvas.getState().select(f.id)}
          onLinkDrop={() => onLinkDrop(f.id)}
          onHover={onHover}
        />
      ))}
      {more > 0 && (
        <Caption pose={pose(X0 + ROW_W / 2, TOP - FIRST * STEP - 0.12, ROW_W - 0.2, 0.1, open ? 0 : 1)} color={colors.fgDim} spacing={0.04}>
          {`+${more} more`}
        </Caption>
      )}
    </group>
  )
}

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

// The parts folded into a feature, beside it, fading in as the cards arrive and out as they leave (`shown`). Clicking
// one unfolds them all.
export function PartList({ parts, shown, onUnfold, onLinkDrop }: { parts: Part[]; shown: boolean; onUnfold: () => void; onLinkDrop: (targetId: string) => void }) {
  const colors = usePalette()
  const spots = partSpots(parts)
  return (
    <group>
      {parts.map((p) => {
        const at = spots.get(p.id)!
        return (
          <Row
            key={p.id}
            pose={{ ...at, o: shown ? 1 : 0 }}
            start={{ ...at, o: 0 }}
            name={p.title}
            accent={colors.link.part}
            onPress={onUnfold}
            onLinkDrop={() => onLinkDrop(p.id)}
          />
        )
      })}
    </group>
  )
}
