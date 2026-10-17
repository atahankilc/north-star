import { useState } from 'react'
import { isConfigured, useEmulators } from '../../data/firebase'
import { signInAsTestUser, signInWithGoogle } from '../../data/auth'
import { AsciiButton } from '../../ui/AsciiButton'
import { Hud } from '../../ui/Hud'
import { Appear } from '../../ui/Appear'
import styles from './Landing.module.css'

export function Landing({ error }: { error?: string | null }) {
  const [signInError, setSignInError] = useState<string | null>(null)
  const shownError = signInError ?? error

  return (
    <main className={styles.page}>
      <Hud />

      <section className={styles.hero}>
        {/* Builds cell by cell every time the landing opens: on reload, and after signing out. */}
        <Appear as="h1" className={styles.title} duration={400}>
          North Star
        </Appear>

        <Appear className={styles.aside}>
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
        </Appear>
      </section>
    </main>
  )
}
