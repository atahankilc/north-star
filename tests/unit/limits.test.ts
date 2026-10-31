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

describe('limits match firestore.rules', () => {
  for (const [name, read] of CASES) it(name, () => expect(L[name]).toBe(read()))
})
