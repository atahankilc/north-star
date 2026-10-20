// A node's connections to anything in the workspace, plus a picker to add one (any type ↔ any type): `+ link` opens a
// dropdown with a search box and the matches, like the tag picker's list (D-093). Each row edits the link like its bar on
// the board: kind, label, reverse, remove. A link just added is marked, lit on the board, its label field ready (D-154).
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { createEdge, deleteEdge, linked, reverseEdge, updateEdge } from '../../data/edges'
import type { WithId } from '../../data/hooks'
import { FOR, type Edge, type NodeType } from '../../data/model'
import { useCanvas } from '../../state/canvasStore'
import { floatFrom, type Floating } from '../../ui/floating'
import { Select } from '../../ui/Select'
import { KindOption } from '../canvas/LinkBar'
import { EDGE_KINDS, LINK_TONE, linkStyle } from '../canvas/linkKinds'
import { useWs } from './context'
import { TYPE_LABELS, useNodeIndex } from './nodeIndex'
import styles from './LinkList.module.css'

const MAX_RESULTS = 8

type Props = {
  nodeId: string
  nodeType: NodeType
  hint?: string
}

export function LinkList({ nodeId, nodeType, hint }: Props) {
  const { wid, edges } = useWs()
  const index = useNodeIndex()
  const navigate = useNavigate()
  const [picking, setPicking] = useState(false)
  // The link just added here, until its label field is left.
  const [fresh, setFresh] = useState<string | null>(null)
  // Nothing stays lit on the board once the panel goes.
  useEffect(() => () => useCanvas.getState().setLitEdge(null), [])
  const head = useRef<HTMLDivElement>(null)
  const addButton = useRef<HTMLButtonElement>(null)

  // Customer tags have their own "for" row in the panel; a customer lists everything tagged for it here.
  const links = edges
    .filter((e) => e.fromId === nodeId || e.toId === nodeId)
    .filter((e) => e.kind !== FOR || nodeType === 'customer')
    .map((e) => {
      const otherId = e.fromId === nodeId ? e.toId : e.fromId
      return { edge: e, other: index.get(otherId), outgoing: e.fromId === nodeId }
    })

  return (
    <div className={styles.section}>
      <div ref={head} className={styles.head}>
        links
        <button ref={addButton} className={styles.add} onClick={() => setPicking((p) => !p)} aria-expanded={picking} aria-haspopup="listbox">
          + link
        </button>
      </div>

      {picking && (
        <Picker
          anchor={head}
          onPick={(id) => {
            const target = index.get(id)
            if (target) {
              const made = createEdge(wid, { id: nodeId, type: nodeType }, { id, type: target.type })
              setFresh(made)
              useCanvas.getState().setLitEdge(made)
            }
            setPicking(false)
          }}
          onClose={(refocus) => {
            setPicking(false)
            if (refocus) addButton.current?.focus()
          }}
          exclude={(id) => id === nodeId || linked(edges, nodeId, id)}
        />
      )}

      {links.length === 0 ? (
        hint && <p className={styles.hint}>{hint}</p>
      ) : (
        <ul className={styles.links}>
          {links.map(({ edge, other, outgoing }) => (
            <LinkRow
              key={edge.id}
              wid={wid}
              edge={edge}
              outgoing={outgoing}
              title={other && other.type !== nodeType ? `${TYPE_LABELS[other.type]} · ` : ''}
              name={other?.title ?? 'Missing'}
              onOpen={() => other && navigate(other.path)}
              fresh={edge.id === fresh}
              onSettled={() => {
                setFresh(null)
                if (useCanvas.getState().litEdge === edge.id) useCanvas.getState().setLitEdge(null)
              }}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

// One link: where it goes, its kind, reverse, remove; under it, its own label. Hovering it lights its line on the board.
function LinkRow({
  wid,
  edge,
  outgoing,
  title,
  name,
  onOpen,
  fresh,
  onSettled,
}: {
  wid: string
  edge: WithId<Edge>
  outgoing: boolean
  title: string
  name: string
  onOpen: () => void
  fresh: boolean
  onSettled: () => void
}) {
  const [draft, setDraft] = useState(edge.label ?? '')
  useEffect(() => setDraft(edge.label ?? ''), [edge.label])
  const row = useRef<HTMLLIElement>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!fresh) return
    row.current?.scrollIntoView({ block: 'nearest' })
    input.current?.focus({ preventScroll: true })
  }, [fresh])

  const saveLabel = () => {
    const next = draft.trim()
    if (next !== (edge.label ?? '')) void updateEdge(wid, edge.id, { label: next || undefined })
  }
  const lit = (on: boolean) => {
    if (fresh) return
    const { litEdge, setLitEdge } = useCanvas.getState()
    if (on) setLitEdge(edge.id)
    else if (litEdge === edge.id) setLitEdge(null)
  }

  return (
    <li
      ref={row}
      className={styles.link}
      data-fresh={fresh}
      style={{ ['--tone' as string]: LINK_TONE[linkStyle(edge.kind).group] }}
      onMouseEnter={() => lit(true)}
      onMouseLeave={() => lit(false)}
    >
      <span className={styles.arrow}>{outgoing ? '→' : '←'}</span>
      <button className={styles.linkTitle} data-nav onClick={onOpen} title={name}>
        {title && <span className={styles.type}>{title}</span>}
        {name}
      </button>
      <Select
        className={styles.kind}
        value={edge.kind}
        options={EDGE_KINDS.map((k) => ({ value: k, label: <KindOption kind={k} /> }))}
        onChange={(kind) => void updateEdge(wid, edge.id, { kind })}
        ariaLabel="Link type"
      />
      {/* A customer tag always points item → customer (D-044). */}
      <button
        className={styles.unlink}
        disabled={edge.kind === FOR}
        onClick={() => void reverseEdge(wid, edge.id, edge)}
        title={edge.kind === FOR ? 'A customer tag always points at the customer' : 'Turn the arrow around'}
        aria-label="Reverse link"
      >
        ⇄
      </button>
      <button className={styles.unlink} onClick={() => void deleteEdge(wid, edge.id)} aria-label="Remove link">
        ×
      </button>
      <input
        ref={input}
        className={styles.label}
        value={draft}
        maxLength={200}
        placeholder="label…"
        aria-label="Link label"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          saveLabel()
          if (fresh) onSettled()
        }}
        onKeyDown={(e) => {
          // Keys stay here: the board's shortcuts and the panel's Escape don't fire.
          e.stopPropagation()
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            setDraft(edge.label ?? '')
            requestAnimationFrame(() => (e.target as HTMLInputElement).blur())
          }
        }}
      />
    </li>
  )
}

// One row's height, the search box and the list's padding: the dropdown's height, to tell whether it fits below.
const ROW = 25
const SEARCH = 40

// The dropdown under the links heading, as wide as the section. Picking links and closes it; Escape or a click outside closes.
function Picker({
  anchor,
  onPick,
  onClose,
  exclude,
}: {
  anchor: RefObject<HTMLDivElement | null>
  onPick: (id: string) => void
  onClose: (refocus: boolean) => void
  exclude: (id: string) => boolean
}) {
  const index = useNodeIndex()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [at, setAt] = useState<Floating | null>(null)
  const box = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return [...index.values()]
      .filter((n) => !exclude(n.id))
      .filter((n) => !needle || n.title.toLowerCase().includes(needle) || TYPE_LABELS[n.type].includes(needle))
      .slice(0, MAX_RESULTS)
  }, [index, q, exclude])

  const place = () => {
    const el = anchor.current
    if (el) setAt(floatFrom(el, { height: SEARCH + MAX_RESULTS * ROW, width: el.getBoundingClientRect().width }))
  }
  useLayoutEffect(place, [anchor])

  useEffect(() => {
    // A click outside closes (the `+ link` button toggles by itself); a scroll or resize moves it along.
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!box.current?.contains(t) && !anchor.current?.contains(t)) onClose(false)
    }
    const onMove = (e: Event) => {
      if (!box.current?.contains(e.target as Node)) place()
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!at) return null
  return createPortal(
    <div ref={box} className={styles.dropdown} style={at.style}>
      <input
        autoFocus
        className={styles.search}
        placeholder="search customers, problems, ideas…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setActive(0)
        }}
        onKeyDown={(e) => {
          // Keys stay here: the board's shortcuts and the panel's Escape don't fire.
          e.stopPropagation()
          if (e.key === 'Enter' && results[active]) onPick(results[active].id)
          else if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(results.length - 1, a + 1)))
          else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(0, a - 1)))
          else if (e.key === 'Escape') (e.preventDefault(), onClose(true))
        }}
        role="combobox"
        aria-expanded
        aria-autocomplete="list"
        aria-label="Find something to link"
      />
      <ul className={styles.results} role="listbox" aria-label="Link to">
        {results.map((n, i) => (
          <li key={n.id} role="option" aria-selected={i === active}>
            <button
              className={styles.result}
              data-active={i === active}
              tabIndex={-1}
              onMouseEnter={() => setActive(i)}
              onClick={() => onPick(n.id)}
            >
              <span className={styles.type}>{TYPE_LABELS[n.type]}</span>
              <span className={styles.resultTitle}>{n.title}</span>
            </button>
          </li>
        ))}
        {results.length === 0 && <li className={styles.none}>nothing to link{q && ` matching "${q}"`}</li>}
      </ul>
    </div>,
    at.host,
  )
}
