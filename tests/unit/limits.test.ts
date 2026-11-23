// src/model/limits.ts and firestore.rules hold the same numbers (D-325): the rules can't import them, so this reads the
// rules and checks each limit against the line that enforces it. A change to either side fails here until both agree.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as L from '../../src/model/limits'
import { base64Length } from '../../src/model/base64'

const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8')
// Writing together's packets live in RTDB (D-426), as base64: its rules cap their length.
const rtdbRules = readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8')
const base64Cap = (field: string) => num(rtdbRules, new RegExp(`"${field}": \\{\\s*"\\.validate": "newData\\.isString\\(\\) && newData\\.val\\(\\)\\.length > 0 && newData\\.val\\(\\)\\.length <= (\\d+)"`))

// A rules function's body: from `function name(` to the next function or match at its depth.
function body(name: string) {
  const start = rules.indexOf(`function ${name}(`)
  if (start < 0) throw new Error(`no function ${name} in firestore.rules`)
  const rest = rules.slice(start + 1)
  const end = rest.search(/\n\s{4}(function |match )/)
  return end < 0 ? rest : rest.slice(0, end)
}
// The number a pattern captures in a body; the pattern's one group is the number.
function num(src: string, re: RegExp) {
  const m = src.match(re)
  if (!m) throw new Error(`no match for ${re} in firestore.rules`)
  return Number(m[1])
}
const text = (field: string) => new RegExp(`isText\\(d\\.${field}, (\\d+)\\)`)
const opt = (obj: string, field: string) => new RegExp(`optText\\(${obj}, '${field}', (\\d+)\\)`)
const list = (path: string) => new RegExp(`${path.replace('.', '\\.')}\\.size\\(\\) <= (\\d+)`)

const CASES: [keyof typeof L, () => number][] = [
  ['TITLE_MAX', () => num(body('validCard'), text('title'))],
  ['CHANNEL_NAME_MAX', () => num(rules, /\[a-z0-9\]\[a-z0-9-\]\{0,(\d+)\}/) + 1],
  ['FOLDER_NAME_MAX', () => num(rules.slice(rules.indexOf('function validFolder(')), text('name'))],
  ['LONG_TEXT_MAX', () => num(body('validCard'), opt('d', 'body'))],
  ['TAGS_MAX', () => num(body('validCard'), list('d.tags'))],
  ['REGIONS_MAX', () => num(body('validCompetitor'), list('d.regions'))],
  ['ID_MAX', () => num(body('validCard'), /isText\(d\.pieceId, (\d+)\)/)],
  ['PACKAGE_MEMBERS_MAX', () => num(body('validPackage'), list('d.memberIds'))],
  ['EMAIL_MAX', () => num(body('validMember'), opt('d', 'email'))],
  ['PHOTO_MAX', () => num(body('validMember'), opt('d', 'photo'))],
  ['COL_KEY_MAX', () => num(body('validTask'), /isText\(d\.col, (\d+)\)/)],
  ['WORKSPACE_NAME_KEPT_MAX', () => num(body('validName'), list('d.name'))],
  ['FACT_MAX', () => num(body('validCompetitor'), opt('d', 'pricing'))],
  ['URL_MAX', () => num(body('validCompetitor'), opt('d', 'url'))],
  ['CATEGORY_MAX', () => num(body('validCompetitorFeature'), opt('d', 'category'))],
  ['EVIDENCE_TEXT_MAX', () => num(body('validEvidence'), text('text'))],
  ['SOURCE_MAX', () => num(body('validEvidence'), opt('d', 'source'))],
  ['LINK_LABEL_MAX', () => num(body('validEdge'), opt('d', 'label'))],
  ['AXIS_NOUN_MAX', () => num(body('validAxis'), opt('a', 'noun'))],
  ['UNIT_MAX', () => num(body('validMatrix'), opt('m', 'unit'))],
  ['PIECE_NAME_MAX', () => num(body('validPiece'), opt('d', 'name'))],
  ['AUTHOR_NAME_MAX', () => num(body('validDoc'), text('name'))],
  ['CANVAS_NAME_MAX', () => num(body('validCanvas'), text('name'))],
  ['KICKER_MAX', () => num(body('validLabel'), opt('d', 'kicker'))],
  ['DESCRIPTION_MAX', () => num(rules, /optText\(request\.resource\.data, 'description', (\d+)\)/)],
  ['KANBAN_COLS_MAX', () => num(body('validKanban'), list('k.cols'))],
  ['BOX_NAMES_MAX', () => num(body('validKanban'), list('k.names'))],
  ['TASK_TITLE_MAX', () => num(body('validTask'), text('title'))],
  ['TASK_NOTES_MAX', () => num(body('validTask'), opt('d', 'notes'))],
  ['CHECKS_MAX', () => num(body('validTask'), list('d.checks'))],
  ['LABELS_MAX', () => num(body('validTask'), list('d.labels'))],
  ['CELL_TEXT_MAX', () => num(body('validCell'), text('value'))],
  ['CELL_NOTES_MAX', () => num(body('validCell'), opt('d', 'notes'))],
  ['VALUE_MAX', () => num(body('validCell'), text('value'))],
  ['MESSAGE_MAX', () => num(rules, /isText\(d\.text, (\d+)\)/)],
  ['MENTIONS_MAX', () => num(rules.slice(rules.indexOf('match /messages/')), list('d.mentions'))],
  ['AGENT_NOTES_MAX', () => num(rules, /b\.keys\(\)\.hasOnly\(\['text'\]\) && b\.text is string && b\.text\.size\(\) <= (\d+)/)],
  ['CHANGE_KINDS_MAX', () => num(rules.slice(rules.indexOf('match /changes/')), list('d.kinds'))],
  ['SUMMARY_PIECES_CHARS', () => num(body('validSummary'), list('d.pieces'))],
  ['SUMMARY_CARDS_CHARS', () => num(body('validSummary'), list('d.cards'))],
  ['KEY_ALLOWED_MAX', () => num(body('validAccess'), list('d.allowed'))],
  ['KEY_MODELS_MAX', () => num(body('validModels'), list('d.allowedModels'))],
]
// Bytes in the app, base64 in RTDB.
const BASE64_CASES: [keyof typeof L, () => number][] = [
  ['LIVE_PACKET_MAX', () => base64Cap('u')],
  ['LIVE_STATE_MAX', () => base64Cap('s')],
]

// Limits the rules can't hold, each with why: they bound an item inside a list or map (Firestore rules can't loop over
// one), or Firestore itself. The client and the ops enforce them.
const CLIENT_ONLY: Partial<Record<keyof typeof L, string>> = {
  TAG_MAX: "a card's #tag, inside the tags list",
  REGION_MAX: "a competitor's region, inside the regions list",
  CRITERION_MAX: "a feature's criterion, inside the criteria list",
  COL_NAME_MAX: "a deck column's name, inside the kanban's cols list",
  LIMIT_MAX: "a deck column's limit, inside the cols list",
  BOX_NAME_MAX: "a box's name, inside the kanban's names list",
  CHECK_MAX: 'a checklist item, inside the checks list',
  LABEL_MAX: 'a #label, inside the labels list',
  MATRIX_NAME_MAX: "a typed head's name, inside an axis's items",
  GLYPH_MAX: "a scale step's glyph, inside the steps list",
  STEP_LABEL_MAX: "a scale step's label, inside the steps list",
  TABLE_COL_NAME_MAX: "a table column's name, inside the cols list",
  CHANGE_IDS_MAX: 'ids in one change entry: the rules cap the joined string (6600), not the count',
  WRITE_BATCH_MAX: 'how a cut write is cut: the SDK slows with a batch\'s square, not a rule',
  ATOMIC_WRITE_MAX: 'docs in a write kept whole, for the page\'s sake, not a rule',
  ATOMIC_WRITE_BYTES: 'bytes in a write kept whole, under Firestore\'s 10 MiB, not a rule',
  MEMBERS_LISTED: 'how many people a picker loads, not data',
  WORKSPACE_NAME_MAX: "the fields' cap; the rules' validName takes up to WORKSPACE_NAME_KEPT_MAX (older names kept)",
  SUMMARY_PIECES_MAX: 'pieces in a workspace summary: the rules cap the joined string (SUMMARY_PIECES_CHARS), not the count',
  LIVE_FOLD_PACKETS: 'when a writer folds the packets, not data',
  LIVE_FOLD_BYTES: 'when a writer folds the packets, not data',
  LIVE_DROP_BATCH: 'how a compaction cuts its deletes, not a rule',
  CARET_MAX: 'a caret in presence: database.rules.json, checked in tests/unit/liveText.test.ts',
  SUMMARY_CARDS_MAX: 'cards in a workspace summary: the rules cap the joined string (SUMMARY_CARDS_CHARS), not the count',
}

describe('limits match firestore.rules', () => {
  for (const [name, read] of CASES) it(name, () => expect(L[name]).toBe(read()))
  for (const [name, read] of BASE64_CASES) it(`${name} (base64 in database.rules.json)`, () => expect(base64Length(L[name] as number)).toBe(read()))
  // A new limit is either checked against its rule above or says here why the rules can't hold it.
  it('every limit is checked or says why not', () => {
    const covered = new Set<string>([...CASES.map(([n]) => n), ...BASE64_CASES.map(([n]) => n), ...Object.keys(CLIENT_ONLY)])
    expect(Object.keys(L).filter((n) => !covered.has(n))).toEqual([])
  })
})
