// Text anywhere in the workspace (D-188), drawn in its space's px (the canvas's world, or a plane's view). Headings
// (H1–H3, an H1 with a rule fading right, a small line over it), paragraphs (light Markdown at a width, a hairline down
// the left), either turned a quarter; sticky notes (signed, a colour bar); sections (a frame holding what's inside it,
// its number and name set into its top or left edge, the line breaking round them) and the project title (the
// workspace's name and what it's building, folding round the name when too far out to read). Live, a click selects
// (corner marks, closing in while pressed), a drag moves (5 px first, snapped, alt = free; a section carries what's
// inside it), a double-click types, a right edge sets a width, a section's corner its size; a small bar under the
// selected one sets it. Frames are drawn under everything else, text over it.
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import type { DocumentReference } from 'firebase/firestore'
import { useAuth } from '../../data/auth'
import { snap } from '../../data/grid'
import {
  deleteLabel,
  HEADING_PX,
  KICKER_MAX,
  kindOf,
  LABEL_COLORS,
  labelRef,
  moveMany,
  PARA_PX,
  PARA_W,
  SECTION_MIN,
  STICKY_PX,
  STICKY_W,
  textMax,
  TITLE_W,
  updateLabel,
  type Label,
  type LabelColor,
  type LabelSize,
  type TextScale,
} from '../../data/labels'
import { DESCRIPTION_MAX, describeWorkspace, renameWorkspace } from '../../data/workspaces'
import { useCanvasView } from '../../state/canvasView'
import { useMotion } from '../../state/motion'
import { ago } from '../../ui/ago'
import { LightMarkdown } from '../../ui/LightMarkdown'
import { useWs } from './context'
import styles from './TextItems.module.css'
import { PeerRing } from './collab'
import { ThreadChip, threadOn } from './Threads'
import { ABOUT_HINT, DESC_SHARE, FOLD_BELOW_PX, foldIndent, foldStar, T, titleLayout } from './titleLayout'

const DRAG_PX = 5
// Down from a sticky note's top to its text: the bar, a gap, the signed line (the old board's units × 80).
const STICKY_TEXT_TOP = 17.64
// Text smaller than this on screen is left out (a heading's small line), as on the old board (D-111).
const MIN_TEXT_PX = 6

// Something else in the space a section can carry: a plane on the canvas, a card on a plane.
export type Carried = { id: string; ref: DocumentReference; x: number; y: number; w: number; h: number }

export const COLOR_VAR: Record<LabelColor, string> = {
  ink: 'var(--fg)',
  magenta: 'var(--accent-magenta)',
  cyan: 'var(--accent-cyan)',
  yellow: 'var(--accent-yellow)',
  green: 'var(--accent-green)',
  blue: 'var(--accent-blue)',
}

type HeadingSize = Exclude<LabelSize, 'note'>
// A heading's or a section name's size (a section never says `note`; if it did, H3).
const headingSize = (l: Label): HeadingSize => (l.size === 'note' ? 'minor' : (l.size ?? 'heading'))
// A heading's small line, a section's number: its size from the text it goes with.
const kickPx = (px: number) => Math.max(8, px * 0.3)
const secKickPx = (px: number) => Math.max(8, px * 0.42)
// Caps read better a little apart; big text a little tighter.
const tracking = (l: Label, size: HeadingSize) => (l.caps ? '0.04em' : size === 'heading' ? '-0.03em' : '-0.02em')

// The small line over a heading or before a section's name (D-156): a leading number stands out, the rest is set small
// in mono capitals. `02 who we beat` → `02`, `WHO WE BEAT`.
function kickerParts(kicker: string | undefined): { num: string; rest: string } | null {
  const k = kicker?.trim()
  if (!k) return null
  const m = /^(\d{1,4})(?:[\s.·:—–-]+(.*))?$/.exec(k)
  return m ? { num: m[1], rest: (m[2] ?? '').toUpperCase() } : { num: '', rest: k.toUpperCase() }
}

// Roughly where it sits, for what a section holds and what fit frames. A turned one's sides swap.
export function labelBox(l: Label) {
  const k = kindOf(l)
  const lines = Math.max(1, l.text.split('\n').length)
  if (k === 'section') return { x: l.x, y: l.y, w: l.w ?? 400, h: l.h ?? 300 }
  if (k === 'sticky') return { x: l.x, y: l.y, w: l.w ?? STICKY_W.initial, h: STICKY_TEXT_TOP + lines * STICKY_PX[l.scale ?? 'medium'] * 1.45 + 7.2 }
  if (k === 'title') return { x: l.x, y: l.y, w: l.w ?? TITLE_W.initial, h: 340 }
  let w: number
  let h: number
  if (k === 'paragraph') [w, h] = [l.w ?? PARA_W.initial, lines * PARA_PX[l.scale ?? 'large'] * 1.55 + 8]
  else {
    const px = HEADING_PX[headingSize(l)]
    ;[w, h] = [Math.max(4, l.text.length) * px * 0.55, px * 1.3 + (l.kicker ? kickPx(px) * 1.6 : 0)]
  }
  return l.rotate ? { x: l.x, y: l.y, w: h, h: w } : { x: l.x, y: l.y, w, h }
}

const inside = (b: { x: number; y: number; w: number; h: number }, s: { x: number; y: number; w: number; h: number }) =>
  b.x >= s.x && b.y >= s.y && b.x + b.w <= s.x + s.w && b.y + b.h <= s.y + s.h

type Props = { labels: Label[]; layer: 'frames' | 'text'; live: boolean; editor: boolean; zoom: number; carry: Carried[] }

export function TextItems({ labels, layer, live, editor, zoom, carry }: Props) {
  const shown = labels.filter((l) => (kindOf(l) === 'section') === (layer === 'frames'))
  return (
    <>
      {shown.map((l) => (
        <LabelItem key={l.id} l={l} live={live} editor={editor} zoom={zoom} labels={labels} carry={carry} />
      ))}
    </>
  )
}

type ItemProps = { l: Label; live: boolean; editor: boolean; zoom: number; labels: Label[]; carry: Carried[] }

function LabelItem({ l, live, editor, zoom, labels, carry }: ItemProps) {
  const { wid, threads } = useWs()
  const kind = kindOf(l)
  const selected = useCanvasView((s) => live && s.labelSelected === l.id)
  const typing = useCanvasView((s) => live && editor && s.labelEditing === l.id)
  const shift = useCanvasView((s) => (s.dragShift && s.dragShift.ids.includes(l.id) ? s.dragShift : null))
  // Held down (a press, or a drag): its corner marks close in, as a card's do (D-150).
  const [pressed, setPressed] = useState(false)
  // A new size (and a turned one's top, as it grows upwards), held until the data's back.
  const [held, setHeld] = useState<{ w?: number; h?: number; y?: number } | null>(null)
  useEffect(() => {
    if (held && (held.w === undefined || held.w === l.w) && (held.h === undefined || held.h === l.h) && (held.y === undefined || held.y === l.y)) setHeld(null)
  }, [held, l.w, l.h, l.y])
  const w = held?.w ?? l.w
  const h = held?.h ?? l.h
  const y = held?.y ?? l.y

  // A turned heading or paragraph (D-156): its text laid out level, then turned; the box it takes is that measured,
  // sides swapped, with its top-left at x/y.
  const turn = kind === 'heading' || kind === 'paragraph' ? l.rotate : undefined
  const body = useRef<HTMLDivElement>(null)
  const [laid, setLaid] = useState<[number, number] | null>(null)
  useLayoutEffect(() => {
    const el = body.current
    if (!turn || !el) return
    const measure = () => setLaid([el.offsetWidth, el.offsetHeight])
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [turn])
  const turnedBox = turn && laid ? { width: laid[1], height: laid[0] } : undefined

  const select = () => useCanvasView.setState({ labelSelected: l.id, cardSelected: null, selected: null })

  // Press and drag: moves it (a section with what's inside it), one undo step.
  const press = (e: ReactPointerEvent<HTMLElement>) => {
    if (!live || e.button !== 0) return
    e.stopPropagation()
    select()
    if (!editor || typing) return
    setPressed(true)
    const [sx, sy] = [e.clientX, e.clientY]
    const box = { ...labelBox(l), w: w ?? labelBox(l).w, h: h ?? labelBox(l).h }
    // What a section holds, by where it is now.
    const held: { id: string; ref: DocumentReference; x: number; y: number }[] = [{ id: l.id, ref: labelRef(wid, l.id), x: l.x, y: l.y }]
    if (kind === 'section') {
      for (const o of labels) if (o.id !== l.id && inside(labelBox(o), box)) held.push({ id: o.id, ref: labelRef(wid, o.id), x: o.x, y: o.y })
      for (const c of carry) if (inside(c, box)) held.push({ id: c.id, ref: c.ref, x: c.x, y: c.y })
    }
    let d: [number, number] | null = null
    const move = (ev: PointerEvent) => {
      const [dx, dy] = [ev.clientX - sx, ev.clientY - sy]
      if (!d && Math.hypot(dx, dy) < DRAG_PX) return
      const to = ev.altKey ? [Math.round(l.x + dx / zoom), Math.round(l.y + dy / zoom)] : [snap(l.x + dx / zoom), snap(l.y + dy / zoom)]
      d = [to[0] - l.x, to[1] - l.y]
      useCanvasView.setState({ dragShift: { ids: held.map((x) => x.id), dx: d[0], dy: d[1] } })
    }
    const up = async () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      setPressed(false)
      if (d && (d[0] || d[1])) {
        const [dx, dy] = d
        await moveMany(
          kind === 'section' && held.length > 1 ? 'move a section and what is in it' : `move ${kind === 'title' ? 'the title' : `a ${kind}`}`,
          held.map((x) => ({ ref: x.ref, from: { x: x.x, y: x.y }, to: { x: x.x + dx, y: x.y + dy } })),
        ).catch(() => {})
      }
      useCanvasView.setState({ dragShift: null })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  // A width from the right edge (along the text: a turned one's top or bottom), a section's size from its corner:
  // snapped, alt = free, one undo step. A paragraph reading upwards keeps its start (the bottom) where it is.
  const resize = (which: 'w' | 'wh') => (e: ReactPointerEvent<HTMLElement>) => {
    if (!live || !editor || e.button !== 0) return
    e.stopPropagation()
    const [sx, sy] = [e.clientX, e.clientY]
    const w0 = w ?? { paragraph: PARA_W.initial, sticky: STICKY_W.initial, title: TITLE_W.initial, section: 400, heading: 0 }[kind]
    const h0 = h ?? labelBox(l).h
    const lim = kind === 'paragraph' ? PARA_W : kind === 'sticky' ? STICKY_W : kind === 'title' ? TITLE_W : { min: SECTION_MIN.w, max: 100000 }
    let to: { w?: number; h?: number; y?: number } | null = null
    const move = (ev: PointerEvent) => {
      const at = (v: number) => (ev.altKey ? Math.round(v) : snap(v))
      const [dx, dy] = [(ev.clientX - sx) / zoom, (ev.clientY - sy) / zoom]
      const edge = turn === 90 ? l.y + w0 - at(l.y + dy) : turn === -90 ? at(l.y + w0 + dy) - l.y : at(l.x + w0 + dx) - l.x
      const nw = Math.min(lim.max, Math.max(lim.min, edge))
      to =
        which === 'w'
          ? { w: nw, ...(turn === 90 && { y: l.y + w0 - nw }) }
          : { w: nw, h: Math.max(SECTION_MIN.h, at(l.y + h0 + dy) - l.y) }
      setHeld(to)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (to) void updateLabel(wid, l, to).catch(() => setHeld(null))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const edit = live && editor ? () => useCanvasView.setState({ labelEditing: l.id, labelSelected: l.id }) : undefined
  const color = COLOR_VAR[l.color ?? (kind === 'sticky' ? 'yellow' : 'ink')]
  const style: CSSProperties = {
    left: l.x + (shift?.dx ?? 0),
    top: y + (shift?.dy ?? 0),
    ['--tone' as string]: color,
    fontWeight: l.bold ? 700 : undefined,
    fontStyle: l.italic ? 'italic' : undefined,
  }
  const common = {
    'data-target': `label:${l.id}`,
    'data-selected': selected || undefined,
    'data-pressed': pressed || undefined,
    'data-live': live || undefined,
    'data-caps': l.caps || undefined,
    'data-colored': !!l.color || undefined,
    // A width being dragged: its strip in its colour.
    'data-resizing': !!held || undefined,
  }
  const marks = (
    <>
      <i className={styles.mark} data-corner="nw" aria-hidden />
      <i className={styles.mark} data-corner="ne" aria-hidden />
      <i className={styles.mark} data-corner="se" aria-hidden />
      <i className={styles.mark} data-corner="sw" aria-hidden />
      {live && <PeerRing id={l.id} space={l.pieceId} />}
      {live && <ThreadChip wid={wid} thread={threadOn(threads, l.id)} zoom={zoom} />}
    </>
  )
  const bar = selected && editor && kind !== 'title' ? <LabelBar l={l} zoom={zoom} /> : null

  if (kind === 'section') {
    // Its name is set like a heading (D-130, D-157), whatever the frame's size, into the top edge or up the left one,
    // the line breaking round it; a number (its small line) before it only when someone typed one.
    const size = headingSize(l)
    const px = HEADING_PX[size]
    const inset = 28 + px * 0.4
    const gap = px * 0.35
    const kick = kickerParts(l.kicker)
    const num = kick ? [kick.num, kick.rest].filter(Boolean).join(' ') : ''
    const onLeft = l.side === 'left'
    return (
      <div className={styles.section} data-side={onLeft ? 'left' : 'top'} style={{ ...style, width: w, height: h, fontWeight: undefined, fontStyle: undefined }} {...common}>
        {(['n', 'e', 's', 'w'] as const).map((side) => (
          <span key={side} className={styles.band} data-side={side} onPointerDown={press} onDoubleClick={edit} />
        ))}
        <div className={styles.secEdge} style={onLeft ? { width: h } : undefined}>
          <span className={styles.secLine} style={{ flex: `0 0 ${Math.max(0, inset - gap)}px` }} />
          <span
            className={styles.secName}
            style={{ padding: `0 ${gap}px`, fontSize: px, fontWeight: l.bold ? 700 : undefined, fontStyle: l.italic ? 'italic' : undefined, letterSpacing: tracking(l, size) }}
            onPointerDown={press}
            onDoubleClick={edit}
          >
            {typing ? (
              <NamedFields l={l} kick={l.kicker ?? ''} kickSize={secKickPx(px)} row />
            ) : (
              <>
                {num && (
                  <span className={styles.secNum} style={{ fontSize: secKickPx(px), marginRight: px * 0.3 }}>
                    {num}
                  </span>
                )}
                <span className={styles.secText} data-empty={!l.text || undefined}>
                  {l.text || 'Section'}
                </span>
              </>
            )}
          </span>
          <span className={styles.secLine} style={{ flex: '1 1 0' }} />
        </div>
        {live && editor && <span className={styles.corner} onPointerDown={resize('wh')} aria-hidden />}
        {marks}
        {bar}
      </div>
    )
  }

  if (kind === 'title')
    return <TitleBlock l={l} style={style} common={common} press={press} edit={edit} typing={typing} editor={editor} zoom={zoom} w={w ?? TITLE_W.initial} marks={marks} resize={live && editor ? resize('w') : undefined} />

  if (kind === 'sticky') {
    // Signed along its top (D-158): the writer's first name and how long ago, three little checks in its colour.
    const who = (l.author ?? 'someone').split(/\s+/)[0].toUpperCase()
    return (
      <div className={styles.sticky} style={{ ...style, width: w ?? STICKY_W.initial, fontSize: STICKY_PX[l.scale ?? 'medium'] }} {...common} onPointerDown={press} onDoubleClick={edit}>
        <span className={styles.stickyHead}>
          <span>
            {who} · {ago(l.createdAt)}
          </span>
          <Checks />
        </span>
        {typing ? <Field l={l} /> : <div className={styles.stickyText}>{l.text ? <LightMarkdown text={l.text} mark="•" /> : <span className={styles.empty}>a note</span>}</div>}
        {live && editor && <span className={styles.edge} onPointerDown={resize('w')} aria-hidden />}
        {marks}
        {bar}
      </div>
    )
  }

  if (kind === 'paragraph') {
    const pw = w ?? PARA_W.initial
    return (
      <div className={styles.para} style={{ ...style, fontSize: PARA_PX[l.scale ?? 'large'], ...(turn ? turnedBox : { width: pw }) }} {...common} onPointerDown={press} onDoubleClick={edit}>
        <div ref={body} className={styles.body} data-turn={turn} style={{ width: pw }}>
          {typing ? <Field l={l} /> : l.text ? <LightMarkdown text={l.text} mark="•" /> : <span className={styles.empty}>a paragraph</span>}
          {live && editor && <span className={styles.edge} onPointerDown={resize('w')} aria-hidden />}
        </div>
        {marks}
        {bar}
      </div>
    )
  }

  const size = headingSize(l)
  const px = HEADING_PX[size]
  const kick = kickerParts(l.kicker)
  return (
    <div className={styles.heading} data-size={size} style={{ ...style, fontSize: px, letterSpacing: tracking(l, size), ...turnedBox }} {...common} onPointerDown={press} onDoubleClick={edit}>
      <div ref={body} className={styles.body} data-turn={turn}>
        {typing ? (
          <NamedFields l={l} kick={l.kicker ?? ''} kickSize={kickPx(px)} />
        ) : (
          <>
            {kick && <Kicker kick={kick} size={kickPx(px)} hidden={kickPx(px) * zoom < MIN_TEXT_PX} />}
            <span className={styles.headText} data-empty={!l.text || undefined}>
              {l.text || 'heading'}
            </span>
          </>
        )}
        {size === 'heading' && <span className={styles.rule} style={{ height: Math.max(1, px * 0.028) }} aria-hidden />}
      </div>
      {marks}
      {bar}
    </div>
  )
}

// A sticky note's mark: three little checks, like ▚▚▚, in its colour (each two squares corner to corner).
function Checks() {
  const c = 2.8
  return (
    <svg className={styles.checks} viewBox={`${-c * 7.2} ${-c} ${c * 7.2} ${c * 2}`} width={c * 7.2} height={c * 2} aria-hidden>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={-i * c * 2.6 - c} y={-c} width={c} height={c} />
          <rect x={-i * c * 2.6 - c * 2} y={0} width={c} height={c} />
        </g>
      ))}
    </svg>
  )
}

// A heading's small line (D-156): its number in the accent (or the heading's colour), the rest small mono capitals.
function Kicker({ kick, size, hidden }: { kick: { num: string; rest: string }; size: number; hidden: boolean }) {
  return (
    <span className={styles.kicker} style={{ fontSize: size, visibility: hidden ? 'hidden' : undefined }}>
      {kick.num && <span className={styles.kickNum}>{kick.num}</span>}
      {kick.rest && <span className={styles.kickRest}>{kick.num ? `── ${kick.rest}` : kick.rest}</span>}
    </span>
  )
}

// Typing a heading with its small line over it, or a section's name with its number before it (`row`); Tab moves
// between the two. Enter or leaving both keeps them, Escape puts them back. A heading left empty goes away; a section
// may have no name.
function NamedFields({ l, kick, kickSize, row }: { l: Label; kick: string; kickSize: number; row?: boolean }) {
  const { wid } = useWs()
  const [text, setText] = useState(l.text)
  const [k, setK] = useState(kick)
  const root = useRef<HTMLSpanElement>(null)
  const main = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  useEffect(() => {
    main.current?.focus()
    main.current?.select()
  }, [])
  const finish = (keep: boolean) => {
    if (done.current) return
    done.current = true
    useCanvasView.setState({ labelEditing: null })
    const heading = kindOf(l) === 'heading'
    const t = (keep ? text : l.text).trim()
    if (!t && heading) return void deleteLabel(wid, l)
    if (!keep) return
    const kk = k.trim()
    const nextKick = kk || undefined
    const patch: Partial<Label> = {}
    if (t !== l.text) patch.text = t
    if (nextKick !== l.kicker) patch.kicker = nextKick
    if (Object.keys(patch).length) void updateLabel(wid, l, patch, 'text')
  }
  const onKeyDown = (e: ReactKeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter') (e.preventDefault(), finish(true))
    if (e.key === 'Escape') finish(false)
  }
  return (
    <span
      ref={root}
      className={styles.fields}
      data-row={row || undefined}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={(e) => {
        if (!root.current?.contains(e.relatedTarget as Node)) finish(true)
      }}
    >
      <input
        className={`${styles.field} ${styles.kickField}`}
        style={{ fontSize: kickSize, ...(row ? { marginRight: kickSize * 0.7 } : {}) }}
        value={k}
        maxLength={KICKER_MAX}
        placeholder={row ? '01' : '01 small line'}
        size={Math.max(k.length, row ? 2 : 13) + 1}
        aria-label={row ? 'Number before the name' : 'Small line over the heading'}
        onChange={(e) => setK(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <input
        ref={main}
        className={styles.field}
        value={text}
        maxLength={textMax(l)}
        placeholder={row ? 'Section' : 'heading'}
        size={Math.max(text.length, 6) + 1}
        aria-label={row ? 'Section name' : 'heading text'}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
      />
    </span>
  )
}

// Typing into a paragraph or a sticky note: ⌘Enter or leaving keeps it, Escape puts it back. A paragraph left empty
// goes away.
function Field({ l }: { l: Label }) {
  const { wid } = useWs()
  const [draft, setDraft] = useState(l.text)
  const ref = useRef<HTMLTextAreaElement>(null)
  const done = useRef(false)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  // As tall as what's in it.
  useEffect(() => {
    const el = ref.current
    if (el) {
      el.style.height = '0px'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [draft])
  const finish = (keep: boolean) => {
    if (done.current) return
    done.current = true
    useCanvasView.setState({ labelEditing: null })
    const text = (keep ? draft : l.text).trim()
    if (!text && kindOf(l) === 'paragraph') return void deleteLabel(wid, l)
    if (text !== l.text) void updateLabel(wid, l, { text }, 'text')
  }
  return (
    <textarea
      ref={ref}
      className={styles.field}
      rows={1}
      value={draft}
      maxLength={textMax(l)}
      // What an empty one shows, so typing into it looks the same.
      placeholder={kindOf(l) === 'sticky' ? 'a note' : 'Text: **bold**, *italic*, - bullets'}
      aria-label={`${kindOf(l)} text`}
      onChange={(e) => setDraft(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) (e.preventDefault(), finish(true))
        if (e.key === 'Escape') finish(false)
      }}
    />
  )
}

// The fonts' own metrics, once they're in, for laying out the title.
function useFontsReady() {
  const [ready, setReady] = useState(() => document.fonts.status === 'loaded')
  useEffect(() => {
    let on = true
    void document.fonts.ready.then(() => on && setReady(true))
    return () => {
      on = false
    }
  }, [])
  return ready
}

// The app's mark: a four-pointed star.
function Star({ style }: { style: CSSProperties }) {
  return (
    <svg className={styles.star} style={style} viewBox="-1 -1 2 2" aria-hidden>
      <path d="M0 -1 L0.2 -0.2 L1 0 L0.2 0.2 L0 1 L-0.2 0.2 L-1 0 L-0.2 -0.2 Z" />
    </svg>
  )
}

// The project title (D-118, D-132): the workspace's name and what it's building, edited in place (the same fields as
// Settings); the north star and PROJECT over them, a rule (a magenta lead, then a hairline), corner brackets that are
// its hover and selection marks; its right edge sets its width. Too far out to read the description it folds (320 ms,
// eased both ends): the caption, rule and description go, the star moves beside the name, and the name grows into the
// room they leave, as big as fits without breaking a word.
type TitleProps = {
  l: Label
  style: CSSProperties
  common: object
  press: (e: ReactPointerEvent<HTMLElement>) => void
  edit?: () => void
  typing: boolean
  editor: boolean
  zoom: number
  w: number
  marks: ReactNode
  resize?: (e: ReactPointerEvent<HTMLElement>) => void
}

function TitleBlock({ l, style, common, press, edit, typing, editor, zoom, w, marks, resize }: TitleProps) {
  const { wid, workspace } = useWs()
  const reduced = useMotion((s) => s.reduced)
  const fonts = useFontsReady()
  const description = workspace.description ?? ''
  // Editors see where to write it; viewers see nothing until someone has.
  const about = description || (editor ? ABOUT_HINT : null)
  const lay = useMemo(() => titleLayout(workspace.name, about, w), [workspace.name, about, w, fonts])
  const folded = T.desc * zoom < FOLD_BELOW_PX && !typing
  const r = folded ? foldStar(lay.fold) : T.star
  // The star's centre: in the caption, or beside the name's first line.
  const [cx, cy] = folded ? [r, (lay.fold * T.nameLead) / 2] : [T.star, T.caption / 2]
  return (
    <div
      className={styles.title}
      style={{ ...style, width: w, padding: T.pad, fontWeight: undefined, fontStyle: undefined }}
      {...common}
      data-folded={folded || undefined}
      data-reduced={reduced || undefined}
      onPointerDown={press}
      onDoubleClick={edit}
      data-id={l.id}
    >
      {/* Drawn at the caption's size and moved by transform only, so the fold animates without layout. */}
      <Star style={{ transform: `translate(${T.pad + cx - r}px, ${T.pad + cy - r}px) scale(${r / T.star})` }} />
      <div className={styles.fold}>
        <div>
          <span className={styles.titleKick} style={{ fontSize: T.caption, lineHeight: `${T.caption}px`, paddingLeft: T.star * 2 + 13 }}>
            PROJECT
          </span>
          <i className={styles.spacer} style={{ height: T.gap }} />
        </div>
      </div>
      {typing ? (
        <TitleFields wid={wid} name={workspace.name} description={description} />
      ) : (
        <>
          <h2 className={styles.titleName} style={{ fontSize: folded ? lay.fold : T.name, paddingLeft: folded ? foldIndent(lay.fold) : 0 }}>
            {workspace.name}
          </h2>
          <div className={styles.fold}>
            <div>
              <i className={styles.spacer} style={{ height: T.gap }} />
              <span className={styles.titleRule} style={{ height: T.rule }} aria-hidden />
              {about !== null && (
                <>
                  <i className={styles.spacer} style={{ height: T.gap }} />
                  <p className={styles.titleAbout} data-empty={!description || undefined} style={{ width: `${DESC_SHARE * 100}%` }}>
                    {about}
                  </p>
                </>
              )}
            </div>
          </div>
        </>
      )}
      {(['nw', 'ne', 'se', 'sw'] as const).map((c) => (
        <i key={c} className={styles.bracket} data-corner={c} style={{ width: T.arm, height: T.arm }} aria-hidden />
      ))}
      {resize && <span className={styles.edge} onPointerDown={resize} aria-hidden />}
      {marks}
    </div>
  )
}

function TitleFields({ wid, name, description }: { wid: string; name: string; description: string }) {
  const [n, setN] = useState(name)
  const [d, setD] = useState(description)
  const root = useRef<HTMLDivElement>(null)
  const about = useRef<HTMLTextAreaElement>(null)
  useEffect(() => root.current?.querySelector('input')?.focus(), [])
  // As tall as what's written, like the line it stands in for.
  useEffect(() => {
    const el = about.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [d])
  const keep = () => {
    if (n.trim() && n.trim() !== name) void renameWorkspace(wid, n.trim())
    if (d.trim() !== description) void describeWorkspace(wid, d)
  }
  return (
    <div
      ref={root}
      className={styles.titleFields}
      onPointerDown={(e) => e.stopPropagation()}
      // Leaving both fields keeps them.
      onBlur={(e) => {
        if (root.current?.contains(e.relatedTarget as Node)) return
        keep()
        useCanvasView.setState({ labelEditing: null })
      }}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') useCanvasView.setState({ labelEditing: null })
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') (e.target as HTMLElement).blur()
      }}
    >
      {/* Laid out as it reads (name, rule, what it's building), so typing doesn't change how it looks. */}
      <input className={`${styles.field} ${styles.titleName}`} style={{ fontSize: T.name }} aria-label="Workspace name" value={n} maxLength={80} onChange={(e) => setN(e.target.value)} />
      <i className={styles.spacer} style={{ height: T.gap }} />
      <span className={styles.titleRule} style={{ height: T.rule }} aria-hidden />
      <i className={styles.spacer} style={{ height: T.gap }} />
      <textarea
        ref={about}
        className={`${styles.field} ${styles.titleAbout}`}
        style={{ width: `${DESC_SHARE * 100}%` }}
        aria-label="What we're building"
        rows={1}
        value={d}
        maxLength={DESCRIPTION_MAX}
        placeholder={ABOUT_HINT}
        onChange={(e) => setD(e.target.value)}
      />
    </div>
  )
}

const SCALES: [TextScale, string][] = [['small', 'S'], ['medium', 'M'], ['large', 'L']]
const SIZES: [HeadingSize, string][] = [['heading', 'H1'], ['subheading', 'H2'], ['minor', 'H3']]
// A quarter turn either way (D-156): ↺ reads upwards, ↻ downwards; pressed again, it's level again.
const TURNS: [90 | -90, string, string][] = [
  [90, '↺', 'turn left: reads upwards'],
  [-90, '↻', 'turn right: reads downwards'],
]
// Where a section's name sits (D-157): in the top edge, or up the left one.
const SIDES: ['top' | 'left', string, string][] = [
  ['top', '⌐ top', 'name in the top edge'],
  ['left', '⌊ left', 'name up the left edge'],
]

// Under the selected one, at the screen's own size: how it's set (a terminal line, like a plane's console). A heading
// or section name: H1–H3, B/I/AA; a paragraph or sticky note: S/M/L; a paragraph B/I/AA too. Headings and paragraphs
// turn; a section's name goes in the top or left edge. Then its colour, edit (rename) and delete.
function LabelBar({ l, zoom }: { l: Label; zoom: number }) {
  const { wid } = useWs()
  const kind = kindOf(l)
  const set = (patch: Parameters<typeof updateLabel>[2]) => void updateLabel(wid, l, patch)
  const scale = l.scale ?? (kind === 'sticky' ? 'medium' : 'large')
  const named = kind === 'heading' || kind === 'section'
  const sizes = named ? SIZES : kind === 'paragraph' || kind === 'sticky' ? SCALES : []
  return (
    <div className={styles.bar} style={{ transform: `scale(${1 / zoom})` }} onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      {sizes.map(([s, name]) => (
        <button
          key={s}
          className={styles.tool}
          aria-pressed={named ? headingSize(l) === s : scale === s}
          onClick={() => set(named ? { size: s as HeadingSize } : { scale: s as TextScale })}
        >
          {name}
        </button>
      ))}
      {kind !== 'sticky' && (
        <>
          <span className={styles.rule2} />
          <button className={styles.tool} aria-pressed={!!l.bold} title="bold" style={{ fontWeight: 700 }} onClick={() => set({ bold: l.bold ? undefined : true })}>
            B
          </button>
          <button className={styles.tool} aria-pressed={!!l.italic} title="italic" style={{ fontStyle: 'italic' }} onClick={() => set({ italic: l.italic ? undefined : true })}>
            I
          </button>
          <button className={styles.tool} aria-pressed={!!l.caps} title="capitals" onClick={() => set({ caps: l.caps ? undefined : true })}>
            AA
          </button>
        </>
      )}
      {(kind === 'heading' || kind === 'paragraph') && (
        <>
          <span className={styles.rule2} />
          {TURNS.map(([t, glyph, name]) => (
            <button key={t} className={styles.tool} aria-pressed={l.rotate === t} aria-label={name} title={name} onClick={() => set({ rotate: l.rotate === t ? undefined : t })}>
              {glyph}
            </button>
          ))}
        </>
      )}
      {kind === 'section' && (
        <>
          <span className={styles.rule2} />
          {SIDES.map(([s, glyph, name]) => (
            <button key={s} className={styles.tool} aria-pressed={(l.side ?? 'top') === s} title={name} onClick={() => set({ side: s === 'left' ? 'left' : undefined })}>
              {glyph}
            </button>
          ))}
        </>
      )}
      <span className={styles.rule2} />
      {LABEL_COLORS.filter((c) => kind !== 'sticky' || c !== 'ink').map((c) => (
        <button
          key={c}
          className={styles.dot}
          style={{ background: COLOR_VAR[c] }}
          aria-label={c}
          title={c}
          aria-pressed={(l.color ?? (kind === 'sticky' ? 'yellow' : 'ink')) === c}
          onClick={() => set({ color: c === 'ink' && kind !== 'sticky' ? undefined : c })}
        />
      ))}
      <span className={styles.rule2} />
      <button className={styles.tool} title="or double-click it" onClick={() => useCanvasView.setState({ labelEditing: l.id })}>
        {kind === 'section' ? 'rename' : 'edit'}
      </button>
      <button className={styles.tool} data-tone="danger" title={kind === 'section' ? 'delete (Delete); what it holds stays' : 'delete (Delete)'} onClick={() => void deleteLabel(wid, l)}>
        delete
      </button>
    </div>
  )
}

// Who's writing: a sticky note is signed with their name as it is now.
export function useAuthor() {
  const { user } = useAuth()
  return { uid: user?.id, author: user?.name || user?.email || 'someone' }
}
