// Side panel for the selected idea: all editing happens here, in the DOM (D-009).
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { WithId } from '../../data/hooks'
import { deleteEdge, deleteIdea, updateEdge, updateIdea } from '../../data/ideas'
import type { Edge, EdgeKind, Idea } from '../../data/model'
import { useCanvas } from '../../state/canvasStore'
import { AsciiButton } from '../../ui/AsciiButton'
import { IDEA_COLORS } from './cardLayout'
import styles from './DetailPanel.module.css'

const EDGE_KINDS: EdgeKind[] = ['relates', 'depends-on', 'part-of', 'inspired-by', 'contradicts']
const SAVE_AFTER_MS = 400

type Draft = { title: string; body: string; tags: string }

const toDraft = (i: Idea): Draft => ({ title: i.title, body: i.body ?? '', tags: (i.tags ?? []).join(', ') })

const parseTags = (s: string) =>
  [...new Set(s.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean))]

type Props = {
  wid: string
  ideas: WithId<Idea>[]
  edges: WithId<Edge>[]
}

export function DetailPanel({ wid, ideas, edges }: Props) {
  const selectedId = useCanvas((s) => s.selectedId)
  const idea = ideas.find((i) => i.id === selectedId)

  return (
    <AnimatePresence>
      {idea && (
        <motion.aside
          key="panel"
          className={styles.panel}
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          aria-label="Idea details"
        >
          <IdeaEditor key={idea.id} wid={wid} idea={idea} ideas={ideas} edges={edges} />
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

function IdeaEditor({ wid, idea, ideas, edges }: Props & { idea: WithId<Idea> }) {
  const select = useCanvas((s) => s.select)
  const [draft, setDraft] = useState<Draft>(() => toDraft(idea))
  const focused = useRef<keyof Draft | null>(null)
  const pending = useRef<Partial<Idea>>({})
  const timer = useRef<number | undefined>(undefined)
  const titleRef = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Remote edits flow in, except into the field you're typing in.
  useEffect(() => {
    const remote = toDraft(idea)
    setDraft((d) => {
      const next = { ...d }
      for (const k of Object.keys(remote) as (keyof Draft)[]) if (focused.current !== k) next[k] = remote[k]
      return next
    })
  }, [idea])

  // New, empty ideas open ready to type.
  useEffect(() => {
    if (!idea.title) titleRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const flush = () => {
    window.clearTimeout(timer.current)
    if (Object.keys(pending.current).length === 0) return
    void updateIdea(wid, idea.id, pending.current)
    pending.current = {}
  }
  useEffect(() => flush, []) // eslint-disable-line react-hooks/exhaustive-deps

  const edit = (field: keyof Draft, value: string) => {
    setDraft((d) => ({ ...d, [field]: value }))
    pending.current[field] = (field === 'tags' ? parseTags(value) : value) as never
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, SAVE_AFTER_MS)
  }

  const field = (name: keyof Draft) => ({
    value: draft[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => edit(name, e.target.value),
    onFocus: () => (focused.current = name),
    onBlur: () => {
      focused.current = null
      flush()
    },
  })

  useEffect(() => {
    if (!confirmDelete) return
    const t = window.setTimeout(() => setConfirmDelete(false), 3000)
    return () => window.clearTimeout(t)
  }, [confirmDelete])

  const links = edges
    .filter((e) => e.fromId === idea.id || e.toId === idea.id)
    .map((e) => {
      const otherId = e.fromId === idea.id ? e.toId : e.fromId
      return { edge: e, other: ideas.find((i) => i.id === otherId), outgoing: e.fromId === idea.id }
    })

  return (
    <div className={styles.inner}>
      <header className={styles.head}>
        <span className={styles.kicker}>idea</span>
        <button className={styles.close} onClick={() => select(null)} aria-label="Close panel">
          [×]
        </button>
      </header>

      <input ref={titleRef} className={styles.title} placeholder="Untitled" {...field('title')} />

      <label className={styles.label}>
        notes
        <textarea className={styles.body} rows={6} placeholder="What's the thought?" {...field('body')} />
      </label>

      <label className={styles.label}>
        tags
        <input className={styles.input} placeholder="pricing, onboarding" {...field('tags')} />
      </label>

      <div className={styles.label}>
        colour
        <div className={styles.swatches} role="radiogroup" aria-label="Card colour">
          {IDEA_COLORS.map((c) => {
            const active = (idea.color ?? IDEA_COLORS[0].value) === c.value
            return (
              <button
                key={c.name}
                role="radio"
                aria-checked={active}
                aria-label={c.name}
                className={styles.swatch}
                data-active={active}
                style={{ ['--swatch' as string]: c.value }}
                onClick={() => void updateIdea(wid, idea.id, { color: c.name === 'none' ? undefined : c.value })}
              />
            )
          })}
        </div>
      </div>

      <div className={styles.label}>
        links
        {links.length === 0 ? (
          <p className={styles.hint}>Shift + drag from this card onto another to connect them.</p>
        ) : (
          <ul className={styles.links}>
            {links.map(({ edge, other, outgoing }) => (
              <li key={edge.id} className={styles.link}>
                <span className={styles.arrow}>{outgoing ? '→' : '←'}</span>
                <button className={styles.linkTitle} onClick={() => other && select(other.id)}>
                  {other?.title || 'Untitled'}
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

      <footer className={styles.foot}>
        <span className={styles.meta}>created {new Date(idea.createdAt).toLocaleDateString()}</span>
        <AsciiButton
          accent={confirmDelete ? 'magenta' : 'yellow'}
          onClick={() => {
            if (!confirmDelete) return setConfirmDelete(true)
            select(null)
            void deleteIdea(wid, idea.id)
          }}
        >
          {confirmDelete ? 'Confirm delete' : 'Delete'}
        </AsciiButton>
      </footer>
    </div>
  )
}
