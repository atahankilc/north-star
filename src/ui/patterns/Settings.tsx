// Settings (D-054, D-064, D-097): your square and the gear, bottom left (D-175); either opens a modal with a grouped side
// menu on the left and the chosen page on the right: you (account, display) and the current workspace (general, people,
// export, D-246). The agent's page (your own key, the model, usage: S14, D-312) is under you.
// Its layout (D-404): the page's title and the close stay in a head that never scrolls, only what's under it moves; a
// page's groups are numbered rules (`01 KEYS ──`), a setting's control sits at the row's right edge.
// On the one Window (D-359): focus kept inside and given back, Escape (a menu in it first) and the scrim close it.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { signOut, useAuth } from '../../data/auth'
import { safePhoto, usePresence } from '../../data/presence'
import { useDisplay, type BackgroundPref } from '../../state/display'
import { UI_SIZE } from '../foundation/feel'
import { useMotion, type MotionPref } from '../../state/motion'
import { themeAccent, useTheme, type ThemePref } from '../../state/theme'
import { AgentSettings } from '../../agent/ui/AgentSettings'
import { Button } from '../primitives/Button'
import { Avatar } from '../primitives/Avatar'
import { Choice } from '../primitives/Choice'
import { Slider } from '../primitives/Slider'
import { ButtonGroup } from '../primitives/ButtonGroup'
import { CountBadge } from '../primitives/CountBadge'
import { Rule } from '../primitives/Rule'
import { SettingsTool } from './SettingsTool'
import { Window } from './Window'
import styles from './Settings.module.css'
import { CloseIcon } from '../primitives/hudIcons'

const MOTION: readonly MotionPref[] = ['full', 'reduced', 'system']
const BACKGROUND: readonly BackgroundPref[] = ['on', 'off']
const THEME: readonly ThemePref[] = ['dark', 'light', 'system']

// The workspace's own pages; WorkspaceLayout renders each (D-097).
export type WorkspacePage = 'general' | 'people' | 'key' | 'export'
type Page = 'account' | 'display' | 'agent' | WorkspacePage
type Group = 'you' | 'workspace'

// The menu, in groups (D-097): you, this workspace.
const PAGES: { id: Page; label: string; title: string; about: string; group: Group }[] = [
  { id: 'account', label: 'account', title: 'Account', about: 'Who you are signed in as.', group: 'you' },
  { id: 'display', label: 'display', title: 'Display', about: 'How North Star looks and moves in this browser.', group: 'you' },
  { id: 'agent', label: 'the agent', title: 'The agent', about: 'Your own keys and the model the agent uses, in this browser. A workspace can also have its own key (workspace → agent key).', group: 'you' },
  { id: 'general', label: 'general', title: 'Workspace', about: 'Its name and what the team is building.', group: 'workspace' },
  { id: 'people', label: 'people', title: 'People', about: 'Who is in this workspace and how others get in.', group: 'workspace' },
  { id: 'key', label: 'agent key', title: 'Agent key', about: "The workspace's own OpenAI key for the agent: who may use it, and which models.", group: 'workspace' },
  { id: 'export', label: 'export', title: 'Export', about: 'Take the workspace with you as a file.', group: 'workspace' },
]

const WORKSPACE_PAGES: readonly Page[] = ['general', 'people', 'key', 'export']

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
      <button className={styles.account} data-filled onClick={() => show('account')} aria-haspopup="dialog" aria-label={`Account: ${who}`} title={who}>
        {/* In a workspace, your square is in the colour the others see you in (D-067). */}
        <Avatar name={who} photo={safePhoto(user.photoURL)} color={myColor ? themeAccent(myColor, theme) : 'var(--accent-cyan)'} />
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
                            {p.label}
                            {p.id === 'people' && badge > 0 && <CountBadge count={badge} tone="cyan" placement="inline" />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </nav>

            <div className={styles.main}>
              {/* The head never scrolls: nothing passes under the title or the close. */}
              <header className={styles.head} {...(current.id === 'people' && { 'data-learn': 'settings-people' })}>
                <div className={styles.headText}>
                  <h3 className={styles.title}>{current.title}</h3>
                  <p className={styles.about}>{current.about}</p>
                </div>
                <Button icon onClick={() => setOpen(false)} aria-label="Close settings" title="Close (Esc)">
                  <CloseIcon />
                </Button>
              </header>

              <div className={styles.page} key={current.id}>
                {current.id === 'account' && (
                  <Section>
                    <div className={styles.profile}>
                      <Avatar name={who} size="lg" photo={safePhoto(user.photoURL)} color={myColor ? themeAccent(myColor, theme) : 'var(--accent-cyan)'} />
                      <span className={styles.profileText}>
                        <span className={styles.profileName}>{user.name ?? who}</span>
                        <span className={styles.profileEmail}>{user.email ? `${user.email} · signed in with Google` : 'signed in with Google'}</span>
                      </span>
                      <Button onClick={() => signOut()}>sign out</Button>
                    </div>
                  </Section>
                )}

                {current.id === 'display' && (
                  <Section>
                    <SizeChoice />
                    <ThemeChoice />
                    <MotionChoice />
                    <BackgroundChoice />
                  </Section>
                )}

                {current.id === 'agent' && <AgentSettings />}

                {workspace && WORKSPACE_PAGES.includes(current.id) && workspace(current.id as WorkspacePage)}
              </div>
            </div>
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

// The interface's size (D-417, replacing D-348's hud size): everything on the screen, 75–150 % in steps of 5; what's on
// the canvas keeps its own zoom. Set when the knob is let go, so the page doesn't grow under the hand mid-drag.
function SizeChoice() {
  const size = useDisplay((s) => s.size)
  const setSize = useDisplay((s) => s.setSize)
  return (
    <Row label="interface size" hint="Text, buttons, panels and menus, all at once. What's on the canvas keeps its own zoom.">
      <ButtonGroup>
        <Slider label="interface size" min={UI_SIZE.min} max={UI_SIZE.max} step={UI_SIZE.step} mark={UI_SIZE.normal} format={(n) => `${n} %`} value={size} onChange={setSize} />
        <Button disabled={size === UI_SIZE.normal} onClick={() => setSize(UI_SIZE.normal)}>
          reset
        </Button>
      </ButtonGroup>
    </Row>
  )
}

// A group of rows (D-404): a numbered rule over it (`01 MEMBERS ── 4`), dashed lines between its rows, an optional
// note under them. A page with one group gives no label: the page's title already names it.
export function Section({ n, label, count, note, children }: { n?: number; label?: string; count?: number; note?: ReactNode; children?: ReactNode }) {
  return (
    <section className={styles.section}>
      {label && <Rule as="h4" n={n} name={label} count={count} countAt="end" />}
      {children && <div className={styles.body}>{children}</div>}
      {note && <div className={styles.foot}>{note}</div>}
    </section>
  )
}

// A setting: its name and what it does on the left, the control at the right edge; `wide`: the control under them,
// as wide as the row (a field, a text).
export function Row({ label, hint, wide, children }: { label: string; hint?: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <div className={styles.row} data-wide={wide || undefined}>
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
