// The repo's rules at commit time (D-339), for people and agents alike (.githooks/, `npm install` points git at it).
//   node scripts/commit-rules.mjs pre          pre-commit: the rule checks (tokens, kit, gallery, lessons, memory bank)
//   node scripts/commit-rules.mjs msg <file>   commit-msg: a changed component ships with its gallery and its lesson
// The second can't know whether a change is "real" (CLAUDE.md: a new component, or a real change to one, ships with its
// X.gallery.tsx and its lesson), so it asks the commit to say: when a component file is staged without its gallery
// file, the message needs a `Gallery: …` line (why it's unchanged); when UI is staged without src/onboarding/lessons.ts
// or docs/specs/onboarding-lessons.md, a `Lessons: …` line. Saying so is enough; forgetting it isn't.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const [mode, msgFile] = process.argv.slice(2)
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
// What's staged (RULES_STAGED, comma-separated, stands in for it in a test without touching the index).
const staged = (process.env.RULES_STAGED?.split(',') ?? git('diff', '--cached', '--name-only', '--diff-filter=ACMR').split('\n')).filter(Boolean)

if (mode === 'pre') {
  const checks = ['check-tokens', 'check-kit', 'check-gallery', 'check-lessons']
  if (staged.some((f) => f.startsWith('memory-bank/'))) checks.push('check-memory')
  const refused = []
  for (const c of checks) {
    try {
      execFileSync(process.execPath, [path.join(root, 'scripts', `${c}.mjs`)], { cwd: root, stdio: 'pipe', encoding: 'utf8' })
    } catch (e) {
      refused.push(`npm run ${c.replace('check-', 'check:')}:\n${`${e.stdout ?? ''}${e.stderr ?? ''}`.trim().split('\n').slice(-15).join('\n')}`)
    }
  }
  if (refused.length) {
    console.error(`commit refused by the repo's rules (D-339):\n\n${refused.join('\n\n')}`)
    process.exit(1)
  }
  process.exit(0)
}

if (mode === 'msg') {
  const message = readFileSync(msgFile, 'utf8')
  const said = (key) => new RegExp(`^${key}:\\s*\\S`, 'mi').test(message)
  const COVERED = /^src\/(ui|views\/workspace|views\/workspaces|onboarding)\/.*\.tsx$/
  const UI = /^src\/(ui|views|onboarding|agent\/ui)\/.*\.tsx$/
  const isExtra = (f) => /\.(gallery|test)\.tsx$/.test(f)
  const problems = []

  // Gallery: a covered component staged without its example (D-324).
  const noGallery = staged.filter((f) => COVERED.test(f) && !isExtra(f)).filter((f) => {
    const g = f.replace(/\.tsx$/, '.gallery.tsx')
    return existsSync(path.join(root, g)) && !staged.includes(g)
  })
  if (noGallery.length && !said('Gallery'))
    problems.push(
      `Components changed without their gallery example:\n  ${noGallery.join('\n  ')}\n` +
        `Update each X.gallery.tsx (a new state for what changed), or add a line to the message: Gallery: <why it's unchanged>`,
    )

  // Onboarding: UI staged without its lesson (D-315).
  const ui = staged.filter((f) => UI.test(f) && !isExtra(f))
  const lessons = staged.some((f) => f === 'src/onboarding/lessons.ts' || f === 'docs/specs/onboarding-lessons.md')
  if (ui.length && !lessons && !said('Lessons'))
    problems.push(
      `UI changed without its lesson:\n  ${ui.slice(0, 8).join('\n  ')}${ui.length > 8 ? `\n  …and ${ui.length - 8} more` : ''}\n` +
        `Add or bump its lesson in src/onboarding/lessons.ts (and a line in releases.ts if people should hear of it), ` +
        `or add a line to the message: Lessons: <why none is needed>`,
    )

  if (problems.length) {
    console.error(`commit refused by the repo's rules (D-339):\n\n${problems.join('\n\n')}`)
    process.exit(1)
  }
  process.exit(0)
}

console.error('usage: node scripts/commit-rules.mjs pre | msg <file>')
process.exit(2)
