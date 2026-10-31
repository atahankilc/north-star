// Which component uses which (D-326's gallery, the user: "hangi componentler hangi primitive componentlerden oluşuyor…
// nerede kullanıldıklarını bir ağaç şeklinde"): read from the sources themselves, never a list kept by hand. A file
// uses another when it imports a capitalised name from it and draws it (`<Name`). Each file is one node; its level is 0
// when it draws no other component file (a primitive), else one more than the deepest it draws.
const sources = import.meta.glob<string>(['/src/**/*.tsx', '!/src/**/*.gallery.tsx', '!/src/gallery/**', '!/src/demo/**'], { query: '?raw', import: 'default', eager: true })

export type Node = { file: string; name: string; uses: string[]; usedBy: string[]; level: number }

const norm = (parts: string[]) => {
  const out: string[] = []
  for (const p of parts) {
    if (p === '..') out.pop()
    else if (p !== '.' && p !== '') out.push(p)
  }
  return '/' + out.join('/')
}
// An import's path to a file of `sources`, or null (a library, a .ts module, a stylesheet).
function resolve(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null
  const base = norm([...from.split('/').slice(0, -1), ...spec.split('/')])
  for (const f of [`${base}.tsx`, `${base}/index.tsx`]) if (f in sources) return f
  return null
}

const IMPORT = /import\s+(?:type\s+)?(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*'([^']+)'/g

function usesOf(file: string, src: string): string[] {
  const out = new Set<string>()
  for (const m of src.matchAll(IMPORT)) {
    if (/^import\s+type\b/.test(m[0])) continue
    const target = resolve(file, m[3])
    if (!target || target === file) continue
    const names = [m[1], ...(m[2] ?? '').split(',').map((s) => s.trim())]
      .filter((n): n is string => !!n && !n.startsWith('type '))
      .map((n) => n.split(/\s+as\s+/).pop()!.trim())
      .filter((n) => /^[A-Z]/.test(n))
    if (names.some((n) => new RegExp(`<${n}[\\s/>.]`).test(src))) out.add(target)
  }
  return [...out]
}

const base = (f: string) => f.split('/').pop()!.replace(/\.tsx$/, '')

export const NODES: Map<string, Node> = (() => {
  const nodes = new Map<string, Node>()
  for (const [file, src] of Object.entries(sources)) nodes.set(file, { file, name: base(file), uses: usesOf(file, src), usedBy: [], level: 0 })
  for (const n of nodes.values()) for (const u of n.uses) nodes.get(u)?.usedBy.push(n.file)
  // Levels: 0 for what draws nothing else; a cycle (two files drawing each other) stops at the file already on the path.
  const memo = new Map<string, number>()
  const levelOf = (f: string, path: Set<string>): number => {
    const known = memo.get(f)
    if (known !== undefined) return known
    if (path.has(f)) return 0
    path.add(f)
    const uses = nodes.get(f)?.uses ?? []
    const l = uses.length ? 1 + Math.max(...uses.map((u) => levelOf(u, path))) : 0
    path.delete(f)
    memo.set(f, l)
    return l
  }
  for (const n of nodes.values()) n.level = levelOf(n.file, new Set())
  for (const n of nodes.values()) n.usedBy.sort((a, b) => base(a).localeCompare(base(b)))
  return nodes
})()

// From the gallery's `file: 'src/ui/X.tsx'` to a node's key.
export const nodeOf = (file: string) => NODES.get(`/${file}`)
