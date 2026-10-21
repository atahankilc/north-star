// Text anywhere in the workspace (D-188), drawn in its space's px (the canvas's world, or a plane's view). Headings
// (H1–H3, an H1 with a rule fading right), paragraphs (light Markdown at a width), sticky notes (signed, a colour bar),
// sections (a frame holding what's inside it, its number and name set into its top edge) and the project title (the
// workspace's name and what it's building). Live, a click selects (corner marks), a drag moves (5 px first, snapped,
// alt = free; a section carries what's inside it), a double-click types, a right edge sets a width, a section's corner
// its size; a small bar under the selected one sets it. Frames are drawn under everything else, text over it.
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { DocumentReference } from 'firebase/firestore'
import { useAuth } from '../../data/auth'
import { snap } from '../../data/grid'
import {
  deleteLabel,
  HEADING_PX,
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
import { LightMarkdown } from '../../ui/LightMarkdown'
import { useWs } from './context'
import styles from './TextItems.module.css'
import { PeerRing } from './collab'
import { ThreadChip, threadOn } from './Threads'

const DRAG_PX = 5

// Something else in the space a section can carry: a plane on the canvas, a card on a plane.
export type Carried = { id: string; ref: DocumentReference; x: number; y: number; w: number; h: number }

export const COLOR_VAR: Record<LabelColor, string> = {
  ink: 'var(--fg-strong)',
  magenta: 'var(--accent-magenta)',
  cyan: 'var(--accent-cyan)',
  yellow: 'var(--accent-yellow)',
  green: 'var(--accent-green)',
  blue: 'var(--accent-blue)',
}

// Roughly where it sits, for what a section holds and what fit frames.
export function labelBox(l: Label) {
  const k = kindOf(l)
  const lines = Math.max(1, l.text.split('\n').length)
  if (k === 'section') return { x: l.x, y: l.y, w: l.w ?? 400, h: l.h ?? 300 }
  if (k === 'paragraph') return { x: l.x, y: l.y, w: l.w ?? PARA_W.initial, h: lines * PARA_PX[l.scale ?? 'large'] * 1.55 + 8 }
  if (k === 'sticky') return { x: l.x, y: l.y, w: l.w ?? STICKY_W.initial, h: 48 + lines * STICKY_PX[l.scale ?? 'medium'] * 1.45 }
  if (k === 'title') return { x: l.x, y: l.y, w: l.w ?? TITLE_W.initial, h: 160 }
  const px = HEADING_PX[(l.size as Exclude<LabelSize, 'note'>) ?? 'heading'] ?? 48
  return { x: l.x, y: l.y, w: Math.max(4, l.text.length) * px * 0.55, h: px * 1.3 }
}

const inside = (b: { x: number; y: number; w: number; h: number }, s: { x: number; y: number; w: number; h: number }) =>
  b.x >= s.x && b.y >= s.y && b.x + b.w <= s.x + s.w && b.y + b.h <= s.y + s.h

type Props = { labels: Label[]; layer: 'frames' | 'text'; live: boolean; editor: boolean; zoom: number; carry: Carried[] }

export function TextItems({ labels, layer, live, editor, zoom, carry }: Props) {
  const shown = labels.filter((l) => (kindOf(l) === 'section') === (layer === 'frames'))
  // Sections are numbered in the order they were made, per space.
  const order = labels.filter((l) => kindOf(l) === 'section').sort((a, b) => a.createdAt - b.createdAt).map((l) => l.id)
  return (
    <>
      {shown.map((l) => (
        <LabelItem key={l.id} l={l} n={order.indexOf(l.id) + 1} live={live} editor={editor} zoom={zoom} labels={labels} carry={carry} />
      ))}
    </>
  )
}

type ItemProps = { l: Label; n: number; live: boolean; editor: boolean; zoom: number; labels: Label[]; carry: Carried[] }

function LabelItem({ l, n, live, editor, zoom, labels, carry }: ItemProps) {
  const { wid, threads } = useWs()
  const kind = kindOf(l)
  const selected = useCanvasView((s) => live && s.labelSelected === l.id)
  const typing = useCanvasView((s) => live && editor && s.labelEditing === l.id)
  const shift = useCanvasView((s) => (s.dragShift && s.dragShift.ids.includes(l.id) ? s.dragShift : null))
  // A new size, held until the data's back.
  const [held, setHeld] = useState<{ w?: number; h?: number } | null>(null)
  useEffect(() => {
    if (held && (held.w === undefined || held.w === l.w) && (held.h === undefined || held.h === l.h)) setHeld(null)
  }, [held, l.w, l.h])
  const w = held?.w ?? l.w
  const h = held?.h ?? l.h

  const select = () => useCanvasView.setState({ labelSelected: l.id, cardSelected: null, selected: null })

  // Press and drag: moves it (a section with what's inside it), one undo step.
  const press = (e: ReactPointerEvent<HTMLElement>) => {
    if (!live || e.button !== 0) return
    e.stopPropagation()
    select()
    if (!editor || typing) return
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

  // A width from the right edge, a section's size from its corner: snapped, alt = free, one undo step.
  const resize = (which: 'w' | 'wh') => (e: ReactPointerEvent<HTMLElement>) => {
    if (!live || !editor || e.button !== 0) return
    e.stopPropagation()
    const [sx, sy] = [e.clientX, e.clientY]
    const box = labelBox(l)
    const [w0, h0] = [w ?? box.w, h ?? box.h]
    const lim = kind === 'paragraph' ? PARA_W : kind === 'sticky' ? STICKY_W : kind === 'title' ? TITLE_W : { min: SECTION_MIN.w, max: 100000 }
    let to: { w?: number; h?: number } | null = null
    const move = (ev: PointerEvent) => {
      const at = (v: number) => (ev.altKey ? Math.round(v) : snap(v))
      const nw = Math.min(lim.max, Math.max(lim.min, at(l.x + w0 + (ev.clientX - sx) / zoom) - l.x))
      to = which === 'w' ? { w: nw } : { w: nw, h: Math.max(SECTION_MIN.h, at(l.y + h0 + (ev.clientY - sy) / zoom) - l.y) }
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
    top: l.y + (shift?.dy ?? 0),
    ['--tone' as string]: color,
    fontWeight: l.bold ? 700 : undefined,
    fontStyle: l.italic ? 'italic' : undefined,
  }
  const common = {
    'data-target': `label:${l.id}`,
    'data-selected': selected || undefined,
    'data-live': live || undefined,
    'data-caps': l.caps || undefined,
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
    const name = (
      <span className={styles.secName} onPointerDown={press} onDoubleClick={edit}>
        <span className={styles.secNum}>{String(n).padStart(2, '0')}</span>
        {typing ? <Field l={l} single /> : <span data-empty={!l.text || undefined}>{l.text || 'section'}</span>}
      </span>
    )
    return (
      <div className={styles.section} style={{ ...style, width: w, height: h, fontWeight: undefined, fontStyle: undefined }} {...common}>
        {(['n', 'e', 's', 'w'] as const).map((side) => (
          <span key={side} className={styles.band} data-side={side} onPointerDown={press} onDoubleClick={edit} />
        ))}
        {name}
        {selected && editor && <span className={styles.corner} onPointerDown={resize('wh')} aria-hidden />}
        {marks}
        {bar}
      </div>
    )
  }

  if (kind === 'title') return <TitleBlock l={l} style={style} common={common} press={press} edit={edit} typing={typing} w={w ?? TITLE_W.initial} marks={marks} resize={selected && editor ? resize('w') : undefined} />

  if (kind === 'sticky') {
    const date = new Date(l.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    return (
      <div className={styles.sticky} style={{ ...style, width: w ?? STICKY_W.initial, fontSize: STICKY_PX[l.scale ?? 'medium'] }} {...common} onPointerDown={press} onDoubleClick={edit}>
        <span className={styles.stickyHead}>
          {l.author ?? 'someone'} · {date}
        </span>
        {typing ? <Field l={l} /> : <div className={styles.stickyText}>{l.text ? <LightMarkdown text={l.text} /> : <span className={styles.empty}>a note</span>}</div>}
        {selected && editor && <span className={styles.edge} onPointerDown={resize('w')} aria-hidden />}
        {marks}
        {bar}
      </div>
    )
  }

  if (kind === 'paragraph') {
    return (
      <div className={styles.para} style={{ ...style, width: w ?? PARA_W.initial, fontSize: PARA_PX[l.scale ?? 'large'] }} {...common} onPointerDown={press} onDoubleClick={edit}>
        {typing ? <Field l={l} /> : l.text ? <LightMarkdown text={l.text} /> : <span className={styles.empty}>a paragraph</span>}
        {selected && editor && <span className={styles.edge} onPointerDown={resize('w')} aria-hidden />}
        {marks}
        {bar}
      </div>
    )
  }

  const size = (l.size as Exclude<LabelSize, 'note'>) ?? 'heading'
  return (
    <div className={styles.heading} data-size={size} style={{ ...style, fontSize: HEADING_PX[size] }} {...common} onPointerDown={press} onDoubleClick={edit}>
      {typing ? <Field l={l} single /> : <span data-empty={!l.text || undefined}>{l.text || 'heading'}</span>}
      {size === 'heading' && <span className={styles.rule} aria-hidden />}
      {marks}
      {bar}
    </div>
  )
}

// Typing into it: Enter (a heading's, a section's name; ⌘Enter in a paragraph or note) or leaving keeps it, Escape puts
// it back. A heading or paragraph left empty goes away.
function Field({ l, single }: { l: Label; single?: boolean }) {
  const { wid } = useWs()
  const [draft, setDraft] = useState(l.text)
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null)
  const done = useRef(false)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  // A text area as tall as what's in it.
  useEffect(() => {
    const el = ref.current
    if (el && !single) {
      el.style.height = '0px'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [draft, single])
  const finish = (keep: boolean) => {
    if (done.current) return
    done.current = true
    useCanvasView.setState({ labelEditing: null })
    const text = (keep ? draft : l.text).trim()
    const kind = kindOf(l)
    if (!text && (kind === 'heading' || kind === 'paragraph')) return void deleteLabel(wid, l)
    if (text !== l.text) void updateLabel(wid, l, { text }, 'text')
  }
  const props = {
    ref,
    className: styles.field,
    value: draft,
    maxLength: textMax(l),
    // What an empty one shows, so typing into it looks the same.
    placeholder: { heading: 'heading', paragraph: 'a paragraph', sticky: 'a note', section: 'section', title: '' }[kindOf(l)],
    'aria-label': `${kindOf(l)} text`,
    onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
    onPointerDown: (e: ReactPointerEvent) => e.stopPropagation(),
    onBlur: () => finish(true),
    onKeyDown: (e: ReactKeyboardEvent) => {
      e.stopPropagation()
      if (e.key === 'Enter' && (single || e.metaKey || e.ctrlKey)) (e.preventDefault(), finish(true))
      if (e.key === 'Escape') finish(false)
    },
  }
  return single ? <input {...props} size={Math.max(draft.length, 6) + 1} /> : <textarea {...props} rows={1} />
}

// The project title (D-118): the workspace's name and what it's building, edited in place (the same fields as
// Settings), a star and PROJECT over them, a rule, corner brackets; its right edge sets its width.
type TitleProps = {
  l: Label
  style: CSSProperties
  common: object
  press: (e: ReactPointerEvent<HTMLElement>) => void
  edit?: () => void
  typing: boolean
  w: number
  marks: ReactNode
  resize?: (e: ReactPointerEvent<HTMLElement>) => void
}

function TitleBlock({ l, style, common, press, edit, typing, w, marks, resize }: TitleProps) {
  const { wid, workspace } = useWs()
  return (
    <div className={styles.title} style={{ ...style, width: w }} {...common} onPointerDown={press} onDoubleClick={edit} data-id={l.id}>
      <span className={styles.titleKick}>✦ PROJECT</span>
      {typing ? (
        <TitleFields wid={wid} name={workspace.name} description={workspace.description ?? ''} />
      ) : (
        <>
          <h2 className={styles.titleName}>{workspace.name}</h2>
          <span className={styles.titleRule} aria-hidden />
          <p className={styles.titleAbout} data-empty={!workspace.description || undefined}>
            {workspace.description || "what we're building"}
          </p>
        </>
      )}
      {(['nw', 'ne', 'se', 'sw'] as const).map((c) => (
        <i key={c} className={styles.bracket} data-corner={c} aria-hidden />
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
      <input className={`${styles.field} ${styles.titleName}`} aria-label="Workspace name" value={n} maxLength={80} onChange={(e) => setN(e.target.value)} />
      <span className={styles.titleRule} aria-hidden />
      <textarea
        ref={about}
        className={`${styles.field} ${styles.titleAbout}`}
        aria-label="What we're building"
        rows={1}
        value={d}
        maxLength={DESCRIPTION_MAX}
        placeholder="what we're building"
        onChange={(e) => setD(e.target.value)}
      />
    </div>
  )
}

const SCALES: [TextScale, string][] = [['small', 'S'], ['medium', 'M'], ['large', 'L']]
const SIZES: [Exclude<LabelSize, 'note'>, string][] = [['heading', 'H1'], ['subheading', 'H2'], ['minor', 'H3']]

// Under the selected one, at the screen's own size: how it's set (a terminal line, like a plane's console).
function LabelBar({ l, zoom }: { l: Label; zoom: number }) {
  const { wid } = useWs()
  const kind = kindOf(l)
  const set = (patch: Parameters<typeof updateLabel>[2]) => void updateLabel(wid, l, patch)
  const scale = l.scale ?? (kind === 'sticky' ? 'medium' : 'large')
  return (
    <div className={styles.bar} style={{ transform: `scale(${1 / zoom})` }} onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      {kind === 'heading' &&
        SIZES.map(([s, name]) => (
          <button key={s} className={styles.tool} aria-pressed={(l.size ?? 'heading') === s} onClick={() => set({ size: s })}>
            {name}
          </button>
        ))}
      {(kind === 'paragraph' || kind === 'sticky') &&
        SCALES.map(([s, name]) => (
          <button key={s} className={styles.tool} aria-pressed={scale === s} onClick={() => set({ scale: s })}>
            {name}
          </button>
        ))}
      {(kind === 'heading' || kind === 'paragraph') && (
        <>
          <span className={styles.rule2} />
          <button className={styles.tool} aria-pressed={!!l.bold} style={{ fontWeight: 700 }} onClick={() => set({ bold: l.bold ? undefined : true })}>
            B
          </button>
          <button className={styles.tool} aria-pressed={!!l.italic} style={{ fontStyle: 'italic' }} onClick={() => set({ italic: l.italic ? undefined : true })}>
            I
          </button>
          {kind === 'heading' && (
            <button className={styles.tool} aria-pressed={!!l.caps} onClick={() => set({ caps: l.caps ? undefined : true })}>
              AA
            </button>
          )}
        </>
      )}
      <span className={styles.rule2} />
      {LABEL_COLORS.map((c) => (
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
      <button className={styles.tool} data-tone="danger" title="delete (Delete)" onClick={() => void deleteLabel(wid, l)}>
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
