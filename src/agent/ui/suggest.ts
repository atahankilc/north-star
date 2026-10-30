// The empty chat's first asks (S14, D-312; agent.md §6 Phase 6 "empty state with good first asks"): a few lines chosen
// from what the workspace holds, so each one has something to answer. The skills (S17) are listed beside them (Agent.tsx FirstSkills).
import type { WorkspaceCtx } from '../../state/wsStore'
import { kindOfPiece } from '../../model/pieces'

const q = (s: string | undefined, n = 28) => {
  const flat = (s ?? '').replace(/\s+/g, ' ').trim()
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat
}

export function firstAsks(ws: WorkspaceCtx | null, focus?: string | null): string[] {
  if (!ws) return []
  const out: string[] = []
  const named = (kind: string) => ws.pieces.filter((p) => kindOfPiece(p) === kind && p.name?.trim())
  const plane = (focus && ws.pieces.find((p) => p.id === focus && kindOfPiece(p) === 'plane' && p.name?.trim())) || named('plane')[0]
  const problems = ws.cards.filter((c) => c.type === 'problem')
  const backed = new Set(ws.evidence.map((e) => e.nodeId))
  if (problems.length) out.push(problems.some((c) => !backed.has(c.id)) ? 'which problems have no evidence yet?' : 'which problems are we least sure about?')
  const today = new Date().toISOString().slice(0, 10)
  const decks = named('kanban')
  const late = decks.find((d) => ws.tasks.some((t) => t.pieceId === d.id && t.due && t.due < today))
  const deck = late ?? decks.find((d) => ws.tasks.some((t) => t.pieceId === d.id))
  if (deck) out.push(late ? `what's late on "${q(deck.name)}"?` : `what's next on "${q(deck.name)}"?`)
  if (plane) out.push(`summarise "${q(plane.name)}"`)
  const rival = ws.cards.find((c) => c.type === 'competitor' && c.title.trim())
  if (rival && out.length < 4) out.push(`how do we compare with ${q(rival.title, 24)}?`)
  if (out.length < 4) out.push('add an idea "…" for our biggest problem')
  if (!out.length) out.push('what should we write down first?')
  return out.slice(0, 4)
}
