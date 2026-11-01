// The gallery's tree (the user: "basic olanlar listenin başında durur, sonrasında kullanıldıkları yerleri ağaç üzerinde
// görürüm… her şeyi göstersin"): every component file, by level (primitives first: they draw no other component), each
// opening into what uses it, and that into what uses that, up to the screens. In the prompt's look (Menu.module.css,
// D-222). A row opens its page; its `▸ N` opens what uses it. A file with no example is faint but opens too (its page
// says what it's built from and where it's used), so the tree still says where a primitive ends up (the agent).
import { useMemo, useState } from 'react'
import { NODES, type Node } from './uses'
import { pageOfFile } from './pages'
import menu from '../ui/patterns/Menu.module.css'
import styles from './Gallery.module.css'

const LEVEL_NAME = ['primitives', 'built from primitives']

type Row = { key: string; node: Node; depth: number; prefix: string; open: boolean; canOpen: boolean }

export function UsesTree({ current, onPick }: { current?: string; onPick: (file: string) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const q = query.trim().toLowerCase()
  const nodes = useMemo(() => [...NODES.values()].sort((a, b) => a.level - b.level || label(a).localeCompare(label(b))), [])
  function label(n: Node) {
    return pageOfFile(n.file)?.name ?? n.name
  }

  // The rows shown: by level, each node's users under it while it's open (a path key, so one node can be open in one
  // place and shut in another).
  const rows = useMemo(() => {
    const out: (Row | { heading: string; key: string })[] = []
    const shown = q ? nodes.filter((n) => `${label(n)} ${n.file}`.toLowerCase().includes(q)) : nodes
    let level = -1
    // `prefix` is this row's tree lines, `cont` what its children's lines start with (a bar where an ancestor has more
    // below it).
    const walk = (n: Node, depth: number, key: string, prefix: string, cont: string, path: Set<string>) => {
      const isOpen = open.has(key)
      out.push({ key, node: n, depth, prefix, open: isOpen, canOpen: n.usedBy.length > 0 })
      if (!isOpen || q) return
      n.usedBy.forEach((u, i) => {
        const child = NODES.get(u)
        if (!child || path.has(u)) return
        const last = i === n.usedBy.length - 1
        walk(child, depth + 1, `${key}>${u}`, cont + (last ? '└ ' : '├ '), cont + (last ? '  ' : '│ '), new Set([...path, u]))
      })
    }
    for (const n of shown) {
      if (n.level !== level) {
        level = n.level
        out.push({ heading: `LEVEL ${level} · ${LEVEL_NAME[level] ?? `built from level ${level - 1}`}`, key: `# ${level}` })
      }
      walk(n, 0, n.file, '', '', new Set([n.file]))
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, open, q])

  const toggle = (key: string) =>
    setOpen((s) => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const count = rows.filter((r) => !('heading' in r) && r.depth === 0).length
  return (
    <div className={menu.prompt} style={{ maxHeight: 'none', flex: 1, minHeight: 0 }}>
      <label className={menu.line}>
        <span className={menu.caretSign} aria-hidden>
          &gt;
        </span>
        <input className={menu.field} type="text" value={query} placeholder="find a component…" aria-label="find a component" autoComplete="off" spellCheck={false} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className={menu.list} role="list" aria-label="Components by what they use">
        {rows.map((r) =>
          'heading' in r ? (
            <div key={r.key} className={menu.heading}>
              {r.heading}
            </div>
          ) : (
            <TreeRow key={r.key} row={r} example={!!pageOfFile(r.node.file)?.entry} current={current} name={label(r.node)} onPick={onPick} onToggle={() => toggle(r.key)} />
          ),
        )}
      </div>
      <div className={menu.foot} aria-hidden>
        {count} components · ▸ what uses it
      </div>
    </div>
  )
}

function TreeRow({ row, example, current, name, onPick, onToggle }: { row: Row; example: boolean; current?: string; name: string; onPick: (file: string) => void; onToggle: () => void }) {
  const here = row.node.file.slice(1) === current
  return (
    <div className={styles.treeRow} data-depth={row.depth} data-none={!example || undefined} role="listitem">
      <span className={styles.treePrefix} aria-hidden>
        {row.prefix}
      </span>
      <button className={styles.treeName} data-here={here || undefined} title={example ? `open ${name}` : `${row.node.file.slice(1)}: no example yet; open what it's built from and where it's used`} onClick={() => onPick(row.node.file)}>
        {here ? '• ' : ''}
        {name}
      </button>
      <span className={styles.treeLevel} aria-hidden>
        {row.depth ? `L${row.node.level}` : ''}
      </span>
      {row.canOpen ? (
        <button className={styles.treeFold} aria-expanded={row.open} title={row.open ? 'hide what uses it' : 'show what uses it'} onClick={onToggle}>
          {row.open ? '▾' : '▸'} {row.node.usedBy.length}
        </button>
      ) : (
        <span className={styles.treeFold} aria-hidden />
      )}
    </div>
  )
}
