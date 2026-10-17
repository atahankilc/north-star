// The top bar on every page: breadcrumb and view menu bar on the left, page actions and settings on the right.
// Same position and margins everywhere (--hud-x / --hud-y), so nothing shifts between pages.
import { Fragment, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../data/auth'
import styles from './Hud.module.css'
import { MotionToggle } from './MotionToggle'
import { SettingsButton } from './Settings'

export type Crumb = {
  label: ReactNode
  // Earlier segments link back; the last one is the current page.
  to?: string
}

// The workspace's views, as a menu bar of their own beside the breadcrumb (D-053): `BOARD | FLOW | TABLE | MATRIX`.
export type Tab = { label: string; to: string; end?: boolean }

type Props = {
  crumbs?: Crumb[]
  views?: Tab[]
  right?: ReactNode
  // The current workspace's section in the settings modal.
  settings?: ReactNode
}

export function Hud({ crumbs = [], views, right, settings }: Props) {
  const atRoot = crumbs.length === 0
  const { user } = useAuth()

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
              {last || !c.to ? (
                <span className={last ? styles.current : styles.link} aria-current={last ? 'page' : undefined}>
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
      </nav>
      {views && (
        <nav className={styles.views} aria-label="Views">
          {views.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? styles.viewActive : styles.view)}>
              {t.label}
            </NavLink>
          ))}
        </nav>
      )}
      <div className={styles.right}>
        {right}
        {/* Signed in: motion lives in settings. Signed out: just the motion switch. */}
        {user ? <SettingsButton workspace={settings} /> : <MotionToggle />}
      </div>
    </header>
  )
}
