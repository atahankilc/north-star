// The component gallery's page (D-324, docs/specs/gallery.md §3): the prompt of components on the left (the app's own
// MenuPanel, D-222), the example in the middle, the bar under it (state, theme, motion, what it stands on, zoom), the
// address saying all of it (`#c=select&s=open&theme=light&motion=reduced&on=piece&zoom=2`, `&alone` for the example by
// itself). Built from the app's own components and tokens.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { create } from 'zustand'
import { MenuPanel, type MenuEntry } from '../ui/Menu'
import { Choice } from '../ui/Choice'
import { useHistory } from '../data/history'
import { useTheme } from '../state/theme'
import { useMotion } from '../state/motion'
import { ENTRIES, SECTIONS, entryById, stateSlug } from './registry'
import { Mount } from './Mount'
import styles from './Gallery.module.css'

// Writes refused while the gallery is open (the bar shows them for the example shown).
const useRefused = create<{ n: number }>(() => ({ n: 0 }))
export const countRefused = () => useRefused.setState((s) => ({ n: s.n + 1 }))
const READ_ONLY = 'the gallery writes nothing'
useHistory.subscribe((s, prev) => {
  if (s.notice && s.notice !== prev.notice && s.notice.text === READ_ONLY) countRefused()
})

type Address = { c: string | null; s: string | null; theme: 'dark' | 'light'; motion: 'full' | 'reduced'; on: 'page' | 'piece'; zoom: '1' | '2'; alone: boolean; grid: boolean }

const subscribeHash = (on: () => void) => {
  window.addEventListener('hashchange', on)
  return () => window.removeEventListener('hashchange', on)
}
const readHash = () => location.hash

function parse(hash: string): Address {
  const h = new URLSearchParams(hash.slice(1))
  return {
    c: h.get('c'),
    s: h.get('s'),
    theme: h.get('theme') === 'light' ? 'light' : h.get('theme') === 'dark' ? 'dark' : useTheme.getState().theme,
    motion: h.get('motion') === 'reduced' ? 'reduced' : h.get('motion') === 'full' ? 'full' : useMotion.getState().reduced ? 'reduced' : 'full',
    on: h.get('on') === 'piece' ? 'piece' : 'page',
    zoom: h.get('zoom') === '2' ? '2' : '1',
    alone: h.has('alone'),
    grid: h.has('grid'),
  }
}

function hashOf(a: Address): string {
  const h = new URLSearchParams()
  if (a.c) h.set('c', a.c)
  if (a.s) h.set('s', a.s)
  h.set('theme', a.theme)
  h.set('motion', a.motion)
  if (a.on !== 'page') h.set('on', a.on)
  if (a.zoom !== '1') h.set('zoom', a.zoom)
  const s = h.toString()
  return `#${s}${a.alone ? '&alone' : ''}${a.grid && !a.alone ? '&grid' : ''}`
}

export function Gallery() {
  const hash = useSyncExternalStore(subscribeHash, readHash)
  const a = useMemo(() => parse(hash), [hash])
  const go = useCallback((next: Partial<Address>) => void (location.hash = hashOf({ ...parse(location.hash), ...next })), [])

  const entry = entryById(a.c) ?? ENTRIES[0]
  const names = useMemo(() => (entry ? Object.keys(entry.states) : []), [entry])
  const stateName = names.find((n) => stateSlug(n) === a.s) ?? names[0]
  const [reset, setReset] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const refused = useRefused((s) => s.n)

  // The address's theme and motion, in the gallery's stores only (gallery.html keeps storage in memory).
  useEffect(() => {
    if (useTheme.getState().theme !== a.theme) useTheme.setState({ theme: a.theme, pref: a.theme })
    const reduced = a.motion === 'reduced'
    if (useMotion.getState().reduced !== reduced) useMotion.setState({ reduced, pref: a.motion })
  }, [a.theme, a.motion])

  // A new example or state starts the refused count again.
  useEffect(() => useRefused.setState({ n: 0 }), [entry?.id, stateName, reset])

  // `[` and `]` step through the states, `\` mounts again (not while typing).
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.metaKey || e.ctrlKey || e.altKey || t?.closest('input, textarea, [contenteditable="true"]')) return
      const at = names.indexOf(stateName)
      if (e.key === ']' || e.key === '[') go({ s: stateSlug(names[(at + (e.key === ']' ? 1 : -1) + names.length) % names.length]) })
      else if (e.key === '\\') setReset((n) => n + 1)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [names, stateName, go])

  const items = useMemo<MenuEntry[]>(
    () =>
      SECTIONS.flatMap((sec) => {
        const here = ENTRIES.filter((e) => e.section === sec)
        if (!here.length) return []
        return [
          { key: `# ${sec}`, heading: `${sec} · ${here.length}` },
          ...here.map((e) => ({
            key: e.id,
            label: e.name,
            words: e.file,
            glyph: e.id === entry?.id ? '•' : undefined,
            hint: String(Object.keys(e.states).length),
            onSelect: () => go({ c: e.id, s: null }),
          })),
        ]
      }),
    [entry?.id, go],
  )

  if (!entry) return <p className={styles.failed}>no example files yet (src/**/X.gallery.tsx)</p>

  // Every state at once, each in a frame of its own (the address with `alone`): their stores never meet.
  const grid = (
    <div className={styles.grid} data-on={a.on}>
      {names.map((n) => (
        <button key={n} className={styles.tile} onClick={() => go({ s: stateSlug(n), grid: false })} title={`open ${n}`}>
          <span className={styles.tileFrame}>
            <iframe className={styles.tileView} src={`gallery.html${hashOf({ ...a, c: entry?.id ?? null, s: stateSlug(n), alone: true, grid: false })}`} loading="lazy" tabIndex={-1} title={n} />
          </span>
          <span className={stateName === n ? styles.tileNameOn : styles.tileName}>{n}</span>
        </button>
      ))}
    </div>
  )
  const stage = a.grid && !a.alone ? grid : (
    <div className={styles.stage} data-on={a.on} data-alone={a.alone || undefined}>
      <div className={styles.zoom} style={a.zoom === '2' ? { transform: 'scale(2)' } : undefined}>
        <Mount key={`${entry.id}/${stateName}/${reset}/${a.theme}/${a.motion}`} state={entry.states[stateName]} onError={setError} />
      </div>
    </div>
  )
  if (a.alone) return stage

  const spec = entry.states[stateName]
  const note = typeof spec === 'function' ? undefined : spec.note
  return (
    <div className={styles.page}>
      <aside className={styles.side} aria-label="Components">
        <div className={styles.title}>
          NORTH STAR <span className={styles.faint}>· GALLERY</span>
        </div>
        <MenuPanel items={items} ariaLabel="Components" prompt="find a component…" noun="components" onClose={() => {}} />
      </aside>
      <main className={styles.main}>
        {stage}
        <div className={styles.bar}>
          <div className={styles.head}>
            <span className={styles.name}>{entry.name}</span>
            {entry.note && <span className={styles.faint}>{entry.note}</span>}
          </div>
          <div className={styles.row}>
            <Choice label="state" options={names} value={a.grid ? undefined : stateName} onChange={(s) => go({ s: stateSlug(s), grid: false })} />
            <button className={a.grid ? styles.actionOn : styles.action} onClick={() => go({ grid: !a.grid })} title="every state at once">
              [grid]
            </button>
          </div>
          <div className={styles.row}>
            <Choice label="theme" options={['dark', 'light'] as const} value={a.theme} onChange={(theme) => go({ theme })} />
            <Choice label="motion" options={['full', 'reduced'] as const} value={a.motion} onChange={(motion) => go({ motion })} />
            <Choice label="on" options={['page', 'piece'] as const} value={a.on} onChange={(on) => go({ on })} />
            <Choice label="zoom" options={['1', '2'] as const} value={a.zoom} onChange={(zoom) => go({ zoom })} />
          </div>
          {(note || error) && <div className={error ? styles.error : styles.note}>{error ?? note}</div>}
          <div className={styles.foot}>
            <button className={styles.file} title="copy the path" onClick={() => void navigator.clipboard?.writeText(entry.file)}>
              {entry.file}
            </button>
            <span className={refused ? styles.refused : styles.faint}>refused {refused}</span>
            <span className={styles.faint}>[ ] states · \ reset</span>
            <button className={styles.action} onClick={() => setReset((n) => n + 1)}>
              [reset]
            </button>
            <a className={styles.action} href={hashOf({ ...a, c: entry.id, s: stateSlug(stateName), alone: true })} target="_blank" rel="noreferrer">
              [alone ↗]
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}
