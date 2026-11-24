import { useState } from 'react'
import { isConfigured, useEmulators } from '../../data/firebase'
import { signInAsTestUser, signInWithGoogle } from '../../data/auth'
import { Button } from '../../ui/primitives/Button'
import { Appear } from '../../ui/primitives/Appear'
import { LegalLinks } from '../../ui/patterns/LegalLinks'
import styles from './Landing.module.css'

export function Landing({ error }: { error?: string | null }) {
  const [signInError, setSignInError] = useState<string | null>(null)
  const shownError = signInError ?? error

  return (
    <main className={styles.page}>
      {/* No HUD and no scrim (D-340): the page is the title, the sign-in and the backdrop on the whole screen. */}
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
                <Button key={name} size="md" accent="green" onClick={() => signInAsTestUser(name).catch((e: Error) => setSignInError(e.message))}>
                  {name}
                </Button>
              ))}
            </span>
          ) : isConfigured ? (
            <Button size="md" onClick={() => (setSignInError(null), signInWithGoogle().catch((e: Error) => setSignInError(e.message)))}>
              sign in with Google
            </Button>
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
          <LegalLinks />
        </Appear>
      </section>
    </main>
  )
}
