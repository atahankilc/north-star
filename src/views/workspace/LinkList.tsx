// A node's connections to anything in the workspace, plus a picker to add one (any type ↔ any type): `+ link` opens a
// dropdown with a search box and the matches, like the tag picker's list (D-093).
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { createEdge, deleteEdge, linked, updateEdge } from '../../data/edges'
import { FOR, type NodeType } from '../../data/model'
import { floatFrom, type Floating } from '../../ui/floating'
import { Select } from '../../ui/Select'
import { KindOption } from '../canvas/LinkBar'
import { EDGE_KINDS } from '../canvas/linkKinds'
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
            if (target) void createEdge(wid, { id: nodeId, type: nodeType }, { id, type: target.type })
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
            <li key={edge.id} className={styles.link}>
              <span className={styles.arrow}>{outgoing ? '→' : '←'}</span>
              <button className={styles.linkTitle} data-nav onClick={() => other && navigate(other.path)} title={other?.title}>
                {other && other.type !== nodeType && <span className={styles.type}>{TYPE_LABELS[other.type]} · </span>}
                {other?.title ?? 'Missing'}
              </button>
              <Select
                className={styles.kind}
                value={edge.kind}
                options={EDGE_KINDS.map((k) => ({ value: k, label: <KindOption kind={k} /> }))}
                onChange={(kind) => void updateEdge(wid, edge.id, { kind })}
                ariaLabel="Link type"
              />
              <button className={styles.unlink} onClick={() => void deleteEdge(wid, edge.id)} aria-label="Remove link">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
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
