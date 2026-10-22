// The card panel's sections that belong to one type (D-221): a competitor's profile and its features (the basic cards
// inside it, by category, a row opening in place), a feature's parent, parts (a tree of `part of`), must-haves, what it
// rests on (and how sure that makes it) and the features of theirs that match it.
import { useRef, useState } from 'react'
import { cardRef, updateCard, type Card } from '../../data/cards'
import {
  addCompetitorFeature,
  AVAILABILITIES,
  matchOurs,
  removeCompetitorFeature,
  updateCompetitorFeature,
  type CompetitorFeature,
  type NewCompetitorFeature,
  CRITERION_SCORES,
  dropCriterionScores,
  scoreCriterion,
} from '../../data/competitorFeatures'
import { deleteField } from 'firebase/firestore'
import { deleteEdge, FOR } from '../../data/edges'
import { mismatch } from '../../data/evidence'
import { useAutoGrow } from '../../ui/autoGrow'
import { PanelSection } from '../../ui/SidePanel'
import { Select } from '../../ui/Select'
import { CardPicker, goToCard, KIND_LABEL, PLACEHOLDER, Pills, useCommit, type P } from './CardPanel'
import { createEdge } from '../../data/edges'
import { useWs } from './context'
import { useCanvasView } from '../../state/canvasView'
import { linkTone } from './PlaneLinks'
import styles from './CardPanel.module.css'

const MAX_CRITERIA = 8

// A text field shown as its value. What's typed is kept only on Enter or on leaving the field (the user: not while
// still typing); Escape puts it back; shift+Enter is a new line where it may have several. Leaving the panel keeps it.
function Field({ value, placeholder, editor, multiline, onSave, link }: { value?: string; placeholder: string; editor: boolean; multiline?: boolean; onSave: (v: string) => void; link?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const { draft, setDraft, commit, revert } = useCommit(value ?? '', (v) => onSave(v.trim()))
  useAutoGrow(ref, draft)
  if (!editor)
    return link && value ? (
      <a className={styles.url} href={/^https?:/.test(value) ? value : `https://${value}`} target="_blank" rel="noreferrer">
        {value} ↗
      </a>
    ) : (
      <span data-empty={!value || undefined} className={styles.fieldText}>
        {value || '—'}
      </span>
    )
  return (
    <textarea
      ref={ref}
      className={`${styles.input} ${styles.field}`}
      data-link={link || undefined}
      rows={1}
      value={draft}
      placeholder={placeholder}
      maxLength={2000}
      onChange={(e) => setDraft(multiline ? e.target.value : e.target.value.replace(/\n/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter' && !(multiline && e.shiftKey)) (e.preventDefault(), e.currentTarget.blur())
        if (e.key === 'Escape') (e.preventDefault(), revert(), requestAnimationFrame(() => ref.current?.blur()))
      }}
    />
  )
}

// A competitor's profile (D-040): what it does, for whom, its price, where it operates (D-145), its site.
export function CompetitorProfile({ n, card, editor }: P) {
  const { wid } = useWs()
  const [region, setRegion] = useState<string | null>(null)
  const regions = card.regions ?? []
  const save = (field: 'description' | 'audience' | 'pricing' | 'url') => (v: string) => void updateCard(wid, card, { [field]: v || undefined }, 'profile of')
  const setRegions = (next: string[]) => void updateCard(wid, card, { regions: next.length ? next : undefined }, 'regions of')
  return (
    <PanelSection n={n} name="profile">
      <div className={styles.plan}>
        <span className={styles.k}>does</span>
        <Field value={card.description} placeholder="what they offer" editor={editor} multiline onSave={save('description')} />
        <span className={styles.k}>for</span>
        <Field value={card.audience} placeholder="who buys it" editor={editor} onSave={save('audience')} />
        <span className={styles.k}>pricing</span>
        <Field value={card.pricing} placeholder="what it costs" editor={editor} onSave={save('pricing')} />
        <span className={styles.k}>where</span>
        <div className={styles.tags}>
          {regions.map((r) => (
            <span key={r} className={styles.chip}>
              {r}
              {editor && (
                <button className={styles.chipX} title="Remove" onClick={() => setRegions(regions.filter((x) => x !== r))}>
                  ×
                </button>
              )}
            </span>
          ))}
          {region !== null ? (
            <input
              className={`${styles.input} ${styles.tagInput}`}
              autoFocus
              placeholder="US, Germany…"
              value={region}
              maxLength={60}
              onChange={(e) => setRegion(e.target.value)}
              onBlur={() => setRegion(null)}
              onKeyDown={(e) => {
                e.stopPropagation()
                const r = region.trim()
                if (e.key === 'Enter' && r) (regions.includes(r) || setRegions([...regions, r]), setRegion(''))
                if (e.key === 'Escape') setRegion(null)
              }}
            />
          ) : (
            editor && (
              <button className={styles.inlineAdd} onClick={() => setRegion('')}>
                region
              </button>
            )
          )}
        </div>
        <span className={styles.k}>site</span>
        <Field value={card.url} placeholder="their website" editor={editor} link onSave={save('url')} />
      </div>
    </PanelSection>
  )
}

// Its features, the basic cards inside it (D-164): by category (grey caps), each row its name and how it's offered, and
// `≈ our …` in cyan when it matches one of ours. A row opens in place for its details, one at a time.
export function CompetitorFeatures({ n, card, cards, editor }: P) {
  const { wid, competitorFeatures, comparisons } = useWs()
  const list = competitorFeatures.filter((f) => f.competitorId === card.id).sort((a, b) => a.createdAt - b.createdAt)
  // One open at a time; a small card inside the competitor on the plane opens its own here (D-225).
  const open = useCanvasView((s) => s.cfOpen)
  const setOpen = (id: string | null) => useCanvasView.setState({ cfOpen: id })
  const [adding, setAdding] = useState(false)
  const ours = (f: CompetitorFeature) => {
    const c = comparisons.find((x) => x.competitorFeatureId === f.id)
    return c ? cards.find((k) => k.id === c.featureId) : undefined
  }
  const groups = new Map<string, CompetitorFeature[]>()
  for (const f of list) groups.set(f.category ?? '', [...(groups.get(f.category ?? '') ?? []), f])
  const order = [...groups.keys()].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
  const matched = list.filter((f) => ours(f)).length
  const categories = order.filter(Boolean)
  return (
    <PanelSection
      n={n}
      name="features"
      count={list.length ? `${list.length}${matched ? ` · ${matched} match ours` : ''}` : undefined}
      add={editor ? { label: 'feature', onClick: () => setAdding(true) } : undefined}
      empty={!list.length && !adding}
    >
      {order.map((cat) => (
        <div key={cat || '-'}>
          {cat && <p className={styles.cat}>{cat}</p>}
          {groups.get(cat)!.map((f) => {
            const o = ours(f)
            return open === f.id ? (
              <FeatureDetails key={f.id} f={f} card={card} cards={cards} ours={o} editor={editor} categories={categories} onClose={() => setOpen(null)} />
            ) : (
              <button key={f.id} className={styles.cf} data-match={!!o || undefined} onClick={() => setOpen(f.id)}>
                <span className={styles.cfName}>{f.name}</span>
                <span className={styles.cfAv}>{f.availability}</span>
                {o && <span className={styles.cfMatch}>≈ our {o.title || 'untitled feature'}</span>}
              </button>
            )
          })}
        </div>
      ))}
      {adding && (
        <NewFeature
          card={card}
          cards={cards}
          categories={categories}
          onDone={(fields, oursId) => {
            setAdding(false)
            if (fields) void addCompetitorFeature(wid, card.id, fields, oursId)
          }}
        />
      )}
    </PanelSection>
  )
}

// Adding one shows the whole of it, as evidence does (the user): its name, about, category (the ones in use offered),
// how it's offered, which of ours it matches, where it was seen. Enter in a line, or `[add]`, adds it.
function NewFeature({ card, cards, categories, onDone }: { card: Card; cards: Card[]; categories: string[]; onDone: (f: NewCompetitorFeature | null, oursId: string | null) => void }) {
  const [f, setF] = useState<NewCompetitorFeature>({ name: '' })
  const [ours, setOurs] = useState('')
  const about = useRef<HTMLTextAreaElement>(null)
  useAutoGrow(about, f.description ?? '')
  const features = cards.filter((c) => c.type === 'feature' && c.pieceId === card.pieceId)
  const add = () => (f.name.trim() ? onDone({ ...f, name: f.name.trim(), category: f.category?.trim() || undefined }, ours || null) : undefined)
  const keys = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter' && !e.shiftKey) (e.preventDefault(), add())
    if (e.key === 'Escape') onDone(null, null)
  }
  return (
    <div className={styles.form}>
      <input className={styles.input} autoFocus placeholder="its name" value={f.name} maxLength={200} onChange={(e) => setF({ ...f, name: e.target.value })} onKeyDown={keys} />
      <div className={styles.plan}>
        <span className={styles.k}>about</span>
        <textarea ref={about} className={styles.input} rows={1} placeholder="what it does" value={f.description ?? ''} maxLength={20000} onChange={(e) => setF({ ...f, description: e.target.value })} onKeyDown={keys} />
        <span className={styles.k}>category</span>
        <div className={styles.cats}>
          <input className={styles.input} placeholder="booking, operations…" value={f.category ?? ''} maxLength={100} onChange={(e) => setF({ ...f, category: e.target.value })} onKeyDown={keys} />
          {categories.length > 0 && (
            <Pills values={categories} value={f.category} editor label="Categories in use" onPick={(v) => setF({ ...f, category: v })} />
          )}
        </div>
        <span className={styles.k}>offered</span>
        <Pills values={AVAILABILITIES} value={f.availability} editor label="Offered" onPick={(v) => setF({ ...f, availability: v })} />
        <span className={styles.k}>ours</span>
        <Select
          className={styles.select}
          value={ours}
          ariaLabel="Our feature it matches"
          options={[{ value: '', label: 'none' }, ...features.map((c) => ({ value: c.id, label: c.title || 'untitled feature' }))]}
          onChange={setOurs}
        />
        <span className={styles.k}>seen at</span>
        <input className={styles.input} placeholder="where it was seen" value={f.url ?? ''} maxLength={2000} onChange={(e) => setF({ ...f, url: e.target.value })} onKeyDown={keys} />
      </div>
      <div className={styles.formActions}>
        <button className={styles.small} data-tone="primary" disabled={!f.name.trim()} onClick={add}>
          add
        </button>
        <button className={styles.small} onClick={() => onDone(null, null)}>
          cancel
        </button>
        <span className={styles.hint}>enter adds · esc</span>
      </div>
    </div>
  )
}

function FeatureDetails({ f, card, cards, ours, editor, categories, onClose }: { f: CompetitorFeature; card: Card; cards: Card[]; ours?: Card; editor: boolean; categories: string[]; onClose: () => void }) {
  const { wid, comparisons } = useWs()
  const set = (fields: Partial<CompetitorFeature>) => void updateCompetitorFeature(wid, f.id, fields)
  const features = cards.filter((c) => c.type === 'feature' && c.pieceId === card.pieceId)
  return (
    <div className={styles.cfOpen}>
      <div className={styles.cfHead}>
        <Field value={f.name} placeholder="its name" editor={editor} onSave={(v) => v && set({ name: v })} />
        <button className={styles.small} onClick={onClose}>
          close
        </button>
      </div>
      <div className={styles.plan}>
        <span className={styles.k}>about</span>
        <Field value={f.description} placeholder="what it does" editor={editor} multiline onSave={(v) => set({ description: v })} />
        <span className={styles.k}>category</span>
        <Field value={f.category} placeholder={categories.length ? categories.join(', ') : 'booking, operations…'} editor={editor} onSave={(v) => set({ category: v })} />
        <span className={styles.k}>offered</span>
        <Pills values={AVAILABILITIES} value={f.availability} editor={editor} label="Offered" onPick={(v) => set({ availability: v })} />
        <span className={styles.k}>ours</span>
        {editor ? (
          <Select
            className={styles.select}
            value={ours?.id ?? ''}
            ariaLabel="Our feature it matches"
            options={[{ value: '', label: 'none' }, ...features.map((c) => ({ value: c.id, label: c.title || 'untitled feature' }))]}
            onChange={(v) => void matchOurs(wid, f, v || null, comparisons)}
          />
        ) : (
          <span>{ours?.title ?? '—'}</span>
        )}
        <span className={styles.k}>seen at</span>
        <Field value={f.url} placeholder="where it was seen" editor={editor} link onSave={(v) => set({ url: v })} />
      </div>
      {editor && (
        <div className={styles.formActions}>
          <button
            className={styles.small}
            data-tone="danger"
            onClick={() => {
              onClose()
              void removeCompetitorFeature(wid, f, comparisons)
            }}
          >
            remove
          </button>
        </div>
      )}
    </div>
  )
}

// A feature that's a part of another (D-164): its parent on a line under the header; `[detach]` takes the link away.
// Without one, `+ a feature` makes it a part of one (the user: from the part's side too, not only `+ part`).
export function Parent({ card, cards, editor }: { card: Card; cards: Card[]; editor: boolean }) {
  const { wid, edges } = useWs()
  const [picking, setPicking] = useState(false)
  const e = edges.find((x) => x.kind === 'part-of' && x.fromId === card.id)
  const parent = e && cards.find((c) => c.id === e.toId)
  if (!e || !parent) {
    if (!editor) return null
    // Not itself or any of its parts, all the way down (no loops).
    const below = new Set([card.id])
    for (let grew = true; grew; ) {
      grew = false
      for (const x of edges) if (x.kind === 'part-of' && below.has(x.toId) && !below.has(x.fromId)) (below.add(x.fromId), (grew = true))
    }
    return (
      <div className={styles.parent} data-none>
        <span>part of</span>
        {picking ? (
          <div className={styles.parentPick}>
            <CardPicker card={card} cards={cards} types={['feature']} exclude={below} onPick={(c) => (setPicking(false), createEdge(wid, card, c, 'part-of'))} onClose={() => setPicking(false)} />
          </div>
        ) : (
          <button className={styles.inlineAdd} onClick={() => setPicking(true)}>
            a feature
          </button>
        )}
      </div>
    )
  }
  return (
    <div className={styles.parent}>
      <span>part of</span>
      <button className={styles.parentTo} onClick={() => goToCard(parent)}>
        ↑ {parent.title || PLACEHOLDER.feature}
      </button>
      {editor && (
        <button className={styles.small} onClick={() => void deleteEdge(wid, e.id)}>
          detach
        </button>
      )}
    </div>
  )
}

// Its parts (features `part of` it), as a tree; `+ part` picks a feature on the plane or makes one.
export function Parts({ n, card, cards, editor }: P) {
  const { wid, edges } = useWs()
  const [picking, setPicking] = useState(false)
  const byId = new Map(cards.map((c) => [c.id, c]))
  const kids = (id: string) => edges.filter((e) => e.kind === 'part-of' && e.toId === id && byId.has(e.fromId))
  const rows: { e: (typeof edges)[number]; c: Card; depth: number; last: boolean }[] = []
  const walk = (id: string, depth: number, seen: Set<string>) => {
    const list = kids(id)
    list.forEach((e, i) => {
      if (seen.has(e.fromId) || depth > 5) return
      rows.push({ e, c: byId.get(e.fromId)!, depth, last: i === list.length - 1 })
      walk(e.fromId, depth + 1, new Set([...seen, e.fromId]))
    })
  }
  walk(card.id, 0, new Set([card.id]))
  // Not itself, its parts, or what it's a part of (no loops).
  const above = new Set<string>()
  for (let at: string | undefined = card.id; at && !above.has(at); at = edges.find((e) => e.kind === 'part-of' && e.fromId === at)?.toId) above.add(at)
  return (
    <PanelSection n={n} name="parts" count={rows.length || undefined} add={editor ? { label: 'part', onClick: () => setPicking(true) } : undefined} empty={!rows.length && !picking}>
      {rows.map(({ e, c, depth, last }) => (
        <div key={e.id} className={styles.part} style={{ paddingLeft: depth * 16 }}>
          <span className={styles.tree}>{last ? '└' : '├'}</span>
          <button className={styles.to} onClick={() => goToCard(c)}>
            {c.title || PLACEHOLDER.feature}
          </button>
          <span className={styles.type}>{c.status}</span>
          {editor && depth === 0 && (
            <button className={styles.x} title="Detach" onClick={() => void deleteEdge(wid, e.id)}>
              ×
            </button>
          )}
        </div>
      ))}
      {picking && (
        <CardPicker
          card={card}
          cards={cards}
          types={['feature']}
          exclude={new Set([...above, ...rows.map((r) => r.c.id)])}
          onPick={(c) => (setPicking(false), createEdge(wid, c, card, 'part-of'))}
          onClose={() => setPicking(false)}
        />
      )}
    </PanelSection>
  )
}

// What it must do (D-133): up to eight, typed in place. Each says how the competitors do on it, `met by N` or `◇ open`
// (nobody scored meets it: white space); a click on that opens the plane's competitors to score it `met / part / no`
// (the old matrix's cell scores). `×` takes one away with its scores.
export function Criteria({ n, card, cards, editor }: P) {
  const { wid, comparisons } = useWs()
  const list = card.criteria ?? []
  const [adding, setAdding] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const set = (next: { id: string; text: string }[]) => void updateCard(wid, card, { criteria: next.length ? next : undefined }, 'must-haves of')
  const rivals = cards.filter((c) => c.type === 'competitor' && c.pieceId === card.pieceId)
  const scoreOf = (who: string, id: string) => comparisons.find((c) => c.featureId === card.id && c.competitorId === who)?.criteria?.[id]
  const remove = (id: string) => {
    const next = list.filter((x) => x.id !== id)
    const ref = cardRef(wid, card.type, card.id)
    void dropCriterionScores(wid, card.id, id, comparisons, { ref, write: (b) => b.update(ref, { criteria: next.length ? next : deleteField(), updatedAt: Date.now() }) })
  }
  return (
    <PanelSection
      n={n}
      name="must do"
      count={list.length ? `${list.length} of ${MAX_CRITERIA}` : undefined}
      add={editor && list.length < MAX_CRITERIA ? { label: 'must-have', onClick: () => setAdding('') } : undefined}
      empty={!list.length && adding === null}
    >
      {list.map((c, i) => {
        const scores = rivals.map((r) => scoreOf(r.id, c.id)).filter(Boolean)
        const met = scores.filter((s) => s === 'met').length
        const reading = !scores.length ? 'score' : met ? `met by ${met}` : '◇ open'
        return (
          <div key={c.id}>
            <div className={styles.crit}>
              <span className={styles.critN}>{i + 1}</span>
              <Field value={c.text} placeholder="what it must do" editor={editor} onSave={(v) => v && set(list.map((x) => (x.id === c.id ? { ...x, text: v } : x)))} />
              <button className={styles.critRead} data-open={!scores.length ? undefined : met ? 'met' : 'open'} aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}>
                {reading} {open === c.id ? '▾' : '▸'}
              </button>
              {editor && (
                <button className={styles.x} title="Remove with its scores" onClick={() => remove(c.id)}>
                  ×
                </button>
              )}
            </div>
            {open === c.id && (
              <div className={styles.scores}>
                {rivals.length ? (
                  rivals.map((r) => (
                    <div key={r.id} className={styles.score}>
                      <span className={styles.scoreWho}>{r.title || PLACEHOLDER.competitor}</span>
                      <Pills values={CRITERION_SCORES} value={scoreOf(r.id, c.id)} editor={editor} label={`${r.title} on it`} onPick={(v) => void scoreCriterion(wid, card.id, r.id, c.id, v ?? null)} />
                    </div>
                  ))
                ) : (
                  <p className={styles.quiet}>no competitors on this plane to score</p>
                )}
              </div>
            )}
          </div>
        )
      })}
      {adding !== null && (
        <input
          className={styles.input}
          autoFocus
          placeholder="what it must do"
          value={adding}
          maxLength={200}
          onChange={(e) => setAdding(e.target.value)}
          onBlur={() => setAdding(null)}
          onKeyDown={(e) => {
            e.stopPropagation()
            const t = adding.trim()
            if (e.key === 'Escape') setAdding(null)
            if (e.key === 'Enter' && t) {
              set([...list, { id: Math.random().toString(36).slice(2, 10), text: t }])
              setAdding(list.length + 1 < MAX_CRITERIA ? '' : null)
            }
          }}
        />
      )}
    </PanelSection>
  )
}

const RANK = { none: 0, low: 1, medium: 2, high: 3 } as const

// What it rests on (D-138): the ideas linked to it, and the problems they solve, with their status; how sure that makes
// it is the weakest of them (invalidated: none; a status the evidence doesn't back: low).
export function RestsOn({ n, card, cards, editor }: P) {
  const { wid, edges, evidence } = useWs()
  const [picking, setPicking] = useState(false)
  const byId = new Map(cards.map((c) => [c.id, c]))
  const ideaLinks = edges.filter((e) => e.kind !== FOR && e.kind !== 'part-of' && ((e.fromId === card.id && e.toType === 'idea') || (e.toId === card.id && e.fromType === 'idea')))
  const ideas = ideaLinks.map((e) => ({ e, c: byId.get(e.fromId === card.id ? e.toId : e.fromId) })).filter((x): x is { e: typeof x.e; c: Card } => !!x.c)
  const problems = ideas.flatMap(({ c }) => edges.filter((e) => e.kind === 'solves' && e.fromId === c.id).map((e) => byId.get(e.toId))).filter((c): c is Card => !!c)
  const sure = (c: Card) => {
    const clash = mismatch(c.validation, evidence.filter((e) => e.nodeId === c.id))
    if (c.validation === 'invalidated') return { level: 'none' as const, why: `"${c.title}" is invalidated` }
    if (clash || !c.validation || c.validation === 'hypothesis') return { level: 'low' as const, why: clash ? `"${c.title}": ${clash.toLowerCase()}` : `"${c.title}" is a guess` }
    if (c.validation === 'testing') return { level: 'medium' as const, why: `"${c.title}" is being tested` }
    return { level: 'high' as const, why: 'what it rests on is validated' }
  }
  const all = [...ideas.map((x) => x.c), ...problems]
  const weakest = all.map(sure).sort((a, b) => RANK[a.level] - RANK[b.level])[0]
  const parent = edges.find((e) => e.kind === 'part-of' && e.fromId === card.id)
  const parentCard = parent && byId.get(parent.toId)
  const status = (c: Card) => `${c.validation ?? 'no status'}${mismatch(c.validation, evidence.filter((e) => e.nodeId === c.id)) ? ' !' : ''}`
  return (
    <PanelSection n={n} name="rests on" add={editor ? { label: 'idea', onClick: () => setPicking(true) } : undefined} empty={!ideas.length && !parentCard && !picking}>
      {ideas.map(({ e, c }) => (
        <div key={e.id}>
          <div className={styles.link} style={{ ['--tone' as string]: linkTone(e.kind) }}>
            <span className={styles.swatch} aria-hidden />
            <span className={styles.kind}>{e.fromId === card.id ? `${KIND_LABEL[e.kind] ?? e.kind} →` : `← ${KIND_LABEL[e.kind] ?? e.kind}`}</span>
            <button className={styles.to} onClick={() => goToCard(c)}>
              {c.title || PLACEHOLDER.idea}
            </button>
            <span className={styles.type}>{status(c)}</span>
            {editor && (
              <button className={styles.x} title="Unlink" onClick={() => void deleteEdge(wid, e.id)}>
                ×
              </button>
            )}
          </div>
          {edges
            .filter((s) => s.kind === 'solves' && s.fromId === c.id && byId.has(s.toId))
            .map((s) => {
              const p = byId.get(s.toId)!
              return (
                <div key={s.id} className={styles.link} style={{ ['--tone' as string]: linkTone('solves') }}>
                  <span className={styles.swatch} data-faint aria-hidden />
                  <span className={styles.kind}>· solves</span>
                  <button className={styles.to} onClick={() => goToCard(p)}>
                    {p.title || PLACEHOLDER.problem}
                  </button>
                  <span className={styles.type}>{status(p)}</span>
                </div>
              )
            })}
        </div>
      ))}
      {!ideas.length && parentCard && <p className={styles.quiet}>what its parent rests on: {parentCard.title || PLACEHOLDER.feature}</p>}
      {weakest && (
        <p className={styles.conf}>
          <span>confidence</span>
          <b data-level={weakest.level}>{weakest.level}</b>
          <span>· {weakest.why}</span>
        </p>
      )}
      {picking && (
        <CardPicker
          card={card}
          cards={cards}
          types={['idea']}
          exclude={new Set([card.id, ...ideas.map((x) => x.c.id)])}
          onPick={(c) => (setPicking(false), createEdge(wid, card, c, 'inspired-by'))}
          onClose={() => setPicking(false)}
        />
      )}
    </PanelSection>
  )
}

// The features of theirs that match it (the competitor panel's `ours`): `≈ theirs`, the competitor and its feature, how
// it's offered; the row goes to the competitor, `×` unmatches.
export function MatchedBy({ card, cards, editor }: { card: Card; cards: Card[]; editor: boolean }) {
  const { wid, comparisons, competitorFeatures } = useWs()
  const rows = comparisons
    .filter((c) => c.featureId === card.id && c.competitorFeatureId)
    .map((c) => ({ c, f: competitorFeatures.find((f) => f.id === c.competitorFeatureId), who: cards.find((k) => k.id === c.competitorId) }))
    .filter((r): r is { c: (typeof r)['c']; f: CompetitorFeature; who: Card } => !!r.f && !!r.who)
  return (
    <>
      {rows.map(({ c, f, who }) => (
        <div key={c.id} className={styles.link} style={{ ['--tone' as string]: 'var(--accent-yellow)' }}>
          <span className={styles.swatch} aria-hidden />
          <span className={styles.kind}>≈ theirs</span>
          <button className={styles.to} onClick={() => goToCard(who)}>
            {who.title} · {f.name}
          </button>
          <span className={styles.type}>{f.availability}</span>
          {editor && (
            <button className={styles.x} title="Not a match" onClick={() => void matchOurs(wid, f, null, comparisons)}>
              ×
            </button>
          )}
        </div>
      ))}
    </>
  )
}

export const hasMatches = (card: Card, comparisons: { featureId: string; competitorFeatureId?: string }[]) =>
  comparisons.some((c) => c.featureId === card.id && c.competitorFeatureId)
