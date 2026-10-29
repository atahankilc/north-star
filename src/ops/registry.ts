// Every entity op in one list (S4, D-312; docs/specs/agent-actions.md): its name (snake_case, the naming rule there), the
// kind of thing it works on, one line for the model, its arguments (a JSON-schema-ish object, for the agent's tools
// later) and its builder. Plain data and functions: the agent's tools, validate's op names and onboarding read it.
// Later steps (S5–S8) add theirs.
//
// What S4 left for later steps: competitorFeatures.ts' dropCriterionScores is update_card since S7 (criteria taken off a
// feature take their matrix cells and comparison scores, src/ops/lens.ts' criterionCascade); S6 did places.ts'
// planeGoes and runOps (the plane delete is pieces.ts' pieceCascade).
//
// S5 (text.ts): every write in data/labels.ts is a wrapper (addLabel → create_text, updateLabel → update_text,
// deleteLabel → delete, moveMany → arrange). Left: arrange's layouts (line up, space out: CardPanel's maths);
// pieces moved by arrange don't bring what's stuck to them (pieces.ts' placeAll, S6). The workspace's name and
// description (the project title's words, workspaces.ts) stay untracked writes, not ops. update_text's builder takes
// w, h, x, y (the UI's resize and drag go through it) but the model's schema leaves them out: moving is arrange, sizing
// is the resize op (S6). arrange carries folded parts, package members and section contents
// (model/cardInside.ts' carriedWith, model/textPlace.ts' sectionHolds); the UI's moveMany passes exact spots with
// carry: false, having found them itself.
import { CARD_TYPES } from '../model/cards'
import { VALIDATIONS, FEATURE_PRIORITIES, FEATURE_STATUSES, FEATURE_IMPACTS, FEATURE_EFFORTS } from '../model/cards'
import { EVIDENCE_KINDS, AVAILABILITIES } from '../model/shapes'
import { project } from './project'
import { createCard, createPackage, duplicate, updateCard } from './cards'
import { EDGE_KINDS, link, unlink, updateLink } from './edges'
import { createEvidence, updateEvidence } from './evidence'
import { createCompetitorFeature, updateCompetitorFeature } from './features'
import { placeOn, takeOff } from './places'
import { arrange, createText, HEADING_SIZES, TEXT_KINDS, TEXT_SCALES, updateText } from './text'
import { createCanvas, createPiece, moveCanvas, moveToCanvas, PIECE_KINDS, piecesOff, piecesOnPlan, rename, resize, updatePiece } from './pieces'
import { deleteAny } from './delete'
import { MATRIX_TEMPLATES, SCALE_KEYS, updateMatrix } from './matrix'
import { TABLE_TEMPLATES, updateTable } from './table'
import { axisAdd, axisRemove, axisUpdate, updateCell } from './lens'
import { CARD_TYPES as TYPES5 } from '../model/cards'
import { CELL_KINDS, CONFIDENCES, FIELDS, OWN_KINDS, TONES, TOTALS_AS, TOTALS_AT } from '../model/shapes'
import { RULE_FIELDS } from '../model/source'
import { LABEL_COLORS } from '../model/labels'
import { createTask, moveTask, PRIORITIES, updateTask } from './tasks'
import { columnById, createDeckColumn, DECK_TEMPLATES, LANES, moveDeckColumn, TIMELINE_ROWS_SAID, updateDeck, updateDeckColumn, updateTimeline } from './deck'
import { CARD_FIELDS } from '../model/shapes'
import type { OpCtx, Plan } from './types'
import { refuse } from './util'

// A JSON-schema-ish description: enough for a tool definition, not a validator (validate is the validator).
export type ArgSchema = { type?: string | string[]; anyOf?: ArgSchema[]; description?: string; enum?: readonly (string | number)[]; items?: ArgSchema; properties?: Record<string, ArgSchema>; required?: string[] }

export type OpDef = {
  name: string
  kind: 'card' | 'link' | 'evidence' | 'feature' | 'place' | 'package' | 'text' | 'piece' | 'canvas' | 'matrix' | 'table' | 'lens' | 'task' | 'deck' | 'timeline' | 'any'
  summary: string
  args: ArgSchema
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  build: (ctx: OpCtx, args: any) => Plan
}

const s = (description?: string): ArgSchema => ({ type: 'string', ...(description ? { description } : {}) })
const n = (description?: string): ArgSchema => ({ type: 'number', ...(description ? { description } : {}) })
const b = (description?: string): ArgSchema => ({ type: 'boolean', ...(description ? { description } : {}) })
const ids = (description: string): ArgSchema => ({ type: 'array', items: s(), description })
const obj = (properties: Record<string, ArgSchema>, required: string[] = [], description?: string): ArgSchema => ({ type: 'object', properties, required, ...(description ? { description } : {}) })
const kindArg = (description?: string): ArgSchema => ({ type: 'string', enum: EDGE_KINDS, ...(description ? { description } : {}) })
const orNull = (description: string): ArgSchema => ({ type: ['string', 'null'], description })
const handle = s('a name for the new thing ($a, $b…) that later ops in the same batch can use instead of its id')

const cardFields = obj(
  {
    validation: { type: 'string', enum: VALIDATIONS, description: 'customer, problem, idea: how far it is tested' },
    tags: { type: 'array', items: s() },
    notes: s(),
    regions: { type: 'array', items: s(), description: 'competitor only' },
    description: s('competitor only'),
    audience: s('competitor only'),
    pricing: s('competitor only'),
    url: s('competitor only'),
    priority: { type: 'string', enum: FEATURE_PRIORITIES, description: 'feature only' },
    status: { type: 'string', enum: FEATURE_STATUSES, description: 'feature only' },
    impact: { type: 'string', enum: FEATURE_IMPACTS, description: 'feature or package' },
    effort: { type: 'string', enum: FEATURE_EFFORTS, description: 'feature or package' },
    criteria: { type: 'array', items: obj({ id: s('a–z 0–9, ≤ 16'), text: s() }, ['id', 'text']), description: 'feature only: what it is judged on (≤ 8)' },
    memberIds: ids('package only: the cards it holds'),
  },
  [],
  'fields to set; null takes one away',
)
// How text is set (update_text: null takes one away).
const nb = (description: string): ArgSchema => ({ type: ['boolean', 'null'], description })
const textStyle = (nullable: boolean): Record<string, ArgSchema> => {
  const e = (values: readonly (string | number)[], description: string): ArgSchema =>
    nullable ? { anyOf: [{ type: typeof values[0] === 'number' ? 'number' : 'string', enum: values }, { type: 'null' }], description } : { type: typeof values[0] === 'number' ? 'number' : 'string', enum: values, description }
  const t = (type: string, description: string): ArgSchema => ({ type: nullable ? [type, 'null'] : type, description })
  return {
    text: s('its words (a section: its name); not for the project title, which shows the workspace name'),
    kicker: t('string', 'heading: a small line over it; section: the number before its name (`02`)'),
    size: e(HEADING_SIZES, 'heading or section name: heading = H1, subheading = H2, minor = H3'),
    scale: e(TEXT_SCALES, 'paragraph or sticky note: text size'),
    color: e(LABEL_COLORS, 'its colour (a sticky note: its paper; not ink)'),
    bold: nullable ? nb('not for sticky notes') : b('not for sticky notes'),
    italic: nullable ? nb('not for sticky notes') : b('not for sticky notes'),
    caps: nullable ? nb('capitals; not for sticky notes') : b('capitals; not for sticky notes'),
    rotate: e([90, -90], 'heading or paragraph: turned a quarter (90 reads upwards)'),
    side: e(['left'], "section: its name up the left edge instead of the top"),
    folded: nullable ? nb('sticky note: held at its first height') : b('sticky note: held at its first height'),
    w: t('number', 'paragraph, sticky note, title: its width; section: its width (px)'),
    h: t('number', 'section: its height (px)'),
  }
}

const evidenceArgs = { kind: { type: 'string', enum: EVIDENCE_KINDS }, text: s('what was learned, a sentence or a quote'), stance: { type: 'string', enum: ['supports', 'contradicts'] }, source: s('who or where'), url: s(), date: s('YYYY-MM-DD') }
// S7: a matrix's and a table's setup, typed (converted to the stored setup by src/ops/matrix.ts and table.ts).
const stepsArg: ArgSchema = {
  anyOf: [{ type: 'string', enum: SCALE_KEYS }, { type: 'array', items: { anyOf: [s('a label'), obj({ label: s(), glyph: s('≤ 4 characters'), tone: { type: 'string', enum: TONES } }, ['label'])] } }],
  description: `a scale (${SCALE_KEYS.join(', ')}) or 2–9 step labels, low to high`,
}
const axisSpec = (side: string) =>
  obj(
    {
      type: { type: 'string', enum: TYPES5, description: 'every card of this type joins by itself (new ones too)' },
      plane: s('only the type\'s cards on this plane (id or name)'),
      cards: ids('cards added by hand (any type)'),
      names: { type: 'array', items: s(), description: 'typed names' },
      noun: s(`what one of the ${side} is called`),
      unfold: b('features only: each opens into what it is judged on (its criteria)'),
    },
    [],
    `the ${side}`,
  )
const matrixOptions = (nullable: boolean): Record<string, ArgSchema> => {
  const e = (values: readonly string[], description: string): ArgSchema => (nullable ? { anyOf: [{ type: 'string', enum: values }, { type: 'null' }], description } : { type: 'string', enum: values, description })
  const f = (description: string): ArgSchema => (nullable ? { type: ['boolean', 'null'], description } : b(description))
  return {
    cell: { type: 'string', enum: CELL_KINDS, description: 'what every cell holds: a step of a scale, a number or a short text' },
    scale: { type: 'string', enum: SCALE_KEYS, description: 'the steps, from a scale' },
    steps: stepsArg,
    unit: nullable ? orNull('number cells: €, h, %…') : s('number cells: €, h, %…'),
    not_relevant: f('allow "doesn\'t apply" (—): left out of the totals'),
    confidence: f('allow marking guesses (~ inferred, ? a guess)'),
    totals: f('show totals for each row and column'),
    totals_at: e(TOTALS_AT, 'where the totals are'),
    totals_as: e(TOTALS_AS, 'what the totals look like'),
    marks: f("a scale's cells as their glyphs instead of filled squares"),
  }
}
const ruleSpec = obj(
  { field: { type: 'string', enum: RULE_FIELDS }, not: b('is not'), values: { type: 'array', items: s(), description: 'any of these: plane ids or names, card types, statuses, tags; title: the words it holds' } },
  ['field', 'values'],
)
const columnSpec = obj(
  {
    field: { type: 'string', enum: FIELDS, description: "a card field, shown read-only (leave kind out)" },
    name: s('its head'),
    kind: { type: 'string', enum: OWN_KINDS, description: 'a column of its own: its values (name needed)' },
    unit: s('number columns'),
    steps: stepsArg,
    width: n('px, 48–640'),
  },
  [],
  '{ field } or { name, kind }',
)
const tableSpec = obj(
  {
    template: { type: 'string', enum: TABLE_TEMPLATES, description: 'cards: every card; features; competitors; blank: rows you name' },
    rules: { type: 'array', items: ruleSpec, description: 'every rule must hold; none: every card' },
    manual: b('only the rows added by hand (a list of names)'),
    cards: ids('cards added by hand'),
    names: { type: 'array', items: s(), description: 'typed rows' },
    columns: { type: 'array', items: columnSpec, description: "replaces the template's columns (the name column is always first)" },
    sort: obj({ col: s('a column id or name; name for the rows'), desc: b() }, ['col']),
    page_size: n('rows a page'),
  },
  [],
  'table only: its setup, typed',
)
const matrixSpec = obj(
  { template: { type: 'string', enum: MATRIX_TEMPLATES, description: 'compare: features × competitors; pain: problems × customers; score: ideas × criteria; blank' }, rows: axisSpec('rows'), cols: axisSpec('columns'), ...matrixOptions(false) },
  [],
  'matrix only: its setup, typed (left out: blank)',
)
const axisPatch = (side: string) =>
  obj(
    {
      type: { anyOf: [{ type: 'string', enum: TYPES5 }, { type: 'null' }], description: 'null: only what was added by hand' },
      plane: orNull('narrow the type to one plane (id or name); null: every plane'),
      noun: orNull(`what one of the ${side} is called`),
      unfold: b('features: open into their criteria'),
      open: ids('feature cards shown open'),
      fold: ids('feature cards shown folded'),
      bring_back: b('the cards taken out come back'),
    },
    [],
    `the ${side}`,
  )
const axisArg = { type: 'string', enum: ['rows', 'cols'] } as ArgSchema
// S8: tasks and decks.
const day = (what: string, nullable: boolean): ArgSchema => ({ type: nullable ? ['string', 'null'] : 'string', description: `${what}, YYYY-MM-DD${nullable ? '; null takes it away' : ''}` })
const taskFields = (nullable: boolean): Record<string, ArgSchema> => {
  const t = (type: string, description: string): ArgSchema => ({ type: nullable ? [type, 'null'] : type, description })
  return {
    notes: t('string', 'longer notes'),
    assignee: t('string', "a member's uid: who it's given to"),
    assigneeName: t('string', "their name, shown on the task (left out: as other tasks show them)"),
    start: day('its first day (a first day past the due day it keeps moves that along, and the other way)', nullable),
    due: day('its due day', nullable),
    card: t('string', 'the card it is for (its id)'),
    priority: nullable ? { anyOf: [{ type: 'string', enum: PRIORITIES }, { type: 'null' }] } : { type: 'string', enum: PRIORITIES },
    labels: { type: nullable ? ['array', 'null'] : 'array', items: s(), description: '#labels, ≤ 20' },
    checks: { type: nullable ? ['array', 'null'] : 'array', items: { anyOf: [s('a step'), obj({ id: s('keep a step\'s id when rewriting the list'), text: s(), done: b() }, ['text'])] }, description: 'its checklist (the whole list), ≤ 50 steps' },
  }
}
const deckSpec = obj(
  {
    template: { type: 'string', enum: DECK_TEMPLATES, description: 'tasks: todo · doing · done; features: features by status; priorities: features and packages, effort × impact, corners named' },
    holds: { type: 'string', enum: ['tasks', 'cards'], description: 'tasks (default) or cards from the planes' },
    columns: { type: 'array', items: { anyOf: [s('its name'), obj({ name: s(), limit: n('most tasks it should hold'), done: b('the finished column') }, ['name'])] }, description: 'tasks: its columns, left to right (left out: todo · doing · done)' },
    finished: s('tasks: the finished column, by name'),
    lanes: { type: 'string', enum: LANES, description: 'tasks: lanes across the columns by who a task is given to, or by card' },
    rules: { type: 'array', items: ruleSpec, description: 'cards: which cards (every rule must hold)' },
    cards: ids('cards: cards added by hand'),
    col_field: { type: 'string', enum: CARD_FIELDS, description: "cards: the field its columns are the values of (status when left out)" },
    row_field: { type: 'string', enum: CARD_FIELDS, description: 'cards: another field across the columns as rows' },
    names: { type: 'array', items: obj({ col: s("the column field's value"), row: s("the row field's value (`-` for no value)"), name: s(), tone: { type: 'string', enum: ['good', 'bad'] } }, ['col', 'row']), description: 'cards: names for its boxes' },
  },
  [],
  'deck only: its setup, typed (left out: todo · doing · done)',
)
const featureFields = { name: s(), description: s(), category: s(), availability: { type: 'string', enum: AVAILABILITIES }, url: s() }

export const OPS: OpDef[] = [
  {
    name: 'create_card',
    kind: 'card',
    summary: 'Make a card on a plane, whole: title, fields, links, parts and evidence in one step.',
    args: obj(
      {
        type: { type: 'string', enum: CARD_TYPES },
        plane: s('the plane it goes on'),
        title: s(),
        fields: cardFields,
        where: obj({ near: s('right of this card') }, [], 'left out: the first clear spot on the plane'),
        links: { type: 'array', items: obj({ to: s('a card'), kind: kindArg('as drawn when left out'), label: s(), reverse: b('the link points at the new card') }, ['to']) },
        parts: { type: 'array', description: 'parts: new cards of its type, each part of it', items: { anyOf: [s('its title'), obj({ title: s(), fields: cardFields }, ['title'])] } },
        evidence: { type: 'array', items: obj(evidenceArgs, ['kind', 'text', 'stance']) },
        handle,
      },
      ['type', 'plane'],
    ),
    build: createCard,
  },
  {
    name: 'update_card',
    kind: 'card',
    summary: "Change a card: its title, fields, or its spot and fold on a plane it's on.",
    args: obj({ card: s(), plane: s("the plane for x, y and folded (its home when left out)"), title: s(), fields: cardFields, x: n(), y: n(), folded: b() }, ['card']),
    build: updateCard,
  },
  {
    name: 'create_package',
    kind: 'package',
    summary: 'Package cards on their plane (named "Package N" unless named).',
    args: obj({ cards: ids('the cards it holds'), plane: s(), name: s(), handle }, ['cards']),
    build: createPackage,
  },
  {
    name: 'delete',
    kind: 'any',
    summary:
      "Delete cards (with their links, places, evidence, competitor features and matches), links, evidence, competitor features, matches, text (a section alone: what it holds stays), pieces (a plane with its cards, text and links, though a card also on another plane stays there; a matrix or table with its cells; a deck with its tasks), canvases (with everything on them; never the first), tasks, or a deck's column (its tasks move to the end of the column before it; never the last). On a plane, cards also elsewhere only come off it. A piece on several canvases needs scope.",
    args: obj(
      {
        ids: ids('what to delete'),
        plane: s('delete here only: cards on other planes stay there'),
        everywhere: b('delete cards from every plane, pieces from every canvas'),
        scope: { type: 'string', enum: ['here', 'everywhere'], description: 'a piece on several canvases: here takes it off canvas only, everywhere deletes it' },
        canvas: s('with scope here: the canvas it comes off'),
        deck: s("a deck column's id that several decks share: the deck it is on"),
      },
      ['ids'],
    ),
    build: deleteAny,
  },
  {
    name: 'duplicate',
    kind: 'card',
    summary: 'Copy cards and text onto a plane, with the links between them (not evidence, competitor features, tasks or places).',
    args: obj({ ids: ids('cards and text'), from: s('the plane they are shown on'), to: s('the plane the copies go on'), by: { type: 'array', items: n(), description: '[dx, dy], plane px' }, handle }, ['ids', 'to']),
    build: duplicate,
  },
  {
    name: 'link',
    kind: 'link',
    summary: 'Link two cards (kind as drawn when left out: for, solves, competes-with, inspired-by, relates, part-of, depends-on, contradicts).',
    args: obj({ from: s(), to: s(), kind: kindArg('as drawn when left out'), label: s(), handle }, ['from', 'to']),
    build: link,
  },
  { name: 'unlink', kind: 'link', summary: 'Remove a link.', args: obj({ link: s() }, ['link']), build: unlink },
  {
    name: 'update_link',
    kind: 'link',
    summary: "Change a link's kind or label, or turn it round.",
    args: obj({ link: s(), kind: kindArg(), label: orNull('empty or null takes it away'), reverse: b() }, ['link']),
    build: updateLink,
  },
  {
    name: 'create_evidence',
    kind: 'evidence',
    summary: 'Add what was learned to a customer, problem or idea. from_task: what a finished task taught (on its card unless card is said); the task is marked as logged.',
    args: obj({ card: s('needed unless from_task is for a card'), ...evidenceArgs, from_task: s('the task it was learned from'), handle }, ['kind', 'text', 'stance']),
    build: createEvidence,
  },
  {
    name: 'update_evidence',
    kind: 'evidence',
    summary: 'Change a piece of evidence.',
    args: obj({ evidence: s(), fields: obj(evidenceArgs) }, ['evidence', 'fields']),
    build: updateEvidence,
  },
  {
    name: 'create_competitor_feature',
    kind: 'feature',
    summary: "Add a feature to a competitor, optionally matched to one of ours.",
    args: obj({ competitor: s(), ...featureFields, ours: orNull('our feature it matches'), handle }, ['competitor', 'name']),
    build: createCompetitorFeature,
  },
  {
    name: 'update_competitor_feature',
    kind: 'feature',
    summary: "Change a competitor's feature, or which of ours it matches (ours: null for none).",
    args: obj({ feature: s(), fields: obj(featureFields), ours: orNull('our feature it matches; null: none') }, ['feature']),
    build: updateCompetitorFeature,
  },
  {
    name: 'create_text',
    kind: 'text',
    summary: 'Write text on a plane or the canvas: a heading (H1–H3), paragraph, sticky note, section (round things) or the project title (canvas only, one per workspace).',
    args: obj(
      {
        kind: { type: 'string', enum: TEXT_KINDS },
        plane: s('the plane it goes on; left out: the canvas'),
        canvas: s('on the canvas: which one (left out: the one shown)'),
        ...textStyle(false),
        where: {
          anyOf: [obj({ near: s('right of this text, card (on its plane) or piece (on the canvas), two grid steps (50 px) clear, its top level with it') }, ['near']), obj({ in_section: s('inside this section, under what it holds') }, ['in_section'])],
          description: 'left out: a clear spot (a plane: the first from its top-left; the canvas: under everything)',
        },
        around: ids('section only: the text, cards or pieces it goes round (its box fitted to them)'),
        handle,
      },
      ['kind'],
    ),
    build: createText,
  },
  {
    name: 'update_text',
    kind: 'text',
    summary: 'Change text: its words or how it is set (size, scale, colour, bold, italic, caps, turn, side, fold). To move it: arrange.',
    // w, h, x, y stay out of the model's schema (the builder takes them, for the UI's resize and drag): moving is
    // arrange, sizing a resize op (S6).
    args: obj({ id: s('the text'), ...Object.fromEntries(Object.entries(textStyle(true)).filter(([k]) => k !== 'w' && k !== 'h')) }, ['id']),
    build: updateText,
  },
  {
    name: 'arrange',
    kind: 'any',
    summary:
      "Move text, cards and pieces by [dx, dy] in their space's px (a plane's or the canvas's). A section carries what's wholly inside it, a folded card its parts, a package its members, a plane or deck what's stuck to it. A card's spot on a plane other than its home needs that plane. stick: a matrix, table, deck or timeline dropped near a plane's edge sticks to it.",
    args: obj(
      {
        items: ids('what moves'),
        by: { type: 'array', items: n(), description: '[dx, dy] in their space px' },
        plane: s("the plane the cards are shown on: needed for a card's place on a plane that isn't its home (left out: each card's home)"),
        canvas: s('the canvas the pieces are on (left out: the one shown)'),
        carry: b("false: a section moves without what's inside it, a plane without what's stuck to it"),
        stick: b("a matrix, table, deck or timeline ending within 48 px of a plane's edge (a timeline: a deck's too) snaps there and sticks to it"),
      },
      ['items', 'by'],
    ),
    build: arrange,
  },
  {
    name: 'place_on',
    kind: 'place',
    summary: 'Show the same cards on another plane too (cards + plane; with their parts and members; move: their home moves there), or the same pieces on another canvas too (pieces + canvas; with what is stuck to them).',
    args: obj({ cards: ids('the cards'), plane: s(), move: b(), pieces: ids('the pieces'), canvas: s('the canvas they go on too'), from: s('the canvas the pieces are shown on (left out: the one shown)') }),
    build: (ctx: OpCtx, args: { pieces?: string[]; canvas?: string; from?: string; cards?: string[] }) => (args.pieces || args.canvas ? piecesOnPlan(ctx, args as Parameters<typeof piecesOnPlan>[1]).plan : placeOn(ctx, args as Parameters<typeof placeOn>[1])),
  },
  {
    name: 'take_off',
    kind: 'place',
    summary: "Take cards off one plane (cards + plane), or pieces off one canvas (pieces + canvas); they stay on the others (a card on no other plane isn't touched; a piece on no other canvas is refused: delete it).",
    args: obj({ cards: ids('the cards'), plane: s(), pieces: ids('the pieces'), canvas: s() }),
    build: (ctx: OpCtx, args: { pieces?: string[]; canvas?: string }) => (args.pieces || args.canvas ? piecesOff(ctx, args as Parameters<typeof piecesOff>[1]) : takeOff(ctx, args as Parameters<typeof takeOff>[1])),
  },
  {
    name: 'create_piece',
    kind: 'piece',
    summary: 'Put a piece on a canvas: a plane (cards go on it), a deck (tasks), a matrix, a table, a timeline, a documents list, or one document. Optionally stuck to a plane (a timeline: a deck or a plane).',
    args: obj(
      {
        kind: { type: 'string', enum: PIECE_KINDS },
        name: s(),
        canvas: s('the canvas it goes on (main for the first)'),
        matrix: matrixSpec,
        table: tableSpec,
        deck: deckSpec,
        setup: { type: 'object', description: "timeline or documents list: its setup as the piece stores it; left out, a blank one (a matrix, table or deck: use matrix / table / deck)" },
        doc: s('document only: the shared document it shows'),
        stuck_to: s('matrix, table, deck: the plane it sticks to; timeline: a deck or a plane'),
        where: obj({ near: s('right of this piece') }, ['near'], 'left out: beside what it sticks to, else under everything on the canvas'),
        handle,
      },
      ['kind', 'canvas'],
    ),
    build: createPiece,
  },
  {
    name: 'update_piece',
    kind: 'piece',
    summary: "Change a piece: its name, framed (false lays a matrix, table, deck, timeline or documents out of its window onto the canvas), what it's stuck to (null lets go), a documents list's view.",
    args: obj(
      {
        id: s('the piece'),
        name: orNull('null or empty takes it away (it shows its kind)'),
        framed: b(),
        stuck_to: orNull('a plane (a timeline: a deck or a plane); null lets go'),
        documents: obj({ view: { type: 'string', enum: ['table', 'shelf'] }, pageSize: n(), kinds: { type: 'array', items: s() }, sort: obj({ col: s(), desc: b() }) }, [], 'documents list only'),
      },
      ['id'],
    ),
    build: updatePiece,
  },
  {
    name: 'rename',
    kind: 'any',
    summary: "Rename a piece, a canvas or a deck's column (a card's title: update_card; text: update_text; a task: update_task).",
    args: obj({ id: s(), name: s(), deck: s("a column's deck, when its id is on several") }, ['id', 'name']),
    build: (ctx: OpCtx, args: { id: string; name: string; deck?: string }) => {
      const onPiece = ctx.ws.pieces.some((p) => p.id === args.id) || ctx.ws.canvases.some((c) => c.id === args.id)
      const col = !onPiece && typeof args.id === 'string' ? columnById(ctx, 'rename', args.id, args.deck) : null
      return col ? { ...updateDeckColumn(ctx, { deck: col.deck.id, column: col.col.id, name: args.name }), op: 'rename' } : rename(ctx, args)
    },
  },
  {
    name: 'resize',
    kind: 'any',
    summary: "Resize a piece (at least 325 × 200; framed only; what's stuck to it follows) or text: a paragraph's, sticky note's or the title's width, a section's width and height.",
    args: obj({ id: s(), w: n('px'), h: n('px; a piece or a section only') }, ['id', 'w']),
    build: resize,
  },
  { name: 'create_canvas', kind: 'canvas', summary: 'Make a canvas (after the others).', args: obj({ name: s(), handle }, ['name']), build: createCanvas },
  { name: 'move_canvas', kind: 'canvas', summary: 'Move a canvas one place up or down in the list.', args: obj({ canvas: s(), by: { type: 'string', enum: ['up', 'down'] } }, ['canvas', 'by']), build: moveCanvas },
  {
    name: 'move_to_canvas',
    kind: 'canvas',
    summary: "Move pieces and the canvas's text to another canvas, with what's stuck to them and what their sections hold; they land where they were or the nearest clear place.",
    args: obj({ items: ids('pieces and text on the canvas'), canvas: s('where they go'), from: s('the canvas they are on (left out: the one shown)') }, ['items', 'canvas']),
    build: moveToCanvas,
  },
  {
    name: 'update_matrix',
    kind: 'matrix',
    summary: "Change a matrix's setup: start over from a template, the cells' kind, steps, unit, options, totals, or an axis (its type, plane, name, unfolding, cards shown open, taken-out cards brought back).",
    args: obj({ id: s('the matrix'), template: { type: 'string', enum: MATRIX_TEMPLATES }, name: s(), rows: axisPatch('rows'), cols: axisPatch('columns'), ...matrixOptions(true) }, ['id']),
    build: updateMatrix,
  },
  {
    name: 'update_table',
    kind: 'table',
    summary: "Change a table's setup: start over from a template, its rules (a plane rule set by sticking stays), only-by-hand, sort, rows a page, taken-out cards brought back.",
    args: obj(
      {
        id: s('the table'),
        template: { type: 'string', enum: TABLE_TEMPLATES },
        name: s(),
        rules: { type: 'array', items: ruleSpec, description: 'replaces the rules' },
        manual: b(),
        sort: { anyOf: [obj({ col: s('a column id or name; name for the rows'), desc: b() }, ['col']), { type: 'null' }], description: 'null: the rules\' order' },
        page_size: { type: ['number', 'null'], description: 'rows a page; null: all on one' },
        bring_back: b(),
      },
      ['id'],
    ),
    build: updateTable,
  },
  {
    name: 'axis_add',
    kind: 'lens',
    summary: "Add a row or column to a matrix (a card, or a typed name; a card of the axis's type taken out comes back), a row to a table (a card or a name), or a column to a table ({ field } read-only, or { name, kind } its own).",
    args: obj({ id: s('the matrix or table'), axis: axisArg, card: s(), name: s(), column: columnSpec, handle }, ['id', 'axis']),
    build: axisAdd,
  },
  {
    name: 'axis_remove',
    kind: 'lens',
    summary: "Take a row or column out of a matrix or table: a card its type or rules bring is hidden (its cells kept for when it comes back), one added by hand goes with its cells; a table's column goes with its cells. A criterion row: update_card.",
    args: obj({ id: s('the matrix or table'), axis: axisArg, entry: s('its key, a card id or title, a typed name or a column id or name') }, ['id', 'axis', 'entry']),
    build: axisRemove,
  },
  {
    name: 'axis_update',
    kind: 'lens',
    summary: "Rename a typed row or column (a card's row reads its title: update_card), or change a table's column: name, kind, unit, steps, width (the name column: width only), move left or right.",
    args: obj(
      {
        id: s('the matrix or table'),
        axis: axisArg,
        entry: s('its key or name; a column id or name, `name` for the name column'),
        name: s(),
        kind: { type: 'string', enum: OWN_KINDS },
        unit: orNull('number columns'),
        steps: { ...stepsArg, description: `scale columns only: a scale (${SCALE_KEYS.join(', ')}) or 2–9 step labels, low to high` },
        width: { type: ['number', 'null'], description: 'px 48–640; null: its own' },
        move: { type: 'string', enum: ['left', 'right'] },
      },
      ['id', 'axis', 'entry'],
    ),
    build: axisUpdate,
  },
  {
    name: 'update_cell',
    kind: 'lens',
    summary: "Fill a matrix's or table's cell, rows and columns by name (a card's title, a typed name, `Feature › criterion`, a column's name) or key: its value (a step's label or 1…, a number, a text; a check true/false), a note, doesn't-apply, how sure; null clears one, clear: true empties the cell.",
    args: obj(
      {
        id: s('the matrix or table'),
        row: s('the row: key or name'),
        col: s('the column: key or name'),
        value: { type: ['string', 'number', 'boolean', 'null'], description: 'as the cells say; null clears it' },
        note: orNull('null takes it away'),
        not_relevant: { type: ['boolean', 'null'], description: 'matrix: "doesn\'t apply" (—), if allowed' },
        confidence: { anyOf: [{ type: 'string', enum: CONFIDENCES }, { type: 'null' }], description: 'matrix: how sure, if guesses are allowed' },
        clear: b('everything in the cell taken away'),
      },
      ['id', 'row', 'col'],
    ),
    build: updateCell,
  },
  {
    name: 'create_task',
    kind: 'task',
    summary: "Add a task to a deck (one that holds tasks): in a column (the first when left out), before or after another task (else at the end), with who it's given to, days, a card, a priority, labels, a checklist and notes.",
    args: obj(
      {
        deck: s('the deck, by id or name'),
        title: s(),
        column: s('by id or name; left out, the first'),
        ...taskFields(false),
        before: s('a task in that column it goes before'),
        after: s('a task in that column it goes after'),
        handle,
      },
      ['deck', 'title'],
    ),
    build: createTask,
  },
  {
    name: 'update_task',
    kind: 'task',
    summary: "Change a task, or several the same way: its title, notes, who it's given to, first and due days, card, priority, labels, checklist, or learned: 'skip' (nothing to log). null takes a field away. To log what it taught: create_evidence from_task.",
    args: obj({ task: s(), tasks: ids('several, changed the same way'), title: s(), ...taskFields(true), learned: { anyOf: [{ type: 'string', enum: ['skip'] }, { type: 'null' }], description: "'skip': not logging what it taught" } }),
    build: updateTask,
  },
  {
    name: 'move_task',
    kind: 'task',
    summary: "Move tasks (one step for all, in the order given) to a column, before or after a task there (else at the end); deck: onto another deck that holds tasks; lane: into a lane (a member's uid or a card's id by the deck's lanes, none for nobody).",
    args: obj(
      {
        task: s(),
        tasks: ids('several, in the order they go'),
        column: s('by id or name'),
        deck: s('another deck (id or name); left out, their own'),
        lane: s("the deck's lanes: a member's uid (by who) or a card id (by card); none: nobody / no card"),
        before: s('a task they go before'),
        after: s('a task they go after'),
      },
      [],
    ),
    build: moveTask,
  },
  {
    name: 'update_deck',
    kind: 'deck',
    summary:
      "Change a deck's setup: what it holds (tasks or cards; switching to cards with tasks on it needs tasks_to), which cards (rules, cards), the fields its columns and rows come from, its boxes' names, lanes. null takes rows, names or lanes away.",
    args: obj(
      {
        id: s('the deck, by id or name'),
        holds: { type: 'string', enum: ['tasks', 'cards'] },
        rules: { type: 'array', items: ruleSpec, description: 'cards: which cards (replaces the rules)' },
        cards: ids('cards: cards added by hand (replaces them)'),
        col_field: { type: 'string', enum: CARD_FIELDS },
        row_field: { anyOf: [{ type: 'string', enum: CARD_FIELDS }, { type: 'null' }], description: 'null: no rows' },
        names: { type: ['array', 'null'], items: obj({ col: s(), row: s(), name: s(), tone: { type: 'string', enum: ['good', 'bad'] } }, ['col', 'row']), description: "cards: its boxes' names (replaces them)" },
        lanes: { anyOf: [{ type: 'string', enum: LANES }, { type: 'null' }], description: 'tasks: lanes by who or by card; null: none' },
        tasks_to: s("switching to cards with tasks on it: 'new_deck' (a new deck of tasks next to it, with its columns) or a deck's id or name (each into the column of the same name)"),
        handle: s("with tasks_to 'new_deck': a $handle ($a…) for the new deck's id, for later ops in the batch (its name is always '<name> · tasks')"),
      },
      ['id'],
    ),
    build: updateDeck,
  },
  {
    name: 'create_deck_column',
    kind: 'deck',
    summary: "Add a column at the end of a deck's columns (at most 12).",
    args: obj({ deck: s('by id or name'), name: s(), limit: n('most tasks it should hold'), done: b('the finished column') }, ['deck', 'name']),
    build: createDeckColumn,
  },
  {
    name: 'update_deck_column',
    kind: 'deck',
    summary: "Change a deck's column: its name, its limit (null takes it away), whether it's the finished column.",
    args: obj({ deck: s('by id or name'), column: s('by id or name'), name: s(), limit: { type: ['number', 'null'], description: '1–99; null: none' }, done: b() }, ['deck', 'column']),
    build: updateDeckColumn,
  },
  {
    name: 'move_deck_column',
    kind: 'deck',
    summary: "Move a deck's column one place left or right.",
    args: obj({ deck: s('by id or name'), column: s('by id or name'), by: { type: 'string', enum: ['left', 'right'] } }, ['deck', 'column', 'by']),
    build: moveDeckColumn,
  },
  {
    name: 'update_timeline',
    kind: 'timeline',
    summary: "Change a timeline's rows: by deck, by who a task is given to, or by card. (A task's days: update_task start/due.)",
    args: obj({ id: s('the timeline'), rows: { type: 'string', enum: TIMELINE_ROWS_SAID } }, ['id', 'rows']),
    build: updateTimeline,
  },
]

export const REGISTRY: ReadonlyMap<string, OpDef> = new Map(OPS.map((o) => [o.name, o]))

export function build(ctx: OpCtx, op: string, args: unknown): Plan {
  const def = REGISTRY.get(op)
  if (!def) refuse(op, `there is no op ${op}`, `use one of ${OPS.map((o) => o.name).join(', ')}`)
  return def.build(ctx, args)
}

// `$a`-style handles in args replaced by the ids made earlier in the batch (deeply, in strings that are a handle).
function resolve(v: unknown, made: Record<string, string>): unknown {
  if (typeof v === 'string') return v.startsWith('$') && v in made ? made[v] : v
  if (Array.isArray(v)) return v.map((x) => resolve(x, made))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x, made)]))
  return v
}

export type Step = { op: string; args: Record<string, unknown> }

// A batch built in order: each op sees the workspace as the ops before it left it (projected), and may name what they
// made by handle. A step that makes something and gives no handle gets `$1`, `$2`… (its place in the batch).
export function buildBatch(ctx: OpCtx, steps: Step[]): Plan[] {
  const plans: Plan[] = []
  const made: Record<string, string> = {}
  let ws = ctx.ws
  steps.forEach((step, i) => {
    const args = resolve(step.args, made) as Record<string, unknown>
    if (!('handle' in args)) args.handle = `$${i + 1}`
    const plan = build({ ...ctx, ws }, step.op, args)
    for (const [h, id] of Object.entries(plan.ids)) {
      if (made[h] && made[h] !== id) refuse(step.op, `the handle ${h} is used twice`, 'give each new thing its own handle')
      made[h] = id
    }
    plans.push(plan)
    ws = project(ws, [plan])
  })
  return plans
}

// S6 (pieces.ts, delete.ts, stick.ts): every write in data/pieces.ts and data/canvases.ts is a wrapper (addPiece and
// placeDocument → create_piece, placePiece/placeLens → arrange or resize through pieces.ts' place, linkLens/openPiece/
// setDocumentsSetup/renamePiece → update_piece, deletePiece/deleteCanvas → delete, addCanvas → create_canvas,
// renameCanvas → rename, moveCanvas → move_canvas, moveToCanvas → move_to_canvas, alsoOnCanvas → place_on,
// takeOffCanvas → take_off). Left: placeDocument sharing the document in the same step (documents aren't an ops
// collection yet: a plain tracked() batch, as before). The UI's drag still passes exact boxes for what follows a plane
// (it draws them while dragging); arrange and resize work them out themselves (model/pieceMoves.ts' followerMoves).

// S7 (matrix.ts, table.ts, lens.ts; pure helpers in src/model/{matrix,table,lens}.ts): every write in data/matrix.ts and
// data/table.ts is a wrapper (setSetup/setPart/setOpen → update_matrix; setTable/setTablePart/setRows → update_table,
// or the axis op when the editors' whole list is one change; addNamed/addCardEntry/addNamedRow/addCardRow/addColumn →
// axis_add; removeEntry/removeRow/removeColumn → axis_remove; renameEntry/renameRow/editColumn/setColumnWidth/
// moveColumn → axis_update; setCell → update_cell, a set with merge). create_piece takes a typed `matrix` or `table`
// (templates, axes by type/plane/cards/names, rules, columns), converted to the stored setup. Rows and columns are
// named by key or name (a card's title, a typed name, `Feature › criterion`, a column's name), ambiguous → refused with
// the candidates. A criterion is update_card's `criteria` (taking one off cascades).

// S8 (tasks.ts, deck.ts): every write in data/tasks.ts is a wrapper (addTask → create_task; updateTask/updateTasks/
// setChecks → update_task; moveTask/moveTasks → move_task, one plan for several, the UI's exact orders and lane fields
// passed as `moves`; deleteTask/deleteTasks/deleteColumn → delete; setKanbanCols → create_deck_column /
// update_deck_column / move_deck_column when the editor's list is one change, else update_deck's raw `setup.cols`;
// setKanbanRows/setKanbanSetup → update_deck; moveTasksAway → update_deck with `moves` (the UI's) or `tasks_to` (the
// model's, worked out as KanbanSetup.tsx' moveTo did); setTimeline → update_timeline; logLearned → create_evidence
// from_task). create_piece takes a typed `deck`. A column has no doc of its own: delete and rename find it by id (with
// `deck` when two decks share the id), the model by name through the column ops.
