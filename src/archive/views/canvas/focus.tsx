// The focus view (D-127): the board showing one card and its chain only. From the card, the chain customer → problem →
// idea → feature is followed both ways, never turning back (an idea shows its problems and their customers, and its
// features, but not the other ideas for the same problems), plus every competitor linked to one of its problems, ideas
// or features (or to them through its features). Cards keep their board positions; everything else is hidden.
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { focusPath } from '../../app/paths'
import { useCanvas } from '../../state/canvasStore'
import type { CompetitorFeature, Edge } from '../../data/model'
import type { BoardItem } from './boardKinds'
import styles from './DetailPanel.module.css'

// Where each type sits along the chain (D-045); competitors aren't on it, they gather around it.
const STEP: Record<string, number> = { customer: 0, problem: 1, idea: 2, feature: 3 }

export function focusSet(
  id: string,
  items: Pick<BoardItem, 'id' | 'type'>[],
  edges: Pick<Edge, 'fromId' | 'toId'>[],
  competitorFeatures: { id: string; competitorId: string }[],
): Set<string> {
  const typeOf = new Map(items.map((i) => [i.id, i.type]))
  const start = typeOf.get(id)
  if (!start) return new Set()
  // A competitor's feature stands for its competitor (it sits behind it, D-058).
  const owner = new Map(competitorFeatures.map((f) => [f.id, f.competitorId]))
  const near = new Map<string, Set<string>>()
  for (const e of edges) {
    const a = owner.get(e.fromId) ?? e.fromId
    const b = owner.get(e.toId) ?? e.toId
    if (a === b || !typeOf.has(a) || !typeOf.has(b)) continue
    near.set(a, (near.get(a) ?? new Set()).add(b))
    near.set(b, (near.get(b) ?? new Set()).add(a))
  }
  const linksOf = (n: string) => [...(near.get(n) ?? [])]
  const onChain = (n: string) => STEP[typeOf.get(n)!] !== undefined

  // A competitor in focus starts from the chain cards it's linked to.
  const seeds = start === 'competitor' ? linksOf(id).filter(onChain) : [id]
  const out = new Set<string>([id, ...seeds])
  // Up the chain (towards customers) and down it (towards features), each only one way.
  for (const dir of [-1, 1]) {
    let front = seeds
    while (front.length) {
      const next: string[] = []
      for (const n of front) {
        for (const m of linksOf(n)) {
          if (!onChain(m) || Math.sign(STEP[typeOf.get(m)!] - STEP[typeOf.get(n)!]) !== dir || out.has(m)) continue
          out.add(m)
          next.push(m)
        }
      }
      front = next
    }
  }
  // Competitors gather around the problems, ideas and features; one only tagged for the same customers isn't about this.
  for (const n of [...out]) {
    if (!onChain(n) || typeOf.get(n) === 'customer') continue
    for (const m of linksOf(n)) if (typeOf.get(m) === 'competitor') out.add(m)
  }
  return out
}

// The cards in focus with their competitors' features, for the board.
export function focusFeatures<T extends Pick<CompetitorFeature, 'competitorId'>>(set: Set<string>, competitorFeatures: T[]): T[] {
  return competitorFeatures.filter((f) => set.has(f.competitorId))
}

// The card last focused in each workspace, so the focus tab goes back to it when nothing is selected.
const last = new Map<string, string>()
export const lastFocus = (wid: string) => last.get(wid) ?? null
export const rememberFocus = (wid: string, id: string) => void last.set(wid, id)

// `[◎ focus]` in a card's panel: opens the focus view on it (not shown on the card it's already on).
export function FocusButton({ wid, id }: { wid: string; id: string }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const here = useLocation().pathname.endsWith('/focus') && params.get('on') === id
  if (here) return null
  return (
    // The panel closes, so it doesn't cover the card the view frames.
    <button
      className={styles.close}
      onClick={() => {
        useCanvas.getState().select(null)
        navigate(focusPath(wid, id))
      }}
      aria-label="Focus on this card and its chain"
    >
      [◎ focus]
    </button>
  )
}
