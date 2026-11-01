// The workspaces page's pieces (D-338, docs/specs/workspaces-page.md §1–2): drawn as the canvas draws its pieces
// (graphite, a band in its colour on top, its name cut into the edge, Marks on hover and on the keyboard's pick).
// Clicking one goes into the workspace; its actions are in its menu (`⋯`, right-click), never on its face.
import { useEffect, useState, type ReactNode } from 'react'
import { ago } from '../../ui/foundation/ago'
import { Button } from '../../ui/primitives/Button'
import { Label } from '../../ui/primitives/Label'
import { Marks } from '../../ui/primitives/Marks'
import { Num } from '../../ui/primitives/Rule'
import type { WithId } from '../../data/hooks'
import type { Workspace } from '../../data/model'
import { roleOf } from '../../data/workspaces'
import { sinceLines, useHereNow, useNames, useNewTasks, useSince, useSummary, type Visit } from '../../data/glance'
import type { ChangeKind } from '../../model/changeLog'
import { WorkspacePicture } from './WorkspacePicture'
import styles from './Workspaces.module.css'

// A piece: its band's colour, its name cut into the top edge, Marks. `onOpen` makes the whole of it a target.
export function Piece({ band, cut, tier = 'm', picked, onOpen, onMenu, className, children }: {
  band: string
  cut: ReactNode
  tier?: 's' | 'm' | 'l'
  picked?: boolean
  onOpen?: () => void
  onMenu?: (at: [number, number]) => void
  className?: string
  children: ReactNode
}) {
  const [hover, setHover] = useState(false)
  return (
    <article
      className={[styles.piece, className].filter(Boolean).join(' ')}
      style={{ '--band': band } as React.CSSProperties}
      data-open={onOpen ? true : undefined}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onContextMenu={onMenu ? (e) => (e.preventDefault(), onMenu([e.clientX, e.clientY])) : undefined}
    >
      {cut !== null && <Label className={styles.cut}>{cut}</Label>}
      {/* An invisible layer over the whole piece: it opens the workspace. */}
      {onOpen && <button /* kit-ok: a layer over the whole piece, not a [verb] */ type="button" className={styles.open} onClick={onOpen} aria-label="open" tabIndex={-1} />}
      {children}
      {onOpen && <Marks tier={tier} hover={hover} selected={picked} />}
    </article>
  )
}

// How many people are in it.
export function People({ w }: { w: WithId<Workspace> }) {
  const n = w.memberIds.length
  return <span className={styles.people}>{n} {n === 1 ? 'person' : 'people'}</span>
}

export function HereNow({ names }: { names: string[] }) {
  if (!names.length) return null
  return <span className={styles.here} title={names.join(', ')}>{names.length} here now</span>
}

// `2h ago`, `just now`.
const agoText = (t: number) => (ago(t) === 'now' ? 'just now' : `${ago(t)} ago`)

// What a kind of change reads as (the log holds kinds, never text, D-312).
const KIND_WORD: Partial<Record<ChangeKind, [string, string]>> = {
  customers: ['customer', 'customers'],
  problems: ['problem', 'problems'],
  competitors: ['competitor', 'competitors'],
  ideas: ['idea', 'ideas'],
  features: ['feature', 'features'],
  packages: ['package', 'packages'],
  labels: ['text', 'texts'],
  cells: ['cell', 'cells'],
  tasks: ['task', 'tasks'],
  edges: ['link', 'links'],
  pieces: ['piece', 'pieces'],
  documents: ['document', 'documents'],
  evidence: ['evidence', 'evidence'],
}
const CARD_KINDS = new Set(['customers', 'problems', 'competitors', 'ideas', 'features', 'packages', 'places'])
export function kindsText(kinds: Record<string, number>): string {
  const cards = Object.entries(kinds).filter(([k]) => CARD_KINDS.has(k)).reduce((n, [, v]) => n + v, 0)
  const parts: string[] = cards ? [`${cards} ${cards === 1 ? 'card' : 'cards'}`] : []
  for (const [k, n] of Object.entries(kinds).sort((a, b) => b[1] - a[1])) {
    if (CARD_KINDS.has(k)) continue
    const word = KIND_WORD[k as ChangeKind]
    if (word) parts.push(`${n} ${n === 1 ? word[0] : word[1]}`)
  }
  return parts.slice(0, 3).join(', ') || 'changes'
}

// ── The continue piece: the workspace you left ──────────────────────────────────────────────────────────────────
export function ContinuePiece({ w, uid, visit, picked, onOpen, onMenu }: {
  w: WithId<Workspace>
  uid: string
  visit: Visit | undefined
  picked?: boolean
  onOpen: () => void
  onMenu: (at: [number, number]) => void
}) {
  const summary = useSummary(w.id).data
  const since = useSince(w.id, uid, visit?.visited, 20).data
  const lines = sinceLines(since)
  const names = useNames(w.id, lines.map((l) => l.by))
  const here = useHereNow(w.id, w.memberIds, uid)
  const role = roleOf(w, uid) ?? 'editor'
  return (
    <Piece band="var(--accent-cyan)" tier="l" picked={picked} onOpen={onOpen} onMenu={onMenu} className={styles.hero} cut={<><Num n={1} /> continue <span className={styles.kind}>· {role}</span></>}>
      <div className={styles.heroPic}>
        <WorkspacePicture summary={summary} />
      </div>
      <div className={styles.heroSide}>
        <h2 className={styles.heroName}>{w.name}</h2>
        {w.description && <p className={styles.about}>{w.description}</p>}
        <Label className={styles.caps}>since you left{visit?.visited ? ` · ${agoText(visit.visited)}` : ''}</Label>
        <ul className={styles.since}>
          {lines.length ? (
            lines.slice(0, 4).map((l) => (
              <li key={l.by}>
                <span className={styles.who}>{names[l.by] ?? 'someone'}</span> {kindsText(l.kinds)} <span className={styles.t}>{ago(l.at)}</span>
              </li>
            ))
          ) : (
            <li className={styles.faint}>nothing new since you left</li>
          )}
        </ul>
        <div className={styles.go}>
          <Button size="md" accent="cyan" tone="main" onClick={onOpen}>
            continue ↵
          </Button>
          <HereNow names={here} />
          <span className={styles.grow} />
          <Button icon aria-label={`more for ${w.name}`} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onMenu([r.left, r.bottom]) }}>
            ⋯
          </Button>
        </div>
      </div>
    </Piece>
  )
}

// ── Another workspace: a small piece ─────────────────────────────────────────────────────────────────────────────
export function OtherPiece({ w, n, uid, visit, newTasks, picked, onOpen, onMenu }: {
  w: WithId<Workspace>
  n: number
  uid: string
  visit: Visit | undefined
  newTasks: number
  picked?: boolean
  onOpen: () => void
  onMenu: (at: [number, number]) => void
}) {
  const summary = useSummary(w.id).data
  const fresh = useSince(w.id, uid, visit?.visited, 5).data.length
  const here = useHereNow(w.id, w.memberIds, uid)
  const role = roleOf(w, uid) ?? 'editor'
  return (
    <Piece band="var(--piece-edge)" picked={picked} onOpen={onOpen} onMenu={onMenu} className={styles.mini} cut={<><Num n={n} /> <span className={styles.kind}>{role}</span></>}>
      <div className={styles.miniPic}>
        <WorkspacePicture summary={summary} />
      </div>
      <div className={styles.miniInfo}>
        <span className={styles.miniName}>{w.name}</span>
        <span className={styles.row}>
          <People w={w} />
          <HereNow names={here} />
          {fresh > 0 && <span className={styles.fresh}>new</span>}
          {newTasks > 0 && <span className={styles.mine}>☐ {newTasks}</span>}
          <span className={styles.grow} />
          {visit?.visited ? ago(visit.visited) : ''}
        </span>
      </div>
    </Piece>
  )
}

// Counts that live per workspace but are shown together (tasks new for you): one hook each, reported up.
export function NewTasksOf({ wid, uid, seen, onCount }: { wid: string; uid: string; seen: number | undefined; onCount: (wid: string, n: number) => void }) {
  const n = useNewTasks(wid, uid, seen)
  useEffect(() => onCount(wid, n), [wid, n, onCount])
  return null
}
