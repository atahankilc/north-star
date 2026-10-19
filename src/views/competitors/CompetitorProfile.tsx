// A competitor's profile in the board's side panel (D-038, D-040): details, plus its features grouped by category.
import { AnimatePresence } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { WithId } from '../../data/hooks'
import type { Competitor, CompetitorFeature } from '../../data/model'
import { createNode, deleteNode, updateNode } from '../../data/nodes'
import { useHistory } from '../../data/history'
import { useCanvas } from '../../state/canvasStore'
import { isReducedMotion } from '../../state/motion'
import { Appear } from '../../ui/Appear'
import { AsciiButton } from '../../ui/AsciiButton'
import { AutosaveField } from '../../ui/AutosaveField'
import { Attachments } from '../workspace/Attachments'
import { useWs } from '../workspace/context'
import { TAG_HINT } from '../canvas/tags'
import { TagInput } from '../../ui/TagInput'
import { cleanRegion, useRegionSuggestions } from './regions'
import { FocusButton } from '../canvas/focus'
import { ItemTags } from '../workspace/ItemTags'
import { LinkList } from '../workspace/LinkList'
import { removeItem, UNDO_HINT } from '../workspace/useEditKeys'
import styles from './CompetitorProfile.module.css'

const UNCATEGORIZED = 'uncategorized'

// `children` sits between the facts and the features (the customer picker).
export function CompetitorProfile({
  competitor,
  focusFeature,
  children,
}: {
  competitor: WithId<Competitor>
  // Unfold and scroll to this feature (its chip was clicked on the board).
  focusFeature?: string
  children?: ReactNode
}) {
  const { wid, competitors } = useWs()
  const select = useCanvas((s) => s.select)
  const regionSuggestions = useRegionSuggestions(competitors)
  const set = (fields: Partial<Competitor>) => void updateNode(wid, 'competitor', competitor.id, fields)
  const opt = (key: keyof Competitor) => (v: string) => set({ [key]: v.trim() ? v : undefined })

  const href = safeUrl(competitor.url)

  return (
    <div className={styles.profile}>
      <header className={styles.head}>
        <div className={styles.kickerRow}>
          <span className={styles.kicker}>competitor</span>
          <span className={styles.headActions}>
            <FocusButton wid={wid} id={competitor.id} />
            <button className={styles.close} onClick={() => select(null)} aria-label="Close panel">
              [×]
            </button>
          </span>
        </div>
        <AutosaveField
          className={styles.name}
          wrap
          label="Competitor name"
          placeholder="Competitor name"
          value={competitor.name}
          onSave={(name) => set({ name: name.trim() })}
          autoFocus={!competitor.name}
        />
        <div className={styles.urlRow}>
          <AutosaveField
            className={styles.url}
            label="Website"
            placeholder="https://"
            inputMode="url"
            value={competitor.url ?? ''}
            onSave={opt('url')}
          />
          {href && (
            <a className={styles.visit} href={href} target="_blank" rel="noopener noreferrer">
              visit ↗
            </a>
          )}
        </div>
      </header>

      <div className={styles.facts}>
        <Field label="pricing" value={competitor.pricing} onSave={opt('pricing')} placeholder="$20 / seat / month" />
        <Field label="audience" value={competitor.audience} onSave={opt('audience')} placeholder="Who they sell to" />
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>regions</span>
        <TagInput
          label="Regions"
          prefix=""
          placeholder="where they operate, e.g. US, Germany, Europe"
          clean={cleanRegion}
          value={competitor.regions ?? []}
          suggestions={regionSuggestions}
          onChange={(regions) => set({ regions: regions.length ? regions : undefined })}
        />
        <span className={styles.hint}>Where they sell. Filter competitors by region at the top and under the matrix.</span>
      </div>
      <Field label="description" value={competitor.description} onSave={opt('description')} placeholder="What they do" multiline />
      <Field label="notes" value={competitor.notes} onSave={opt('notes')} placeholder="Strengths, weaknesses, reviews" multiline />
      <div className={styles.field}>
        <span className={styles.fieldLabel}>tags</span>
        <ItemTags item={{ id: competitor.id, type: 'competitor', tags: competitor.tags ?? [] }} />
        <span className={styles.hint}>{TAG_HINT}</span>
      </div>

      {children}

      <Features competitorId={competitor.id} focus={focusFeature} />

      <Attachments node={{ id: competitor.id, type: 'competitor' }} />

      <LinkList nodeId={competitor.id} nodeType="competitor" hint="Link this competitor to ideas or features." />

      <footer className={styles.foot}>
        <span className={styles.meta}>added {new Date(competitor.createdAt).toLocaleDateString()}</span>
        {/* Undoable, so one click (Q-013). */}
        <AsciiButton accent="yellow" onClick={() => removeItem(wid, 'competitor', competitor.id, competitor.name)}>
          delete competitor
        </AsciiButton>
      </footer>
    </div>
  )
}

function Field({
  label,
  value,
  onSave,
  placeholder,
  multiline,
}: {
  label: string
  value: string | undefined
  onSave: (v: string) => void
  placeholder: string
  multiline?: boolean
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <AutosaveField
        className={multiline ? styles.textarea : styles.input}
        label={label}
        value={value ?? ''}
        onSave={onSave}
        placeholder={placeholder}
        multiline={multiline}
        rows={3}
      />
    </label>
  )
}

function Features({ competitorId, focus }: { competitorId: string; focus?: string }) {
  const { wid, competitorFeatures } = useWs()
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    if (!focus) return
    setOpen(focus)
    requestAnimationFrame(() => document.getElementById(`cf-${focus}`)?.scrollIntoView({ block: 'center', behavior: isReducedMotion() ? 'auto' : 'smooth' }))
  }, [focus])
  const features = competitorFeatures.filter((f) => f.competitorId === competitorId)
  const listId = `categories-${competitorId}`

  // `?feature=<id>` (from a link elsewhere) opens that feature.
  useEffect(() => {
    const id = params.get('feature')
    if (!id) return
    setOpen(id)
    requestAnimationFrame(() => document.getElementById(`cf-${id}`)?.scrollIntoView({ block: 'center' }))
    setParams(
      (p) => {
        p.delete('feature')
        return p
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const groups = useMemo(() => {
    const map = new Map<string, WithId<CompetitorFeature>[]>()
    for (const f of [...features].sort((a, b) => a.createdAt - b.createdAt)) {
      const key = f.category?.trim() || UNCATEGORIZED
      map.set(key, [...(map.get(key) ?? []), f])
    }
    return [...map.entries()].sort(([a], [b]) => (a === UNCATEGORIZED ? 1 : b === UNCATEGORIZED ? -1 : a.localeCompare(b)))
  }, [features])

  return (
    <div className={styles.features}>
      <span className={styles.fieldLabel}>their features · {features.length}</span>
      <datalist id={listId}>
        {groups.map(([c]) => c !== UNCATEGORIZED && <option key={c} value={c} />)}
      </datalist>

      {groups.map(([category, items]) => (
        <section key={category} className={styles.group}>
          <h3 className={styles.category}>
            <span aria-hidden>─ </span>
            {category}
            <span aria-hidden className={styles.rule} />
          </h3>
          <ul className={styles.rows}>
            {items.map((f) => (
              <FeatureRow
                key={f.id}
                feature={f}
                open={open === f.id}
                onToggle={() => setOpen((o) => (o === f.id ? null : f.id))}
                listId={listId}
              />
            ))}
          </ul>
        </section>
      ))}

      <AddFeature
        listId={listId}
        onAdd={async (name, category) => {
          await createNode(wid, 'competitorFeature', { competitorId, name, ...(category && { category }) })
        }}
      />
    </div>
  )
}

function FeatureRow({
  feature,
  open,
  onToggle,
  listId,
}: {
  feature: WithId<CompetitorFeature>
  open: boolean
  onToggle: () => void
  listId: string
}) {
  const { wid, edges } = useWs()
  const set = (fields: Partial<CompetitorFeature>) => void updateNode(wid, 'competitorFeature', feature.id, fields)
  const links = edges.filter((e) => e.fromId === feature.id || e.toId === feature.id).length

  return (
    <li id={`cf-${feature.id}`} className={styles.row} data-open={open}>
      <div className={styles.rowHead}>
        <button className={styles.toggle} data-nav onClick={onToggle} aria-expanded={open} aria-label={`Details for ${feature.name || 'feature'}`}>
          {open ? '▾' : '▸'}
        </button>
        <AutosaveField
          className={styles.rowName}
          label="Feature name"
          placeholder="Feature"
          value={feature.name}
          onSave={(name) => set({ name: name.trim() })}
        />
        {links > 0 && <span className={styles.linkCount}>{links} ↔</span>}
        <AutosaveField
          className={styles.rowCategory}
          label="Category"
          placeholder="category"
          list={listId}
          value={feature.category ?? ''}
          onSave={(c) => set({ category: c.trim() || undefined })}
        />
      </div>
      <AnimatePresence>
        {open && (
          <Appear key="detail" className={styles.rowDetail}>
            <AutosaveField
              className={styles.textarea}
              label="Description"
              placeholder="How it works, how good it is"
              value={feature.description ?? ''}
              onSave={(d) => set({ description: d.trim() ? d : undefined })}
              multiline
              rows={2}
            />
            <LinkList nodeId={feature.id} nodeType="competitorFeature" hint="Link it to your ideas or features." />
            <div className={styles.rowFoot}>
              <AsciiButton
                accent="yellow"
                onClick={() => {
                  void deleteNode(wid, 'competitorFeature', feature.id)
                  useHistory.getState().say(`Deleted "${feature.name || 'feature'}" · ${UNDO_HINT} to undo`)
                }}
              >
                delete
              </AsciiButton>
            </div>
          </Appear>
        )}
      </AnimatePresence>
    </li>
  )
}

function AddFeature({ listId, onAdd }: { listId: string; onAdd: (name: string, category: string) => Promise<void> }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  return (
    <form
      className={styles.add}
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        const n = name.trim()
        setName('')
        nameRef.current?.focus()
        // The category sticks, so a run of features in one category is quick to type.
        await onAdd(n, category.trim())
      }}
    >
      <span className={styles.plus} aria-hidden>
        +
      </span>
      <input
        ref={nameRef}
        className={styles.rowName}
        placeholder="Add a feature, press Enter"
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="New feature name"
      />
      <input
        className={styles.rowCategory}
        placeholder="category"
        list={listId}
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        aria-label="New feature category"
      />
      {/* Enter in either field submits. */}
      <button type="submit" hidden />
    </form>
  )
}

// Only http(s) links become clickable.
function safeUrl(raw: string | undefined): string | null {
  if (!raw?.trim()) return null
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}
