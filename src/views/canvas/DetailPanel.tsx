// Side panel for the selected card: all editing happens here, in the DOM (D-009). Competitors show their profile (D-040).
import { AnimatePresence } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { WithId } from '../../data/hooks'
import {
  BOARD_TYPES,
  FEATURE_EFFORTS,
  FEATURE_PRIORITIES,
  FEATURE_STATUSES,
  type BoardNode,
  type Feature,
} from '../../data/model'
import { updateNode } from '../../data/nodes'
import { useCanvas } from '../../state/canvasStore'
import { AsciiButton } from '../../ui/AsciiButton'
import { Appear } from '../../ui/Appear'
import { Choice } from '../../ui/Choice'
import { CompetitorProfile } from '../competitors/CompetitorProfile'
import { CriteriaEditor } from '../matrix/Criteria'
import { FocusButton } from './focus'
import { useWs } from '../workspace/context'
import { Attachments } from '../workspace/Attachments'
import { ForPicker } from '../workspace/ItemPickers'
import { ItemTags } from '../workspace/ItemTags'
import { PeersHere } from '../workspace/PeersHere'
import { LinkList } from '../workspace/LinkList'
import { removeItem, removeSelection } from '../workspace/useEditKeys'
import { useViewer } from '../workspace/viewerLock'
import { retagMany } from '../../data/selection'
import { TagInput } from '../../ui/TagInput'
import { useAutoGrow } from '../../ui/autoGrow'
import { align, space, type Align } from './arrange'
import { duplicateSelection } from './clipboard'
import { BOARD_KINDS, TYPE_ACCENT, useAllTags, type BoardItem } from './boardKinds'
import { TAG_HINT } from './tags'
import styles from './DetailPanel.module.css'

const SAVE_AFTER_MS = 400

type Draft = { title: string; body: string }

const toDraft = (n: BoardNode): Draft => ({ title: n.title, body: n.body ?? '' })


type CardType = Exclude<BoardItem['type'], 'competitor'>

// Every board item, so a selected card hidden by a filter change keeps its panel.
export function DetailPanel({ items }: { items: BoardItem[] }) {
  const ws = useWs()
  const selectedId = useCanvas((s) => s.selectedId)
  const many = useCanvas((s) => s.selection.length > 1)
  // A competitor's feature chip on the board opens its competitor, with that feature unfolded (D-058).
  const feature = ws.competitorFeatures.find((f) => f.id === selectedId)
  const item = items.find((n) => n.id === (feature ? feature.competitorId : selectedId))
  const docs = { customer: ws.customers, problem: ws.problems, idea: ws.ideas, feature: ws.features }
  const competitor = item?.type === 'competitor' ? ws.competitors.find((c) => c.id === item.id) : undefined
  const node = item && item.type !== 'competitor' ? (docs[item.type] as WithId<BoardNode>[]).find((n) => n.id === item.id) : undefined

  return (
    <AnimatePresence>
      {many && (
        <Appear as="aside" key="many" className={styles.panel} data-side-panel="narrow" aria-label="Selection">
          <SelectionPanel items={items} />
        </Appear>
      )}
      {!many && item && (competitor || node) && (
        <Appear
          as="aside"
          key="panel"
          className={styles.panel}
          data-wide={Boolean(competitor)}
          data-side-panel={competitor ? 'wide' : 'narrow'}
          aria-label={`${BOARD_KINDS[item.type].label} details`}
        >
          <PeersHere itemId={item.id} />
          {competitor ? (
            <CompetitorProfile key={item.id} competitor={competitor} focusFeature={feature?.id}>
              <div className={styles.pickers}>
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
  const { wid } = useWs()
  const select = useCanvas((s) => s.select)
  const [draft, setDraft] = useState<Draft>(() => toDraft(node))
  const focused = useRef<keyof Draft | null>(null)
  const pending = useRef<Partial<BoardNode>>({})
  const timer = useRef<number | undefined>(undefined)
  const titleRef = useRef<HTMLTextAreaElement>(null)
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

  const bodyRef = useRef<HTMLTextAreaElement>(null)
  useAutoGrow(titleRef, draft.title)
  useAutoGrow(bodyRef, draft.body)

  const flush = () => {
    window.clearTimeout(timer.current)
    if (Object.keys(pending.current).length === 0) return
    void updateNode(wid, type, node.id, pending.current)
    pending.current = {}
  }
  useEffect(() => flush, []) // eslint-disable-line react-hooks/exhaustive-deps

  const edit = (field: keyof Draft, value: string) => {
    setDraft((d) => ({ ...d, [field]: value }))
    pending.current[field] = value
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

  return (
    <div className={styles.inner}>
      <header className={styles.head}>
        <span className={styles.kicker}>{kind.label}</span>
        <span className={styles.headActions}>
          <FocusButton wid={wid} id={item.id} />
          <button className={styles.close} onClick={() => select(null)} aria-label="Close panel">
            [×]
          </button>
        </span>
      </header>

      <textarea
        ref={titleRef}
        className={styles.title}
        rows={1}
        placeholder="Untitled"
        {...field('title')}
        // A title is one line of text, only wrapped: Enter finishes it, pasted line breaks become spaces.
        onChange={(e) => edit('title', e.target.value.replace(/\s*\n\s*/g, ' '))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
      />

      <div className={styles.pickers}>
        {type === 'feature' && <FeatureFields wid={wid} feature={node as WithId<Feature>} />}
        {type !== 'customer' && <ForPicker item={item} />}
      </div>

      <label className={styles.label}>
        notes
        <textarea ref={bodyRef} className={styles.body} rows={6} placeholder={kind.placeholder} {...field('body')} />
      </label>

      <div className={styles.label}>
        tags
        <ItemTags item={item} />
        <span className={styles.hint}>{TAG_HINT}</span>
      </div>

      <Attachments node={{ id: node.id, type }} />

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
          {/* Undoable, so one click (Q-013). */}
          <AsciiButton
            accent="yellow"
            onClick={() => {
              flush()
              removeItem(wid, type, node.id, draft.title)
            }}
          >
            delete
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
      {/* What it must do: the matrix scores competitors against these (D-133). */}
      <CriteriaEditor feature={feature} />
    </>
  )
}

// Lining a selection up (D-124): one row per axis, then spacing out evenly (three or more).
const LINE_UP: { axis: 0 | 1; align: [Align, string][]; space: string }[] = [
  { axis: 0, align: [['left', 'left'], ['centre', 'centre'], ['right', 'right']], space: 'space ↔' },
  { axis: 1, align: [['top', 'top'], ['middle', 'middle'], ['bottom', 'bottom']], space: 'space ↕' },
]

// Several things selected (D-108): what they are, tags they share (add or remove on all), line up, duplicate, delete.
function SelectionPanel({ items }: { items: BoardItem[] }) {
  const ws = useWs()
  const selection = useCanvas((s) => s.selection)
  const viewer = useViewer((s) => s.viewer)
  const cards = items.filter((i) => selection.includes(i.id))
  const labels = ws.labels.filter((l) => selection.includes(l.id) && l.kind !== 'section')
  const sections = ws.labels.filter((l) => selection.includes(l.id) && l.kind === 'section')
  const shared = cards.length ? cards[0].tags.filter((t) => cards.every((c) => c.tags.includes(t))) : []
  const suggestions = useAllTags(items).map((t) => t.tag)
  const counts = BOARD_TYPES.map((t) => [t, cards.filter((c) => c.type === t).length] as const).filter(([, n]) => n > 0)

  return (
    <div className={styles.inner}>
      <header className={styles.head}>
        <span className={styles.kicker}>{selection.length} selected</span>
        <button className={styles.close} onClick={() => useCanvas.getState().select(null)} aria-label="Close panel">
          [×]
        </button>
      </header>

      <ul className={styles.many}>
        {counts.map(([t, n]) => (
          <li key={t} style={{ ['--tone' as string]: TYPE_ACCENT[t] }}>
            <span className={styles.manyMark} aria-hidden>▌</span>
            {n} {n === 1 ? BOARD_KINDS[t].label : BOARD_KINDS[t].plural}
          </li>
        ))}
        {labels.length > 0 && (
          <li>
            <span className={styles.manyMark} aria-hidden>T</span>
            {labels.length} text{labels.length === 1 ? '' : 's'}
          </li>
        )}
        {/* Sections (D-130) move what they hold along. */}
        {sections.length > 0 && (
          <li>
            <span className={styles.manyMark} aria-hidden>⬚</span>
            {sections.length} section{sections.length === 1 ? '' : 's'}
          </li>
        )}
      </ul>

      {cards.length > 0 && !viewer && (
        <div className={styles.label}>
          tags on all {cards.length}
          <TagInput
            label="Tags on every selected card"
            value={shared}
            suggestions={suggestions}
            onChange={(next) =>
              void retagMany(
                ws.wid,
                cards.map((c) => ({ kind: c.type, id: c.id, tags: c.tags })),
                next.filter((t) => !shared.includes(t)),
                shared.filter((t) => !next.includes(t)),
              )
            }
          />
          <span className={styles.hint}>Adding a tag here adds it to every selected card; × takes it off all of them.</span>
        </div>
      )}

      {!viewer && (
        <div className={styles.label}>
          line up
          {LINE_UP.map((row) => (
            <span key={row.axis} className={styles.lineUp}>
              {row.align.map(([how, name]) => (
                <button key={how} className={styles.small} onClick={() => align(ws.wid, how)}>
                  {name}
                </button>
              ))}
              <button
                className={styles.small}
                disabled={selection.length < 3}
                title={selection.length < 3 ? 'Select three or more to space them out' : undefined}
                onClick={() => space(ws.wid, row.axis)}
              >
                {row.space}
              </button>
            </span>
          ))}
        </div>
      )}

      <p className={styles.hint}>
        Drag any of them to move them together; the arrow keys nudge them (shift: further). Shift+click adds or takes one out; alt+drag on the board draws a box.
        {!viewer && ' ⌘C copies, ⌘V pastes, ⌘D duplicates.'}
      </p>

      {!viewer && (
        <footer className={styles.foot}>
          <span className={styles.meta} />
          <span className={styles.actions}>
            <AsciiButton accent="cyan" onClick={() => void duplicateSelection(ws)}>
              duplicate
            </AsciiButton>
            <AsciiButton accent="yellow" onClick={() => removeSelection(ws, selection)}>
              delete
            </AsciiButton>
          </span>
        </footer>
      )}
    </div>
  )
}
