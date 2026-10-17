import { motion } from 'motion/react'
import { useState } from 'react'
import { isConfigured, useEmulators } from '../../data/firebase'
import { signInAsTestUser, signInWithGoogle } from '../../data/auth'
import { AsciiButton } from '../../ui/AsciiButton'
import { DecodeText } from '../../ui/DecodeText'
import styles from './Landing.module.css'

const PILLARS = ['Ideas', 'Connections', 'Competitors', 'Comparison', 'Live together']

export function Landing({ error }: { error?: string | null }) {
  const [signInError, setSignInError] = useState<string | null>(null)
  const shownError = signInError ?? error

  return (
    <main className={styles.page}>
      <header className={styles.nav}>
        <span className={styles.mark}>
          <span className={styles.hash}>#</span> north-star
        </span>
        <nav className={styles.pillars} aria-label="What it does">
          {PILLARS.map((p, i) => (
            <span key={p}>
              <DecodeText text={p} delay={200 + i * 90} duration={500} />
            </span>
          ))}
        </nav>
      </header>

      <section className={styles.hero}>
        <motion.h1
          className={styles.title}
          initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        >
          North Star
        </motion.h1>

        <motion.div
          className={styles.aside}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.7 }}
        >
          <p className={styles.tagline}>
            Ideation space for founders. Pin ideas, connect them, take competitors apart
            feature by feature and see where the gaps are, together and live.
          </p>

          {useEmulators ? (
            // Local emulators: fake Google users, so two "people" can be tested in two windows.
            <span className={styles.testUsers}>
              {['Alice', 'Bob', 'Carol'].map((name) => (
                <AsciiButton key={name} accent="green" onClick={() => signInAsTestUser(name).catch((e: Error) => setSignInError(e.message))}>
                  {name}
                </AsciiButton>
              ))}
            </span>
          ) : isConfigured ? (
            <AsciiButton onClick={() => signInWithGoogle().catch((e: Error) => setSignInError(e.message))}>Sign in with Google</AsciiButton>
          ) : (
            <p className={styles.notice}>
              <span className={styles.warn}>!</span> Add the <code>VITE_FIREBASE_*</code> config to{' '}
              <code>.env.local</code> to enable sign-in.
            </p>
          )}
          {shownError && (
            <p className={styles.notice} role="alert">
              <span className={styles.warn}>!</span> {shownError}
            </p>
          )}
        </motion.div>
      </section>
    </main>
  )
}
