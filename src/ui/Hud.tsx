// The HUD on every page: the breadcrumb top left, page actions top right; you and settings in the bottom-left corner
// (D-175). The rest moves to the left side nav piece by piece.
// Same position and margins everywhere (--hud-x / --hud-y), so nothing shifts between pages.
import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../data/auth'
import styles from './Hud.module.css'
import { SettingsButton, type WorkspacePage } from './Settings'

export type Crumb = {
  label: ReactNode
  // Earlier segments link back; the last one is the current page.
  to?: string
}

type Props = {
  crumbs?: Crumb[]
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
  // Under the rule, by your square: what's yours (the tasks given to you, D-261).
  mine?: ReactNode
}

export function Hud({ crumbs = [], right, settings, settingsName, settingsBadge, side, corner, mine }: Props) {
  const atRoot = crumbs.length === 0
  const { user } = useAuth()

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
      <div className={styles.right} data-glide>
        {right}
      </div>
      {/* A shade of the page down the left edge, so the side nav's icons read over the canvas and the backdrop. */}
      {(side || user) && <div className={styles.shade} aria-hidden />}
      {side && <div className={styles.side}>{side}</div>}
      {/* You and settings (motion, theme, background) in the bottom-left corner (D-175), only once signed in; the
          landing has no controls. */}
      {user && (
        <div className={styles.corner}>
          {corner}
          {/* The rule just above your square (D-175): what's above it is others' and the workspace's. */}
          <span className={styles.rule} aria-hidden />
          {mine}
          <SettingsButton workspace={settings} workspaceName={settingsName} badge={settingsBadge} />
        </div>
      )}
    </header>
  )
}
