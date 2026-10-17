import { useEffect, useState, type CSSProperties } from 'react'
import { isConfigured, useEmulators } from '../../data/firebase'
import { signInAsTestUser, signInWithGoogle } from '../../data/auth'
import { AsciiButton } from '../../ui/AsciiButton'
import { Hud } from '../../ui/Hud'
import { Appear } from '../../ui/Appear'
import { introTime } from '../../three/sceneClock'
import { useTheme } from '../../state/theme'
import styles from './Landing.module.css'

// Light theme: while the welcome's sky is dark blue (D-072), the landing's text turns light (`data-night` on <html>, tokens.css)
// and eases back about when the sky is half paper again. Dark theme and later visits never set it.
function useNightText() {
  const light = useTheme((s) => s.theme) === 'light'
  useEffect(() => {
    if (!light || introTime() >= NIGHT_TEXT_UNTIL) return
    const root = document.documentElement
    root.setAttribute('data-night', '')
    root.setAttribute('data-night-top', '')
    const left = (NIGHT_TEXT_UNTIL - introTime()) * 1000
    const timers = [
      setTimeout(() => root.removeAttribute('data-night'), left),
      setTimeout(() => root.removeAttribute('data-night-top'), left + 400),
    ]
    return () => {
      timers.forEach(clearTimeout)
      root.removeAttribute('data-night')
      root.removeAttribute('data-night-top')
    }
  }, [light])
}
// Day comes up from the bottom (AsciiEffect): the headline's band is paper again by about 8.1 s, the top by 9.8 s.
// Text eases over 1.6 s and the page colour over 2.4 s, starting here; the HUD at the top 0.4 s later over 1.2 s (data-night-top).
const NIGHT_TEXT_UNTIL = 7.6

export function Landing({ error }: { error?: string | null }) {
  const [signInError, setSignInError] = useState<string | null>(null)
  const shownError = signInError ?? error
  useNightText()

  return (
    <main className={styles.page}>
      <Hud />

      {/* The scrim under the headline fades in with the end of the welcome, so the dawn can rise from the bottom edge (D-072). */}
      <section className={styles.hero} style={{ '--intro-at': `${-introTime()}s` } as CSSProperties}>
        {/* Builds cell by cell every time the landing opens: on reload, and after signing out. */}
        <Appear as="h1" className={styles.title} duration={400}>
          {/* The tight tracking makes the r's arm touch the t's crossbar; open just that pair. */}
          No<span className={styles.kernRt}>r</span>th Star
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
