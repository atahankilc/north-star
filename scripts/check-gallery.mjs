// The component gallery's check (D-324, docs/specs/gallery.md §7): `npm run check:gallery`.
// - every component file in a covered folder has its example beside it (`X.gallery.tsx`), or is in EXEMPT with why;
// - every example has its component file, and names it (`file: 'src/ui/X.tsx'`);
// - nothing in the app imports the gallery (src/gallery/ or a *.gallery.tsx), so it never reaches a build;
// - gallery.html is in no build input.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, relative, dirname, basename } from 'node:path'

const ROOT = join(dirname(new URL(import.meta.url).pathname), '..')
// The folders whose components need an example (D-324): src/ui since G1, src/views/workspace since G2, src/onboarding
// since G3.
const COVERED = ['src/ui', 'src/views/workspace', 'src/onboarding']
// Component files with no example, and why.
const EXEMPT = {
  'src/ui/patterns/Curtain.tsx': 'the page’s own loading curtain (WebGL backdrop); seen on every page load, and it drives the global `revealed` the gallery holds on',
}

// Components still waiting for their example: none since G3. Kept so a folder joining later can list its own while
// they're written; the list only shrinks, and a new component never joins it.
const PENDING = []

const problems = []
const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
const rel = (p) => relative(ROOT, p).split('\\').join('/')

// A file exports a component: a capitalised function or const (memo, forwardRef, an arrow).
const COMPONENT = /^export\s+(?:function\s+[A-Z]\w*\s*[(<]|const\s+[A-Z]\w*\s*=\s*(?:memo|forwardRef|\())/m

for (const folder of COVERED) {
  const files = walk(join(ROOT, folder)).filter((p) => p.endsWith('.tsx'))
  for (const p of files) {
    const r = rel(p)
    if (r.endsWith('.gallery.tsx')) {
      const comp = p.replace(/\.gallery\.tsx$/, '.tsx')
      if (!existsSync(comp)) problems.push(`${r}: no ${basename(comp)} beside it`)
      else if (!readFileSync(p, 'utf8').includes(`file: '${rel(comp)}'`)) problems.push(`${r}: its \`file\` should be '${rel(comp)}'`)
      continue
    }
    if (!COMPONENT.test(readFileSync(p, 'utf8'))) continue
    const ex = p.replace(/\.tsx$/, '.gallery.tsx')
    if (existsSync(ex)) {
      if (EXEMPT[r]) problems.push(`${r}: has an example and is in EXEMPT; drop one`)
      if (PENDING.includes(r)) problems.push(`${r}: has its example now; take it off PENDING`)
      continue
    }
    if (!EXEMPT[r] && !PENDING.includes(r)) problems.push(`${r}: a component with no example (add ${basename(ex)} beside it, D-324)`)
  }
}
for (const r of PENDING) if (!existsSync(join(ROOT, r))) problems.push(`PENDING lists ${r}, which is gone`)
for (const r of Object.keys(EXEMPT)) if (!existsSync(join(ROOT, r))) problems.push(`EXEMPT lists ${r}, which is gone`)

// The app never imports the gallery.
const IMPORTS_GALLERY = /(?:from\s+|import\s*\(\s*|import\s+)['"][^'"]*(?:\.gallery(?:\.tsx)?|\/gallery\/[^'"]*)['"]/
for (const p of walk(join(ROOT, 'src')).filter((p) => /\.(ts|tsx)$/.test(p))) {
  const r = rel(p)
  if (r.startsWith('src/gallery/') || r.endsWith('.gallery.tsx')) continue
  if (IMPORTS_GALLERY.test(readFileSync(p, 'utf8'))) problems.push(`${r}: imports the gallery (dev only, D-324)`)
}

// gallery.html is never built.
for (const f of ['vite.config.ts', 'vite.demo.config.ts', 'index.html', 'demo.html']) {
  if (existsSync(join(ROOT, f)) && readFileSync(join(ROOT, f), 'utf8').includes('gallery')) problems.push(`${f}: mentions the gallery (it must stay out of every build, D-324)`)
}

if (problems.length) {
  console.error(`check:gallery: ${problems.length} problem${problems.length === 1 ? '' : 's'}\n` + problems.map((p) => `  - ${p}`).join('\n'))
  process.exit(1)
}
const n = COVERED.flatMap((f) => walk(join(ROOT, f))).filter((p) => p.endsWith('.gallery.tsx')).length
console.log(`gallery ok: ${n} examples in ${COVERED.join(', ')}, ${Object.keys(EXEMPT).length} exempt, ${PENDING.length} pending`)
