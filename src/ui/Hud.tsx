// The top bar on every page: breadcrumb and view menu bar on the left, page actions on the right; you and settings in
// the bottom-left corner (D-175). The HUD moves to the left piece by piece.
// Same position and margins everywhere (--hud-x / --hud-y), so nothing shifts between pages.
import { motion } from 'motion/react'
import { Fragment, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../data/auth'
import { useMotion } from '../state/motion'
import styles from './Hud.module.css'
import { SettingsButton, type WorkspacePage } from './Settings'

export type Crumb = {
  label: ReactNode
  // Earlier segments link back; the last one is the current page.
  to?: string
}

// The workspace's views, as tabs beside the breadcrumb (D-053, D-066): `│ board  flow  table  matrix`, the current one underlined.
export type Tab = { label: string; to: string; end?: boolean }

type Props = {
  crumbs?: Crumb[]
  views?: Tab[]
  right?: ReactNode
  // The current workspace's pages in the settings modal, and its name for the menu (D-097).
  settings?: (page: WorkspacePage) => ReactNode
  settingsName?: string
  // Something in settings wants attention, e.g. people asking to join (D-062).
  settingsBadge?: number
  // The top of the side nav, under the breadcrumb (D-176): the canvas's `+`.
  side?: ReactNode
  // In the bottom-left corner, just above your square (D-193): the threads button.
  corner?: ReactNode
}

export function Hud({ crumbs = [], views, right, settings, settingsName, settingsBadge, side, corner }: Props) {
  const atRoot = crumbs.length === 0
  const { user } = useAuth()
  const reduced = useMotion((s) => s.reduced)

  return (
    <header className={styles.hud}>
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        {atRoot ? (
          <span className={styles.current} aria-current="page">
            <span className={styles.hash}>#</span>
            <span className={styles.rootName}> north-star</span>
          </span>
        ) : (
          <Link to="/" className={styles.link}>
            <span className={styles.hash}>#</span>
            <span className={styles.rootName}> north-star</span>
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
              {({ isActive }) => (
                <>
                  {t.label}
                  {/* One bar that slides to the current view. */}
                  {isActive && (
                    <motion.span
                      layoutId="hud-view-bar"
                      className={styles.viewBar}
                      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}
      <div className={styles.right} data-glide>
        {right}
      </div>
      {side && <div className={styles.side}>{side}</div>}
      {/* You and settings (motion, theme, background) in the bottom-left corner (D-175), only once signed in; the
          landing has no controls. */}
      {user && (
        <div className={styles.corner}>
          {corner}
          {/* The rule just above your square (D-175): what's above it is others' and the workspace's. */}
          <span className={styles.rule} aria-hidden />
          <SettingsButton workspace={settings} workspaceName={settingsName} badge={settingsBadge} />
        </div>
      )}
    </header>
  )
}
