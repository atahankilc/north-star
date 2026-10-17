// Settings (D-054): one place for your account, how the app moves, the current workspace (name, invite code) and,
// later, the AI key and export. A native <dialog>: focus stays inside, Escape and the backdrop close it.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { signOut, useAuth } from '../data/auth'
import { useMotion, type MotionPref } from '../state/motion'
import { AsciiButton } from './AsciiButton'
import { Choice } from './Choice'
import styles from './Settings.module.css'

const MOTION: readonly MotionPref[] = ['system', 'full', 'reduced']

type Props = {
  // The current workspace's section, if there is one.
  workspace?: ReactNode
  badge?: number
}

export function SettingsButton({ workspace, badge = 0 }: Props) {
  const { user } = useAuth()
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  if (!user) return null
  const who = user.name || user.email || 'Account'

  return (
    <>
      <button className={styles.trigger} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className={styles.avatar} aria-hidden>
          {who.trim()[0]?.toUpperCase()}
        </span>
        <span className={styles.who}>{who}</span>
        <span className={styles.gear} aria-hidden>
          ⚙
        </span>
        {badge > 0 && (
          <span className={styles.badge} aria-hidden>
            {badge}
          </span>
        )}
        <span className={styles.srOnly}>Settings{badge > 0 ? `, ${badge} waiting` : ''}</span>
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
            <header className={styles.head}>
              <h2 id="settings-title" className={styles.title}>
                Settings
              </h2>
              <button className={styles.close} onClick={() => setOpen(false)} aria-label="Close settings">
                [×]
              </button>
            </header>

            <Section label="account">
              <Row label="signed in as">{user.email ?? who}</Row>
              <div className={styles.actions}>
                <AsciiButton accent="cyan" onClick={() => signOut()}>
                  Sign out
                </AsciiButton>
              </div>
            </Section>

            {workspace}

            <Section label="display">
              <MotionChoice />
            </Section>

            <Section label="coming later">
              <Later name="AI assistant" detail="Your own OpenAI key, kept only in this browser" phase="phase 4" />
              <Later name="Live cursors" detail="See who's here and where they're looking" phase="phase 3" />
              <Later name="Export and import" detail="A whole workspace as one file" phase="phase 5" />
            </Section>
          </div>
        )}
      </dialog>
    </>
  )
}

function MotionChoice() {
  const pref = useMotion((s) => s.pref)
  const reduced = useMotion((s) => s.reduced)
  const setPref = useMotion((s) => s.setPref)
  return (
    <>
      <Choice label="motion" options={MOTION} value={pref} onChange={(p) => setPref(p ?? 'system')} />
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

export function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.label}>{label}</h3>
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
