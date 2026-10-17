// A competitor's profile in the board's side panel (D-038, D-040): details, plus its features grouped by category.
import { AnimatePresence } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { WithId } from '../../data/hooks'
import type { Competitor, CompetitorFeature } from '../../data/model'
import { createNode, deleteNode, updateNode } from '../../data/nodes'
import { useCanvas } from '../../state/canvasStore'
import { Appear } from '../../ui/Appear'
import { AsciiButton } from '../../ui/AsciiButton'
import { AutosaveField } from '../../ui/AutosaveField'
import { useWs } from '../workspace/context'
import { LinkList } from '../workspace/LinkList'
import styles from './CompetitorProfile.module.css'

const UNCATEGORIZED = 'uncategorized'

// `children` sits between the facts and the features (domain and customer pickers).
export function CompetitorProfile({ competitor, children }: { competitor: WithId<Competitor>; children?: ReactNode }) {
  const { wid } = useWs()
  const select = useCanvas((s) => s.select)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (fields: Partial<Competitor>) => void updateNode(wid, 'competitor', competitor.id, fields)
  const opt = (key: keyof Competitor) => (v: string) => set({ [key]: v.trim() ? v : undefined })

  useEffect(() => {
    if (!confirmDelete) return
    const t = window.setTimeout(() => setConfirmDelete(false), 3000)
    return () => window.clearTimeout(t)
  }, [confirmDelete])

  const href = safeUrl(competitor.url)

  return (
    <div className={styles.profile}>
      <header className={styles.head}>
        <div className={styles.kickerRow}>
          <span className={styles.kicker}>competitor</span>
          <button className={styles.close} onClick={() => select(null)} aria-label="Close panel">
            [×]
          </button>
        </div>
        <AutosaveField
          className={styles.name}
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
      <Field label="description" value={competitor.description} onSave={opt('description')} placeholder="What they do" multiline />
      <Field label="notes" value={competitor.notes} onSave={opt('notes')} placeholder="Strengths, weaknesses, reviews" multiline />

      {children}

      <Features competitorId={competitor.id} />

      <LinkList nodeId={competitor.id} nodeType="competitor" hint="Link this competitor to ideas or features." />

      <footer className={styles.foot}>
        <span className={styles.meta}>added {new Date(competitor.createdAt).toLocaleDateString()}</span>
        <AsciiButton
          accent={confirmDelete ? 'magenta' : 'yellow'}
          onClick={() => {
            if (!confirmDelete) return setConfirmDelete(true)
            select(null)
            void deleteNode(wid, 'competitor', competitor.id)
          }}
        >
          {confirmDelete ? 'Confirm delete' : 'Delete competitor'}
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

function Features({ competitorId }: { competitorId: string }) {
  const { wid, competitorFeatures } = useWs()
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState<string | null>(null)
  const features = competitorFeatures.filter((f) => f.competitorId === competitorId)
  const listId = `categories-${competitorId}`

  // `?f=<id>` (from a link elsewhere) opens that feature.
  useEffect(() => {
    const id = params.get('f')
    if (!id) return
    setOpen(id)
    requestAnimationFrame(() => document.getElementById(`cf-${id}`)?.scrollIntoView({ block: 'center' }))
    setParams(
      (p) => {
        p.delete('f')
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (fields: Partial<CompetitorFeature>) => void updateNode(wid, 'competitorFeature', feature.id, fields)
  const links = edges.filter((e) => e.fromId === feature.id || e.toId === feature.id).length

  return (
    <li id={`cf-${feature.id}`} className={styles.row} data-open={open}>
      <div className={styles.rowHead}>
        <button className={styles.toggle} onClick={onToggle} aria-expanded={open} aria-label={`Details for ${feature.name || 'feature'}`}>
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
                accent={confirmDelete ? 'magenta' : 'yellow'}
                onClick={() => {
                  if (!confirmDelete) {
                    setConfirmDelete(true)
                    window.setTimeout(() => setConfirmDelete(false), 3000)
                    return
                  }
                  void deleteNode(wid, 'competitorFeature', feature.id)
                }}
              >
                {confirmDelete ? 'Confirm delete' : 'Delete'}
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
