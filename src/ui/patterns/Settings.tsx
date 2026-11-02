// Settings (D-054, D-064, D-097): your square and the gear, bottom left (D-175); either opens a modal with a grouped side
// menu on the left and the chosen page on the right: you (account, display) and the current workspace (general, people,
// export, D-246). The agent's page (your own key, the model, usage: S14, D-312) is under you.
// On the one Window (D-359): focus kept inside and given back, Escape (a menu in it first) and the scrim close it.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { signOut, useAuth } from '../../data/auth'
import { usePresence } from '../../data/presence'
import { useDisplay, type BackgroundPref, type HudSizePref, type StrengthPref } from '../../state/display'
import { useMotion, type MotionPref } from '../../state/motion'
import { themeAccent, useTheme, type ThemePref } from '../../state/theme'
import { AgentSettings } from '../../agent/ui/AgentSettings'
import { Button } from '../primitives/Button'
import { Avatar } from '../primitives/Avatar'
import { Choice } from '../primitives/Choice'
import { SettingsTool } from './SettingsTool'
import { Window } from './Window'
import styles from './Settings.module.css'

const MOTION: readonly MotionPref[] = ['full', 'reduced', 'system']
const BACKGROUND: readonly BackgroundPref[] = ['on', 'off']
const STRENGTH: readonly StrengthPref[] = ['soft', 'normal', 'strong']
const HUD_SIZE: readonly HudSizePref[] = ['small', 'normal', 'large']
const THEME: readonly ThemePref[] = ['dark', 'light', 'system']

// The workspace's own pages; WorkspaceLayout renders each (D-097).
export type WorkspacePage = 'general' | 'people' | 'export'
type Page = 'account' | 'display' | 'agent' | WorkspacePage
type Group = 'you' | 'workspace'

// The menu, in groups (D-097): you, this workspace.
const PAGES: { id: Page; label: string; title: string; about: string; group: Group }[] = [
  { id: 'account', label: 'account', title: 'Account', about: 'Who you are signed in as.', group: 'you' },
  { id: 'display', label: 'display', title: 'Display', about: 'How North Star looks and moves in this browser.', group: 'you' },
  { id: 'agent', label: 'the agent', title: 'The agent', about: 'Your own OpenAI key and the model the agent uses, in this browser.', group: 'you' },
  { id: 'general', label: 'general', title: 'Workspace', about: 'Its name and what the team is building.', group: 'workspace' },
  { id: 'people', label: 'people', title: 'People', about: 'Who is in this workspace and how others get in.', group: 'workspace' },
  { id: 'export', label: 'export', title: 'Export', about: 'Take the workspace with you as a file.', group: 'workspace' },
]

const WORKSPACE_PAGES: readonly Page[] = ['general', 'people', 'export']

// Opens Settings on a page from elsewhere (the agent's `settings → the agent`): heard by the mounted SettingsButton.
const OPEN_AT = 'north-star:settings-at'
export const openSettingsAt = (page: 'agent' | 'account' | 'display') => window.dispatchEvent(new CustomEvent(OPEN_AT, { detail: page }))

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
  const box = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState<Page>('account')

  // Opened (on a page or not): the keyboard on that page's menu item, so only one item reads as current.
  useEffect(() => {
    if (!open) return
    const r = requestAnimationFrame(() => box.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus())
    return () => cancelAnimationFrame(r)
  }, [open])

  useEffect(() => {
    const on = (e: Event) => {
      setPage((e as CustomEvent<Page>).detail)
      setOpen(true)
    }
    window.addEventListener(OPEN_AT, on)
    return () => window.removeEventListener(OPEN_AT, on)
  }, [])

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
        <Avatar name={who} color={myColor ? themeAccent(myColor, theme) : 'var(--accent-cyan)'} />
      </button>
      <SettingsTool open={open} waiting={badge} onClick={() => show()} />
      {open && (
        <Window label="Settings" onClose={() => setOpen(false)} look="bare" focus={false} elRef={box} className={styles.dialog}>
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
                    <Button size="md" accent="cyan" onClick={() => signOut()}>
                      sign out
                    </Button>
                  </Row>
                </Section>
              )}

              {current.id === 'display' && (
                <Section label="appearance" note="Saved in this browser only.">
                  <ThemeChoice />
                  <MotionChoice />
                  <BackgroundChoice />
                  <StrengthChoice />
                  <HudSizeChoice />
                </Section>
              )}

              {current.id === 'agent' && <AgentSettings />}

              {workspace && WORKSPACE_PAGES.includes(current.id) && workspace(current.id as WorkspacePage)}
            </div>

            <Button icon className={styles.close} onClick={() => setOpen(false)} aria-label="Close settings" title="Close (Esc)">
              ×
            </Button>
          </div>
        </Window>
      )}
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

// How bright the background is on your pages (D-348); only while it's on.
function StrengthChoice() {
  const background = useDisplay((s) => s.background)
  const strength = useDisplay((s) => s.strength)
  const setStrength = useDisplay((s) => s.setStrength)
  if (background === 'off') return null
  return (
    <Row
      label="background strength"
      hint={
        strength === 'soft'
          ? 'The background is quieter behind your work.'
          : strength === 'strong'
            ? 'The background is brighter: use it if it looks faint on your screen.'
            : 'The background as North Star draws it.'
      }
    >
      <Choice label="background strength" bare options={STRENGTH} value={strength} onChange={setStrength} />
    </Row>
  )
}

// The HUD's size (D-348): the side nav, the bottom-left corner, people's squares and the breadcrumb.
function HudSizeChoice() {
  const hud = useDisplay((s) => s.hud)
  const setHud = useDisplay((s) => s.setHud)
  return (
    <Row label="hud size" hint="The tools on the left edge, the corner and the path at the top.">
      <Choice label="hud size" bare options={HUD_SIZE} value={hud} onChange={setHud} />
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
