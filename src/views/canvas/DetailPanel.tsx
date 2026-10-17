// Side panel for the selected card: all editing happens here, in the DOM (D-009).
import { AnimatePresence } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { WithId } from '../../data/hooks'
import { createEdge } from '../../data/edges'
import {
  FEATURE_EFFORTS,
  FEATURE_PRIORITIES,
  FEATURE_STATUSES,
  type BoardNode,
  type BoardType,
  type Feature,
} from '../../data/model'
import { createBoardNode, deleteNode, updateNode } from '../../data/nodes'
import { useCanvas } from '../../state/canvasStore'
import { AsciiButton } from '../../ui/AsciiButton'
import { Appear } from '../../ui/Appear'
import { Choice } from '../../ui/Choice'
import { useWs } from '../workspace/context'
import { LinkList } from '../workspace/LinkList'
import { boardCenter } from './Board'
import { BOARD_KINDS } from './boardKinds'
import { findFreeSpot, IDEA_COLORS } from './cardLayout'
import styles from './DetailPanel.module.css'

const SAVE_AFTER_MS = 400

type Draft = { title: string; body: string; tags: string }

const toDraft = (n: BoardNode): Draft => ({ title: n.title, body: n.body ?? '', tags: (n.tags ?? []).join(', ') })

const parseTags = (s: string) =>
  [...new Set(s.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean))]

type Props = {
  type: BoardType
  nodes: WithId<BoardNode>[]
}

export function DetailPanel({ type, nodes }: Props) {
  const selectedId = useCanvas((s) => s.selectedId)
  const node = nodes.find((n) => n.id === selectedId)

  return (
    <AnimatePresence>
      {node && (
        <Appear as="aside" key="panel" className={styles.panel} aria-label={`${BOARD_KINDS[type].label} details`}>
          <NodeEditor key={node.id} type={type} node={node} />
        </Appear>
      )}
    </AnimatePresence>
  )
}

function NodeEditor({ type, node }: { type: BoardType; node: WithId<BoardNode> }) {
  const { wid, features } = useWs()
  const select = useCanvas((s) => s.select)
  const [draft, setDraft] = useState<Draft>(() => toDraft(node))
  const focused = useRef<keyof Draft | null>(null)
  const pending = useRef<Partial<BoardNode>>({})
  const timer = useRef<number | undefined>(undefined)
  const titleRef = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [promoted, setPromoted] = useState(false)
  const kind = BOARD_KINDS[type]

  // Remote edits flow in, except into the field you're typing in.
  useEffect(() => {
    const remote = toDraft(node)
    setDraft((d) => {
      const next = { ...d }
      for (const k of Object.keys(remote) as (keyof Draft)[]) if (focused.current !== k) next[k] = remote[k]
      return next
    })
  }, [node])

  // New, empty cards open ready to type.
  useEffect(() => {
    if (!node.title) titleRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const flush = () => {
    window.clearTimeout(timer.current)
    if (Object.keys(pending.current).length === 0) return
    void updateNode(wid, type, node.id, pending.current)
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

  // D-037: the idea's text becomes a new feature that remembers where it came from.
  const promote = async () => {
    flush()
    setPromoted(true)
    const [x, y] = findFreeSpot(boardCenter(wid, 'feature'), features)
    const { title, body, tags, color } = { ...node, ...pending.current }
    const id = await createBoardNode(wid, 'feature', { x, y }, { title, ...(body && { body }), ...(tags?.length && { tags }), ...(color && { color }) })
    await createEdge(wid, { id, type: 'feature' }, { id: node.id, type: 'idea' }, 'inspired-by')
  }

  return (
    <div className={styles.inner}>
      <header className={styles.head}>
        <span className={styles.kicker}>{kind.label}</span>
        <button className={styles.close} onClick={() => select(null)} aria-label="Close panel">
          [×]
        </button>
      </header>

      <input ref={titleRef} className={styles.title} placeholder="Untitled" {...field('title')} />

      {type === 'feature' && <FeatureFields wid={wid} feature={node as WithId<Feature>} />}

      <label className={styles.label}>
        notes
        <textarea className={styles.body} rows={6} placeholder={kind.placeholder} {...field('body')} />
      </label>

      <label className={styles.label}>
        tags
        <input className={styles.input} placeholder="pricing, onboarding" {...field('tags')} />
      </label>

      <div className={styles.label}>
        colour
        <div className={styles.swatches} role="radiogroup" aria-label="Card colour">
          {IDEA_COLORS.map((c) => {
            const active = (node.color ?? IDEA_COLORS[0].value) === c.value
            return (
              <button
                key={c.name}
                role="radio"
                aria-checked={active}
                aria-label={c.name}
                className={styles.swatch}
                data-active={active}
                style={{ ['--swatch' as string]: c.value }}
                onClick={() => void updateNode(wid, type, node.id, { color: c.name === 'none' ? undefined : c.value })}
              />
            )
          })}
        </div>
      </div>

      <LinkList nodeId={node.id} nodeType={type} hint="Shift + drag from this card onto another to connect them." />

      <footer className={styles.foot}>
        <span className={styles.meta}>created {new Date(node.createdAt).toLocaleDateString()}</span>
        <span className={styles.actions}>
          {type === 'idea' && (
            <AsciiButton accent="cyan" onClick={promote} disabled={promoted}>
              {promoted ? 'Promoted' : 'To feature'}
            </AsciiButton>
          )}
          <AsciiButton
            accent={confirmDelete ? 'magenta' : 'yellow'}
            onClick={() => {
              if (!confirmDelete) return setConfirmDelete(true)
              select(null)
              void deleteNode(wid, type, node.id)
            }}
          >
            {confirmDelete ? 'Confirm delete' : 'Delete'}
          </AsciiButton>
        </span>
      </footer>
    </div>
  )
}

function FeatureFields({ wid, feature }: { wid: string; feature: WithId<Feature> }) {
  const set = (fields: Partial<Feature>) => void updateNode(wid, 'feature', feature.id, fields)
  return (
    <>
      <Choice label="priority" options={FEATURE_PRIORITIES} value={feature.priority} onChange={(priority) => set({ priority })} />
      <Choice label="status" options={FEATURE_STATUSES} value={feature.status} onChange={(status) => set({ status })} />
      <Choice label="effort" options={FEATURE_EFFORTS} value={feature.effort} onChange={(effort) => set({ effort })} />
    </>
  )
}
