// The top bar on every page: breadcrumb on the left, page actions on the right.
// Same position and margins everywhere (--hud-x / --hud-y), so nothing shifts between pages.
import { Fragment, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import styles from './Hud.module.css'
import { MotionToggle } from './MotionToggle'

export type Crumb = {
  label: ReactNode
  // Earlier segments link back; the last one is the current page.
  to?: string
}

// View switcher after the breadcrumb (D-036): `[ideas] features competitors matrix`.
export type Tab = { label: string; to: string; end?: boolean }

// `nav` is free-form navigation after the breadcrumb instead of `tabs` (e.g. domain tabs, D-039).
type Props = { crumbs?: Crumb[]; tabs?: Tab[]; nav?: ReactNode; right?: ReactNode }

export function Hud({ crumbs = [], tabs: tabList, nav, right }: Props) {
  const atRoot = crumbs.length === 0
  const tabs = tabList ?? nav

  return (
    <header className={styles.hud}>
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        {atRoot ? (
          <span className={styles.current} aria-current="page">
            <span className={styles.hash}>#</span> north-star
          </span>
        ) : (
          <Link to="/" className={styles.link}>
            <span className={styles.hash}>#</span> north-star
          </Link>
        )}
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <Fragment key={i}>
              <span className={styles.sep} aria-hidden>
                /
              </span>
              {(last && !tabs) || !c.to ? (
                <span className={last && !tabs ? styles.current : styles.link} aria-current={last && !tabs ? 'page' : undefined}>
                  {c.label}
                </span>
              ) : (
                <Link to={c.to} className={styles.link}>
                  {c.label}
                </Link>
              )}
            </Fragment>
          )
        })}
        {tabs && (
          <>
            <span className={styles.sep} aria-hidden>
              /
            </span>
            {tabList ? (
              <span className={styles.tabs}>
                {tabList.map((t) => (
                  <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? styles.tabActive : styles.tab)}>
                    {t.label}
                  </NavLink>
                ))}
              </span>
            ) : (
              nav
            )}
          </>
        )}
      </nav>
      <div className={styles.right}>
        {right}
        <MotionToggle />
      </div>
    </header>
  )
}
