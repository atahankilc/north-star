// A node's connections to anything in the workspace, plus a picker to add one (any type ↔ any type).
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createEdge, deleteEdge, linked, updateEdge } from '../../data/edges'
import { FOR, type EdgeKind, type NodeType } from '../../data/model'
import { useWs } from './context'
import { TYPE_LABELS, useNodeIndex } from './nodeIndex'
import styles from './LinkList.module.css'

const EDGE_KINDS: EdgeKind[] = ['relates', 'solves', 'competes-with', 'depends-on', 'part-of', 'inspired-by', 'contradicts', FOR]
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
      <div className={styles.head}>
        links
        <button className={styles.add} onClick={() => setPicking((p) => !p)} aria-expanded={picking}>
          {picking ? 'done' : '+ link'}
        </button>
      </div>

      {picking && (
        <Picker
          onPick={(id) => {
            const target = index.get(id)
            if (target) void createEdge(wid, { id: nodeId, type: nodeType }, { id, type: target.type })
          }}
          exclude={(id) => id === nodeId || linked(edges, nodeId, id)}
        />
      )}

      {links.length === 0 && !picking ? (
        hint && <p className={styles.hint}>{hint}</p>
      ) : (
        <ul className={styles.links}>
          {links.map(({ edge, other, outgoing }) => (
            <li key={edge.id} className={styles.link}>
              <span className={styles.arrow}>{outgoing ? '→' : '←'}</span>
              <button className={styles.linkTitle} onClick={() => other && navigate(other.path)} title={other?.title}>
                {other && other.type !== nodeType && <span className={styles.type}>{TYPE_LABELS[other.type]} · </span>}
                {other?.title ?? 'Missing'}
              </button>
              <select
                className={styles.kind}
                value={edge.kind}
                onChange={(e) => void updateEdge(wid, edge.id, { kind: e.target.value })}
                aria-label="Link type"
              >
                {EDGE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
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

function Picker({ onPick, exclude }: { onPick: (id: string) => void; exclude: (id: string) => boolean }) {
  const index = useNodeIndex()
  const [q, setQ] = useState('')

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return [...index.values()]
      .filter((n) => !exclude(n.id))
      .filter((n) => !needle || n.title.toLowerCase().includes(needle) || TYPE_LABELS[n.type].includes(needle))
      .slice(0, MAX_RESULTS)
  }, [index, q, exclude])

  return (
    <div>
      <input
        autoFocus
        className={styles.search}
        placeholder="Search customers, problems, ideas, competitors, features"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) onPick(results[0].id)
          e.stopPropagation()
        }}
        aria-label="Find something to link"
      />
      <ul className={styles.results}>
        {results.map((n) => (
          <li key={n.id}>
            <button className={styles.result} onClick={() => onPick(n.id)}>
              <span className={styles.type}>{TYPE_LABELS[n.type]}</span>
              {n.title}
            </button>
          </li>
        ))}
        {results.length === 0 && <li className={styles.hint}>Nothing to link{q && ` matching "${q}"`}</li>}
      </ul>
    </div>
  )
}
