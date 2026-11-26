// A page's side list (D-404): groups of pages under a caps name, each a pill, the one you're on filled. Settings' menu
// and the backoffice's (D-434) are this. On a narrow screen it turns into a row of tabs above the page (no group names).
import type { ReactNode } from 'react'
import styles from './SideList.module.css'

export type SideListItem<T extends string> = { id: T; label: string; extra?: ReactNode }
export type SideListGroup<T extends string> = { name: string; aside?: string; items: SideListItem<T>[] }

type Props<T extends string> = {
  label: string
  groups: SideListGroup<T>[]
  current: T
  onPick: (id: T) => void
  className?: string
  // Extra attributes for the nav (a lesson's anchor).
  data?: Record<string, string>
}

export function SideList<T extends string>({ label, groups, current, onPick, className, data }: Props<T>) {
  return (
    <nav className={[styles.nav, className].filter(Boolean).join(' ')} aria-label={label} {...data}>
      {groups.map((g) =>
        g.items.length === 0 ? null : (
          <div key={g.name} className={styles.group}>
            <span className={styles.groupLabel}>
              {g.name}
              {g.aside && <span className={styles.groupAside}>{g.aside}</span>}
            </span>
            <ul className={styles.list}>
              {g.items.map((p) => (
                <li key={p.id}>
                  {/* A page link in a list (aria-current), moved from Settings: Button's pill is a control, Tabs a tablist. */}
                  <button className={styles.item} /* kit-ok: the side list's own row */ aria-current={p.id === current ? 'page' : undefined} onClick={() => onPick(p.id)}>
                    {p.label}
                    {p.extra}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ),
      )}
    </nav>
  )
}
