// The workspaces page's cards (D-338, D-390; docs/specs/workspaces-page.md §1–2): round with a line (PieceCard), a
// picture of the workspace's first canvas, its name, who's in it, what waits for you there as words on a wash, and what
// others changed since you left, person by person in their colour. Clicking one goes into the workspace; its actions
// are in its menu (`⋯`, right-click), never on its face.
import { useEffect } from 'react'
import { ago } from '../../ui/foundation/ago'
import { Avatar } from '../../ui/primitives/Avatar'
import { Button } from '../../ui/primitives/Button'
import { Chip } from '../../ui/primitives/Chip'
import { Label } from '../../ui/primitives/Label'
import { PieceCard } from '../../ui/patterns/PieceCard'
import type { WithId } from '../../data/hooks'
import type { Workspace } from '../../data/model'
import { roleOf } from '../../data/workspaces'
import { presenceColor } from '../../data/presence'
import { sinceCut, sinceLines, SINCE_MAX, useHereNow, useNames, useNewTasks, useSince, useSummary, type Here, type Visit } from '../../data/glance'
import type { ChangeEntry, ChangeKind } from '../../model/changeLog'
import { useThemeAccent } from '../../state/theme'
import { WorkspacePicture } from './WorkspacePicture'
import styles from './Workspaces.module.css'
import { people, plural } from '../../model/words'
import { MoreIcon } from '../../ui/primitives/hudIcons'

// The workspace's menu (open, rename, invite code, leave, delete), under its `⋯`: right-click opens the same.
function More({ name, onMenu }: { name: string; onMenu: (at: [number, number]) => void }) {
  return (
    <Button icon aria-label={`more for ${name}`} title="more: rename, invite code, leave, delete" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onMenu([r.left, r.bottom]) }}>
      <MoreIcon />
    </Button>
  )
}

// How many people are in it.
export function People({ w }: { w: WithId<Workspace> }) {
  const n = w.memberIds.length
  return <span className={styles.people}>{people(n)}</span>
}

// Who's in it now: a lamp that beats, their circles in their colours, `here now`.
function HereNow({ here }: { here: readonly Here[] }) {
  const accent = useThemeAccent()
  if (!here.length) return null
  return (
    <span className={styles.here} title={here.map((p) => p.name).join(', ')}>
      <span className={styles.lamp} aria-hidden />
      <span className={styles.faces}>
        {here.slice(0, 3).map((p) => (
          <Avatar key={p.uid} name={p.name} color={accent(p.color)} size="sm" />
        ))}
      </span>
      {here.length > 3 ? `+${here.length - 3} ` : ''}here now
    </span>
  )
}

// What waits for you in a workspace, in words (D-390: `☐ 2` said too little): tasks given to you since you last
// looked, people asking to join (owners).
export function Waiting({ tasks, asking }: { tasks: number; asking: number }) {
  if (tasks <= 0 && asking <= 0) return null
  return (
    <>
      {tasks > 0 && <Chip variant="soft" tone="var(--accent-yellow)">{plural(tasks, 'new task')}</Chip>}
      {asking > 0 && <Chip variant="soft" tone="var(--accent-magenta)">{asking} ask to join</Chip>}
    </>
  )
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
function kindsText(kinds: Record<string, number>): string {
  const cards = Object.entries(kinds).filter(([k]) => CARD_KINDS.has(k)).reduce((n, [, v]) => n + v, 0)
  const parts: string[] = cards ? [plural(cards, 'card')] : []
  for (const [k, n] of Object.entries(kinds).sort((a, b) => b[1] - a[1])) {
    if (CARD_KINDS.has(k)) continue
    const word = KIND_WORD[k as ChangeKind]
    if (word) parts.push(`${n} ${n === 1 ? word[0] : word[1]}`)
  }
  return parts.slice(0, 3).join(', ') || 'changes'
}

// Since you left: who changed what, a line each, the name in that person's colour (their own, by their id: outside the
// workspace there's no join order to give them another).
const LINES = 3
function Since({ wid, since, visited, max = LINES }: { wid: string; since: readonly ChangeEntry[]; visited: number | undefined; max?: number }) {
  const lines = sinceLines(since)
  const names = useNames(wid, lines.map((l) => l.by))
  const accent = useThemeAccent()
  if (!lines.length) return null
  const more = lines.length - max
  return (
    <>
      <Label className={styles.caps}>since you left{visited ? ` · ${agoText(visited)}` : ''}</Label>
      <ul className={styles.since}>
        {lines.slice(0, max).map((l) => (
          <li key={l.by}>
            <span className={styles.who} style={{ color: accent(presenceColor(l.by)) }}>{names[l.by] ?? 'someone'}</span> {kindsText(l.kinds)} <span className={styles.t}>{ago(l.at)}</span>
          </li>
        ))}
        {(more > 0 || sinceCut(since)) && <li className={styles.t}>{more > 0 ? `+${more} more ${more === 1 ? 'person' : 'people'}` : 'and more'}</li>}
      </ul>
    </>
  )
}

// ── The continue card: the workspace you left ───────────────────────────────────────────────────────────────────
export function ContinuePiece({ w, uid, visit, newTasks = 0, asking = 0, picked, onOpen, onMenu }: {
  w: WithId<Workspace>
  uid: string
  visit: Visit | undefined
  newTasks?: number
  asking?: number
  picked?: boolean
  onOpen: () => void
  onMenu: (at: [number, number]) => void
}) {
  const summary = useSummary(w.id).data
  const since = useSince(w.id, uid, visit?.visited, SINCE_MAX).data
  const here = useHereNow(w.id, w.memberIds, uid)
  const role = roleOf(w, uid) ?? 'editor'
  return (
    <PieceCard tier="l" picked={picked} onOpen={onOpen} onMenu={onMenu} className={styles.hero}>
      <div className={styles.heroPic}>
        <WorkspacePicture summary={summary} />
      </div>
      <div className={styles.heroSide}>
        <Label>continue · {role}</Label>
        <h2 className={styles.heroName}>{w.name}</h2>
        {w.description && <p className={styles.about}>{w.description}</p>}
        <Since wid={w.id} since={since} visited={visit?.visited} max={4} />
        {(newTasks > 0 || asking > 0) && (
          <div className={styles.waiting}>
            <Waiting tasks={newTasks} asking={asking} />
          </div>
        )}
        <div className={styles.go}>
          <People w={w} />
          <HereNow here={here} />
          <span className={styles.grow} />
          <More name={w.name} onMenu={onMenu} />
        </div>
      </div>
    </PieceCard>
  )
}

// ── Another workspace: a small card; with changes since you left, a wide one that says them ─────────────────────
export function OtherPiece({ w, uid, visit, newTasks, asking = 0, picked, onOpen, onMenu }: {
  w: WithId<Workspace>
  uid: string
  visit: Visit | undefined
  newTasks: number
  asking?: number
  picked?: boolean
  onOpen: () => void
  onMenu: (at: [number, number]) => void
}) {
  const summary = useSummary(w.id).data
  const since = useSince(w.id, uid, visit?.visited, SINCE_MAX).data
  const here = useHereNow(w.id, w.memberIds, uid)
  const role = roleOf(w, uid) ?? 'editor'
  const wide = since.length > 0
  return (
    <PieceCard picked={picked} onOpen={onOpen} onMenu={onMenu} className={styles.mini} data-wide={wide || undefined}>
      <div className={styles.miniPic}>
        <WorkspacePicture summary={summary} />
      </div>
      <div className={styles.miniInfo}>
        <span className={styles.nameLine}>
          <span className={styles.miniName}>{w.name}</span>
          <span className={styles.people}>{role}</span>
        </span>
        {wide && <Since wid={w.id} since={since} visited={visit?.visited} />}
        {wide && <span className={styles.grow} />}
        <span className={styles.row}>
          <People w={w} />
          <HereNow here={here} />
          <Waiting tasks={newTasks} asking={asking} />
          <span className={styles.grow} />
          {visit?.visited ? ago(visit.visited) : ''}
          <More name={w.name} onMenu={onMenu} />
        </span>
      </div>
    </PieceCard>
  )
}

// Counts that live per workspace but are shown together (tasks new for you): one hook each, reported up.
export function NewTasksOf({ wid, uid, seen, onCount }: { wid: string; uid: string; seen: number | undefined; onCount: (wid: string, n: number) => void }) {
  const n = useNewTasks(wid, uid, seen)
  useEffect(() => onCount(wid, n), [wid, n, onCount])
  return null
}
