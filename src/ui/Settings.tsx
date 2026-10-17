// Settings (D-054, D-064): your account chip and an icon button sit side by side in the HUD; either opens a modal with a side menu on the left and the chosen page on the right:
// your account, the current workspace (name, people, invite code), the app itself (theme, motion, background, what's coming)
// and the assistant (OpenAI key, model; D-073).
// A native <dialog>: focus stays inside, Escape and the backdrop close it.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { signOut, useAuth } from '../data/auth'
import { usePresence } from '../data/presence'
import { useDisplay, type BackgroundPref } from '../state/display'
import { useMotion, type MotionPref } from '../state/motion'
import { themeAccent, useTheme, type ThemePref } from '../state/theme'
import { AiSettingsPage } from './AiSettings'
import { AsciiButton } from './AsciiButton'
import { Choice } from './Choice'
import styles from './Settings.module.css'

const MOTION: readonly MotionPref[] = ['full', 'reduced', 'system']
const BACKGROUND: readonly BackgroundPref[] = ['on', 'off']
const THEME: readonly ThemePref[] = ['dark', 'light', 'system']

type Page = 'account' | 'workspace' | 'app' | 'ai'

const PAGES: { id: Page; label: string; title: string }[] = [
  { id: 'account', label: 'account', title: 'Account' },
  { id: 'workspace', label: 'workspace', title: 'Workspace' },
  { id: 'app', label: 'app', title: 'App' },
  { id: 'ai', label: 'ai', title: 'Assistant' },
]

type Props = {
  // The current workspace's page, if there is one.
  workspace?: ReactNode
  badge?: number
}

export function SettingsButton({ workspace, badge = 0 }: Props) {
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
  const pages = PAGES.filter((p) => p.id !== 'workspace' || workspace)
  // Outside a workspace its page doesn't exist; fall back to the account.
  const current = pages.find((p) => p.id === page) ?? pages[0]

  const show = (on?: Page) => {
    // Someone waiting to join: open straight on the workspace page.
    if (on) setPage(on)
    else if (badge > 0 && workspace) setPage('workspace')
    setOpen(true)
  }

  return (
    <>
      <button className={styles.account} onClick={() => show('account')} aria-haspopup="dialog" aria-label={`Account: ${who}`}>
        {/* In a workspace, your square is in the colour the others see you in (D-067). */}
        <span className={styles.chipAvatar} style={myColor ? { background: themeAccent(myColor, theme) } : undefined} aria-hidden>
          {who.trim()[0]?.toUpperCase()}
        </span>
        <span className={styles.chipName}>{who}</span>
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
        aria-labelledby="settings-title"
        onClose={() => setOpen(false)}
        // A click on the backdrop lands on the <dialog> itself.
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      >
        {open && (
          <div className={styles.inner}>
            <nav className={styles.nav} aria-label="Settings">
              <h2 id="settings-title" className={styles.navTitle}>
                Settings
              </h2>
              <ul className={styles.navList}>
                {pages.map((p) => (
                  <li key={p.id}>
                    <button
                      className={styles.navItem}
                      aria-current={p.id === current.id ? 'page' : undefined}
                      onClick={() => setPage(p.id)}
                    >
                      <span className={styles.navLabel}>{p.label}</span>
                      {p.id === 'workspace' && badge > 0 && <span className={styles.navBadge}>{badge}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            <div className={styles.page}>
              <header className={styles.head}>
                <h3 className={styles.title}>{current.title}</h3>
                <button className={styles.close} onClick={() => setOpen(false)} aria-label="Close settings">
                  [×]
                </button>
              </header>

              {current.id === 'account' && (
                <>
                  <div className={styles.profile}>
                    <span className={styles.avatar} aria-hidden>
                      {who.trim()[0]?.toUpperCase()}
                    </span>
                    <span className={styles.profileText}>
                      <span className={styles.profileName}>{user.name ?? who}</span>
                      {user.email && <span className={styles.profileEmail}>{user.email}</span>}
                    </span>
                  </div>
                  <Section label="sign-in">
                    <Row label="method">Google</Row>
                    <div className={styles.actions}>
                      <AsciiButton accent="cyan" onClick={() => signOut()}>
                        Sign out
                      </AsciiButton>
                    </div>
                  </Section>
                </>
              )}

              {current.id === 'workspace' && workspace}

              {current.id === 'ai' && <AiSettingsPage />}

              {current.id === 'app' && (
                <>
                  <Section label="display">
                    <ThemeChoice />
                    <MotionChoice />
                    <BackgroundChoice />
                  </Section>

                  <Section label="coming later">
                    <Later name="Assistant tools" detail="The assistant adds competitors, links and matrix notes for you" phase="phase 4.2" />
                    <Later name="Export and import" detail="A whole workspace as one file" phase="phase 5" />
                  </Section>
                </>
              )}
            </div>
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
    <>
      <Choice label="theme" options={THEME} value={pref} onChange={(p) => setPref(p ?? 'dark')} />
      <p className={styles.note}>
        {pref === 'system'
          ? `Following your system: ${theme}.`
          : pref === 'light'
            ? 'Dark ink on light paper.'
            : 'Light on black, the way North Star was drawn.'}
      </p>
    </>
  )
}

function MotionChoice() {
  const pref = useMotion((s) => s.pref)
  const reduced = useMotion((s) => s.reduced)
  const setPref = useMotion((s) => s.setPref)
  return (
    <>
      <Choice label="motion" options={MOTION} value={pref} onChange={(p) => setPref(p ?? 'full')} />
      <p className={styles.note}>
        {pref === 'system'
          ? `Following your system: ${reduced ? 'reduced' : 'full'} motion.`
          : pref === 'reduced'
            ? 'Animations are off: things appear at once and the background holds still.'
            : 'All animations on, whatever your system says.'}
      </p>
    </>
  )
}

function BackgroundChoice() {
  const background = useDisplay((s) => s.background)
  const setBackground = useDisplay((s) => s.setBackground)
  return (
    <>
      <Choice label="background" options={BACKGROUND} value={background} onChange={(b) => setBackground(b ?? 'on')} />
      <p className={styles.note}>
        {background === 'on'
          ? 'The ASCII field flows behind your pages.'
          : 'No background animation while you\'re signed in. Uses less power.'}
      </p>
    </>
  )
}

export function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h4 className={styles.label}>{label}</h4>
      {children}
    </section>
  )
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{children}</span>
    </div>
  )
}

function Later({ name, detail, phase }: { name: string; detail: string; phase: string }) {
  return (
    <div className={styles.later}>
      <span className={styles.laterName}>{name}</span>
      <span className={styles.laterDetail}>{detail}</span>
      <span className={styles.laterPhase}>{phase}</span>
    </div>
  )
}
