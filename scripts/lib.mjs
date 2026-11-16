// What the checks share (D-361's round 2, R2): each had its own copy of walking the tree, of the list of rule checks
// and of the covered folders.
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Every file under `dir` (from the repo's root) whose name passes `test`, as paths from the root with `/`.
export function walk(dir, test = /./, out = []) {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const p = `${dir}/${e.name}`
    if (e.isDirectory()) walk(p, test, out)
    else if (test.test(e.name)) out.push(p)
  }
  return out
}

// The folders whose components need a gallery example beside them (D-324): src/ui since G1, src/views/workspace since
// G2, src/onboarding since G3.
export const COVERED = ['src/ui', 'src/views/workspace', 'src/views/workspaces', 'src/onboarding']

// The rule checks a write under src/ and a commit both run (D-339); a check may carry its arguments.
export const RULE_CHECKS = ['check-tokens', 'check-kit', 'check-gallery', 'check-lessons', 'check-repeats --names']

// Runs each; what refused, as `npm run check:x` and the last `lines` of what it said.
export function runChecks(checks, lines) {
  const refused = []
  for (const c of checks) {
    try {
      const [name, ...rest] = c.split(' ')
      execFileSync(process.execPath, [path.join(root, 'scripts', `${name}.mjs`), ...rest], { cwd: root, stdio: 'pipe', encoding: 'utf8' })
    } catch (e) {
      refused.push({ run: `npm run ${c.replace('check-', 'check:').replace(' --', ' -- --')}`, said: `${e.stdout ?? ''}${e.stderr ?? ''}`.trim().split('\n').slice(-lines).join('\n') })
    }
  }
  return refused
}
