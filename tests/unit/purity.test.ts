// src/model/, src/ops/ and the agent's read layer src/agent/read/ stay pure (S3, S10, D-312): no Firebase, React or zustand, nothing from views/, and no value from
// data/, state/ or anywhere outside the two (types are fine: `import type`). So the ops and the read layer run in node,
// in a worker, in tests, without a project. The one door to Firebase is src/ops/firestore.ts, and only src/ops/index.ts
// may import it (pure code imports the modules it needs, never the index).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const DIRS = ['src/model', 'src/ops', 'src/agent/read'].map((d) => join(ROOT, d))
const ADAPTER = join(ROOT, 'src/ops/firestore.ts')
const INDEX = join(ROOT, 'src/ops/index.ts')
const BANNED = /^(firebase|@firebase|react|react-dom|zustand)(\/|$)/

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : []
  })

// Every import and re-export with its specifier, and whether it brings only types.
function importsOf(src: string) {
  const out: { spec: string; typeOnly: boolean; text: string }[] = []
  const re = /^\s*(import|export)\s+(type\s+)?([\s\S]*?)\s*from\s*['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm
  for (const m of src.matchAll(re)) {
    if (m[5]) out.push({ spec: m[5], typeOnly: false, text: m[0].trim() })
    else out.push({ spec: m[4], typeOnly: !!m[2], text: m[0].trim() })
  }
  return out
}

const inside = (p: string) => DIRS.some((d) => p === d || p.startsWith(d + '/'))

describe('src/model, src/ops and src/agent/read are pure', () => {
  const all = DIRS.flatMap(files)

  it('finds the files', () => {
    expect(all.length).toBeGreaterThan(10)
    expect(all).toContain(ADAPTER)
  })

  for (const file of all.filter((f) => f !== ADAPTER)) {
    it(relative(ROOT, file), () => {
      const bad: string[] = []
      for (const { spec, typeOnly, text } of importsOf(readFileSync(file, 'utf8'))) {
        if (typeOnly) continue
        if (BANNED.test(spec)) bad.push(`${text}  (no Firebase, React or zustand)`)
        else if (spec.startsWith('.')) {
          const target = resolve(dirname(file), spec)
          if (!inside(target)) bad.push(`${text}  (a value from outside src/model, src/ops and src/agent/read: move it in, or import type)`)
          else if ((target === ADAPTER.replace(/\.ts$/, '') || target === INDEX.replace(/\.ts$/, '') || target === join(ROOT, 'src/ops')) && file !== INDEX)
            bad.push(`${text}  (only src/ops/index.ts imports the Firebase adapter; import the module you need)`)
        }
      }
      expect(bad).toEqual([])
    })
  }

  it('the guard itself catches what it should', () => {
    const found = importsOf(`import { db } from '../data/firebase'\nimport type { Card } from '../data/cards'\nimport {\n  a,\n  b,\n} from 'firebase/firestore'\nexport { x } from 'zustand'\nimport 'react'\n`)
    expect(found.map((f) => [f.spec, f.typeOnly])).toEqual([
      ['../data/firebase', false],
      ['../data/cards', true],
      ['firebase/firestore', false],
      ['zustand', false],
      ['react', false],
    ])
  })
})
