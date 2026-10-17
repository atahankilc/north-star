// Side panel for the selected card or group: all editing happens here, in the DOM (D-009).
// Competitors show their profile (D-040); groups their name, domain and colour (D-047).
import { AnimatePresence } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { createEdge } from '../../data/edges'
import { updateGroup } from '../../data/groups'
import type { WithId } from '../../data/hooks'
import {
  FEATURE_EFFORTS,
  FEATURE_PRIORITIES,
  FEATURE_STATUSES,
  type BoardNode,
  type Feature,
  type Group,
} from '../../data/model'
import { createBoardNode, updateNode } from '../../data/nodes'
import { useCanvas } from '../../state/canvasStore'
import { AsciiButton } from '../../ui/AsciiButton'
import { Appear } from '../../ui/Appear'
import { AutosaveField } from '../../ui/AutosaveField'
import { Choice } from '../../ui/Choice'
import choice from '../../ui/Choice.module.css'
import { CompetitorProfile } from '../competitors/CompetitorProfile'
import { useWs } from '../workspace/context'
import { DomainPicker, ForPicker } from '../workspace/ItemPickers'
import { LinkList } from '../workspace/LinkList'
import { removeGroup, removeItem } from '../workspace/useEditKeys'
import { BOARD_KINDS, type BoardItem } from './boardKinds'
import { findFreeSpot, IDEA_COLORS } from './cardLayout'
import styles from './DetailPanel.module.css'

const SAVE_AFTER_MS = 400

type Draft = { title: string; body: string; tags: string }

const toDraft = (n: BoardNode): Draft => ({ title: n.title, body: n.body ?? '', tags: (n.tags ?? []).join(', ') })

const parseTags = (s: string) =>
  [...new Set(s.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean))]

type CardType = Exclude<BoardItem['type'], 'competitor'>

// Every board item, so a selected card hidden by a filter change keeps its panel.
export function DetailPanel({ items }: { items: BoardItem[] }) {
  const ws = useWs()
  const selectedId = useCanvas((s) => s.selectedId)
  const item = items.find((n) => n.id === selectedId)
  const docs = { customer: ws.customers, problem: ws.problems, idea: ws.ideas, feature: ws.features }
  const competitor = item?.type === 'competitor' ? ws.competitors.find((c) => c.id === item.id) : undefined
  const node = item && item.type !== 'competitor' ? (docs[item.type] as WithId<BoardNode>[]).find((n) => n.id === item.id) : undefined
  const group = !item ? ws.groups.find((g) => g.id === selectedId) : undefined

  return (
    <AnimatePresence>
      {group && (
        <Appear as="aside" key="group-panel" className={styles.panel} aria-label="Group details">
          <GroupEditor key={group.id} group={group} />
        </Appear>
      )}
      {item && (competitor || node) && (
        <Appear
          as="aside"
          key="panel"
          className={styles.panel}
          data-wide={Boolean(competitor)}
          aria-label={`${BOARD_KINDS[item.type].label} details`}
        >
          {competitor ? (
            <CompetitorProfile key={item.id} competitor={competitor}>
              <div className={styles.pickers}>
                <DomainPicker item={item} />
                <ForPicker item={item} />
              </div>
            </CompetitorProfile>
          ) : (
            node && <NodeEditor key={item.id} item={item} node={node} />
          )}
        </Appear>
      )}
    </AnimatePresence>
  )
}

function NodeEditor({ item, node }: { item: BoardItem; node: WithId<BoardNode> }) {
  const type = item.type as CardType
  const { wid, ideas } = useWs()
  const nodes = useBoardNodes()
  const select = useCanvas((s) => s.select)
  const [draft, setDraft] = useState<Draft>(() => toDraft(node))
  const focused = useRef<keyof Draft | null>(null)
  const pending = useRef<Partial<BoardNode>>({})
  const timer = useRef<number | undefined>(undefined)
  const titleRef = useRef<HTMLInputElement>(null)
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

  // D-037: the idea's text becomes a new feature next to it, in its domain, that remembers where it came from.
  const promote = async () => {
    flush()
    setPromoted(true)
    const [x, y] = findFreeSpot([node.x + 2.7, node.y], nodes)
    const { title, body, tags, color } = { ...node, ...pending.current }
    const domainId = ideas.find((i) => i.id === node.id)?.domainId
    const id = await createBoardNode(
      wid,
      'feature',
      { x, y },
      { title, ...(body && { body }), ...(tags?.length && { tags }), ...(color && { color }), ...(domainId && { domainIds: [domainId] }) },
    )
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

      <div className={styles.pickers}>
        {type === 'feature' && <FeatureFields wid={wid} feature={node as WithId<Feature>} />}
        <DomainPicker item={item} />
        {type !== 'customer' && <ForPicker item={item} />}
      </div>

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

      <LinkList
        nodeId={node.id}
        nodeType={type}
        hint={
          type === 'customer'
            ? 'Tag problems, ideas or competitors with this customer from their panels, or shift + drag them onto this card.'
            : 'Shift + drag from this card onto another to connect them.'
        }
      />

      <footer className={styles.foot}>
        <span className={styles.meta}>created {new Date(node.createdAt).toLocaleDateString()}</span>
        <span className={styles.actions}>
          {type === 'idea' && (
            <AsciiButton accent="cyan" onClick={promote} disabled={promoted}>
              {promoted ? 'Promoted' : 'To feature'}
            </AsciiButton>
          )}
          {/* Undoable, so one click (Q-013). */}
          <AsciiButton
            accent="yellow"
            onClick={() => {
              flush()
              removeItem(wid, type, node.id, draft.title)
            }}
          >
            Delete
          </AsciiButton>
        </span>
      </footer>
    </div>
  )
}

// A frame's name, colour and domain (D-047). Deleting it leaves its cards where they are.
function GroupEditor({ group }: { group: WithId<Group> }) {
  const { wid, domains } = useWs()
  const select = useCanvas((s) => s.select)
  const sorted = [...domains].sort((a, b) => a.createdAt - b.createdAt)

  return (
    <div className={styles.inner}>
      <header className={styles.head}>
        <span className={styles.kicker}>group</span>
        <button className={styles.close} onClick={() => select(null)} aria-label="Close panel">
          [×]
        </button>
      </header>

      <AutosaveField
        className={styles.title}
        label="Group name"
        placeholder="Untitled group"
        value={group.name}
        onSave={(name) => void updateGroup(wid, group.id, { name: name.trim() })}
        autoFocus={!group.name}
      />

      <div className={styles.pickers}>
        <div className={choice.row}>
          <span className={choice.label}>domain</span>
          <span className={choice.options} role="group" aria-label="Domain">
            {sorted.length === 0 && <span className={choice.empty}>none yet: add one with + domain at the top</span>}
            {sorted.map((d) => {
              const on = group.domainId === d.id
              return (
                <button
                  key={d.id}
                  className={choice.option}
                  aria-pressed={on}
                  data-active={on}
                  data-tone=""
                  style={{ ['--tone' as string]: 'var(--accent-magenta)' }}
                  onClick={() => void updateGroup(wid, group.id, { domainId: on ? undefined : d.id })}
                >
                  {d.name}
                </button>
              )
            })}
          </span>
        </div>
      </div>

      <div className={styles.label}>
        colour
        <div className={styles.swatches} role="radiogroup" aria-label="Group colour">
          {IDEA_COLORS.map((c) => {
            const active = (group.color ?? IDEA_COLORS[0].value) === c.value
            return (
              <button
                key={c.name}
                role="radio"
                aria-checked={active}
                aria-label={c.name}
                className={styles.swatch}
                data-active={active}
                style={{ ['--swatch' as string]: c.value }}
                onClick={() => void updateGroup(wid, group.id, { color: c.name === 'none' ? undefined : c.value })}
              />
            )
          })}
        </div>
      </div>

      <p className={styles.hint}>Drag the label to move the group with everything inside it. Drag the corner to resize.</p>

      <footer className={styles.foot}>
        <span className={styles.meta}>created {new Date(group.createdAt).toLocaleDateString()}</span>
        <AsciiButton accent="yellow" onClick={() => removeGroup(wid, group.id, group.name)}>
          Delete group
        </AsciiButton>
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

// Positions of every card, for placing a promoted feature without overlap.
function useBoardNodes() {
  const { customers, problems, ideas, features, competitors } = useWs()
  return [...customers, ...problems, ...ideas, ...features, ...competitors.map((c) => ({ x: c.x ?? 0, y: c.y ?? 0 }))]
}
