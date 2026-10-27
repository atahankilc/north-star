// Checks that the memory bank agrees with itself (README.md in memory-bank/ has the rules):
// - decisions-log.md: numbers run D-001, D-002, … with no gaps or repeats; every `Superseded by` names entries that exist.
// - decisions.md + decisions-1.0.md: cite only numbers that exist; every decision still standing has a line in one of
//   them; a superseded one is cited only under decisions.md's "Rejected".
// - state.md stays a snapshot (at most STATE_MAX_LINES lines).
// Run: npm run check:memory. Exits 1 with a list of problems.
import { readFileSync } from 'node:fs'

const STATE_MAX_LINES = 120
const dir = new URL('../memory-bank/', import.meta.url)
const read = (name) => readFileSync(new URL(name, dir), 'utf8')

const log = read('decisions-log.md')
const current = read('decisions.md')
// 1.0's rules, kept apart and not auto-loaded (D-248): lines there count as a decision's line too.
const old = read('decisions-1.0.md')
const state = read('state.md')
const problems = []

const entries = [...log.matchAll(/^### (D-\d{3}) · [^·]+· (.*)$/gm)].map(([, id, status]) => ({
  id,
  status,
  superseded: status.startsWith('Superseded'),
}))
const ids = new Set(entries.map((e) => e.id))
const superseded = new Set(entries.filter((e) => e.superseded).map((e) => e.id))

entries.forEach((e, i) => {
  const expected = `D-${String(i + 1).padStart(3, '0')}`
  if (!ids.has(expected)) problems.push(`decisions-log.md: ${expected} is missing`)
})
if (ids.size !== entries.length) {
  const seen = new Set()
  for (const { id } of entries) {
    if (seen.has(id)) problems.push(`decisions-log.md: ${id} appears twice`)
    seen.add(id)
  }
}
for (const e of entries.filter((e) => e.superseded)) {
  for (const [target] of e.status.matchAll(/D-\d{3}/g)) {
    if (!ids.has(target)) problems.push(`decisions-log.md: ${e.id} is superseded by ${target}, which doesn't exist`)
  }
}

const rejectedAt = current.search(/^## Rejected/m)
const rules = rejectedAt === -1 ? current : current.slice(0, rejectedAt)
const cited = new Set([...(current.match(/D-\d{3}/g) ?? []), ...(old.match(/D-\d{3}/g) ?? [])])
const citedInRules = new Set([...(rules.match(/D-\d{3}/g) ?? []), ...(old.match(/D-\d{3}/g) ?? [])])

for (const id of cited) {
  if (!ids.has(id)) problems.push(`decisions(-1.0).md: cites ${id}, which isn't in decisions-log.md`)
}
for (const { id, superseded: gone } of entries) {
  if (!gone && !cited.has(id)) problems.push(`decisions.md: ${id} is still standing but has no line (here or in decisions-1.0.md)`)
}
for (const id of citedInRules) {
  if (superseded.has(id)) problems.push(`decisions(-1.0).md: cites ${id} as a rule, but it is superseded (move it under "Rejected" or drop it)`)
}

const stateLines = state.split('\n').length
if (stateLines > STATE_MAX_LINES) {
  problems.push(`state.md: ${stateLines} lines (at most ${STATE_MAX_LINES}); move finished work to state-history.md`)
}

if (problems.length) {
  console.error(`memory bank: ${problems.length} problem${problems.length === 1 ? '' : 's'}`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`memory bank ok: ${entries.length} decisions (${superseded.size} superseded), state.md ${stateLines} lines`)
