// Placeholder for Phase 1: workspace list, create, join by invite code (D-012).
import { signOut } from '../../data/auth'
import { AsciiButton } from '../../ui/AsciiButton'
import { DecodeText } from '../../ui/DecodeText'
import styles from './Workspaces.module.css'

export function Workspaces({ email }: { email?: string | null }) {
  return (
    <main className={styles.page}>
      <header className={styles.bar}>
        <span>
          <span className={styles.hash}>#</span> north-star / workspaces
        </span>
        <span className={styles.user}>
          {email}
          <AsciiButton accent="cyan" onClick={() => signOut()}>
            Sign out
          </AsciiButton>
        </span>
      </header>

      <section className={styles.panel}>
        <pre className={styles.box} aria-hidden>
{`┌────────────────────────────────────┐
│                                    │
│   no workspaces yet                │
│                                    │
└────────────────────────────────────┘`}
        </pre>
        <h2 className={styles.title}>
          <DecodeText text="Workspaces arrive in phase 1" />
        </h2>
        <p className={styles.dim}>Create a workspace or join one with an invite code.</p>
      </section>
    </main>
  )
}
