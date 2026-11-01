// The repo's rules, run for every agent as it writes (D-339). A Claude Code PostToolUse hook (.claude/settings.json) on
// Write/Edit: the written file's path comes on stdin; when it's one the rules cover, the checks run (each well under a
// second): tokens and the kit (D-325, D-326), the gallery (D-324), the lessons (D-315), the memory bank. Anything they
// refuse goes back to the agent as the tool's feedback (exit 2), so it's fixed at once and no one has to ask.
// Commits are held to the same and to the gallery and onboarding going with a changed component: scripts/commit-rules.mjs.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

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
if (/^src\/.*\.(tsx?|css)$/.test(rel)) for (const c of ['check-tokens', 'check-kit', 'check-gallery', 'check-lessons']) checks.add(c)
if (/^src\/onboarding\/|^docs\/specs\/onboarding-lessons\.md$/.test(rel)) checks.add('check-lessons')
if (/^scripts\/(kit|tokens)-baseline\.json$/.test(rel)) for (const c of ['check-tokens', 'check-kit']) checks.add(c)
if (/^memory-bank\//.test(rel)) checks.add('check-memory')
if (!checks.size) process.exit(0)

const refused = []
for (const c of checks) {
  try {
    execFileSync(process.execPath, [path.join(root, 'scripts', `${c}.mjs`)], { cwd: root, stdio: 'pipe', encoding: 'utf8' })
  } catch (e) {
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim().split('\n').slice(-20).join('\n')
    refused.push(`npm run ${c.replace('check-', 'check:')} refused it:\n${out}`)
  }
}
if (!refused.length) process.exit(0)
process.stderr.write(`${rel}: the repo's rules (CLAUDE.md "Hard rules") refused this change. Fix it now, before going on:\n\n${refused.join('\n\n')}\n`)
process.exit(2)
