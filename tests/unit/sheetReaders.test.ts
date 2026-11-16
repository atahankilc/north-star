// The sheet's values (`--sheet-x0`…, foundation/sheet.ts) are one rule for `[data-sheet]` elements, never on the root:
// on <html> every change restyles the whole page. So a style that reads one must have its element say `data-sheet`,
// or it reads nothing and stops riding the sheet without a word. Checked by folder: a CSS file that reads a value has
// code beside it that sets the attribute.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..', '..', 'src')
const READS = /var\(--sheet-(x0|x1|b|rail|round|cut)\b/

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

describe('what rides the sheet says so', () => {
  const all = files(SRC)
  const readers = all.filter((f) => f.endsWith('.css') && READS.test(readFileSync(f, 'utf8')))

  it('finds the readers', () => {
    expect(readers.length).toBeGreaterThan(3)
  })

  it.each(readers.map((f) => [f.slice(SRC.length + 1), f]))('%s has `data-sheet` set beside it', (_, file) => {
    const beside = all.filter((f) => dirname(f) === dirname(file) && /\.tsx?$/.test(f) && !/\.gallery\.tsx$/.test(f))
    expect(beside.some((f) => /data-sheet/.test(readFileSync(f, 'utf8')))).toBe(true)
  })

  it('nothing writes them on the root', () => {
    const writers = all.filter((f) => /\.tsx?$/.test(f) && /documentElement\.style\.(set|get)Property(Value)?\(['"`]--sheet-/.test(readFileSync(f, 'utf8')))
    expect(writers).toEqual([])
  })
})
