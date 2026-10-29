// Settings (D-054, D-064, D-097): your square and the gear, bottom left (D-175); either opens a modal with a grouped side
// menu on the left and the chosen page on the right: you (account, display) and the current workspace (general, people,
// export, D-246). The assistant's pages (keys, usage) are archived (D-177).
// A native <dialog>: focus stays inside, Escape and the backdrop close it.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { signOut, useAuth } from '../data/auth'
import { usePresence } from '../data/presence'
import { useDisplay, type BackgroundPref } from '../state/display'
import { useMotion, type MotionPref } from '../state/motion'
import { themeAccent, useTheme, type ThemePref } from '../state/theme'
import { AsciiButton } from './AsciiButton'
import { Choice } from './Choice'
import styles from './Settings.module.css'

const MOTION: readonly MotionPref[] = ['full', 'reduced', 'system']
const BACKGROUND: readonly BackgroundPref[] = ['on', 'off']
const THEME: readonly ThemePref[] = ['dark', 'light', 'system']

// The workspace's own pages; WorkspaceLayout renders each (D-097).
export type WorkspacePage = 'general' | 'people' | 'export'
type Page = 'account' | 'display' | WorkspacePage
type Group = 'you' | 'workspace'

// The menu, in groups (D-097): you, this workspace.
const PAGES: { id: Page; label: string; title: string; about: string; group: Group }[] = [
  { id: 'account', label: 'account', title: 'Account', about: 'Who you are signed in as.', group: 'you' },
  { id: 'display', label: 'display', title: 'Display', about: 'How North Star looks and moves in this browser.', group: 'you' },
  { id: 'general', label: 'general', title: 'Workspace', about: 'Its name and what the team is building.', group: 'workspace' },
  { id: 'people', label: 'people', title: 'People', about: 'Who is in this workspace and how others get in.', group: 'workspace' },
  { id: 'export', label: 'export', title: 'Export', about: 'Take the workspace with you as a file.', group: 'workspace' },
]

const WORKSPACE_PAGES: readonly Page[] = ['general', 'people', 'export']

type Props = {
  // The current workspace's pages, if there is one.
  workspace?: (page: WorkspacePage) => ReactNode
  workspaceName?: string
  badge?: number
}

export function SettingsButton({ workspace, workspaceName, badge = 0 }: Props) {
  const { user } = useAuth()
  const myColor = usePresence((s) => s.myColor)
  const theme = useTheme((s) => s.theme)
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState<Page>('account')

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  if (!user) return null
  const who = user.name || user.email || 'Account'
  const pages = PAGES.filter((p) => p.group !== 'workspace' || workspace)
  // Outside a workspace its pages don't exist; fall back to the account.
  const current = pages.find((p) => p.id === page) ?? pages[0]

  const show = (on?: Page) => {
    // Someone waiting to join: open straight on the people page.
    if (on) setPage(on)
    else if (badge > 0 && workspace) setPage('people')
    setOpen(true)
  }

  return (
    <>
      <button className={styles.account} onClick={() => show('account')} aria-haspopup="dialog" aria-label={`Account: ${who}`} title={who}>
        {/* In a workspace, your square is in the colour the others see you in (D-067). */}
        <span className={styles.chipAvatar} style={myColor ? { background: themeAccent(myColor, theme) } : undefined} aria-hidden>
          {who.trim()[0]?.toUpperCase()}
        </span>
      </button>
      <button className={styles.trigger} data-open={open || undefined} onClick={() => show()} aria-haspopup="dialog" aria-label={`Settings${badge > 0 ? `, ${badge} waiting` : ''}`}>
        <span className={styles.gear} aria-hidden>
          ⚙&#xFE0E;
        </span>
        {badge > 0 && (
          <span className={styles.badge} aria-hidden>
            {badge}
          </span>
        )}
      </button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-label="Settings"
        onClose={() => setOpen(false)}
        // A click on the backdrop lands on the <dialog> itself.
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      >
        {open && (
          <div className={styles.inner}>
            <nav className={styles.nav} aria-label="Settings" data-learn="settings-menu">
              {(['you', 'workspace'] as const).map((g) => {
                const items = pages.filter((p) => p.group === g)
                if (items.length === 0) return null
                return (
                  <div key={g} className={styles.navGroup}>
                    <span className={styles.navGroupLabel}>
                      {g}
                      {g === 'workspace' && workspaceName && <span className={styles.navGroupName}>{workspaceName}</span>}
                    </span>
                    <ul className={styles.navList}>
                      {items.map((p) => (
                        <li key={p.id}>
                          <button className={styles.navItem} aria-current={p.id === current.id ? 'page' : undefined} onClick={() => setPage(p.id)}>
                            <span className={styles.navLabel}>{p.label}</span>
                            {p.id === 'people' && badge > 0 && <span className={styles.navBadge}>{badge}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </nav>

            <div className={styles.page} key={current.id}>
              <header className={styles.head} {...(current.id === 'people' && { 'data-learn': 'settings-people' })}>
                <h3 className={styles.title}>{current.title}</h3>
                <p className={styles.about}>{current.about}</p>
              </header>

              {current.id === 'account' && (
                <Section label="signed in">
                  <div className={styles.profile}>
                    <span className={styles.avatar} aria-hidden>
                      {who.trim()[0]?.toUpperCase()}
                    </span>
                    <span className={styles.profileText}>
                      <span className={styles.profileName}>{user.name ?? who}</span>
                      {user.email && <span className={styles.profileEmail}>{user.email}</span>}
                    </span>
                  </div>
                  <Row label="method" hint="North Star signs in with Google only.">
                    <span>Google</span>
                    <AsciiButton accent="cyan" onClick={() => signOut()}>
                      sign out
                    </AsciiButton>
                  </Row>
                </Section>
              )}

              {current.id === 'display' && (
                <Section label="appearance" note="Saved in this browser only.">
                  <ThemeChoice />
                  <MotionChoice />
                  <BackgroundChoice />
                </Section>
              )}

              {workspace && WORKSPACE_PAGES.includes(current.id) && workspace(current.id as WorkspacePage)}
            </div>

            <button className={styles.close} onClick={() => setOpen(false)} aria-label="Close settings">
              [×]
            </button>
          </div>
        )}
      </dialog>
    </>
  )
}

function ThemeChoice() {
  const pref = useTheme((s) => s.pref)
  const theme = useTheme((s) => s.theme)
  const setPref = useTheme((s) => s.setPref)
  return (
    <Row
      label="theme"
      hint={
        pref === 'system'
          ? `Following your system: ${theme}.`
          : pref === 'light'
            ? 'Dark ink on light paper.'
            : 'Light on black, the way North Star was drawn.'
      }
    >
      <Choice label="theme" bare options={THEME} value={pref} onChange={setPref} />
    </Row>
  )
}

function MotionChoice() {
  const pref = useMotion((s) => s.pref)
  const reduced = useMotion((s) => s.reduced)
  const setPref = useMotion((s) => s.setPref)
  return (
    <Row
      label="motion"
      hint={
        pref === 'system'
          ? `Following your system: ${reduced ? 'reduced' : 'full'} motion.`
          : pref === 'reduced'
            ? 'Animations are off: things appear at once and the background holds still.'
            : 'All animations on, whatever your system says.'
      }
    >
      <Choice label="motion" bare options={MOTION} value={pref} onChange={setPref} />
    </Row>
  )
}

function BackgroundChoice() {
  const background = useDisplay((s) => s.background)
  const setBackground = useDisplay((s) => s.setBackground)
  return (
    <Row
      label="background"
      hint={background === 'on' ? 'The ASCII field flows behind your pages.' : "No background animation while you're signed in. Uses less power."}
    >
      <Choice label="background" bare options={BACKGROUND} value={background} onChange={setBackground} />
    </Row>
  )
}

// A framed group of rows (D-097): its label in the top edge, rows split by hairlines, an optional note at the foot.
export function Section({ label, note, children }: { label: string; note?: ReactNode; children?: ReactNode }) {
  return (
    <section className={styles.section}>
      <h4 className={styles.label}>{label}</h4>
      {children && <div className={styles.body}>{children}</div>}
      {note && <div className={styles.foot}>{note}</div>}
    </section>
  )
}

// A setting: its name and what it does on the left, the control on the right.
export function Row({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.rowLabel}>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </div>
      <div className={styles.rowValue}>{children}</div>
    </div>
  )
}

// Readable help text inside a section (not faint).
export function Note({ children, tone }: { children: ReactNode; tone?: 'error' }) {
  return (
    <p className={styles.note} data-tone={tone}>
      {children}
    </p>
  )
}
