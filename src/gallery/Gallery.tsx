// The component gallery's page (D-324, D-336; docs/specs/gallery.md §3). On the left every component by layer and area
// (the app's own MenuPanel, D-222), or by what it's made of (the tree). With nothing picked, an overview of them all.
// A component's page: its name, area, file and what it is; every state side by side (each in a frame of its own), one
// of them open large and live when picked; then what it's built from and where it's used, by area, each a link. The
// address says all of it (`#c=button&s=link&theme=light&motion=reduced&on=piece&zoom=2`; `&alone`: the state by
// itself, what the frames and the shot scripts load). Built from the app's own components and tokens.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { create } from 'zustand'
import { MenuPanel, type MenuEntry } from '../ui/patterns/Menu'
import { Choice } from '../ui/primitives/Choice'
import { useHistory } from '../data/history'
import { useTheme } from '../state/theme'
import { useMotion } from '../state/motion'
import { stateSlug } from './registry'
import { specOf } from './example'
import { AREAS, PAGES, byArea, pageById, pageOfFile } from './pages'
import { UsesTree } from './UsesTree'
import { Mount } from './Mount'
import styles from './Gallery.module.css'

// Writes refused while the gallery is open (the bar shows them for the example shown).
const useRefused = create<{ n: number }>(() => ({ n: 0 }))
export const countRefused = () => useRefused.setState((s) => ({ n: s.n + 1 }))
const READ_ONLY = 'the gallery writes nothing'
useHistory.subscribe((s, prev) => {
  if (s.notice && s.notice !== prev.notice && s.notice.text === READ_ONLY) countRefused()
})

type Address = { c: string | null; s: string | null; theme: 'dark' | 'light'; motion: 'full' | 'reduced'; on: 'page' | 'piece'; zoom: '1' | '2'; alone: boolean; side: 'map' | 'tree' }

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
    side: h.get('side') === 'tree' ? 'tree' : 'map',
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
  if (a.side !== 'map') h.set('side', a.side)
  const s = h.toString()
  return `#${s}${a.alone ? '&alone' : ''}`
}

export function Gallery() {
  const hash = useSyncExternalStore(subscribeHash, readHash)
  const a = useMemo(() => parse(hash), [hash])
  const go = useCallback((next: Partial<Address>) => void (location.hash = hashOf({ ...parse(location.hash), ...next })), [])

  const page = pageById(a.c)
  const entry = page?.entry
  const names = useMemo(() => (entry ? Object.keys(entry.states) : []), [entry])
  // A state picked: open large and live; none: every state side by side. Alone, the first when none is said.
  const picked = names.find((n) => stateSlug(n) === a.s) ?? (a.alone ? names[0] : undefined)
  const [reset, setReset] = useState(0)
  // The list is the app's MenuPanel, whose `role="menu"` an onboarding lesson reads as an open menu and hides under
  // (Lesson.tsx MENUS): here it's the page's own navigation, always open, so it says it's a list.
  const side = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    side.current?.querySelector('[role="menu"]')?.setAttribute('role', 'list')
  })
  const [error, setError] = useState<string | null>(null)
  const refused = useRefused((s) => s.n)

  // The address's theme and motion, in the gallery's stores only (gallery.html keeps storage in memory).
  useEffect(() => {
    if (useTheme.getState().theme !== a.theme) useTheme.setState({ theme: a.theme, pref: a.theme })
    const reduced = a.motion === 'reduced'
    if (useMotion.getState().reduced !== reduced) useMotion.setState({ reduced, pref: a.motion })
  }, [a.theme, a.motion])

  // A new page or state starts the refused count again.
  useEffect(() => {
    useRefused.setState({ n: 0 })
    setError(null)
  }, [page?.id, picked, reset])

  // `[` and `]` step through the states, `\` mounts again, Escape goes back to all of them (not while typing).
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.metaKey || e.ctrlKey || e.altKey || t?.closest('input, textarea, [contenteditable="true"]') || !names.length) return
      const at = picked ? names.indexOf(picked) : -1
      if (e.key === ']' || e.key === '[') go({ s: stateSlug(names[(at + (e.key === ']' ? 1 : -1) + names.length) % names.length]) })
      else if (e.key === '\\') setReset((n) => n + 1)
      else if (e.key === 'Escape' && picked) go({ s: null })
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [names, picked, go])

  // The list: an area's name, then its components; a count of states, or `—` with no example. Typing finds by name,
  // file or area.
  const items = useMemo<MenuEntry[]>(
    () =>
      AREAS.flatMap((area) => {
        const here = PAGES.filter((p) => p.area === area)
        if (!here.length) return []
        return [
          { key: `# ${area.id}`, heading: area.name.toUpperCase() },
          ...here.map((p) => ({
            key: p.id,
            label: p.name,
            words: `${p.file} ${area.name}${p.entry ? '' : ' no example'}`,
            indent: true,
            glyph: p.id === page?.id ? '•' : undefined,
            hint: p.entry ? String(Object.keys(p.entry.states).length) : '—',
            onSelect: () => go({ c: p.id, s: null }),
          })),
        ]
      }),
    [page?.id, go],
  )

  // One state, live: its own room (a transform, so what it places `fixed` stays inside).
  const live = entry && picked && (
    <div className={styles.stage} data-on={a.on} data-alone={a.alone || undefined}>
      <div className={styles.zoom} style={a.zoom === '2' ? { transform: 'scale(2)' } : undefined}>
        <Mount key={`${entry.id}/${picked}/${reset}/${a.theme}/${a.motion}`} state={entry.states[picked]} onError={setError} />
      </div>
    </div>
  )
  if (a.alone) return live || <p className={styles.failed}>no such example</p>

  return (
    <div className={styles.page}>
      <aside ref={side} className={styles.side} aria-label="Components">
        <button className={styles.title} onClick={() => go({ c: null, s: null })} title="every component at a glance">
          NORTH STAR <span className={styles.faint}>· GALLERY</span>
        </button>
        <div className={styles.sideTabs}>
          <Choice label="list" bare options={['map', 'tree'] as const} value={a.side} onChange={(side) => go({ side })} />
          <span className={styles.faint}>{a.side === 'map' ? 'by layer and area' : 'by what it’s made of'}</span>
        </div>
        {a.side === 'map' ? (
          <MenuPanel items={items} ariaLabel="Components" prompt="find a component…" noun="components" onClose={() => {}} />
        ) : (
          <UsesTree current={page?.file} onPick={(file) => { const p = pageOfFile(file); if (p) go({ c: p.id, s: null }) }} />
        )}
      </aside>
      <main className={styles.doc}>
        {!page ? (
          <Overview go={go} />
        ) : (
          <article className={styles.article}>
            <header className={styles.docHead}>
              <h1 className={styles.docName}>{page.name}</h1>
              <div className={styles.docMeta}>
                <button className={styles.areaTag} onClick={() => go({ c: null, s: null })} title={page.area.about}>
                  {page.area.name}
                </button>
                <button className={styles.file} title="copy the path" onClick={() => void navigator.clipboard?.writeText(page.file)}>
                  {page.file}
                </button>
              </div>
              {(entry?.note || page.area.about) && <p className={styles.docNote}>{entry?.note ?? `part of ${page.area.name}: ${page.area.about}`}</p>}
            </header>

            {entry ? (
              <section className={styles.sec}>
                <div className={styles.secHead}>
                  <span className={styles.secName}>STATES · {names.length}</span>
                  {picked && (
                    <button className={styles.action} onClick={() => go({ s: null })} title="every state side by side (esc)">
                      [‹ all states]
                    </button>
                  )}
                  <span className={styles.secTools}>
                    <Choice label="theme" options={['dark', 'light'] as const} value={a.theme} onChange={(theme) => go({ theme })} />
                    <Choice label="motion" options={['full', 'reduced'] as const} value={a.motion} onChange={(motion) => go({ motion })} />
                    <Choice label="on" options={['page', 'piece'] as const} value={a.on} onChange={(on) => go({ on })} />
                    {picked && <Choice label="zoom" options={['1', '2'] as const} value={a.zoom} onChange={(zoom) => go({ zoom })} />}
                  </span>
                </div>
                {picked ? (
                  <>
                    <div className={styles.stateTabs}>
                      <Choice label="state" options={names} value={picked} onChange={(s) => go({ s: stateSlug(s) })} />
                    </div>
                    <div className={styles.liveBox}>{live}</div>
                    {(() => {
                      const spec = entry.states[picked]
                      const note = typeof spec === 'function' ? undefined : spec.note
                      return (note || error) && <div className={error ? styles.error : styles.note}>{error ?? note}</div>
                    })()}
                    <div className={styles.foot}>
                      <span className={refused ? styles.refused : styles.faint}>writes refused {refused}</span>
                      <span className={styles.faint}>[ ] states · \ again · esc all</span>
                      <button className={styles.action} onClick={() => setReset((n) => n + 1)}>
                        [again]
                      </button>
                      <a className={styles.action} href={hashOf({ ...a, c: entry.id, s: stateSlug(picked), alone: true })} target="_blank" rel="noreferrer">
                        [alone ↗]
                      </a>
                    </div>
                  </>
                ) : (
                  <div className={styles.grid} data-on={a.on}>
                    {names.map((n) => (
                      <button key={n} className={styles.tile} onClick={() => go({ s: stateSlug(n) })} title={`open ${n}, large and live`}>
                        <span className={styles.tileFrame} data-small={specOf(entry.states[n]).size !== 'full' || undefined}>
                          <iframe className={styles.tileView} src={`gallery.html${hashOf({ ...a, c: entry.id, s: stateSlug(n), alone: true })}`} loading="lazy" tabIndex={-1} title={n} />
                        </span>
                        <span className={styles.tileName}>{n}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <section className={styles.sec}>
                <div className={styles.secHead}>
                  <span className={styles.secName}>STATES</span>
                </div>
                <p className={styles.faint}>No example of its own yet (no {page.name}.gallery.tsx): see it inside what uses it, below.</p>
              </section>
            )}

            <Links title="BUILT FROM" files={page.node?.uses ?? []} empty="nothing else: it draws no other component" go={go} />
            <Links title="USED IN" files={page.node?.usedBy ?? []} empty="nowhere yet" go={go} />
          </article>
        )}
      </main>
    </div>
  )
}

// What a page is built from, or where it's used: a line per area, its components as links (faint: no example yet).
function Links({ title, files, empty, go }: { title: string; files: string[]; empty: string; go: (next: Partial<Address>) => void }) {
  const groups = byArea(files)
  return (
    <section className={styles.sec}>
      <div className={styles.secHead}>
        <span className={styles.secName}>
          {title} · {files.length}
        </span>
      </div>
      {groups.length === 0 ? (
        <p className={styles.faint}>{empty}</p>
      ) : (
        <div className={styles.links}>
          {groups.map(({ area, pages }) => (
            <div key={area.id} className={styles.linkRow}>
              <span className={styles.linkArea}>{area.name}</span>
              <span className={styles.linkList}>
                {pages.map((p) => (
                  <button key={p.id} className={p.entry ? styles.link : styles.linkFaint} title={`${p.file}${p.entry ? '' : ' · no example yet'}`} onClick={() => go({ c: p.id, s: null })}>
                    {p.name}
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// Nothing picked: every component, area by area, with what it is, its states and how widely it's used.
function Overview({ go }: { go: (next: Partial<Address>) => void }) {
  const withExample = PAGES.filter((p) => p.entry).length
  return (
    <article className={styles.article}>
      <header className={styles.docHead}>
        <h1 className={styles.docName}>Gallery</h1>
        <p className={styles.docNote}>
          {PAGES.length} components, {withExample} with live examples. Each page shows every state, what it is built from and where it is used. The layers go from the
          bottom up: foundation, primitives, patterns, then the app&rsquo;s areas.
        </p>
      </header>
      {AREAS.map((area) => {
        const here = PAGES.filter((p) => p.area === area)
        if (!here.length) return null
        return (
          <section key={area.id} className={styles.sec}>
            <div className={styles.secHead}>
              <span className={styles.secName}>
                {area.name.toUpperCase()} · {here.length}
              </span>
              <span className={styles.faint}>{area.about}</span>
            </div>
            <div className={styles.table}>
              {here.map((p) => (
                <button key={p.id} className={styles.tableRow} onClick={() => go({ c: p.id, s: null })}>
                  <span className={p.entry ? styles.tableName : styles.tableNameFaint}>{p.name}</span>
                  <span className={styles.tableNote}>{p.entry?.note ?? (p.entry ? '' : 'no example yet')}</span>
                  <span className={styles.tableNum}>{p.entry ? `${Object.keys(p.entry.states).length} states` : '—'}</span>
                  <span className={styles.tableNum}>{p.node ? `used in ${p.node.usedBy.length}` : ''}</span>
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </article>
  )
}
