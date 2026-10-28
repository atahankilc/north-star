// A plane card's right panel (D-219, D-221): the shell every right panel shares, filled for its type. Every type reads
// in the same order: what it is (a status, a profile, a plan), what backs it (evidence, parts), what it touches (its
// links by meaning, then the rest), tags, notes. A section's add sits at its rule's right end; an empty section is just
// its rule. Everything is edited in place and undoable; viewers only read. A card named in a row goes to it.
import { AnimatePresence } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  addCard,
  CARD,
  cardBounds,
  isOnPlane,
  copyCards,
  deleteCard,
  spotRef,
  discardCard,
  updateCards,
  FEATURE_EFFORTS,
  FEATURE_IMPACTS,
  FEATURE_PRIORITIES,
  FEATURE_STATUSES,
  retitleCard,
  TITLE_MAX,
  updateCard,
  VALIDATIONS,
  type AnyType,
  type Card,
  type CardType,
} from '../../data/cards'
import { CompetitorProfile, CompetitorFeatures, Criteria, hasMatches, InPackages, MatchedBy, Parent, Parts, RestsOn } from './CardPanelKinds'
import { createEdge, defaultKind, deleteEdge, FOR, type Edge, type EdgeKind } from '../../data/edges'
import { addEvidence, EVIDENCE_KINDS, mismatch, removeEvidence, tally, updateEvidence, type Evidence, type EvidenceKind, type Stance } from '../../data/evidence'
import { glide, useCanvasView } from '../../state/canvasView'
import { useAutoGrow } from '../../ui/autoGrow'
import { PanelAction, PanelSection, SIDE_PANEL_W, SidePanel } from '../../ui/SidePanel'
import { factsOf } from './cardFacts'
import { packageTree } from './cardInside'
import { labelBox } from './TextItems'
import { kindOf, labelRef, moveMany, type Label } from '../../data/labels'
import { clipboard, deleteHere, onPlane, packageThese, setSelection } from './selection'
import { bringIn, cardsOn, elsewhere, onPlane as isOn, planeOf, planesOf, takeOff, type Place } from '../../data/places'
import { useGoTo } from './goTo'
import { useHistory } from '../../data/history'
import { GRID, snap } from '../../data/grid'
import { useWs } from './context'
import { linkTone } from './PlaneLinks'
import { TasksSection } from './CardTasks'
import { openThread, startComment, threadOn } from './Threads'
import styles from './CardPanel.module.css'

// Type = the panel's colour, as the card's edge (D-055).
const TONE: Record<AnyType, string> = {
  package: 'var(--accent-blue)',
  customer: 'var(--accent-green)',
  problem: 'var(--accent-magenta)',
  competitor: 'var(--accent-yellow)',
  idea: 'var(--fg)',
  feature: 'var(--accent-cyan)',
}

export const PLACEHOLDER: Record<AnyType, string> = {
  package: 'What does this piece deliver?',
  customer: 'Who are they?',
  problem: 'What hurts?',
  competitor: 'Who else does it?',
  idea: "What's the thought?",
  feature: 'What does it do?',
}

const NOTES_HINT: Record<AnyType, string> = {
  package: 'What it delivers, and what it bets on.',
  customer: 'What do they do all day?',
  problem: 'How often, and what does it cost them?',
  competitor: 'What stands out about them?',
  idea: "What's the thought behind it?",
  feature: 'What does it do, and for whom?',
}

export const KIND_LABEL: Record<string, string> = {
  relates: 'relates',
  solves: 'solves',
  'part-of': 'part of',
  'competes-with': 'competes',
  contradicts: 'contradicts',
  'inspired-by': 'inspired',
  'depends-on': 'depends on',
  [FOR]: 'for',
}

// A field's text kept apart from what's stored until it's committed (Enter or leaving it, D-221): a change from
// elsewhere shows unless it's being typed in; leaving the panel with something typed keeps it.
export function useCommit(value: string, save: (v: string) => void) {
  const [draft, setDraft] = useState(value)
  const dirty = useRef(false)
  const latest = useRef({ draft, save, value })
  latest.current = { draft, save, value }
  useEffect(() => {
    if (!dirty.current) setDraft(value)
  }, [value])
  useEffect(
    () => () => {
      const { draft: d, save: s, value: v } = latest.current
      if (dirty.current && d !== v) s(d)
    },
    [],
  )
  return {
    draft,
    setDraft: (v: string) => ((dirty.current = true), setDraft(v)),
    commit: () => {
      if (dirty.current && draft !== value) save(draft)
      dirty.current = false
    },
    revert: () => ((dirty.current = false), setDraft(value)),
  }
}

// `selected`: this card's rather than the selection's (a matrix's or a table's cell, LensCardPanel), `onClose` then
// closing only the panel.
type PanelProps = { cards: Card[]; labels?: Label[]; editor: boolean; selected?: string | null; onClose?: () => void }
export function CardPanel({ cards, labels = [], editor, selected, onClose }: PanelProps) {
  const ws = useWs()
  const { wid, threads, edges, places } = ws
  const picked = useCanvasView((s) => s.cardSelected)
  const id = selected === undefined ? picked : selected
  const multi = useCanvasView((s) => s.cardMulti)
  const many = cards.filter((c) => multi.includes(c.id))
  const texts = labels.filter((l) => multi.includes(l.id))
  const count = many.length + texts.length
  const plane = new URLSearchParams(location.search).get('focus')
  const shared = many.filter((c) => plane && elsewhere(c, places, plane).length)
  const right = useCanvasView((s) => (s.beside ? s.size.w - Math.round(s.size.w * s.split) : 0))
  const card = cards.find((c) => c.id === id)
  // Enter shut it on a card just made (D-250); the card stays selected.
  const shut = useCanvasView((s) => s.panelShut)
  const close = onClose ?? (() => useCanvasView.setState({ cardSelected: null }))
  // A card the panel would cover glides left, clear of it (48 px). Only on its own plane in focus: picked from a matrix's
  // or a table's head, the view is the lens's.
  useEffect(() => {
    if (!card || planeOf(card) !== plane) return
    const { planeCam: c, size } = useCanvasView.getState()
    if (!c) return
    const area = size.w - right
    const clear = area - Math.min(SIDE_PANEL_W, area) - 48
    const end = c.ox + (card.x + CARD.w) * c.zoom
    if (end > clear) glide(c, { ...c, ox: c.ox - (end - clear) }, 320, (v) => useCanvasView.setState({ planeCam: v }))
    // When a card is picked, or the panel's room changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id, right])
  return (
    <AnimatePresence>
      {count > 1 && (
        <SidePanel
          key="card"
          kind="selection"
          tone="var(--accent-cyan)"
          label={`${count} selected`}
          title={`${count} selected`}
          right={right}
          onClose={() => setSelection([])}
          actions={
            <>
              <PanelAction label="copy" title="⌘C" onClick={() => Object.assign(clipboard, { cards: many, labels: texts, edges, pasted: 0 })} />
              {editor && plane && <PanelAction label="duplicate" title="⌘D" onClick={() => setSelection(copyCards(wid, plane, many, edges, [2 * GRID, 2 * GRID], texts))} />}
              {editor && plane && (
                <PanelAction
                  label={shared.length ? (shared.length === count ? 'take off this plane' : 'remove') : 'delete'}
                  danger={!shared.length}
                  title="Delete or Backspace"
                  onClick={() => {
                    setSelection([])
                    deleteHere(wid, plane, many, { edges, places, pieces: ws.pieces }, texts)
                  }}
                />
              )}
            </>
          }
        >
          <ManyInside cards={many} texts={texts} editor={editor} />
        </SidePanel>
      )}
      {card && count < 2 && card.id !== shut && (
        <SidePanel
          // One panel while cards change under it: it builds only when it opens.
          key="card"
          kind={card.type}
          tone={TONE[card.type]}
          label={`${card.type} ${card.title}`}
          title={<Title card={card} editor={editor} />}
          right={right}
          onClose={close}
          actions={
            <>
              <PanelAction
                label="comment"
                onClick={() => {
                  const t = threadOn(threads, card.id)
                  if (t) openThread(t.id)
                  else startComment({ on: 'card', targetId: card.id, planeId: planeOf(card), at: [card.x + CARD.w, card.y + CARD.h] })
                }}
              />
              {editor &&
                // One also on other planes is deleted from all of them only through the hazard confirm (D-281).
                (elsewhere(card, places, planeOf(card)).length ? (
                  <PanelAction label="delete everywhere" danger onClick={() => useCanvasView.setState({ deleting: { ids: [card.id], plane: planeOf(card) } })} />
                ) : (
                  <PanelAction
                    label="delete"
                    danger
                    title="Delete or Backspace"
                    onClick={() => {
                      close()
                      void deleteCard(wid, card, edges, places)
                    }}
                  />
                ))}
            </>
          }
        >
          <Inside key={card.id} card={card} cards={cards} editor={editor} />
        </SidePanel>
      )}
    </AnimatePresence>
  )
}

// A card picked from a matrix's or a table's head (its row, its column): its panel as on its plane, wherever the lens is
// live (its own focus, beside a plane, open on the canvas). A card on the plane in focus has that plane's own panel.
// Open, it stays open on a cell picked next whose row or column, only one of them, is a card: that card's (a table's rows
// are its only cards), so moving down a table's rows follows them. A cell crossing two cards, or none, closes it; closed,
// a cell doesn't open it again (a head does). Its `[×]` there closes only the panel, the cell stays selected.
const NONE: Card[] = []
const CELL_SEL = /^t?cell\|[^|]+\|([^|]+)\|([^|]+)$/
export function LensCardPanel({ space, editor }: { space: string | null; editor: boolean }) {
  const { cards, places } = useWs()
  const sel = useCanvasView((s) => (s.cardMulti.length ? null : s.cardSelected))
  // The card whose panel is open, as the selection moved on to cells.
  const open = useRef<string | null>(null)
  const [, redraw] = useState(0)
  let shown: string | null = null
  const card = sel ? cards.find((x) => x.id === sel) : undefined
  if (card) {
    open.current = card.id
    // Not on the plane in focus (which opens its own); a card brought there from another is on it too (D-281).
    if (!space || !isOn(card, places, space)) shown = card.id
  } else {
    const m = sel?.match(CELL_SEL)
    const ends = m ? [m[1], m[2]].filter((k) => cards.some((x) => x.id === k)) : []
    open.current = open.current && ends.length === 1 ? ends[0] : null
    shown = open.current
  }
  const close = card ? undefined : () => ((open.current = null), redraw((n) => n + 1))
  // Kept there with nothing to show, so the panel breaks apart as it closes.
  return <CardPanel cards={shown ? cards : NONE} editor={editor} selected={shown} onClose={close} />
}

// Several cards selected (D-227, the old board's "N selected", D-124): what they are, lining them up (six ways), spacing
// them out evenly (three or more), the tags they all have (adding or taking one away does it on all of them).
function ManyInside({ cards, texts, editor }: { cards: Card[]; texts: Label[]; editor: boolean }) {
  const { wid, cards: every } = useWs()
  const packable = cards
  const textKinds = texts.reduce((m, x) => m.set(kindOf(x), (m.get(kindOf(x)) ?? 0) + 1), new Map<string, number>())
  const kinds = [
    ...(['customer', 'problem', 'competitor', 'idea', 'feature', 'package'] as AnyType[]).map((t) => [t, cards.filter((c) => c.type === t).length] as const),
    ...[...textKinds].map(([k, n]) => [k, n] as const),
  ]
    .filter(([, n]) => n)
    .map(([t, n]) => `${n} ${t}${n > 1 ? 's' : ''}`)
    .join(' · ')
  // Everything selected with its box: cards their size, text as it's laid out (D-229).
  const items = [
    ...cards.map((c) => ({ id: c.id, ref: spotRef(wid, c), x: c.x, y: c.y, w: CARD.w, h: CARD.h })),
    ...texts.map((x) => ({ id: x.id, ref: labelRef(wid, x.id), ...labelBox(x) })),
  ]
  type Item = (typeof items)[number]
  const moveTo = (to: (c: Item) => [number, number]) => {
    const moves = items.map((c) => ({ c, to: to(c).map(snap) as [number, number] })).filter((m) => m.to[0] !== m.c.x || m.to[1] !== m.c.y)
    if (moves.length) void moveMany(`line up ${items.length} things`, moves.map((m) => ({ ref: m.c.ref, from: { x: m.c.x, y: m.c.y }, to: { x: m.to[0], y: m.to[1] } })))
  }
  const [l, t] = [Math.min(...items.map((c) => c.x)), Math.min(...items.map((c) => c.y))]
  const [r, b] = [Math.max(...items.map((c) => c.x + c.w)), Math.max(...items.map((c) => c.y + c.h))]
  const ALIGN: [string, (c: Item) => [number, number]][] = [
    ['left', (c) => [l, c.y]],
    ['centre', (c) => [(l + r) / 2 - c.w / 2, c.y]],
    ['right', (c) => [r - c.w, c.y]],
    ['top', (c) => [c.x, t]],
    ['middle', (c) => [c.x, (t + b) / 2 - c.h / 2]],
    ['bottom', (c) => [c.x, b - c.h]],
  ]
  // Evenly from the first to the last, in their order along that way.
  const spread = (axis: 0 | 1) => {
    const sorted = [...items].sort((p, q) => (axis ? p.y - q.y : p.x - q.x))
    const [a, z] = axis ? [sorted[0].y, sorted[sorted.length - 1].y] : [sorted[0].x, sorted[sorted.length - 1].x]
    const at = new Map(sorted.map((c, i) => [c.id, a + ((z - a) * i) / (sorted.length - 1)]))
    moveTo((c) => (axis ? [c.x, at.get(c.id)!] : [at.get(c.id)!, c.y]))
  }
  const all = cards[0]?.tags?.filter((tag) => cards.every((c) => c.tags?.includes(tag))) ?? []
  const [adding, setAdding] = useState<string | null>(null)
  const retag = (tag: string, on: boolean) =>
    void updateCards(
      wid,
      cards.map((c) => {
        const tags = on ? [...new Set([...(c.tags ?? []), tag])] : (c.tags ?? []).filter((x) => x !== tag)
        return { card: c, fields: { tags: tags.length ? tags : undefined } }
      }),
      on ? `tag ${cards.length} cards` : `untag ${cards.length} cards`,
    )
  return (
    <>
      <div className={styles.under}>{kinds}</div>
      <PanelSection n={1} name="line up">
        <div className={styles.pills}>
          {ALIGN.map(([name, to]) => (
            <button key={name} className={styles.pill} disabled={!editor} onClick={() => moveTo(to)}>
              {name}
            </button>
          ))}
        </div>
      </PanelSection>
      <PanelSection n={2} name="space out">
        <div className={styles.pills}>
          <button className={styles.pill} disabled={!editor || items.length < 3} onClick={() => spread(0)}>
            ↔ across
          </button>
          <button className={styles.pill} disabled={!editor || items.length < 3} onClick={() => spread(1)}>
            ↕ down
          </button>
        </div>
      </PanelSection>
      <PanelSection
        n={3}
        name="tags"
        count={all.length ? `on all ${cards.length} cards` : undefined}
        add={editor && cards.length ? { label: 'tag', onClick: () => setAdding('') } : undefined}
        empty={!all.length && adding === null}
      >
        <div className={styles.tags}>
          {all.map((tag) => (
            <span key={tag} className={styles.chip}>
              #{tag}
              {editor && (
                <button className={styles.chipX} title="Take it off all of them" onClick={() => retag(tag, false)}>
                  ×
                </button>
              )}
            </span>
          ))}
          {adding !== null && (
            <input
              className={`${styles.input} ${styles.tagInput}`}
              autoFocus
              placeholder="tag"
              value={adding}
              maxLength={40}
              onChange={(e) => setAdding(e.target.value)}
              onBlur={() => setAdding(null)}
              onKeyDown={(e) => {
                e.stopPropagation()
                const tag = adding.trim().replace(/^#/, '')
                if (e.key === 'Enter' && tag) (retag(tag, true), setAdding(''))
                if (e.key === 'Escape') setAdding(null)
              }}
            />
          )}
        </div>
      </PanelSection>
      {editor && packable.length > 0 && (
        <PanelSection n={4} name="package">
          <div className={styles.pills}>
            <button className={styles.pill} onClick={() => setSelection([packageThese(wid, packable, every)])} title="One thing to rate and rank, holding these cards (D-239)">
              package these {packable.length}
            </button>
          </div>
        </PanelSection>
      )}
    </>
  )
}

// What the panel shows of a card: its quick facts, then its type's sections.
function Inside({ card, cards, editor }: { card: Card; cards: Card[]; editor: boolean }) {
  const { evidence, competitorFeatures, comparisons, edges } = useWs()
  const facts = useMemo(() => factsOf(cards, { evidence, competitorFeatures, edges }).get(card.id), [cards, evidence, competitorFeatures, edges, card.id])
  const under = [facts?.head, facts?.meta, facts?.sure].filter(Boolean).join(' · ')
  const mine = useMemo(() => edges.filter((e) => e.fromId === card.id || e.toId === card.id), [edges, card.id])
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  // Links in the sections before `other links` are taken out of it.
  const shown = new Set<string>()
  const take = (keep: (e: Edge) => boolean) => {
    const list = mine.filter((e) => !shown.has(e.id) && keep(e) && byId.has(e.fromId === card.id ? e.toId : e.fromId))
    list.forEach((e) => shown.add(e.id))
    return list
  }
  const p = { card, cards, editor }
  let n = 0
  const next = () => ++n
  const sections: ReactNode[] = []

  if (card.type === 'customer' || card.type === 'problem' || card.type === 'idea') {
    // Parts of its own type (D-226), as a feature's: a sub-problem, a narrower idea or segment.
    take((e) => e.kind === 'part-of' && e.fromType === e.toType)
    sections.push(
      <StatusSection key="status" n={next()} {...p} />,
      <EvidenceSection key="evidence" n={next()} {...p} />,
      <Parts key="parts" n={next()} {...p} />,
    )
  }
  if (card.type === 'customer') {
    sections.push(
      <LinkSection key="tagged" n={next()} name="tagged for them" {...p} links={take((e) => e.kind === FOR && e.toId === card.id)} add={{ label: 'tag a card', types: ['problem', 'idea', 'feature', 'competitor'], kind: FOR, from: 'other' }} />,
    )
  }
  if (card.type === 'problem') {
    sections.push(
      <LinkSection key="for" n={next()} name="for" {...p} links={take((e) => e.kind === FOR && e.fromId === card.id)} add={{ label: 'customer', types: ['customer'], kind: FOR, from: 'me' }} />,
      <LinkSection
        key="solved"
        n={next()}
        name="solved by · competed for"
        {...p}
        links={take((e) => (e.kind === 'solves' && e.toId === card.id) || e.kind === 'competes-with')}
        add={{ label: 'idea that solves it', types: ['idea'], kind: 'solves', from: 'other' }}
      />,
    )
  }
  if (card.type === 'idea') {
    sections.push(
      <LinkSection key="solves" n={next()} name="solves" {...p} links={take((e) => e.kind === 'solves' && e.fromId === card.id)} add={{ label: 'problem', types: ['problem'], kind: 'solves', from: 'me' }} />,
      <LinkSection
        key="features"
        n={next()}
        name="features"
        {...p}
        links={take((e) => e.kind !== FOR && (e.fromType === 'feature' || e.toType === 'feature'))}
        add={{ label: 'feature', types: ['feature'], kind: 'inspired-by', from: 'other' }}
        count
      />,
      <LinkSection key="for" n={next()} name="for" {...p} links={take((e) => e.kind === FOR && e.fromId === card.id)} add={{ label: 'customer', types: ['customer'], kind: FOR, from: 'me' }} />,
    )
  }
  if (card.type === 'competitor') {
    sections.push(<CompetitorProfile key="profile" n={next()} {...p} />, <CompetitorFeatures key="cfeatures" n={next()} {...p} />)
    sections.push(
      <LinkSection key="competes" n={next()} name="competes for" {...p} links={take((e) => e.kind === 'competes-with')} add={{ label: 'link', types: ['problem', 'idea'], kind: 'competes-with', from: 'me' }} />,
    )
  }
  if (card.type === 'feature') {
    // Its parent (`part of` from it) has its own line under the header; its parts, the ideas it rests on.
    take((e) => e.kind === 'part-of' && e.fromType === e.toType)
    sections.push(
      <PlanSection key="plan" n={next()} {...p} />,
      <Parts key="parts" n={next()} {...p} />,
      <Criteria key="criteria" n={next()} {...p} />,
      <RestsOn key="rests" n={next()} {...p} />,
    )
    take((e) => e.kind !== FOR && (e.fromType === 'idea' || e.toType === 'idea'))
    sections.push(
      <LinkSection
        key="for"
        n={next()}
        name="for · matched by"
        {...p}
        links={take((e) => e.kind === FOR && e.fromId === card.id)}
        add={{ label: 'customer', types: ['customer'], kind: FOR, from: 'me' }}
        extra={hasMatches(card, comparisons) ? <MatchedBy card={card} cards={cards} editor={editor} /> : undefined}
      />,
    )
  }
  if (card.type === 'package') sections.push(<PackagePlan key="plan" n={next()} {...p} />, <Holds key="holds" n={next()} {...p} />)
  const rest = take(() => true)
  sections.push(
    <LinkSection key="links" n={next()} name={card.type === 'customer' ? 'links' : 'other links'} {...p} links={rest} add={{ label: 'link', types: null, kind: null, from: 'me' }} />,
    <PlanesSection key="planes" n={next()} {...p} />,
    <TasksSection key="tasks" n={next()} card={card} editor={editor} />,
    <TagsSection key="tags" n={next()} {...p} />,
    <NotesSection key="notes" n={next()} {...p} />,
  )
  return (
    <>
      {under && <div className={styles.under}>{under}</div>}
      {card.type !== 'competitor' && card.type !== 'package' && <Parent card={card} cards={cards} editor={editor} />}
      <InPackages card={card} cards={cards} />
      {sections}
    </>
  )
}

// A package's rating (D-239, the old D-141): impact and effort; how sure it is comes from what it holds (the line under
// the header).
function PackagePlan({ n, card, editor }: P) {
  const { wid } = useWs()
  const row = (field: 'impact' | 'effort', values: string[]) => (
    <>
      <span className={styles.k}>{field}</span>
      <Pills values={values} value={card[field]} editor={editor} label={field} onPick={(v) => void updateCard(wid, card, { [field]: v }, `${field} of`)} />
    </>
  )
  return (
    <PanelSection n={n} name="rating">
      <div className={styles.plan}>
        {row('impact', FEATURE_IMPACTS)}
        {row('effort', FEATURE_EFFORTS)}
      </div>
    </PanelSection>
  )
}

// What a package holds (D-239): each a row in its type's colour that goes to it, `×` takes it out (the card stays);
// a member's parts come with it, under it (taken out with it); `+ card` adds one from its plane.
function Holds({ n, card, cards, editor }: P) {
  const { wid, edges } = useWs()
  const [picking, setPicking] = useState(false)
  const ids = card.memberIds ?? []
  const tree = packageTree(card, cards, edges)
  // Not a package it's inside (no loops).
  const around = new Set(cards.filter((c) => c.type === 'package' && packageTree(c, cards, edges).some((r) => r.card.id === card.id)).map((c) => c.id))
  const set = (next: string[]) => void updateCard(wid, card, { memberIds: next }, 'contents of')
  return (
    <PanelSection n={n} name="holds" count={tree.length || undefined} add={editor && ids.length < 60 ? { label: 'card', onClick: () => setPicking(true) } : undefined} empty={!tree.length && !picking}>
      {tree.map(({ card: c, depth }) => (
        <div key={c.id} className={styles.part} style={{ paddingLeft: depth * 16 }}>
          <span className={styles.tree} style={depth ? undefined : { color: TONE[c.type] }}>
            {depth ? '└' : '▌'}
          </span>
          <button className={styles.to} onClick={() => goToCard(c)}>
            {c.title || PLACEHOLDER[c.type]}
          </button>
          <span className={styles.type}>{c.validation ?? c.priority ?? c.type}</span>
          {editor && depth === 0 && (
            <button
              className={styles.x}
              title="Take it out of the package, with its parts (the cards stay)"
              onClick={() => {
                // It and what's under it in the tree.
                const at = tree.findIndex((r) => r.card.id === c.id)
                const end = tree.findIndex((r, i) => i > at && r.depth <= depth)
                const out = new Set(tree.slice(at, end < 0 ? undefined : end).map((r) => r.card.id))
                set(ids.filter((x) => !out.has(x)))
              }}
            >
              ×
            </button>
          )}
        </div>
      ))}
      {picking && (
        <CardPicker
          card={card}
          cards={cards.filter((c) => isOnPlane(c, planeOf(card)))}
          types={['customer', 'problem', 'competitor', 'idea', 'feature', 'package']}
          exclude={new Set([card.id, ...around, ...tree.map((r) => r.card.id)])}
          make={false}
          onPick={(c) => (setPicking(false), set([...ids, c.id]))}
          onClose={() => setPicking(false)}
        />
      )}
    </PanelSection>
  )
}

// A feature's plan (D-138): priority, status, impact, effort.
function PlanSection({ n, card, editor }: P) {
  const { wid } = useWs()
  const row = (label: string, field: 'priority' | 'status' | 'impact' | 'effort', values: string[]) => (
    <>
      <span className={styles.k}>{label}</span>
      <Pills values={values} value={card[field]} editor={editor} label={label} onPick={(v) => void updateCard(wid, card, { [field]: v }, `${label} of`)} />
    </>
  )
  return (
    <PanelSection n={n} name="plan">
      <div className={styles.plan}>
        {row('priority', 'priority', FEATURE_PRIORITIES)}
        {row('status', 'status', FEATURE_STATUSES)}
        {row('impact', 'impact', FEATURE_IMPACTS)}
        {row('effort', 'effort', FEATURE_EFFORTS)}
      </div>
    </PanelSection>
  )
}

// The title, typed in place: Enter or leaving keeps it, Escape puts it back. The card itself isn't typed on any more
// (the user, once the panel came): a new card opens its panel with this field ready (`cardEditing`).
// A card just made (`fresh`, D-250): Enter makes it (one undo step with its making) and shuts the panel, the card still
// selected; Tab makes it and starts the next of its type beside it; Escape, or Enter or leaving with nothing typed,
// takes it away as if never made.
function Title({ card, editor }: { card: Card; editor: boolean }) {
  const { wid, cards, places, edges, pieces } = useWs()
  const same = useRef<HTMLDivElement>(null)
  const [typing, setTyping] = useState(false)
  const opening = useCanvasView((s) => s.cardEditing === card.id)
  const fresh = useCanvasView((s) => s.fresh === card.id)
  useEffect(() => {
    if (!opening) return
    setTyping(true)
    useCanvasView.setState({ cardEditing: null })
  }, [opening])
  const [draft, setDraft] = useState(card.title)
  const field = useRef<HTMLTextAreaElement>(null)
  useAutoGrow(field, draft)
  useEffect(() => setDraft(card.title), [card.title, card.id])
  // Once per time typing: Escape or Enter ends it before the field's blur would.
  const over = useRef(false)
  useEffect(() => {
    over.current = false
    if (typing) field.current?.select()
  }, [typing])
  if (!typing || !editor)
    return (
      <span className={styles.title} data-empty={!card.title || undefined} onClick={editor ? () => setTyping(true) : undefined}>
        {card.title || PLACEHOLDER[card.type]}
      </span>
    )
  // Naming a new card (D-250): cards of its type on other planes whose title holds what's typed (D-281), to bring here
  // instead of making a second one.
  const q = draft.trim().toLowerCase()
  const plane = planeOf(card)
  const alike =
    fresh && q.length >= 2 ? cards.filter((c) => c.type === card.type && c.id !== card.id && c.title.toLowerCase().includes(q) && !isOn(c, places, plane)).slice(0, 3) : []
  const nameOf = (id: string) => (pieces.find((p) => p.id === id)?.name?.trim() || 'plane').toUpperCase()
  // That one comes here where the new card was, and the new card goes as if never made: one undo step, the bringing.
  const useThat = (c: Card) => {
    if (over.current) return
    over.current = true
    setTyping(false)
    useCanvasView.setState({ fresh: null })
    void discardCard(wid, card)
    bringIn(wid, plane, [c], { cards: cards.filter((x) => x.id !== card.id), places, edges }, [card.x + CARD.w / 2, card.y + CARD.h / 2])
    useCanvasView.setState({ cardSelected: c.id, cardMulti: [] })
  }
  const done = (keep: boolean, then?: 'shut' | 'next') => {
    if (over.current) return
    over.current = true
    const t = draft.trim()
    setTyping(false)
    if (fresh) {
      useCanvasView.setState({ fresh: null })
      if (!keep || !t) {
        useCanvasView.setState({ cardSelected: null })
        return void discardCard(wid, card)
      }
    }
    if (keep && t !== card.title) void retitleCard(wid, card, t, fresh)
    else setDraft(card.title)
    if (then === 'shut') useCanvasView.setState({ panelShut: card.id })
    if (then === 'next' && card.type !== 'package') void makeNext(wid, card, cards, places)
  }
  return (
    <>
      <textarea
        ref={field}
        className={`${styles.title} ${styles.titleField}`}
        value={draft}
        rows={1}
        maxLength={TITLE_MAX}
        placeholder={PLACEHOLDER[card.type]}
        aria-label="Title"
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        // Going down to `use that one` isn't leaving.
        onBlur={(e) => !same.current?.contains(e.relatedTarget) && done(true)}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter' && !e.shiftKey) (e.preventDefault(), done(true, fresh ? 'shut' : undefined))
          if (e.key === 'Tab' && fresh && !e.shiftKey) (e.preventDefault(), draft.trim() && done(true, 'next'))
          if (e.key === 'Escape') done(false)
          if (e.key === 'ArrowDown' && alike.length) (e.preventDefault(), same.current?.querySelector('button')?.focus())
        }}
      />
      {alike.length > 0 && (
        <div ref={same} className={styles.same} aria-label="The same card on another plane">
          {alike.map((c) => (
            <div key={c.id} className={styles.sameRow}>
              <span className={styles.sameMark} aria-hidden>
                ≈
              </span>
              <span className={styles.sameTitle}>{c.title}</span>
              <span className={styles.type}>{planesOf(c, places).map(nameOf).join(', ')}</span>
              <button
                className={styles.sameUse}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => useThat(c)}
                onBlur={(e) => !same.current?.contains(e.relatedTarget) && e.relatedTarget !== field.current && done(true)}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Escape' || (e.key === 'ArrowUp' && e.currentTarget === same.current?.querySelector('button'))) (e.preventDefault(), field.current?.focus())
                  else if (e.key === 'ArrowUp') (e.preventDefault(), (e.currentTarget.parentElement?.previousElementSibling?.querySelector('button') as HTMLElement | null)?.focus())
                  else if (e.key === 'ArrowDown') (e.preventDefault(), (e.currentTarget.parentElement?.nextElementSibling?.querySelector('button') as HTMLElement | null)?.focus())
                }}
              >
                use that one
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// The next card of its type, a grid step right of this one (or the first clear spot past it), its title ready.
async function makeNext(wid: string, card: Card, cards: Card[], places: Place[]) {
  const at: [number, number] = [card.x + CARD.w + GRID + CARD.w / 2, card.y + CARD.h / 2]
  const id = await addCard(wid, planeOf(card), card.type as CardType, at, cardsOn(cards, places, planeOf(card)))
  useCanvasView.setState({ cardSelected: id, cardEditing: id, fresh: id, cardMulti: [] })
}

export type P = { n: number; card: Card; cards: Card[]; editor: boolean }

// `[pills]`: a click picks, a click on the picked one clears.
export function Pills<T extends string>({ values, value, editor, onPick, label }: { values: readonly T[]; value?: T; editor: boolean; onPick: (v: T | undefined) => void; label: string }) {
  return (
    <div className={styles.pills} role="group" aria-label={label}>
      {values.map((v) => (
        <button key={v} className={styles.pill} aria-pressed={v === value} disabled={!editor} onClick={() => onPick(v === value ? undefined : v)}>
          {v}
        </button>
      ))}
    </div>
  )
}

function StatusSection({ n, card, editor }: P) {
  const { wid, evidence } = useWs()
  const warn = mismatch(card.validation, evidence.filter((e) => e.nodeId === card.id))
  return (
    <PanelSection n={n} name="status">
      <Pills values={VALIDATIONS} value={card.validation} editor={editor} label="Status" onPick={(v) => void updateCard(wid, card, { validation: v }, 'status of')} />
      {warn && <p className={styles.warn}>! {warn}</p>}
    </PanelSection>
  )
}

// What was learned (D-137): filled cell = supports, outlined = against (a click turns it round); `+ evidence` opens a
// small form: the text, for or against, its kind, where it came from, when.
function EvidenceSection({ n, card, editor }: P) {
  const { wid, evidence } = useWs()
  const list = evidence.filter((e) => e.nodeId === card.id).sort((a, b) => a.createdAt - b.createdAt)
  const [adding, setAdding] = useState(false)
  const t = tally(list)
  return (
    <PanelSection
      n={n}
      name="evidence"
      count={list.length ? `${t.supports} for · ${t.contradicts} against` : undefined}
      add={editor ? { label: 'evidence', onClick: () => setAdding(true) } : undefined}
      empty={!list.length && !adding}
    >
      {list.map((e) => (
        <EvidenceRow key={e.id} e={e} editor={editor} />
      ))}
      {adding && (
        <EvidenceForm
          onDone={(fields) => {
            setAdding(false)
            if (fields) void addEvidence(wid, { ...fields, nodeId: card.id, nodeType: card.type as Evidence['nodeType'] })
          }}
        />
      )}
    </PanelSection>
  )
}

function EvidenceRow({ e, editor }: { e: Evidence; editor: boolean }) {
  const { wid } = useWs()
  const [editing, setEditing] = useState(false)
  const src = [e.kind, e.source, e.date].filter(Boolean).join(' · ')
  if (editing)
    return (
      <EvidenceForm
        start={e}
        onDone={(fields) => {
          setEditing(false)
          if (fields) void updateEvidence(wid, e.id, fields)
        }}
      />
    )
  return (
    <div className={styles.ev}>
      <button
        className={styles.cell}
        data-filled={e.stance === 'supports' || undefined}
        disabled={!editor}
        title={e.stance === 'supports' ? 'Supports it (click: against)' : 'Against it (click: supports)'}
        onClick={() => void updateEvidence(wid, e.id, { stance: e.stance === 'supports' ? 'contradicts' : 'supports' })}
      />
      <span className={styles.evText} onClick={editor ? () => setEditing(true) : undefined}>
        {e.text}
      </span>
      {editor && (
        <button className={styles.x} title="Remove" onClick={() => void removeEvidence(wid, e.id)}>
          ×
        </button>
      )}
      {(src || e.url) && (
        <span className={styles.src}>
          {src}
          {e.url && (
            <a href={e.url} target="_blank" rel="noreferrer">
              {' '}
              ↗
            </a>
          )}
        </span>
      )}
    </div>
  )
}

export type EvidenceFields = { text: string; stance: Stance; kind: EvidenceKind; source?: string; date?: string; url?: string }

export function EvidenceForm({ start, onDone }: { start?: Partial<Evidence>; onDone: (fields: EvidenceFields | null) => void }) {
  const [f, setF] = useState<EvidenceFields>({ text: start?.text ?? '', stance: start?.stance ?? 'supports', kind: start?.kind ?? 'interview', source: start?.source, date: start?.date, url: start?.url })
  const text = useRef<HTMLTextAreaElement>(null)
  useAutoGrow(text, f.text)
  const save = () => onDone(f.text.trim() ? { ...f, text: f.text.trim() } : null)
  const keys = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter' && !e.shiftKey) (e.preventDefault(), save())
    if (e.key === 'Escape') onDone(null)
  }
  return (
    <div className={styles.form}>
      <textarea ref={text} className={styles.input} rows={1} autoFocus placeholder="What was learned, in a sentence or a quote" value={f.text} maxLength={2000} onChange={(e) => setF({ ...f, text: e.target.value })} onKeyDown={keys} />
      <Pills values={['supports', 'contradicts'] as const} value={f.stance} editor label="For or against" onPick={(v) => setF({ ...f, stance: v ?? f.stance })} />
      <Pills values={EVIDENCE_KINDS} value={f.kind} editor label="Kind" onPick={(v) => setF({ ...f, kind: v ?? f.kind })} />
      <div className={styles.formRow}>
        <input className={styles.input} placeholder="from (who, where)" value={f.source ?? ''} maxLength={200} onChange={(e) => setF({ ...f, source: e.target.value })} onKeyDown={keys} />
        <input className={styles.input} type="date" value={f.date ?? ''} onChange={(e) => setF({ ...f, date: e.target.value || undefined })} onKeyDown={keys} aria-label="When" />
      </div>
      <input className={styles.input} placeholder="link (optional)" value={f.url ?? ''} maxLength={2000} onChange={(e) => setF({ ...f, url: e.target.value })} onKeyDown={keys} />
      <div className={styles.formActions}>
        <button className={styles.small} data-tone="primary" onClick={save}>
          {start?.id ? 'save' : 'add'}
        </button>
        <button className={styles.small} onClick={() => onDone(null)}>
          cancel
        </button>
        <span className={styles.hint}>enter {start?.id ? 'saves' : 'adds'} · esc</span>
      </div>
    </div>
  )
}

// What a section's add links: cards of these types (null: any), with this kind (null: the old default), from this card
// or to it.
export type LinkAdd = { label: string; types: AnyType[] | null; kind: EdgeKind | null; from: 'me' | 'other' }

// Links as rows like the old panel's (D-154): the kind's colour, its name with an arrow (→ from this card, ← to it),
// the other card, its type. A row goes to that card; `×` unlinks.
export function LinkSection({ n, name, card, cards, editor, links, add, count, extra }: P & { name: string; links: Edge[]; add: LinkAdd; count?: boolean; extra?: ReactNode }) {
  const { wid } = useWs()
  const [picking, setPicking] = useState(false)
  const byId = new Map(cards.map((c) => [c.id, c]))
  const pick = (other: Card) => {
    setPicking(false)
    const [from, to] = add.from === 'me' ? [card, other] : [other, card]
    const id = createEdge(wid, from, to, add.kind ?? defaultKind(from.type, to.type))
    // A plain link opens with its label ready, as one drawn on the plane does (D-154).
    if (!add.kind) useCanvasView.setState({ linkSelected: id, linkLabelling: true, cardSelected: null })
  }
  return (
    <PanelSection n={n} name={name} count={count && links.length ? links.length : undefined} add={editor ? { label: add.label, onClick: () => setPicking(true) } : undefined} empty={!links.length && !picking && !extra}>
      {links.map((e) => {
        const other = byId.get(e.fromId === card.id ? e.toId : e.fromId)!
        const out = e.fromId === card.id
        const kind = KIND_LABEL[e.kind] ?? e.kind
        return (
          <div key={e.id} className={styles.link} style={{ ['--tone' as string]: linkTone(e.kind) }}>
            <span className={styles.swatch} aria-hidden />
            <span className={styles.kind}>{out ? `${kind} →` : `← ${kind}`}</span>
            <button className={styles.to} onClick={() => goToCard(other)} title={e.label ? `"${e.label}"` : undefined}>
              {other.title || PLACEHOLDER[other.type]}
            </button>
            <span className={styles.type}>{other.type === 'feature' ? [other.priority, other.status].filter(Boolean).join(' · ') || 'feature' : other.type}</span>
            {editor && (
              <button className={styles.x} title="Unlink" onClick={() => void deleteEdge(wid, e.id)}>
                ×
              </button>
            )}
          </div>
        )
      })}
      {extra}
      {picking && (
        <CardPicker
          card={card}
          cards={cards}
          types={add.types}
          exclude={new Set([card.id, ...links.map((e) => (e.fromId === card.id ? e.toId : e.fromId))])}
          onPick={pick}
          onClose={() => setPicking(false)}
        />
      )}
    </PanelSection>
  )
}

// Choosing a card on this plane by typing part of its title; with types given, a new card of the first type can be
// made from what was typed (placed under this one, clear of the panel on its right).
export function CardPicker({
  card,
  cards,
  types,
  exclude,
  onPick,
  onClose,
  make: makes = true,
}: {
  card: Card
  cards: Card[]
  types: AnyType[] | null
  exclude: Set<string>
  onPick: (c: Card) => void
  onClose: () => void
  // Whether what's typed can make a new card of the first type.
  make?: boolean
}) {
  const { wid } = useWs()
  const [q, setQ] = useState('')
  const [at, setAt] = useState(0)
  const found = cards
    .filter((c) => !exclude.has(c.id) && (!types || types.includes(c.type)) && (c.title || '').toLowerCase().includes(q.trim().toLowerCase()))
    .slice(0, 8)
  // A package is never made from here (only from a selection, D-239).
  const makeType = !makes || types?.[0] === 'package' ? undefined : types?.[0]
  const make = async () => {
    if (!makeType || !q.trim()) return
    // On the plane it's looked at on, under its spot there (D-281).
    const id = await addCard(wid, planeOf(card), makeType, [card.x + CARD.w / 2, card.y + CARD.h * 2], cards)
    const made: Card = { id, type: makeType, pieceId: planeOf(card), title: q.trim(), x: 0, y: 0 }
    await retitleCard(wid, made, q.trim(), true)
    onPick(made)
  }
  const rows = found.length + (makeType && q.trim() ? 1 : 0)
  return (
    <div className={styles.picker}>
      <input
        className={styles.input}
        autoFocus
        placeholder={types ? `find ${types.join(', ')}…` : 'find a card…'}
        value={q}
        onChange={(e) => (setQ(e.target.value), setAt(0))}
        onBlur={() => setTimeout(onClose, 150)}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape') onClose()
          if (e.key === 'ArrowDown') (e.preventDefault(), setAt((a) => Math.min(rows - 1, a + 1)))
          if (e.key === 'ArrowUp') (e.preventDefault(), setAt((a) => Math.max(0, a - 1)))
          if (e.key === 'Enter') {
            e.preventDefault()
            if (at < found.length) onPick(found[at])
            else void make()
          }
        }}
      />
      <div className={styles.found} role="listbox">
        {found.map((c, i) => (
          <button key={c.id} role="option" aria-selected={i === at} className={styles.option} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(c)}>
            <span className={styles.optType} style={{ color: TONE[c.type] }}>
              {c.type}
            </span>
            {c.title || PLACEHOLDER[c.type]}
          </button>
        ))}
        {makeType && q.trim() && (
          <button role="option" aria-selected={at === found.length} className={styles.option} onMouseDown={(e) => e.preventDefault()} onClick={() => void make()}>
            <span className={styles.optType}>new {makeType}</span>“{q.trim()}”
          </button>
        )}
        {!rows && <span className={styles.none}>nothing on this plane matches</span>}
      </div>
    </div>
  )
}

// Selects a card on the plane and brings it into view, clear of the panel.
export function goToCard(c: Card) {
  useCanvasView.setState({ cardSelected: c.id, labelSelected: null, linkSelected: null })
  const { planeCam: v, size, beside, split } = useCanvasView.getState()
  if (!v) return
  // Where it's drawn (an unfolded package is its frame).
  const b = onPlane.boxes().find((x) => x.id === c.id)?.box ?? { x: c.x, y: c.y, w: CARD.w, h: CARD.h }
  const area = beside ? Math.round(size.w * split) : size.w
  const room = area - Math.min(SIDE_PANEL_W, area)
  const [sx0, sy0] = [v.ox + b.x * v.zoom, v.oy + b.y * v.zoom]
  const [sx1, sy1] = [sx0 + b.w * v.zoom, sy0 + b.h * v.zoom]
  if (sx0 >= 48 && sx1 <= room - 48 && sy0 >= 56 && sy1 <= size.h - 56) return
  const cx = room / 2
  glide(v, { ...v, ox: cx - (b.x + b.w / 2) * v.zoom, oy: size.h / 2 - (b.y + b.h / 2) * v.zoom }, 420, (to) => useCanvasView.setState({ planeCam: to }))
}

// A piece's name with its leading number apart, magenta (D-266, D-276): `01 Pazar`.
function PlaneName({ name }: { name: string }) {
  const m = /^(\d{1,4})(?:[\s.·:—–-]+(.*))?$/.exec(name.trim())
  if (!m) return <>{name}</>
  return (
    <>
      <span className={styles.planeNum}>{m[1]}</span> {m[2] ?? ''}
    </>
  )
}

// The planes it's on (D-281): the same card on each. A name goes there (into its focus, gliding to the card), `here`
// marks the one in focus, `×` takes it off one (while it's on another); `+ place on` brings it to another plane, right of
// what's there, with its parts or members.
function PlanesSection({ n, card, editor }: P) {
  const { wid, cards, places, pieces, edges } = useWs()
  const [picking, setPicking] = useState(false)
  const focus = new URLSearchParams(location.search).get('focus')
  const on = planesOf(card, places)
  const name = (id: string) => pieces.find((p) => p.id === id)?.name?.trim() || 'plane'
  const others = pieces.filter((p) => p.kind === 'plane' && !on.includes(p.id))
  const go = (plane: string) => {
    const there = cardsOn(cards, places, plane).find((c) => c.id === card.id)
    if (!there) return
    if (plane === focus) return goToCard(there)
    useGoTo.setState({ asked: { id: card.id, space: plane, label: card.title, glyph: '', box: { x: there.x, y: there.y, w: CARD.w, h: CARD.h }, whole: true } })
  }
  const off = (plane: string) => {
    if (plane === focus) useCanvasView.setState({ cardSelected: null })
    void takeOff(wid, plane, [card], places)
  }
  const placeOn = (plane: string) => {
    setPicking(false)
    const b = cardBounds(cardsOn(cards, places, plane))
    const at: [number, number] = b ? [b.x + b.w + GRID + CARD.w / 2, b.y + CARD.h / 2] : [CARD.w / 2, CARD.h / 2]
    const base = cards.find((c) => c.id === card.id) ?? card
    if (bringIn(wid, plane, [base], { cards, places, edges }, at).ids.length) useHistory.getState().say(`Brought "${card.title || `this ${card.type}`}" to ${name(plane)}`)
  }
  return (
    <PanelSection n={n} name="planes" count={on.length > 1 ? on.length : undefined} add={editor && others.length ? { label: 'place on', onClick: () => setPicking((v) => !v) } : undefined}>
      {on.map((id) => (
        <div key={id} className={styles.link} style={{ ['--tone' as string]: 'var(--fg)' }}>
          <span className={styles.swatch} aria-hidden />
          <button className={styles.to} onClick={() => go(id)} title={id === focus ? 'Show it' : 'Go there'}>
            <PlaneName name={name(id)} />
          </button>
          {id === focus && <span className={styles.type}>here</span>}
          {editor && on.length > 1 && (
            <button className={styles.x} title="Take it off this plane (it stays on the others)" onClick={() => off(id)}>
              ×
            </button>
          )}
        </div>
      ))}
      {picking &&
        others.map((p) => (
          <div key={p.id} className={styles.link}>
            <button className={styles.inlineAdd} onClick={() => placeOn(p.id)}>
              <PlaneName name={name(p.id)} />
            </button>
          </div>
        ))}
    </PanelSection>
  )
}

// Tags (D-056): chips, `×` on hover; `+ tag` types one (Enter adds, a leading `#` dropped).
function TagsSection({ n, card, editor }: P) {
  const { wid } = useWs()
  const tags = card.tags ?? []
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const set = (next: string[]) => void updateCard(wid, card, { tags: next.length ? next : undefined }, 'tag')
  return (
    <PanelSection n={n} name="tags" add={editor ? { label: 'tag', onClick: () => setAdding(true) } : undefined} empty={!tags.length && !adding}>
      <div className={styles.tags}>
        {tags.map((t) => (
          <span key={t} className={styles.chip}>
            #{t}
            {editor && (
              <button className={styles.chipX} title="Remove" onClick={() => set(tags.filter((x) => x !== t))}>
                ×
              </button>
            )}
          </span>
        ))}
        {adding && (
          <input
            className={`${styles.input} ${styles.tagInput}`}
            autoFocus
            placeholder="tag"
            value={draft}
            maxLength={40}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => (setAdding(false), setDraft(''))}
            onKeyDown={(e) => {
              e.stopPropagation()
              const t = draft.trim().replace(/^#/, '')
              if (e.key === 'Enter' && t) {
                if (!tags.includes(t)) set([...tags, t])
                setDraft('')
              }
              if (e.key === 'Escape') (setAdding(false), setDraft(''))
            }}
          />
        )}
      </div>
    </PanelSection>
  )
}

// Notes: Geist, as long as they are; kept on leaving the field (Enter is a new line), Escape leaves it too.
function NotesSection({ n, card, editor }: P) {
  const { wid } = useWs()
  const field = useRef<HTMLTextAreaElement>(null)
  const { draft, setDraft, commit } = useCommit(card.notes ?? '', (v) => void updateCard(wid, card, { notes: v.trim() ? v : undefined }, 'notes of'))
  useAutoGrow(field, draft)
  return (
    <PanelSection n={n} name="notes">
      <textarea
        ref={field}
        className={styles.notes}
        rows={2}
        value={draft}
        readOnly={!editor}
        placeholder={NOTES_HINT[card.type]}
        maxLength={20000}
        aria-label="Notes"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape') e.currentTarget.blur()
        }}
      />
    </PanelSection>
  )
}
