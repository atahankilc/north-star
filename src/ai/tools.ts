// The assistant's one tool (D-074): propose a set of changes. Nothing is written until the user accepts some of
// them in the chat; then they go through src/data/assistant.ts as one undo step. Deletes too (D-075), with their cascade.
import type { AssistantWrite, ChangeRef } from '../data/assistant'
import { linked } from '../data/edges'
import { newCriterionId } from '../data/comparisons'
import {
  CONFIDENCES,
  EVIDENCE_KINDS,
  EVIDENCE_TYPES,
  STANCES,
  VALIDATIONS,
  COVERAGES,
  CRITERION_SCORES,
  FEATURE_EFFORTS,
  FEATURE_PRIORITIES,
  FEATURE_STATUSES,
  LABEL_SIZES,
  MAX_CRITERIA,
  type BoardType,
  type Criterion,
  type CriterionScore,
  type Edge,
  type Label,
  type NodeType,
} from '../data/model'
import { DESCRIPTION_MAX } from '../data/workspaces'
import { colors } from '../styles/tokens'
import { CARD_H, CARD_W, findFreeSpot } from '../views/canvas/cardLayout'
import { isTitle, labelRoom, titleFullHalf } from '../views/canvas/titleBlock'
import { DEFAULT_H, DEFAULT_W, isSection, rectOf, SECTION_SIZES, textLabels, wrapRect } from '../views/canvas/sections'
import type { WorkspaceCtx } from '../views/workspace/context'
import type { ItemRef } from './context'
import { AREA_LAYOUTS, AREA_SIDES, arrangeAreas, type AreaLayout, type AreaPlan, type AreaSide } from './arrange'

export const PROPOSE = 'propose_changes'

const LINK_KINDS = ['relates', 'depends-on', 'contradicts', 'part-of', 'inspired-by', 'solves', 'competes-with', 'for'] as const
// A customer tag ("for") is added and removed, never edited into another kind (D-108).
const EDITABLE_KINDS = LINK_KINDS.filter((k) => k !== 'for')
const CARD_TYPES = ['customer', 'problem', 'idea', 'feature'] as const
// Far more than one answer should hold; keeps a runaway call from flooding the board.
const MAX_CHANGES = 60
// A project name is a few words; Settings has no limit, a model's answer gets one.
const NAME_MAX = 120

// Strict schemas: every property listed and required; "not given" is null. In an edit an empty string empties a field
// (D-122), except a title or name.
const KEEP_OR_EMPTY = 'Null leaves a field as it is; an empty string empties it.'
// Board text colours by name (D-123), the accents the label bar offers.
const LABEL_COLORS = ['magenta', 'cyan', 'yellow', 'blue', 'green'] as const
const LABEL_HEX: Record<string, string> = { magenta: colors.magenta, cyan: colors.cyan, yellow: colors.yellow, blue: colors.blue, green: colors.green }
const SIDES = ['right', 'left', 'above', 'below'] as const
const NOT_ASSESSED = 'not assessed'
// How sure a matrix cell is (D-136); "not said" clears it.
const NOT_SAID = 'not said'
const str = (description: string) => ({ type: 'string', description })
const optStr = (description: string) => ({ type: ['string', 'null'], description })
const optEnum = (values: readonly string[], description: string) => ({ type: ['string', 'null'], enum: [...values, null], description })
const optBool = (description: string) => ({ type: ['boolean', 'null'], description })
// How text is set (D-130): true sets it, false removes it, null keeps it (a new label: plain).
const STYLE = ['bold', 'italic', 'caps'] as const
const styleProps = (what: string) =>
  Object.fromEntries(STYLE.map((k) => [k, optBool(`${k === 'caps' ? 'ALL CAPS' : k[0].toUpperCase() + k.slice(1)} ${what}. true sets it, false removes it, null keeps it.`)]))
// Only true is stored (D-130): false removes the field, null leaves it.
const styleFields = (r: Raw): Record<string, true | null> =>
  Object.fromEntries(STYLE.flatMap((k): [string, true | null][] => (r[k] === true ? [[k, true]] : r[k] === false ? [[k, null]] : [])))
// A new label: only what is set.
const newStyle = (r: Raw) => Object.fromEntries(STYLE.filter((k) => r[k] === true).map((k) => [k, true]))
const styleWords = (r: Raw) => STYLE.flatMap((k) => (r[k] === true ? [k] : r[k] === false ? [`no ${k}`] : []))
const SIZE_HELP = 'heading (H1, an area), subheading (H2, a part of one), minor (H3, a part of a part), or note'
const optTags = { type: ['array', 'null'], items: { type: 'string' }, description: 'Replaces the tags. Lowercase words, no #.' }
const ref = (what: string) => str(`${what}: a ref from the workspace (without brackets) or the key of an item added in this same proposal.`)
const CONFIDENCE = {
  type: ['string', 'null'],
  enum: [...CONFIDENCES, NOT_SAID, null],
  description: 'How sure: documented (their docs or the workspace say so), inferred (read between the lines), guess; "not said" clears it. Null keeps it.',
}
const near = optStr('Ref or key of a card to place the new card beside, usually the one it will be linked to. Null: beside its own kind.')

function op(name: string, description: string, properties: Record<string, unknown>) {
  return {
    type: 'object',
    description,
    properties: { op: { type: 'string', enum: [name] }, ...properties },
    required: ['op', ...Object.keys(properties)],
    additionalProperties: false,
  }
}

const OPS = [
  op('add_card', 'A new customer, problem, idea or feature card.', {
    key: str('A short name for this new card (e.g. "new1"), so other changes here can refer to it.'),
    type: { type: 'string', enum: CARD_TYPES },
    title: str('Short, like a card title.'),
    notes: optStr('Longer description, shown in its panel.'),
    tags: optTags,
    priority: optEnum(FEATURE_PRIORITIES, 'Features only.'),
    status: optEnum(FEATURE_STATUSES, 'Features only.'),
    effort: optEnum(FEATURE_EFFORTS, 'Features only.'),
    near,
  }),
  op('add_competitor', 'A new competitor card.', {
    key: str('A short name for this new competitor, so its features, links and matrix cells here can refer to it.'),
    name: str('The product or company name.'),
    url: optStr('Homepage, only if you are sure of it.'),
    description: optStr('What it is and does.'),
    pricing: optStr('Plans and prices, only if known.'),
    audience: optStr('Who it is for.'),
    notes: optStr('Strengths, weaknesses, anything else.'),
    tags: optTags,
    near,
  }),
  op('add_competitor_feature', "A feature in a competitor's breakdown (shown stacked behind its card).", {
    key: optStr('Only needed if a link here points at it.'),
    competitor: ref('The competitor'),
    name: str('The feature.'),
    category: optStr('Groups features in the breakdown, e.g. "scheduling", "payroll".'),
    description: optStr('How they do it.'),
  }),
  op('update_card', `Edit an existing customer, problem, idea or feature. ${KEEP_OR_EMPTY}`, {
    target: ref('The card'),
    title: optStr('New title (never empty).'),
    notes: optStr('Replaces the whole notes text; include what should stay.'),
    tags: optTags,
    priority: optEnum(FEATURE_PRIORITIES, 'Features only.'),
    status: optEnum(FEATURE_STATUSES, 'Features only.'),
    effort: optEnum(FEATURE_EFFORTS, 'Features only.'),
    validation: optEnum(
      VALIDATIONS,
      'Customers, problems and ideas: how far from a guess. validated or invalidated only when its evidence shows it.',
    ),
  }),
  op('add_evidence', 'Something learned about a customer, problem or idea (an interview, a quote, a number, a link), listed in its panel.', {
    target: ref('The customer, problem or idea'),
    kind: { type: 'string', enum: EVIDENCE_KINDS },
    text: str('What was learned: a finding or a quote, one or two sentences. Only what the user or a source said, never made up.'),
    stance: { type: 'string', enum: STANCES, description: 'Whether it supports the card or contradicts it.' },
    source: optStr('Who or where it came from, e.g. "Anna, café owner".'),
    url: optStr('A link to it, if there is one.'),
    date: optStr('When it was learned, YYYY-MM-DD.'),
  }),
  op('update_competitor', `Edit an existing competitor. ${KEEP_OR_EMPTY}`, {
    target: ref('The competitor'),
    name: optStr('New name (never empty).'),
    url: optStr('Homepage.'),
    description: optStr('Replaces the description.'),
    pricing: optStr('Replaces the pricing.'),
    audience: optStr('Replaces the audience.'),
    notes: optStr('Replaces the whole notes text; include what should stay.'),
    tags: optTags,
  }),
  op('update_competitor_feature', `Edit a feature in a competitor's breakdown (listed under it with "·"). ${KEEP_OR_EMPTY}`, {
    target: ref('Their feature'),
    name: optStr('New name (never empty).'),
    category: optStr('New category.'),
    description: optStr('Replaces how they do it.'),
  }),
  op('link', 'A link between two items. "for" tags an item with a customer (to = the customer).', {
    from: ref('From'),
    to: ref('To'),
    kind: {
      type: 'string',
      enum: LINK_KINDS,
      description:
        'idea solves problem; customer relates to a problem they have; competitor competes-with the problems it addresses and ideas it rivals; ' +
        'feature inspired-by the idea or competitor feature it comes from; "for" from any item to a customer.',
    },
    label: optStr('Rarely needed: a short note on the link.'),
  }),
  op(
    'edit_link',
    'Change a link that already exists between two items: its kind, its label, or its direction. Write from and to as the ' +
      'link should read afterwards; giving them the other way round from now turns the arrow around.',
    {
      from: ref('From, after the change'),
      to: ref('To, after the change'),
      kind: optEnum(EDITABLE_KINDS, 'The new kind. Null keeps it.'),
      label: optStr('The new note on the link. Null keeps it; an empty string removes it.'),
    },
  ),
  op('add_note', 'A small note written on the board under a card (a reminder, a question, a caveat). Not an area name.', {
    text: str('The note, one short sentence.'),
    near: ref('The card it is about'),
  }),
  op('delete_item', 'Delete an item, like deleting it by hand: its links go too; a competitor takes its features and matrix cells with it.', {
    target: ref('The item'),
    reason: str('Why it should go, in a few words; shown to the user.'),
  }),
  op('unlink', 'Remove every link between two items (either direction), including a "for" tag.', {
    from: ref('One end'),
    to: ref('The other end'),
  }),
  op(
    'arrange_area',
    'Gather cards into one area of the board under a text label. You choose what goes together, how it is laid out, ' +
      'and where it sits; the app works out the positions with room between cards and areas.',
    {
      label: str('The area name as written on the board, 1 to 4 words. If a label with this text exists, it moves with its cards.'),
      items: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Refs (or keys of cards added here) of the cards and competitors in this area, in the order to show them. A card goes in ' +
          'one area at most. May be empty for an area made only of sections.',
      },
      layout: optEnum(
        AREA_LAYOUTS,
        'columns: a column per type (customers, problems, competitors, ideas, features), linked cards level with each other. ' +
          'rows: one row per problem with its customers, competitors, ideas and features beside it, like a flow. ' +
          'grid: a compact block in the given order (many cards of one kind). line: one row in the given order (a journey, ' +
          'steps, a timeline). hub: the first card in the middle and the rest around it (one competitor, customer or problem ' +
          'and what surrounds it). cycle: a ring in the given order, clockwise from the top, nothing in the middle (a loop: a ' +
          'flywheel, a lifecycle, a feedback loop). orbit: the first card in the middle, the cards linked to it on an inner ring, ' +
          'the rest on an outer ring next to what they link to (one problem, its ideas, their features). tree: top-down from the ' +
          'first card, each card under the one it links from (an idea and its features, a breakdown). quadrant: for an area made ' +
          'of 2 to 4 sections: they fill a 2 × 2 in order (top-left, top-right, bottom-left, bottom-right; a SWOT, impact vs ' +
          'effort); name each section for its corner. Null: the app picks.',
      ),
      within: optStr(
        'The label of another arrange_area in this proposal that this area is a section of: its name becomes a subheading ' +
          'inside that area. Null: an area of its own.',
      ),
      beside: optStr('The label of another (not section) arrange_area in this proposal to put this area next to. Null: the app finds room.'),
      side: optEnum(AREA_SIDES, 'Which side of the beside area. Null: right.'),
      frame: optBool(
        'true: a section frame round the area with its name in the frame (sections inside it nest as smaller frames). ' +
          'false: a heading (a section: a subheading) written over its cards. Null: a frame, unless it reuses a heading ' +
          'listed under AREAS ON THE BOARD, which stays a heading.',
      ),
      color: optEnum(
        [...LABEL_COLORS, 'default'],
        'The frame (or heading) in this colour, to tell kinds of areas apart (e.g. one colour per customer segment, or ' +
          'for the core loop). "default" removes it. Null: as it is (new: white).',
      ),
    },
  ),
  op(
    'add_section',
    'Draw a section frame round cards where they are, without moving them (to move cards into place, use arrange_area). ' +
      'Anything else inside the frame belongs to it too, so pick cards that already sit together.',
    {
      label: str('The section name, 1 to 4 words.'),
      items: { type: 'array', items: { type: 'string' }, description: 'Refs (or keys of cards added here) of the cards to frame.' },
    },
  ),
  op('edit_section', "Rename a section frame on the board, or set its name's size, style and colour.", {
    label: str('Its current name, exactly as listed under SECTIONS ON THE BOARD.'),
    text: optStr('The new name. Null keeps it.'),
    size: optEnum(SECTION_SIZES, "The name's size: heading (H1, the default), subheading (H2), minor (H3). Null keeps it."),
    color: optEnum([...LABEL_COLORS, 'default'], 'The frame and its name in this colour; "default" removes it. Null keeps it.'),
    ...styleProps('name'),
  }),
  op('delete_section', 'Remove a section frame from the board; its cards stay where they are.', {
    label: str('Its current name, exactly as listed under SECTIONS ON THE BOARD.'),
    reason: str('Why it should go, in a few words; shown to the user.'),
  }),
  op('add_label', 'Text written on the board: a heading naming what is under it (H1, H2 or H3), or a note. No cards move.', {
    text: str('The text, a few words (a note: one short sentence).'),
    size: { type: 'string', enum: LABEL_SIZES, description: `${SIZE_HELP}.` },
    color: optEnum(LABEL_COLORS, 'Null: the default (white).'),
    above: optStr('Ref or key of the card it goes just above. Null: above the top-left of the board.'),
    ...styleProps('text'),
  }),
  op('edit_label', `Change a label on the board: its text, size, colour, or put it above another card. ${KEEP_OR_EMPTY.split(';')[0]}.`, {
    label: str('Its current text, exactly as listed under AREAS ON THE BOARD or NOTES ON THE BOARD.'),
    text: optStr('The new text.'),
    size: optEnum(LABEL_SIZES, `${SIZE_HELP}.`),
    color: optEnum([...LABEL_COLORS, 'default'], '"default" removes its colour.'),
    above: optStr('Ref or key of a card to move it just above.'),
  }),
  op('move_card', 'Move one card (or a competitor, with its features) next to another card. For whole areas use arrange_area.', {
    target: ref('The card to move'),
    near: ref('The card to put it next to'),
    side: optEnum(SIDES, 'Which side of that card. Null: right.'),
  }),
  op('delete_label', 'Remove a label or a note from the board; its cards stay where they are.', {
    label: str('Its current text, exactly as listed under AREAS ON THE BOARD or NOTES ON THE BOARD.'),
    reason: str('Why it should go, in a few words; shown to the user.'),
  }),
  op('set_matrix_cell', `One cell of the matrix: how well a competitor covers one of OUR features. ${KEEP_OR_EMPTY}`, {
    feature: ref('Our feature'),
    competitor: ref('The competitor'),
    coverage: optEnum([...COVERAGES, NOT_ASSESSED], 'none, partial, full, or better than ours; "not assessed" clears it.'),
    their_feature: optStr(
      "Their version: the ref or key of the competitor's own feature (from its breakdown) that matches ours. Empty string: none.",
    ),
    notes: optStr('Replaces the cell notes.'),
    relevant: optBool(
      "false: they don't do this kind of thing at all, so the cell is left out of the matrix's readings (not the same as " +
        'coverage none: they could and don\'t). true: comparable again. Null keeps it.',
    ),
    confidence: CONFIDENCE,
  }),
  op(
    'set_criteria',
    "One of OUR features' criteria (its must-haves) and how competitors do on each, so the matrix says which part a " +
      'partial competitor covers (D-133). One row per feature: the criteria, then a score list per competitor.',
    {
      feature: ref('Our feature, one already in the workspace'),
      criteria: {
        type: ['array', 'null'],
        items: { type: 'string' },
        description:
          `Replaces its criteria: 3 to 5 (at most ${MAX_CRITERIA}), each a few words saying what it must do, e.g. "traces each ` +
          'request end to end". Concrete enough to check against a competitor\'s docs. A criterion kept word for word keeps ' +
          'its scores. Null keeps the ones it has (see FEATURES).',
      },
      scores: {
        type: 'array',
        description: 'How each competitor does, one entry per competitor scored. Empty: no scores.',
        items: {
          type: 'object',
          properties: {
            competitor: ref('The competitor'),
            scores: {
              type: 'array',
              items: { type: 'string', enum: [...CRITERION_SCORES, NOT_ASSESSED] },
              description:
                'One per criterion, in order: met (the workspace shows they do it), part (some of it), no (shown not to), ' +
                'or "not assessed" when the workspace doesn\'t say. Never guess met.',
            },
            confidence: CONFIDENCE,
          },
          required: ['competitor', 'scores', 'confidence'],
          additionalProperties: false,
        },
      },
    },
  ),
  op(
    'update_project',
    "Edit the workspace's own name or what the team is building (WORKSPACE and WHAT WE'RE BUILDING above), shown in the " +
      "board's project block and in Settings. Null leaves a field as it is.",
    {
      name: optStr("The startup's or project's new name, a few words."),
      description: optStr('Replaces what the team is building: one to three plain sentences, no Markdown.'),
    },
  ),
]

export const PROPOSE_TOOL = {
  type: 'function',
  name: PROPOSE,
  description:
    'Propose changes to the workspace. They are shown to the user as a checklist; nothing changes until they accept. ' +
    'Use it whenever the user asks you to add, link, fill in or edit something, or agrees to a suggestion of yours.',
  strict: true,
  parameters: {
    type: 'object',
    properties: {
      summary: str('One short line saying what this set does, e.g. "Add Deputy with its scheduling features".'),
      changes: { type: 'array', items: { anyOf: OPS } },
    },
    required: ['summary', 'changes'],
    additionalProperties: false,
  },
}

// ---- Reading a proposal ----

type Raw = Record<string, unknown> & { op: string }

// A row in the checklist.
export type Change = {
  n: number
  raw: Raw
  // What it does, in the checklist's words.
  sign: '+' | '~' | '→' | '▦' | '−' | '▤'
  kind: string
  // A board type colours the row (customer green…); competitor features take their competitor's.
  tone: BoardType | null
  text: string
  detail?: string
  // Keys of new items it needs: unchecking one of those unchecks this too.
  needs: string[]
  // Set when it can't be applied (unknown ref, wrong type, already linked).
  problem?: string
  // Removes something (shown struck through).
  removes?: boolean
  // Delete rows in this proposal that remove an item this row uses: while one of them is on, this row is off.
  clashes: number[]
}

export type Proposal = { summary: string; changes: Change[] }

type Resolved = { ref: ChangeRef; name: string; type: NodeType; isNew: boolean }

const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
// Models sometimes copy a ref with its brackets.
export const refKey = (v: unknown) => s(v)?.replace(/^\[|\]$/g, '')
const clip = (t: string, n = 70) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)

// The workspace's own name and description (D-120), as the project block shows them.
export type Project = { name: string; description?: string }

// `labels`: the texts of the board's labels now, so label changes can be checked (D-086). `edges`: its links now, so an
// edit_link row can say what it changes (D-108). `project`: its name and description now, for update_project (D-120).
// `sections`: the names of the board's section frames now (D-131).
export function parseProposal(
  args: string,
  refs: Map<string, ItemRef>,
  labels: string[] = [],
  edges: Edge[] = [],
  project?: Project,
  sections: string[] = [],
  criteria: Map<string, Criterion[]> = new Map(),
): Proposal {
  let data: { summary?: unknown; changes?: unknown }
  try {
    data = JSON.parse(args)
  } catch {
    return { summary: 'The proposal came back garbled.', changes: [] }
  }
  const raws = (Array.isArray(data.changes) ? data.changes : []).slice(0, MAX_CHANGES) as Raw[]

  // New items first, so changes can refer to them in any order.
  // `parent`: a new competitor feature's competitor, as the row gives it.
  const fresh = new Map<string, { type: NodeType; name: string; parent?: unknown }>()
  for (const r of raws) {
    const key = s(r.key)
    if (!key) continue
    if (r.op === 'add_card') fresh.set(key, { type: r.type as NodeType, name: s(r.title) ?? 'Untitled' })
    if (r.op === 'add_competitor') fresh.set(key, { type: 'competitor', name: s(r.name) ?? 'Untitled' })
    if (r.op === 'add_competitor_feature') fresh.set(key, { type: 'competitorFeature', name: s(r.name) ?? 'Untitled', parent: r.competitor })
  }
  const resolve = (v: unknown): Resolved | undefined => {
    const k = refKey(v)
    if (!k) return undefined
    const f = fresh.get(k)
    if (f) return { ref: { key: k, type: f.type }, name: f.name, type: f.type, isNew: true }
    const e = refs.get(k)
    if (e) return { ref: { id: e.id, type: e.type }, name: e.name, type: e.type, isNew: false }
    return undefined
  }
  // The competitor a competitor feature belongs to, as an id or a key.
  const parentOf = (v: unknown): string | undefined => {
    const k = refKey(v)
    if (!k) return undefined
    const f = fresh.get(k)
    if (f) {
      const p = resolve(f.parent)
      return p && idOfRef(p.ref)
    }
    return refs.get(k)?.parent
  }
  const needsOf = (...rs: (Resolved | undefined)[]) => rs.flatMap((r) => (r && 'key' in r.ref ? [r.ref.key] : []))
  const isBoardCard = (t: NodeType) => (CARD_TYPES as readonly string[]).includes(t)
  const hasLabel = (v: unknown) => labels.some((l) => sameLabel(l, v))
  const hasSection = (v: unknown) => sections.some((l) => sameLabel(l, v))
  // Which area each card went to first: a card is in one area at most.
  const areaOf = new Map<string, string>()
  // The areas this proposal arranges, by label: a section or a beside names one of them (D-125).
  const areaNames = raws.filter((r) => r.op === 'arrange_area').map((r) => s(r.label) ?? 'Untitled')

  const changes: Change[] = raws.map((raw, i) => {
    const base = { n: i, raw, needs: [] as string[], clashes: [] as number[] }
    switch (raw.op) {
      case 'add_card': {
        const type = raw.type as BoardType
        const meta = [s(raw.priority), s(raw.status), s(raw.effort) && `effort ${s(raw.effort)}`].filter(Boolean).join(' · ')
        return {
          ...base,
          sign: '+',
          kind: type,
          tone: type,
          text: s(raw.title) ?? 'Untitled',
          detail: [meta, tagText(raw.tags), s(raw.notes) && clip(s(raw.notes)!)].filter(Boolean).join(' · ') || undefined,
          needs: needsOf(resolve(raw.near)),
          problem: isBoardCard(type) ? undefined : 'unknown card type',
        }
      }
      case 'add_competitor':
        return {
          ...base,
          sign: '+',
          kind: 'competitor',
          tone: 'competitor',
          text: s(raw.name) ?? 'Untitled',
          detail:
            [s(raw.pricing) && clip(s(raw.pricing)!, 40), tagText(raw.tags), s(raw.description) && clip(s(raw.description)!), sourcesOf(raw)]
              .filter(Boolean)
              .join(' · ') || undefined,
          needs: needsOf(resolve(raw.near)),
        }
      case 'add_competitor_feature': {
        const c = resolve(raw.competitor)
        return {
          ...base,
          sign: '+',
          kind: 'their feature',
          tone: 'competitor',
          text: `${c?.name ?? '?'}: ${s(raw.name) ?? 'Untitled'}`,
          detail: [s(raw.category), s(raw.description) && clip(s(raw.description)!), sourcesOf(raw)].filter(Boolean).join(' · ') || undefined,
          needs: needsOf(c),
          problem: !c ? 'unknown competitor' : c.type !== 'competitor' ? `${c.name} isn't a competitor` : undefined,
        }
      }
      case 'update_card':
      case 'update_competitor':
      case 'update_competitor_feature': {
        const t = resolve(raw.target)
        const want = raw.op === 'update_competitor' ? 'competitor' : raw.op === 'update_competitor_feature' ? 'competitor feature' : 'card'
        const fit =
          t && (want === 'competitor' ? t.type === 'competitor' : want === 'card' ? isBoardCard(t.type) : t.type === 'competitorFeature')
        const given = Object.entries(raw).filter(([k, v]) => !['op', 'target'].includes(k) && v !== null && v !== undefined)
        const edits = given.map(([k, v]) =>
          k === 'tags' ? `tags ${tagText(v) || 'none'}` : emptied(v) ? `${k} emptied` : `${k} ${clip(String(v), 50)}`,
        )
        const blank = given.find(([k, v]) => (k === 'title' || k === 'name') && emptied(v))
        return {
          ...base,
          sign: '~',
          kind: t?.type === 'competitorFeature' ? 'their feature' : t?.type === 'competitor' ? 'competitor' : (t?.type ?? want),
          tone: t ? (t.type === 'competitorFeature' ? 'competitor' : (t.type as BoardType)) : null,
          text: t?.name ?? '?',
          detail: [...edits, sourcesOf(raw)].filter(Boolean).join(' · ') || undefined,
          needs: needsOf(t),
          problem: !t
            ? 'unknown item'
            : !fit
              ? `${t.name} isn't a ${want}`
              : t.isNew
                ? 'added in this same proposal'
                : blank
                  ? `a ${blank[0]} can't be empty`
                  : edits.length === 0
                    ? 'nothing to change'
                    : undefined,
        }
      }
      case 'link': {
        const from = resolve(raw.from)
        const to = resolve(raw.to)
        const kind = s(raw.kind) ?? 'relates'
        const problem = !from || !to
          ? 'unknown item'
          : from.ref === to.ref || ('id' in from.ref && 'id' in to.ref && from.ref.id === to.ref.id)
            ? 'links an item to itself'
            : kind === 'for' && to.type !== 'customer'
              ? '"for" must point at a customer'
              : undefined
        return {
          ...base,
          sign: '→',
          kind: kind === 'for' ? 'tag' : 'link',
          tone: null,
          text: kind === 'for' ? `${from?.name ?? '?'}  for  ${to?.name ?? '?'}` : `${from?.name ?? '?'}  —${kind}→  ${to?.name ?? '?'}`,
          detail: s(raw.label),
          needs: needsOf(from, to),
          problem,
        }
      }
      case 'edit_link': {
        const from = resolve(raw.from)
        const to = resolve(raw.to)
        const edge = from && to && !from.isNew && !to.isNew ? linkBetween(edges, idOfRef(from.ref), idOfRef(to.ref)) : undefined
        const kind = s(raw.kind) ?? edge?.kind ?? 'relates'
        const label = typeof raw.label === 'string' ? raw.label.trim() : null
        const turns = edge && from && edge.fromId !== idOfRef(from.ref)
        const what = [
          edge && s(raw.kind) && s(raw.kind) !== edge.kind ? `was ${edge.kind}` : undefined,
          turns ? 'turns the arrow around' : undefined,
          label === '' ? 'removes its label' : label ? `label "${clip(label, 50)}"` : undefined,
        ].filter(Boolean)
        return {
          ...base,
          sign: '~',
          kind: 'link',
          tone: null,
          text: `${from?.name ?? '?'}  —${kind}→  ${to?.name ?? '?'}`,
          detail: what.join(' · ') || undefined,
          needs: needsOf(from, to),
          problem: !from || !to
            ? 'unknown item'
            : from.isNew || to.isNew
              ? 'added in this same proposal'
              : edges.length && !edge
                ? 'not linked'
                : edge?.kind === 'for'
                  ? 'a customer tag: unlink it instead'
                  : !what.length && edges.length
                    ? 'nothing to change'
                    : undefined,
        }
      }
      case 'add_note': {
        const near = resolve(raw.near)
        return {
          ...base,
          sign: '+',
          kind: 'note',
          tone: null,
          text: clip(s(raw.text) ?? '', 120),
          detail: near ? `under ${near.name}` : undefined,
          needs: needsOf(near),
          problem: !s(raw.text) ? 'no text' : !near ? 'unknown card' : near.type === 'competitorFeature' ? `${near.name} isn't on the board` : undefined,
        }
      }
      case 'set_matrix_cell': {
        const f = resolve(raw.feature)
        const c = resolve(raw.competitor)
        const theirs = emptied(raw.their_feature) ? undefined : resolve(raw.their_feature)
        const given = typeof raw.their_feature === 'string'
        return {
          ...base,
          sign: '▦',
          kind: 'matrix',
          tone: null,
          text: `${f?.name ?? '?'} × ${c?.name ?? '?'}`,
          detail:
            [
              raw.relevant === false ? 'not relevant' : raw.relevant === true ? 'relevant again' : undefined,
              s(raw.coverage),
              s(raw.confidence),
              given && (theirs ? `their version ${theirs.name}` : emptied(raw.their_feature) ? 'their version emptied' : undefined),
              emptied(raw.notes) ? 'notes emptied' : s(raw.notes) && clip(s(raw.notes)!),
            ]
              .filter(Boolean)
              .join(' · ') || undefined,
          needs: needsOf(f, c, theirs),
          problem: !f || !c
            ? 'unknown item'
            : f.type !== 'feature'
              ? `${f.name} isn't one of our features`
              : c.type !== 'competitor'
                ? `${c.name} isn't a competitor`
                : given && !emptied(raw.their_feature) && !theirs
                  ? 'unknown competitor feature'
                  : theirs && (theirs.type !== 'competitorFeature' || parentOf(raw.their_feature) !== idOfRef(c.ref))
                    ? `${theirs.name} isn't one of ${c.name}'s features`
                    : !s(raw.coverage) && typeof raw.notes !== 'string' && !given && typeof raw.relevant !== 'boolean' && !s(raw.confidence)
                      ? 'nothing to change'
                      : undefined,
        }
      }
      case 'add_evidence': {
        const t = resolve(raw.target)
        const stance = s(raw.stance)
        return {
          ...base,
          sign: '+',
          kind: 'evidence',
          tone: t && (EVIDENCE_TYPES as readonly string[]).includes(t.type) ? (t.type as BoardType) : null,
          text: `${t?.name ?? '?'}: ${stance === 'contradicts' ? '−' : '+'} ${clip(s(raw.text) ?? '', 80)}`,
          detail: [s(raw.kind), s(raw.source), isDate(raw.date) && s(raw.date)].filter(Boolean).join(' · ') || undefined,
          needs: needsOf(t),
          problem: !t
            ? 'unknown item'
            : !(EVIDENCE_TYPES as readonly string[]).includes(t.type)
              ? `${t.name} isn't a customer, problem or idea`
              : !s(raw.text)
                ? 'no text'
                : !(STANCES as readonly string[]).includes(stance ?? '') || !(EVIDENCE_KINDS as readonly string[]).includes(s(raw.kind) ?? '')
                  ? 'unknown kind or stance'
                  : undefined,
        }
      }
      case 'set_criteria': {
        const f = resolve(raw.feature)
        const given = criteriaOf(raw)
        const list = given ?? (f && !f.isNew ? (criteria.get(idOfRef(f.ref)) ?? []).map((k) => k.text) : [])
        const rows = scoresOf(raw).map((x) => ({ ...x, c: resolve(x.competitor) }))
        const bad = rows.find((x) => !x.c || x.c.type !== 'competitor')
        const long = rows.find((x) => x.scores.length !== list.length)
        const twice = raws.filter((r) => r.op === 'set_criteria' && refKey(r.feature) === refKey(raw.feature)).length > 1
        const tally = rows.map((x) => `${x.c?.name ?? '?'} ${x.scores.filter((v) => v === 'met').length}/${list.length}`)
        return {
          ...base,
          sign: '▦',
          kind: 'criteria',
          tone: 'feature',
          text: f?.name ?? '?',
          detail:
            [given && given.map((k, i) => `${i + 1}. ${clip(k, 40)}`).join(' · '), tally.length && `met: ${tally.join(', ')}`]
              .filter(Boolean)
              .join(' — ') || undefined,
          needs: needsOf(f, ...rows.map((x) => x.c)),
          problem: !f
            ? 'unknown item'
            : f.type !== 'feature'
              ? `${f.name} isn't one of our features`
              : f.isNew
                ? 'added in this same proposal'
                : given && !given.length
                  ? 'no criteria'
                  : given && given.length > MAX_CRITERIA
                    ? `more than ${MAX_CRITERIA} criteria`
                    : !list.length
                      ? 'no criteria to score'
                      : bad
                        ? bad.c
                          ? `${bad.c.name} isn't a competitor`
                          : 'unknown competitor'
                        : long
                          ? `${long.c!.name}: ${long.scores.length} scores for ${list.length} criteria`
                          : twice
                            ? 'this feature has two criteria rows'
                            : !given && !rows.length
                              ? 'nothing to change'
                              : undefined,
        }
      }
      case 'arrange_area': {
        const label = s(raw.label) ?? 'Untitled'
        const items = (Array.isArray(raw.items) ? raw.items : []).map((v) => ({ v, r: resolve(v) }))
        const unknown = items.filter((x) => !x.r).length
        const wrong = items.find((x) => x.r && x.r.type === 'competitorFeature')
        const twice = items.find((x) => x.r && areaOf.has(refKey(x.v)!))
        for (const x of items) if (x.r && !areaOf.has(refKey(x.v)!)) areaOf.set(refKey(x.v)!, label)
        const names = items.map((x) => x.r?.name ?? '?')
        const within = s(raw.within)
        const beside = s(raw.beside)
        // A frame unless it says not, or reuses a heading (D-131).
        const frame = typeof raw.frame === 'boolean' ? raw.frame : !hasLabel(label)
        const where = [
          frame ? 'frame' : 'heading',
          s(raw.layout),
          s(raw.color) && (s(raw.color) === 'default' ? 'default colour' : s(raw.color)),
          within && `in ${clip(within, 40)}`,
          beside && `${['above', 'below'].includes(s(raw.side) ?? '') ? s(raw.side) : `${s(raw.side) ?? 'right'} of`} ${clip(beside, 40)}`,
          `${items.length} card${items.length === 1 ? '' : 's'}${hasSection(label) ? ', moves the frame' : hasLabel(label) ? ', moves the label' : ''}`,
        ].filter(Boolean)
        return {
          ...base,
          sign: '▤',
          kind: within ? 'section' : 'area',
          tone: null,
          text: label,
          detail: `${where.join(' · ')}${items.length ? `: ${clip(names.join(', '), 160)}` : ''}`,
          needs: needsOf(...items.map((x) => x.r)),
          problem: !items.length && !raws.some((r) => r.op === 'arrange_area' && sameLabel(label, r.within))
            ? 'no cards'
            : within && (sameLabel(label, within) || !areaNames.some((n) => sameLabel(n, within)))
              ? `no area "${clip(within, 40)}" in this proposal`
              : beside && (sameLabel(label, beside) || !areaNames.some((n) => sameLabel(n, beside)))
                ? `no area "${clip(beside, 40)}" in this proposal`
                : unknown
              ? `${unknown} unknown item${unknown === 1 ? '' : 's'}`
              : wrong
                ? `${wrong.r!.name} can't be moved on its own (it sits behind its competitor)`
                : twice
                  ? `${twice.r!.name} is already in "${areaOf.get(refKey(twice.v)!)}"`
                  : undefined,
        }
      }
      case 'add_label': {
        const above = resolve(raw.above)
        return {
          ...base,
          sign: '+',
          kind: s(raw.size) ?? 'label',
          tone: null,
          text: clip(s(raw.text) ?? '', 120),
          detail: [s(raw.color), ...STYLE.filter((k) => raw[k] === true), above && `above ${above.name}`].filter(Boolean).join(' · ') || undefined,
          needs: needsOf(above),
          problem: !s(raw.text)
            ? 'no text'
            : raw.above != null && !above
              ? 'unknown card'
              : above?.type === 'competitorFeature'
                ? `${above.name} isn't on the board`
                : undefined,
        }
      }
      // rename_label: the older name of edit_label, text only.
      case 'rename_label':
      case 'edit_label': {
        const above = resolve(raw.above)
        const what = [
          s(raw.text) && `→ ${clip(s(raw.text)!, 60)}`,
          s(raw.size),
          s(raw.color) && (s(raw.color) === 'default' ? 'default colour' : s(raw.color)),
          ...styleWords(raw),
          above && `above ${above.name}`,
        ].filter(Boolean)
        return {
          ...base,
          sign: '~',
          kind: 'label',
          tone: null,
          text: s(raw.label) ?? '?',
          detail: what.join(' · ') || undefined,
          needs: needsOf(above),
          problem: !hasLabel(raw.label)
            ? 'no label with this text'
            : raw.above != null && !above
              ? 'unknown card'
              : above?.type === 'competitorFeature'
                ? `${above.name} isn't on the board`
                : !what.length
                  ? 'nothing to change'
                  : undefined,
        }
      }
      case 'move_card': {
        const t = resolve(raw.target)
        const near = resolve(raw.near)
        return {
          ...base,
          sign: '→',
          kind: t?.type === 'competitor' ? 'competitor' : (t?.type ?? 'card'),
          tone: t && t.type !== 'competitorFeature' ? (t.type as BoardType) : null,
          text: t?.name ?? '?',
          detail: near ? `${{ left: 'left of', above: 'above', below: 'below' }[s(raw.side) ?? ''] ?? 'right of'} ${near.name}` : undefined,
          needs: needsOf(near),
          problem: !t || !near
            ? 'unknown item'
            : t.type === 'competitorFeature' || near.type === 'competitorFeature'
              ? `${(t.type === 'competitorFeature' ? t : near).name} sits behind its competitor`
              : t.isNew
                ? 'added in this same proposal: place it with near'
                : idOfRef(t.ref) === idOfRef(near.ref)
                  ? 'next to itself'
                  : areaOf.has(refKey(raw.target)!)
                    ? `${t.name} is already in "${areaOf.get(refKey(raw.target)!)}"`
                    : undefined,
        }
      }
      case 'delete_label':
        return {
          ...base,
          sign: '−',
          kind: 'label',
          tone: null,
          text: s(raw.label) ?? '?',
          detail: s(raw.reason),
          removes: true,
          problem: !hasLabel(raw.label) ? 'no label with this text' : undefined,
        }
      // Section frames (D-131).
      case 'add_section': {
        const items = itemsOf(raw).map((v) => resolve(v))
        const label = s(raw.label) ?? 'Untitled'
        return {
          ...base,
          sign: '▤',
          kind: 'section',
          tone: null,
          text: label,
          detail: `frame round ${items.length} card${items.length === 1 ? '' : 's'}: ${clip(items.map((r) => r?.name ?? '?').join(', '), 160)}`,
          needs: needsOf(...items),
          problem: !items.length
            ? 'no cards'
            : items.some((r) => !r)
              ? 'unknown card'
              : items.find((r) => r!.type === 'competitorFeature')
                ? `${items.find((r) => r!.type === 'competitorFeature')!.name} sits behind its competitor`
                : hasSection(label)
                  ? `a section "${clip(label, 40)}" exists: arrange_area moves it`
                  : // One frame per name: never a second one drawn over the first (D-130).
                    raws.some((o, j) => (o.op === 'arrange_area' || (o.op === 'add_section' && j < i)) && sameLabel(label, o.label))
                    ? `"${clip(label, 40)}" is already an area or section in this proposal`
                    : undefined,
        }
      }
      case 'edit_section': {
        const what = [
          s(raw.text) && `→ ${clip(s(raw.text)!, 60)}`,
          s(raw.size),
          s(raw.color) && (s(raw.color) === 'default' ? 'default colour' : s(raw.color)),
          ...styleWords(raw),
        ].filter(Boolean)
        return {
          ...base,
          sign: '~',
          kind: 'section',
          tone: null,
          text: s(raw.label) ?? '?',
          detail: what.join(' · ') || undefined,
          problem: !hasSection(raw.label) ? 'no section with this name' : !what.length ? 'nothing to change' : undefined,
        }
      }
      case 'delete_section':
        return {
          ...base,
          sign: '−',
          kind: 'section',
          tone: null,
          text: s(raw.label) ?? '?',
          detail: s(raw.reason),
          removes: true,
          problem: !hasSection(raw.label) ? 'no section with this name' : undefined,
        }
      case 'update_project': {
        const name = s(raw.name)?.slice(0, NAME_MAX)
        const about = s(raw.description)?.slice(0, DESCRIPTION_MAX)
        const newName = name && name !== project?.name.trim() ? name : undefined
        const newAbout = about && about !== (project?.description ?? '').trim() ? about : undefined
        return {
          ...base,
          sign: '~',
          kind: 'project',
          tone: null,
          text: newName ?? project?.name ?? name ?? '?',
          detail:
            [newName && project && `was ${clip(project.name, 40)}`, newAbout && `building: ${clip(newAbout, 90)}`].filter(Boolean).join(' · ') ||
            undefined,
          problem: !newName && !newAbout ? 'nothing to change' : undefined,
        }
      }
      case 'delete_item': {
        const t = resolve(raw.target)
        return {
          ...base,
          sign: '−',
          kind: t?.type === 'competitorFeature' ? 'their feature' : (t?.type ?? 'item'),
          tone: t && t.type !== 'competitorFeature' ? (t.type as BoardType) : null,
          text: t?.name ?? '?',
          detail: s(raw.reason),
          removes: true,
          problem: !t ? 'unknown item' : t.isNew ? 'added in this same proposal' : undefined,
        }
      }
      case 'unlink': {
        const from = resolve(raw.from)
        const to = resolve(raw.to)
        return {
          ...base,
          sign: '−',
          kind: to?.type === 'customer' ? 'untag' : 'unlink',
          tone: null,
          text: `${from?.name ?? '?'}  ×  ${to?.name ?? '?'}`,
          removes: true,
          problem: !from || !to ? 'unknown item' : from.isNew || to.isNew ? 'added in this same proposal' : undefined,
        }
      }
      default:
        return { ...base, sign: '~', kind: '?', tone: null, text: String(raw.op), problem: 'unknown change' }
    }
  })

  // Nothing else may use an item this proposal deletes, unless that delete is unticked.
  const deleting = new Map<string, number>()
  for (const c of changes) {
    const k = refKey(c.raw.target)
    if (c.raw.op === 'delete_item' && !c.problem && k) deleting.set(k, c.n)
  }
  for (const c of changes) {
    if (c.raw.op === 'delete_item') continue
    for (const v of [...ITEM_FIELDS.map((f) => c.raw[f]), ...itemsOf(c.raw)]) {
      const d = deleting.get(refKey(v) ?? '')
      if (d !== undefined && !c.clashes.includes(d)) c.clashes.push(d)
    }
  }
  return { summary: s(data.summary) ?? 'Proposed changes', changes }
}

// The link between two items that an edit changes: any link but a customer tag first, either direction.
function linkBetween<E extends Edge>(edges: E[], a: string, b: string): E | undefined {
  const both = edges.filter((e) => (e.fromId === a && e.toId === b) || (e.fromId === b && e.toId === a))
  return both.find((e) => e.kind !== 'for') ?? both[0]
}
const idOfRef = (r: ChangeRef) => ('id' in r ? r.id : r.key)

// The fields of a row that name one item.
const ITEM_FIELDS = ['target', 'from', 'to', 'competitor', 'feature', 'their_feature', 'near', 'above']
// An edit's empty string: empty the field (D-122).
const emptied = (v: unknown) => typeof v === 'string' && !v.trim()

// An arrange_area row's cards; a set_criteria row's competitors.
export const itemsOf = (raw: Raw): unknown[] => [
  ...(Array.isArray(raw.items) ? raw.items : []),
  ...(raw.op === 'set_criteria' ? scoresOf(raw).map((x) => x.competitor) : []),
]

// A `YYYY-MM-DD` date (D-137).
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())

// A set_criteria row (D-133): the criteria given (trimmed, empty ones dropped), or null to keep the feature's.
const criteriaOf = (raw: Raw): string[] | null =>
  Array.isArray(raw.criteria) ? raw.criteria.map((k) => (typeof k === 'string' ? k.trim().slice(0, 200) : '')).filter(Boolean) : null
const scoresOf = (raw: Raw): { competitor: unknown; scores: string[]; confidence: unknown }[] =>
  (Array.isArray(raw.scores) ? raw.scores : [])
    .filter((x): x is Raw => !!x && typeof x === 'object')
    .map((x) => ({ competitor: x.competitor, scores: Array.isArray(x.scores) ? x.scores.map(String) : [], confidence: x.confidence }))
// A cell's confidence from a row (D-136): a value, null to clear ("not said"), undefined to keep.
const sureOf = (v: unknown) => (v === NOT_SAID ? null : (CONFIDENCES as readonly unknown[]).includes(v) ? (v as string) : undefined)
// Labels are named by their text: the same text, ignoring case and spaces at the ends. Nothing names a label with no
// text, like the project block (D-118), whose text is empty.
const sameLabel = (text: string, v: unknown) => !!s(v) && text.trim().toLowerCase() === s(v)!.toLowerCase()

// Where researched facts came from (D-076): the domains of every URL in the row's text fields.
function sourcesOf(raw: Raw): string | undefined {
  const domains = new Set<string>()
  for (const v of Object.values(raw)) {
    if (typeof v !== 'string') continue
    for (const m of v.matchAll(/https?:\/\/(?:www\.)?([^/\s),\]]+)/g)) domains.add(m[1])
  }
  return domains.size ? `sources: ${[...domains].join(', ')}` : undefined
}

function tagText(v: unknown): string {
  return Array.isArray(v) ? v.map((t) => `#${String(t).replace(/^#/, '')}`).join(' ') : ''
}

// Which rows can still be applied against the workspace as it is now (an item may have gone since).
export function stillValid(change: Change, ws: WorkspaceCtx, refs: Map<string, ItemRef>): string | undefined {
  if (change.problem) return change.problem
  const exists = new Set<string>()
  for (const list of [ws.customers, ws.problems, ws.ideas, ws.features, ws.competitors, ws.competitorFeatures]) for (const n of list) exists.add(n.id)
  for (const v of [...ITEM_FIELDS.map((k) => change.raw[k]), ...itemsOf(change.raw)]) {
    const r = refs.get(refKey(v) ?? '')
    if (r && !exists.has(r.id)) return `${r.name} was deleted`
  }
  if (['rename_label', 'edit_label', 'delete_label'].includes(change.raw.op) && !textLabels(ws.labels).some((l) => sameLabel(l.text, change.raw.label))) {
    return 'the label is gone'
  }
  if (['edit_section', 'delete_section'].includes(change.raw.op) && !ws.labels.some((l) => isSection(l) && sameLabel(l.text, change.raw.label))) {
    return 'the section is gone'
  }
  const a = refs.get(refKey(change.raw.from) ?? '')
  const b = refs.get(refKey(change.raw.to) ?? '')
  if (change.raw.op === 'link' && a && b && linked(ws.edges, a.id, b.id)) return 'already linked'
  if (change.raw.op === 'unlink' && a && b && !linked(ws.edges, a.id, b.id)) return 'not linked'
  if (change.raw.op === 'edit_link' && a && b) {
    const edge = linkBetween(ws.edges, a.id, b.id)
    if (!edge) return 'not linked'
    if (edge.kind === 'for') return 'a customer tag: unlink it instead'
  }
  return undefined
}

// ---- Accepted rows → writes ----

// The ticked rows' new items by key, and a row's ref as an id or a key.
function freshRefs(accepted: Change[], refs: Map<string, ItemRef>) {
  const fresh = new Map<string, NodeType>()
  for (const c of accepted) {
    const key = s(c.raw.key)
    if (!key) continue
    if (c.raw.op === 'add_card') fresh.set(key, c.raw.type as NodeType)
    if (c.raw.op === 'add_competitor') fresh.set(key, 'competitor')
    if (c.raw.op === 'add_competitor_feature') fresh.set(key, 'competitorFeature')
  }
  const refOf = (v: unknown): ChangeRef => {
    const k = refKey(v)!
    const t = fresh.get(k)
    if (t) return { key: k, type: t }
    const e = refs.get(k)!
    return { id: e.id, type: e.type }
  }
  return { fresh, refOf }
}

// An arrange_area row's area is a frame (D-131) unless it says not, or it reuses a heading on the board.
const areaFramed = (raw: Raw, ws: WorkspaceCtx) =>
  typeof raw.frame === 'boolean' ? raw.frame : !textLabels(ws.labels).some((l) => sameLabel(l.text, raw.label))

// Where the ticked arrange_area rows put their areas (D-086, D-125, D-126): every card's position now, which ones move,
// the links between cards, and the layout (null without areas).
function planAreas(accepted: Change[], ws: WorkspaceCtx, refs: Map<string, ItemRef>) {
  const { refOf } = freshRefs(accepted, refs)
  const position = new Map<string, { x: number; y: number }>()
  for (const n of [...ws.customers, ...ws.problems, ...ws.ideas, ...ws.features]) position.set(n.id, { x: n.x, y: n.y })
  for (const c of ws.competitors) if (c.x !== undefined && c.y !== undefined) position.set(c.id, { x: c.x, y: c.y })
  const droppedLabels = new Set(
    accepted.filter((c) => c.raw.op === 'delete_label').flatMap((c) => textLabels(ws.labels).filter((l) => sameLabel(l.text, c.raw.label)).map((l) => l.id)),
  )
  const kept = textLabels(ws.labels).filter((l) => !droppedLabels.has(l.id))
  const plans: AreaPlan[] = accepted
    .filter((c) => c.raw.op === 'arrange_area')
    .map((c) => ({
      label: s(c.raw.label)!,
      items: itemsOf(c.raw).map((v) => refOf(v)).map((r) => ({ id: idOfRef(r), type: r.type })),
      layout: s(c.raw.layout) as AreaLayout | undefined,
      within: s(c.raw.within),
      beside: s(c.raw.beside),
      side: s(c.raw.side) as AreaSide | undefined,
      frame: areaFramed(c.raw, ws),
    }))
  // Section frames (D-130): one an area names moves with it; one removed in this set is gone; the rest stay, kept clear.
  const droppedFrames = new Set(
    accepted.filter((c) => c.raw.op === 'delete_section').flatMap((c) => ws.labels.filter((l) => isSection(l) && sameLabel(l.text, c.raw.label)).map((l) => l.id)),
  )
  const frames = ws.labels.filter((l) => isSection(l) && !droppedFrames.has(l.id))
  // One area on its own (with its sections) that is on the board already: tidied where it is, not moved (D-126); a
  // frame from its top-left corner.
  const tops = plans.filter((p) => !p.within || !plans.some((q) => q !== p && sameLabel(q.label, p.within)))
  const loneFrame = tops.length === 1 && tops[0].frame ? frames.find((l) => sameLabel(l.text, tops[0].label)) : undefined
  const lone = tops.length === 1 && !tops[0].frame ? kept.find((l) => sameLabel(l.text, tops[0].label)) : undefined
  if (loneFrame) {
    const [x0, , , y1] = rectOf(loneFrame)
    tops[0].stay = { x: x0, y: y1 }
  } else if (lone) tops[0].stay = { x: lone.x, y: lone.y }
  const moving = new Set(plans.flatMap((p) => p.items.map((i) => i.id)))
  const movingLabels = new Set(ws.labels.filter((l) => plans.some((p) => sameLabel(l.text, p.label))).map((l) => l.id))
  // Which cards are linked, now and by this set's link rows, so an area can put linked cards together; a competitor's
  // features stand for the competitor (they sit behind it, D-058).
  const owner = new Map(ws.competitorFeatures.map((f) => [f.id, f.competitorId]))
  const lift = (id: string) => owner.get(id) ?? id
  const rows = accepted.filter((c) => c.raw.op === 'link').map((c) => [idOfRef(refOf(c.raw.from)), idOfRef(refOf(c.raw.to))])
  const links = [...ws.edges.map((e) => [e.fromId, e.toId]), ...rows].map(([a, b]): [string, string] => [lift(a), lift(b)])
  const layout = plans.length
    ? arrangeAreas(
        plans,
        {
          cards: [...position.entries()].filter(([id]) => !moving.has(id)).map(([id, p]) => ({ id, ...p })),
          labels: kept.filter((l) => !movingLabels.has(l.id)),
          frames: frames.filter((l) => !movingLabels.has(l.id)).map((l) => {
            const [x0, y0, x1, y1] = rectOf(l)
            return { x0, y0, x1, y1 }
          }),
        },
        [...position.values()],
        links,
      )
    : null
  return { position, moving, links, layout }
}

export function toWrites(accepted: Change[], ws: WorkspaceCtx, refs: Map<string, ItemRef>): AssistantWrite[] {
  const { fresh, refOf } = freshRefs(accepted, refs)
  // New cards go in their own kind's column (the board usually reads as columns, D-045): level with the card they're
  // placed near, or under the last of their kind; then the nearest free spot, never on top of another card.
  // Areas first (D-086): their cards (new ones too) get their place from the layout, and what's left is placed around them.
  const { position, moving, layout } = planAreas(accepted, ws, refs)
  const cards = [...position.entries()].filter(([id]) => !moving.has(id)).map(([, p]) => p)
  if (layout) cards.push(...layout.cards.values())
  // The project block (D-118) is far bigger than a card: it takes up the card spots that would overlap it. Unfolded,
  // even when it's drawn folded right now (D-132), so nothing lands where its description shows up close.
  for (const t of textLabels(ws.labels).filter(isTitle)) cards.push(...coverWithCards(t, titleFullHalf()))
  const placed = new Map<string, { x: number; y: number }>()
  const ofType = (type: BoardType) => {
    const list: { x?: number; y?: number }[] = type === 'competitor' ? ws.competitors : ws[`${type}s` as 'ideas']
    return list.filter((c): c is { x: number; y: number } => c.x !== undefined && c.y !== undefined)
  }
  const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]
  const spot = (key: string, type: BoardType, nearRef: unknown): { x: number; y: number } => {
    const k = refKey(nearRef)
    const anchor = (k && placed.get(k)) || (k && refs.get(k) && position.get(refs.get(k)!.id)) || undefined
    const kin = [...ofType(type), ...[...placed.entries()].filter(([pk]) => freshType(pk) === type).map(([, p]) => p)]
    let start: [number, number]
    if (kin.length) start = [median(kin.map((c) => c.x)), anchor ? anchor.y : Math.min(...kin.map((c) => c.y)) - (CARD_H + 0.3)]
    else start = anchor ? [anchor.x + CARD_W + 0.3, anchor.y] : [0, 0]
    const [x, y] = kin.length ? columnSpot(start) : findFreeSpot(start, cards)
    const at = { x, y }
    cards.push(at)
    placed.set(key, at)
    return at
  }
  const freshType = (key: string) => fresh.get(key)
  // Where a card is now in this set: placed, moved or as it was.
  const whereIs = (v: unknown) => {
    const k = refKey(v)
    if (!k) return undefined
    const e = refs.get(k)
    return placed.get(k) ?? layout?.cards.get(e?.id ?? k) ?? layout?.cards.get(k) ?? (e && position.get(e.id))
  }
  // move_card (D-123): beside another card, on the side asked, else the nearest free spot from there.
  const beside = (id: string, nearRef: unknown, side: string): { x: number; y: number } | undefined => {
    const anchor = whereIs(nearRef)
    if (!anchor) return undefined
    const own = position.get(id)
    if (own && cards.includes(own)) cards.splice(cards.indexOf(own), 1)
    const gapX = CARD_W + 0.3
    const gapY = CARD_H + 0.3
    const [dx, dy] = side === 'left' ? [-gapX, 0] : side === 'above' ? [0, gapY] : side === 'below' ? [0, -gapY] : [gapX, 0]
    const [x, y] = findFreeSpot([anchor.x + dx, anchor.y + dy], cards)
    const at = { x, y }
    cards.push(at)
    position.set(id, at)
    return at
  }
  // Up and down the column first, nearest row first; sideways only if the column is full here.
  const columnSpot = ([x, y]: [number, number]): [number, number] => {
    const gapY = CARD_H + 0.3
    const free = (cy: number) => cards.every((c) => Math.abs(c.x - x) >= CARD_W + 0.3 || Math.abs(c.y - cy) >= gapY)
    for (let i = 0; i < 24; i++) for (const cy of i ? [y - i * gapY, y + i * gapY] : [y]) if (free(cy)) return [x, cy]
    return findFreeSpot([x, y], cards)
  }

  const text = (v: unknown) => s(v)
  // In an edit: null (not given) keeps a field, an empty string removes it (null in a write, D-122).
  const edit = (v: unknown) => (emptied(v) ? null : s(v))
  const compact = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
  const tags = (v: unknown) => (Array.isArray(v) ? v.map((t) => String(t).replace(/^#/, '').trim()).filter(Boolean).slice(0, 30) : undefined)

  // Existing cards an area moves: one position update each.
  const moves: AssistantWrite[] = []
  for (const [id, p] of layout?.cards ?? []) {
    const e = [...refs.values()].find((x) => x.id === id)
    if (e) moves.push({ do: 'update', target: { id, type: e.type }, fields: { x: p.x, y: p.y } })
  }

  const notes: { w: Extract<AssistantWrite, { do: 'label' }>; near: unknown }[] = []
  const frames: { w: Extract<AssistantWrite, { do: 'label' }>; items: unknown[] }[] = []
  // Text added or moved above a card (D-123): placed once every card has its place, like notes.
  const texts: { w: Extract<AssistantWrite, { do: 'label' }>; above: unknown }[] = []
  const writes = accepted.map((c): AssistantWrite => {
    const r = c.raw
    switch (r.op) {
      case 'add_card': {
        const type = r.type as BoardType
        const at = layout?.cards.get(s(r.key)!) ?? spot(s(r.key)!, type, r.near)
        const extra = type === 'feature' ? { priority: text(r.priority), status: text(r.status), effort: text(r.effort) } : {}
        return {
          do: 'create',
          key: s(r.key)!,
          type,
          fields: compact({ title: text(r.title) ?? 'Untitled', body: text(r.notes), tags: tags(r.tags), ...extra, ...at }),
        }
      }
      case 'add_competitor': {
        const at = layout?.cards.get(s(r.key)!) ?? spot(s(r.key)!, 'competitor', r.near)
        return {
          do: 'create',
          key: s(r.key)!,
          type: 'competitor',
          fields: compact({
            name: text(r.name) ?? 'Untitled',
            url: text(r.url),
            description: text(r.description),
            pricing: text(r.pricing),
            audience: text(r.audience),
            notes: text(r.notes),
            tags: tags(r.tags),
            ...at,
          }),
        }
      }
      case 'add_competitor_feature':
        return {
          do: 'create',
          key: s(r.key) ?? `feature-${c.n}`,
          type: 'competitorFeature',
          parent: refOf(r.competitor),
          fields: compact({ name: text(r.name) ?? 'Untitled', category: text(r.category), description: text(r.description) }),
        }
      case 'update_card':
      case 'update_competitor': {
        const target = refOf(r.target) as { id: string; type: NodeType }
        const fields =
          r.op === 'update_card'
            ? compact({
                title: text(r.title),
                body: edit(r.notes),
                tags: tags(r.tags),
                priority: text(r.priority),
                status: text(r.status),
                effort: text(r.effort),
                validation: text(r.validation),
              })
            : compact({
                name: text(r.name),
                url: edit(r.url),
                description: edit(r.description),
                pricing: edit(r.pricing),
                audience: edit(r.audience),
                notes: edit(r.notes),
                tags: tags(r.tags),
              })
        return { do: 'update', target, fields }
      }
      case 'move_card': {
        const target = refOf(r.target) as { id: string; type: NodeType }
        // An area that gathers it too has the last word.
        const at = layout?.cards.get(target.id) ?? beside(target.id, r.near, s(r.side) ?? 'right')
        return { do: 'update', target, fields: at ? { x: at.x, y: at.y } : {} }
      }
      case 'update_competitor_feature':
        return {
          do: 'update',
          target: refOf(r.target) as { id: string; type: NodeType },
          fields: compact({ name: text(r.name), category: edit(r.category), description: edit(r.description) }),
        }
      case 'link':
        return { do: 'link', from: refOf(r.from), to: refOf(r.to), kind: s(r.kind) ?? 'relates', label: text(r.label) }
      case 'edit_link': {
        const from = refOf(r.from) as { id: string; type: NodeType }
        const to = refOf(r.to) as { id: string; type: NodeType }
        const edge = linkBetween(ws.edges, from.id, to.id)!
        const fields: Record<string, unknown> = {}
        if (s(r.kind)) fields.kind = s(r.kind)
        // null removes the label (assistant.ts).
        if (typeof r.label === 'string') fields.label = r.label.trim() ? r.label.trim().slice(0, 200) : null
        if (edge.fromId !== from.id) Object.assign(fields, { fromId: from.id, fromType: from.type, toId: to.id, toType: to.type })
        return { do: 'edge', id: edge.id, fields }
      }
      case 'add_note': {
        // Placed once every card has its place, below.
        const w: AssistantWrite = { do: 'label', fields: { text: s(r.text)!.slice(0, 200), size: 'note' } }
        notes.push({ w, near: r.near })
        return w
      }
      case 'delete_item':
        return { do: 'delete', target: refOf(r.target) as { id: string; type: NodeType } }
      case 'arrange_area': {
        const plan = layout!.labels.find((l) => sameLabel(l.text, r.label))!
        // The label of that name, a frame first when the area is one; an existing label turns into the other style in place.
        const named = ws.labels.filter((l) => !isTitle(l) && sameLabel(l.text, r.label))
        const existing = named.find((l) => isSection(l) === !!plan.frame) ?? named[0]
        const a = plan.frame ? layout!.areas.find((x) => x.frame && sameLabel(x.label, r.label))! : undefined
        const fields: Record<string, unknown> = a
          ? // An area's name H1 (the default), a section's H2 (D-130).
            { kind: 'section', x: (a.x0 + a.x1) / 2, y: (a.y0 + a.y1) / 2, w: a.x1 - a.x0, h: a.y1 - a.y0, size: plan.sub ? 'subheading' : existing?.size ? null : undefined }
          : { x: plan.x, y: plan.y, size: plan.sub ? 'subheading' : 'heading', ...(existing && isSection(existing) ? { kind: null, w: null, h: null } : {}) }
        // Its colour (D-131): "default" removes it, null leaves it.
        fields.color = s(r.color) === 'default' ? (existing ? null : undefined) : LABEL_HEX[s(r.color) ?? '']
        return existing ? { do: 'label', id: existing.id, fields: compact(fields) } : { do: 'label', fields: compact({ text: plan.text, ...fields }) }
      }
      // A frame round cards where they end up in this set (D-131): placed once every card has its place, like notes.
      case 'add_section': {
        const w: AssistantWrite = { do: 'label', fields: { text: s(r.label)!.slice(0, 200), kind: 'section' } }
        frames.push({ w, items: itemsOf(r) })
        return w
      }
      case 'edit_section': {
        const size = s(r.size) && SECTION_SIZES.includes(s(r.size) as never) ? s(r.size) : undefined
        const color = s(r.color) === 'default' ? null : LABEL_HEX[s(r.color) ?? '']
        const fields = compact({ text: s(r.text)?.slice(0, 200), size, color, ...styleFields(r) })
        return { do: 'label', id: ws.labels.find((l) => isSection(l) && sameLabel(l.text, r.label))!.id, fields }
      }
      case 'delete_section':
        return { do: 'unlabel', id: ws.labels.find((l) => isSection(l) && sameLabel(l.text, r.label))!.id }
      case 'add_label': {
        const w: AssistantWrite = {
          do: 'label',
          fields: compact({ text: s(r.text)!.slice(0, 200), size: text(r.size), color: LABEL_HEX[s(r.color) ?? ''], ...newStyle(r) }),
        }
        texts.push({ w, above: r.above })
        return w
      }
      case 'rename_label':
      case 'edit_label': {
        const color = s(r.color) === 'default' ? null : LABEL_HEX[s(r.color) ?? '']
        const w: AssistantWrite = {
          do: 'label',
          id: textLabels(ws.labels).find((l) => sameLabel(l.text, r.label))!.id,
          fields: compact({ text: text(r.text)?.slice(0, 200), size: text(r.size), color, ...styleFields(r) }),
        }
        if (refKey(r.above)) texts.push({ w, above: r.above })
        return w
      }
      case 'delete_label':
        return { do: 'unlabel', id: textLabels(ws.labels).find((l) => sameLabel(l.text, r.label))!.id }
      case 'update_project':
        return { do: 'project', fields: compact({ name: text(r.name)?.slice(0, NAME_MAX), description: text(r.description)?.slice(0, DESCRIPTION_MAX) }) }
      case 'add_evidence':
        return {
          do: 'evidence',
          on: refOf(r.target),
          fields: {
            kind: s(r.kind)!,
            text: s(r.text)!.slice(0, 2000),
            stance: s(r.stance)!,
            ...Object.fromEntries(
              Object.entries({ source: s(r.source)?.slice(0, 200), url: s(r.url)?.slice(0, 2000), date: isDate(r.date) ? s(r.date) : undefined }).filter(
                ([, v]) => v !== undefined,
              ),
            ),
          },
        }
      case 'set_criteria': {
        // Criteria kept word for word keep their ids, so their scores stay; the rest get new ones (D-133).
        const feature = refOf(r.feature) as { id: string; type: NodeType }
        const now = ws.features.find((f) => f.id === feature.id)?.criteria ?? []
        const given = criteriaOf(r)
        const list: Criterion[] = given
          ? given.map((text) => ({ id: now.find((k) => sameLabel(k.text, text))?.id ?? newCriterionId(), text }))
          : now
        const cells = scoresOf(r).map((x) => ({
          competitor: refOf(x.competitor),
          confidence: sureOf(x.confidence),
          scores: Object.fromEntries(
            list.map((k, i) => [k.id, (CRITERION_SCORES as readonly string[]).includes(x.scores[i]) ? (x.scores[i] as CriterionScore) : null]),
          ),
        }))
        return { do: 'criteria', feature, criteria: given ? list : undefined, cells }
      }
      case 'unlink': {
        const a = (refOf(r.from) as { id: string }).id
        const b = (refOf(r.to) as { id: string }).id
        const edgeIds = ws.edges.filter((e) => (e.fromId === a && e.toId === b) || (e.fromId === b && e.toId === a)).map((e) => e.id)
        return { do: 'unlink', edgeIds }
      }
      default:
        return {
          do: 'cell',
          feature: refOf(r.feature),
          competitor: refOf(r.competitor),
          fields: compact({
            coverage: r.coverage === NOT_ASSESSED ? null : text(r.coverage),
            notes: edit(r.notes),
            // Only true is stored (D-136).
            notRelevant: r.relevant === false ? true : r.relevant === true ? null : undefined,
            confidence: sureOf(r.confidence),
          }),
          theirs: typeof r.their_feature !== 'string' ? undefined : emptied(r.their_feature) ? null : refOf(r.their_feature),
        }
    }
  })
  // A section's frame round its cards where they end up. None found can't happen (a gone card turns the row off), but
  // the write stays in its row's place (the preview pairs them), so it falls back to a new frame's size at the origin.
  for (const { w, items } of frames) {
    const boxes = items.flatMap((v) => {
      const at = whereIs(v)
      return at ? [{ c: [at.x, at.y] as [number, number], h: [CARD_W / 2, CARD_H / 2] as [number, number] }] : []
    })
    Object.assign(w.fields, boxes.length ? wrapRect(boxes) : { x: 0, y: 0, w: DEFAULT_W, h: DEFAULT_H })
  }
  // A note goes just under its card, where the card ends up; a second note on the same card goes under the first.
  const under = new Map<string, number>()
  for (const { w, near } of notes) {
    const k = refKey(near)!
    const e = refs.get(k)
    const at = placed.get(k) ?? layout?.cards.get(e?.id ?? k) ?? layout?.cards.get(k) ?? (e && position.get(e.id))
    if (!at) continue
    const i = under.get(k) ?? 0
    under.set(k, i + 1)
    w.fields.x = at.x
    w.fields.y = at.y - CARD_H / 2 - NOTE_GAP - i * NOTE_GAP
  }
  // Text above a card, or above the board's top-left: clear of cards and other text, going up until it is.
  const taken = textLabels(ws.labels)
    .filter((l) => !texts.some((t) => t.w.id === l.id))
    .map((l) => ({ x: l.x, y: l.y, half: labelRoom(l) }))
  for (const { w, above } of texts) {
    const old = w.id ? textLabels(ws.labels).find((l) => l.id === w.id) : undefined
    const half = labelRoom({ text: String(w.fields.text ?? old?.text ?? ''), size: (w.fields.size ?? old?.size) as Label['size'] })
    const anchor = refKey(above) ? whereIs(above) : undefined
    if (refKey(above) && !anchor) continue
    const left = cards.length ? Math.min(...cards.map((c) => c.x)) - CARD_W / 2 + half[0] : 0
    const top = cards.length ? Math.max(...cards.map((c) => c.y)) + CARD_H / 2 + 1 : 0
    const x = anchor ? anchor.x : left
    let y = (anchor ? anchor.y + CARD_H / 2 + 0.3 : top) + half[1]
    const clear = (y: number) =>
      cards.every((c) => Math.abs(c.x - x) >= CARD_W / 2 + half[0] || Math.abs(c.y - y) >= CARD_H / 2 + half[1]) &&
      taken.every((t) => Math.abs(t.x - x) >= t.half[0] + half[0] || Math.abs(t.y - y) >= t.half[1] + half[1])
    for (let i = 0; i < 20 && !clear(y); i++) y += half[1] * 2 + 0.2
    w.fields.x = x
    w.fields.y = y
    taken.push({ x, y, half })
  }
  return [...writes, ...moves]
}

// Below a card, between notes on the same card (board units).
const NOTE_GAP = 0.32

// Card centres a card's width and height apart across a rectangle (centre `at`, half size `half`): a card placed clear
// of all of them is clear of the rectangle.
function coverWithCards(at: { x: number; y: number }, [hw, hh]: [number, number]): { x: number; y: number }[] {
  const spread = (c: number, h: number, step: number) => {
    const n = Math.max(1, Math.ceil((2 * h - step) / step) + 1)
    return h <= step / 2 ? [c] : Array.from({ length: n }, (_, i) => c - h + step / 2 + (i * (2 * h - step)) / (n - 1))
  }
  return spread(at.x, hw, CARD_W).flatMap((x) => spread(at.y, hh, CARD_H).map((y) => ({ x, y })))
}

// The proposal and what became of it, as plain text for the model's next turn.
export function proposalForHistory(p: Proposal, state: ProposalState): string {
  const rows = p.changes.map((c) => `${c.sign} ${c.kind} ${c.text}`).join('; ')
  const outcome =
    state.status === 'pending'
      ? 'The user has not decided yet.'
      : state.status === 'discarded'
        ? 'The user discarded it; nothing was changed.'
        : `The user applied ${state.applied} of ${p.changes.length}; the workspace below shows the result.`
  return `[I proposed: ${p.summary} (${rows}). ${outcome}]`
}

export type ProposalState = { status: 'pending' | 'discarded' | 'applied'; applied?: number; rows?: number[] }

// What the model hears back after proposing (D-084): the rows that can't be applied, so it can fix them in the same answer.
export function proposalReport(p: Proposal): string {
  const bad = p.changes.filter((c) => c.problem)
  const shown = `Shown to the user as a checklist of ${p.changes.length} change${p.changes.length === 1 ? '' : 's'}; they decide what to apply.`
  if (!p.changes.length) return 'The proposal had no valid changes. Check the arguments and call it again, or answer in words.'
  if (!bad.length) return `${shown} Don't list the changes again; finish with at most a sentence, or nothing.`
  const rows = bad.map((c) => `- change ${c.n + 1} (${c.raw.op}: ${c.text}): ${c.problem}`).join('\n')
  return (
    `${shown} These rows can't be applied and are switched off:\n${rows}\n` +
    `If you can fix them (copy refs exactly from the workspace), call ${PROPOSE} again with the whole corrected set: it replaces ` +
    'this one. Otherwise finish with at most a sentence.'
  )
}

// How a proposal's areas come out (D-126), for the model to check its own arrangement and propose again if it can do
// better: each area's outline and layout, the board's size, how many links cross, and the longest ones. Empty without
// areas. `final`: it has already corrected once, so it shouldn't again.
export function layoutReport(p: Proposal, ws: WorkspaceCtx, refs: Map<string, ItemRef>, final = false): string {
  const accepted = p.changes.filter((c) => !c.problem)
  if (!accepted.some((c) => c.raw.op === 'arrange_area')) return ''
  let plan
  try {
    plan = planAreas(accepted, ws, refs)
  } catch {
    return ''
  }
  const { position, moving, links, layout } = plan
  if (!layout?.areas.length) return ''
  const at = new Map<string, { x: number; y: number }>()
  for (const [id, q] of position) if (!moving.has(id)) at.set(id, q)
  for (const [id, q] of layout.cards) at.set(id, q)
  const name = new Map([...refs.values()].map((r) => [r.id, r.name]))
  for (const c of accepted) if (s(c.raw.key)) name.set(s(c.raw.key)!, s(c.raw.title) ?? s(c.raw.name) ?? s(c.raw.key)!)
  // The innermost area or section a card is in.
  const areaOf = (q: { x: number; y: number }) =>
    layout.areas
      .filter((a) => q.x >= a.x0 && q.x <= a.x1 && q.y >= a.y0 && q.y <= a.y1)
      .sort((a, b) => (a.x1 - a.x0) * (a.y1 - a.y0) - (b.x1 - b.x0) * (b.y1 - b.y0))[0]?.label
  const x0 = Math.min(...layout.areas.map((a) => a.x0))
  const y1 = Math.max(...layout.areas.map((a) => a.y1))
  const r = (v: number) => Math.round(v)
  const lines = layout.areas.map(
    (a) =>
      `- ${a.sub ? 'section' : 'area'} "${a.label}"${a.layout ? ` (${a.layout})` : ''}: x ${r(a.x0 - x0)}–${r(a.x1 - x0)}, y ${r(y1 - a.y1)}–${r(y1 - a.y0)}`,
  )
  const w = Math.max(...layout.areas.map((a) => a.x1)) - x0
  const h = y1 - Math.min(...layout.areas.map((a) => a.y0))

  // Links with at least one end moved, each once.
  const seen = new Set<string>()
  const segs: { a: string; b: string; p: { x: number; y: number }; q: { x: number; y: number }; len: number }[] = []
  for (const [a, b] of links) {
    const k = [a, b].sort().join('|')
    const p = at.get(a)
    const q = at.get(b)
    if (seen.has(k) || !p || !q || (!layout.cards.has(a) && !layout.cards.has(b))) continue
    seen.add(k)
    segs.push({ a, b, p, q, len: Math.hypot(p.x - q.x, p.y - q.y) })
  }
  const side = (o: { x: number; y: number }, p: { x: number; y: number }, q: { x: number; y: number }) => Math.sign((p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x))
  let crossings = 0
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s1 = segs[i]
      const s2 = segs[j]
      if ([s1.a, s1.b].some((e) => e === s2.a || e === s2.b)) continue
      if (side(s1.p, s1.q, s2.p) * side(s1.p, s1.q, s2.q) < 0 && side(s2.p, s2.q, s1.p) * side(s2.p, s2.q, s1.q) < 0) crossings++
    }
  }
  const long = segs.filter((x) => x.len > 12).sort((a, b) => b.len - a.len)
  const where = (id: string) => {
    const a = areaOf(at.get(id)!)
    return a ? ` (${a})` : ''
  }
  const longLines = long.slice(0, 8).map((x) => `- ${name.get(x.a) ?? '?'}${where(x.a)} — ${name.get(x.b) ?? '?'}${where(x.b)}: ${r(x.len)}`)
  return (
    `\n\nHow the areas come out (board units, x to the right and y down from the top-left; a card is 2.4 × 1.25), ` +
    `${r(w)} × ${r(h)} in all:\n${lines.join('\n')}\n` +
    `${segs.length} links touch the moved cards; ${crossings} pairs cross; ${long.length} ${long.length === 1 ? 'is' : 'are'} longer than 12 units` +
    `${longLines.length ? `:\n${longLines.join('\n')}` : '.'}\n` +
    (final
      ? 'This is the arrangement the user sees; leave it.'
      : 'Check it like a designer: areas linked by several long links should sit beside each other (beside/side), an area ' +
        'that is much taller or wider than the rest may read better as sections or another layout, and many crossings ' +
        'mean the cards could be grouped or ordered better. If one of these clearly applies, call ' +
        `${PROPOSE} once more with the whole improved set (it replaces this one); otherwise don't.`)
  )
}
