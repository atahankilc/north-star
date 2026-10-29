// What a card is, without Firebase (S3, D-312): its types, fields and the doc → card conversion. data/cards.ts re-exports
// all of it under the same names and keeps the writes.
import { GRID } from './grid'

export const CARD_TYPES = ['customer', 'problem', 'competitor', 'idea', 'feature'] as const
export type CardType = (typeof CARD_TYPES)[number]
// A package (D-239, the old board's D-141): a slice of the chain as one card, made from a selection, never from `+`.
// Every card on a plane is one of these.
export type AnyType = CardType | 'package'
export const ALL_TYPES: AnyType[] = [...CARD_TYPES, 'package']

export const CARD_COLLECTION: Record<AnyType, string> = {
  package: 'packages',
  customer: 'customers',
  problem: 'problems',
  competitor: 'competitors',
  idea: 'ideas',
  feature: 'features',
}

// Every card is the same rectangle (D-055): 8 × 4 grid steps, so a snapped card has a mark on each corner.
export const CARD = { w: 8 * GRID, h: 4 * GRID }

// firestore.rules' validCard and validCompetitor allow 200.
export const TITLE_MAX = 200

// What the card shows besides its title (D-152, D-205): set from the side panel, which isn't back yet, so for now only
// read. A customer, problem or idea has a status (D-137); a competitor its regions (D-145); a feature its priority,
// status, impact and effort (D-138); all of them tags (D-056).
export type Validation = 'hypothesis' | 'testing' | 'validated' | 'invalidated'
export type CardFields = {
  tags?: string[]
  validation?: Validation
  regions?: string[]
  priority?: string
  status?: string
  impact?: string
  effort?: string
  // Its notes (D-219): a competitor's `notes`, every other card's `body`.
  notes?: string
  // A competitor's profile (D-219): what it does, for whom, its price, its site.
  description?: string
  audience?: string
  pricing?: string
  url?: string
  // A feature's must-haves (D-133), which a matrix scores.
  criteria?: { id: string; text: string }[]
  // A feature's parts folded into it as names beside it (D-164, D-225), or a package's members (D-239); only `true`.
  folded?: boolean
  // A package's members (D-239): cards on its plane, by id; ones gone are skipped, never cleaned up (D-141).
  memberIds?: string[]
}

export const VALIDATIONS: Validation[] = ['hypothesis', 'testing', 'validated', 'invalidated']
export const FEATURE_PRIORITIES = ['P1', 'P2', 'P3']
export const FEATURE_STATUSES = ['idea', 'planned', 'building', 'shipped']
export const FEATURE_IMPACTS = ['low', 'medium', 'high']
export const FEATURE_EFFORTS = ['S', 'M', 'L']

// `on`: set when the card is shown on a plane that isn't its home (D-281, `cardsOn`); x/y and `folded` are then its
// place's there, and its spot is written there. `planes`: every plane it's on, its home first, when that's more than its
// home (set as the workspace loads).
// `createdAt`/`updatedAt`: copied from its doc when there (the agent's read layer, S10: what's new, by time).
export type Card = { id: string; type: AnyType; pieceId: string; title: string; x: number; y: number; on?: string; planes?: string[]; createdAt?: number; updatedAt?: number } & CardFields

// Whether a card is on a plane: its home or one it was brought to (D-281).
export const isOnPlane = (c: Pick<Card, 'pieceId' | 'planes'>, plane: string) => c.pieceId === plane || !!c.planes?.includes(plane)

// The field a card's title is stored in: a competitor keeps it as `name`.
export const titleField = (type: AnyType) => (type === 'competitor' ? 'name' : 'title')

// Docs from any of the card collections, as cards; one without a plane (`pieceId`) isn't the app's and is left out.
export type CardDoc = { id: string; pieceId?: string; title?: string; name?: string; x?: number; y?: number; body?: string; createdAt?: number; updatedAt?: number } & CardFields

// A doc that didn't change (the same object, hooks.ts) gives the same card, so what's drawn from it stays memoised.
const made = new WeakMap<CardDoc, Card>()

export function toCards(type: AnyType, docs: CardDoc[]): Card[] {
  return docs.flatMap((d) => {
    const kept = made.get(d)
    if (kept) return [kept]
    const out: Card[] = d.pieceId
      ? [
          {
            id: d.id,
            type,
            pieceId: d.pieceId,
            title: (type === 'competitor' ? d.name : d.title) ?? '',
            x: d.x ?? 0,
            y: d.y ?? 0,
            tags: d.tags,
            validation: d.validation,
            regions: d.regions,
            priority: d.priority,
            status: d.status,
            impact: d.impact,
            effort: d.effort,
            notes: type === 'competitor' ? d.notes : d.body,
            description: d.description,
            audience: d.audience,
            pricing: d.pricing,
            url: d.url,
            criteria: d.criteria,
            folded: d.folded,
            memberIds: d.memberIds,
            ...(typeof d.createdAt === 'number' ? { createdAt: d.createdAt } : {}),
            ...(typeof d.updatedAt === 'number' ? { updatedAt: d.updatedAt } : {}),
          },
        ]
      : []
    if (out[0]) made.set(d, out[0])
    return out
  })
}

// The other way (ops' project, S3): the card's own doc fields, as toCards reads them back. Lossless for every field
// toCards reads (`toCards(t, [cardDoc(c)])` gives `c` back, without `planes`/`on`, which come from places); its times
// (createdAt, updatedAt) when it has them (a doc's server timestamps that aren't numbers yet are left out).
export function cardDoc(c: Card): CardDoc {
  const d: Record<string, unknown> = { id: c.id, pieceId: c.pieceId, [titleField(c.type)]: c.title, x: c.x, y: c.y }
  for (const k of ['tags', 'validation', 'regions', 'priority', 'status', 'impact', 'effort', 'description', 'audience', 'pricing', 'url', 'criteria', 'folded', 'memberIds', 'createdAt', 'updatedAt'] as const)
    if (c[k] !== undefined) d[k] = c[k]
  if (c.notes !== undefined) d[c.type === 'competitor' ? 'notes' : 'body'] = c.notes
  // Read back unchanged, the doc gives this very card (toCards' memo), so a copy of the workspace keeps its objects.
  if (!c.planes && !c.on) made.set(d as CardDoc, c)
  return d as CardDoc
}
