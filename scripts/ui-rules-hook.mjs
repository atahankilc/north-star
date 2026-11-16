// The repo's rules, run for every agent as it writes (D-339). A Claude Code PostToolUse hook (.claude/settings.json) on
// Write/Edit: the written file's path comes on stdin; when it's one the rules cover, the checks run (each well under a
// second): tokens and the kit (D-325, D-326; behaviour by hand too, D-391), the gallery (D-324), the lessons (D-315),
// an exported name declared twice (check-repeats --names, D-391), the memory bank. Anything they
// refuse goes back to the agent as the tool's feedback (exit 2), so it's fixed at once and no one has to ask.
// Commits are held to the same and to the gallery and onboarding going with a changed component: scripts/commit-rules.mjs.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { root, RULE_CHECKS, runChecks } from './lib.mjs'


let input = {}
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}')
} catch {
  process.exit(0)
}
const file = input.tool_input?.file_path ?? input.tool_response?.filePath ?? ''
const rel = path.relative(root, path.resolve(file)).split(path.sep).join('/')
if (!file || rel.startsWith('..')) process.exit(0)

const checks = new Set()
if (/^src\/.*\.(tsx?|css)$/.test(rel)) for (const c of RULE_CHECKS) checks.add(c)
if (/^src\/onboarding\/|^docs\/specs\/onboarding-lessons\.md$/.test(rel)) checks.add('check-lessons')
if (/^scripts\/(kit|tokens|repeats)-baseline\.json$/.test(rel)) for (const c of ['check-tokens', 'check-kit', 'check-repeats --names']) checks.add(c)
if (/^memory-bank\//.test(rel)) checks.add('check-memory')
if (!checks.size) process.exit(0)

const refused = runChecks(checks, 20).map((r) => `${r.run} refused it:\n${r.said}`)
if (!refused.length) process.exit(0)
process.stderr.write(`${rel}: the repo's rules (CLAUDE.md "Hard rules") refused this change. Fix it now, before going on:\n\n${refused.join('\n\n')}\n`)
process.exit(2)
