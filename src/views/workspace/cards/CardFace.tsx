// One face for every card and task (D-358, docs/specs/cards.md): what every card-like thing on the canvas stands on. Raised
// paper (`--bg-raised`) with a thin outer line; with a `tone` (its card's type colour), an edge of it on its left
// (`sheet`: a deck's or timeline's 2 px; `card`: a plane card's world edge); `tint`, its face a dark tone of that colour
// (D-294) with the greys and colours inside leaning to the ink so every line reads (D-295: `--fg-dim`, `--fg-faint`,
// `--placeholder`, `--type-ink`, `--clash-ink`). Its states are data attributes for its contents to read (`selected`,
// `finished`, `lifted`, `pressed`, `dim`), and with `marks` it draws its Marks (D-265) in its tone, with the L's of
// others who have `peersOf` picked. A shell only: its layout, drag and data are its caller's.
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent as ReactPointerEvent, ReactNode, Ref } from 'react'
import { Marks, type Tier } from '../../../ui/primitives/Marks'
import { usePeersOn } from '../canvas/collab'
import styles from './CardFace.module.css'

export type Edge = 'sheet' | 'card'

type Props = {
  tone?: string
  tint?: boolean
  // No paper of its own: the tint over what's under it and its edge only, no outer line (a table's row name, whose row
  // lines must show through it).
  flat?: boolean
  edge?: Edge
  selected?: boolean
  finished?: boolean
  lifted?: boolean
  pressed?: boolean
  dim?: boolean
  // Its Marks: drawn when set (hover, selection, others' L's).
  marks?: boolean
  // Its Marks' colour when not its tone (a timeline's ◆: no face, but marks in its card's colour).
  markTone?: string
  // Its Marks' size (D-265's tiers; a small pill takes `s`).
  markTier?: Tier
  // Whose selection of it others' L's follow (a task's or card's id).
  peersOf?: string
  // A button for the keyboard and screen readers (true: the deck's sheets while live; false: out of the tab order;
  // left out: neither, as a plane card's face, which the plane handles).
  button?: boolean
  label?: string
  // Its words on hover, and hidden from screen readers (a copy under the pointer while dragged).
  title?: string
  hidden?: boolean
  className?: string
  style?: CSSProperties
  ref?: Ref<HTMLDivElement>
  onPointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerEnter?: () => void
  onPointerLeave?: () => void
  onClick?: (e: MouseEvent) => void
  onDoubleClick?: () => void
  onKeyDown?: (e: KeyboardEvent) => void
  // Over its contents, after its Marks (a comments chip).
  extra?: ReactNode
  children: ReactNode
} & Record<`data-${string}`, string | number | boolean | undefined>

export function CardFace({ tone, tint, flat, edge = 'sheet', selected, finished, lifted, pressed, dim, marks, markTone, markTier, peersOf, button, label, title, hidden, className, style, ref, onPointerDown, onPointerEnter, onPointerLeave, onClick, onDoubleClick, onKeyDown, extra, children, ...data }: Props) {
  const peers = usePeersOn(peersOf ?? '')
  return (
    <div
      {...data}
      ref={ref}
      className={[styles.face, className].filter(Boolean).join(' ')}
      style={tone ? ({ ['--tone' as string]: tone, ...style } as CSSProperties) : style}
      data-edge={tone ? edge : undefined}
      data-tint={(tone && tint) || undefined}
      data-flat={flat || undefined}
      data-selected={selected || undefined}
      data-finished={finished || undefined}
      data-lifted={lifted || undefined}
      data-pressed={pressed || undefined}
      data-dim={dim || undefined}
      role={button ? 'button' : undefined}
      tabIndex={button === undefined ? undefined : button ? 0 : -1}
      aria-label={label}
      aria-hidden={hidden || undefined}
      title={title}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
    >
      {children}
      {marks && <Marks tier={markTier} tone={markTone ?? tone} selected={selected} pressed={pressed} peers={peers} />}
      {extra}
    </div>
  )
}
