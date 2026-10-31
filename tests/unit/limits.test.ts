// src/model/limits.ts and firestore.rules hold the same numbers (D-325): the rules can't import them, so this reads the
// rules and checks each limit against the line that enforces it. A change to either side fails here until both agree.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as L from '../../src/model/limits'

const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8')

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
  ['LONG_TEXT_MAX', () => num(body('validCard'), opt('d', 'body'))],
  ['PIECE_NAME_MAX', () => num(body('validPiece'), opt('d', 'name'))],
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
]

// Limits the rules can't hold, each with why: they bound an item inside a list or map (Firestore rules can't loop over
// one), or Firestore itself. The client and the ops enforce them.
const CLIENT_ONLY: Partial<Record<keyof typeof L, string>> = {
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
  WRITE_BATCH_MAX: "Firestore's own batch cap (500), not a rule",
}

describe('limits match firestore.rules', () => {
  for (const [name, read] of CASES) it(name, () => expect(L[name]).toBe(read()))
  // A new limit is either checked against its rule above or says here why the rules can't hold it.
  it('every limit is checked or says why not', () => {
    const covered = new Set<string>([...CASES.map(([n]) => n), ...Object.keys(CLIENT_ONLY)])
    expect(Object.keys(L).filter((n) => !covered.has(n))).toEqual([])
  })
})
