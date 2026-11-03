import { useEffect, useState } from 'react'
import { isConfigured, useEmulators } from '../../data/firebase'
import { signInAsTestUser, signInWithGoogle } from '../../data/auth'
import { Button } from '../../ui/primitives/Button'
import { Appear } from '../../ui/primitives/Appear'
import { NIGHT_IN, NIGHT_OUT, NIGHT_OUT_AT, introTime, nightHalfway, startNight, stopNight } from '../../three/sceneClock'
import { useCurtain } from '../../state/curtain'
import { useTheme } from '../../state/theme'
import styles from './Landing.module.css'

// Light theme: the welcome's dark-blue sky (D-072) belongs to the landing only. It starts as the page is revealed, together with
// every entrance, and while it lasts the text turns light, following the sweep (`data-night`, tokens.css): it switches when the
// headline's spot is half way through the tones. Dark theme never sets it.
function useNight() {
  const light = useTheme((s) => s.theme) === 'light'
  const revealed = useCurtain((s) => s.revealed)
  useEffect(() => {
    if (!light || !revealed || introTime() >= NIGHT_OUT_AT) return
    const root = document.documentElement
    startNight()
    const headline = nightHalfway((0.3 + 0.12) / 2) // its middle, low on the left
    const out = (NIGHT_OUT_AT - introTime()) * 1000
    const timers = [
      setTimeout(() => root.setAttribute('data-night', ''), NIGHT_IN * headline * 1000),
      setTimeout(() => root.removeAttribute('data-night'), out + NIGHT_OUT * headline * 1000),
    ]
    return () => {
      timers.forEach(clearTimeout)
      stopNight()
      root.removeAttribute('data-night')
    }
  }, [light, revealed])
}

export function Landing({ error }: { error?: string | null }) {
  const [signInError, setSignInError] = useState<string | null>(null)
  const shownError = signInError ?? error
  useNight()

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
        </Appear>
      </section>
    </main>
  )
}
