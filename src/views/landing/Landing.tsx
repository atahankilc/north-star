import { useEffect, useState, type CSSProperties } from 'react'
import { isConfigured, useEmulators } from '../../data/firebase'
import { signInAsTestUser, signInWithGoogle } from '../../data/auth'
import { AsciiButton } from '../../ui/AsciiButton'
import { Hud } from '../../ui/Hud'
import { Appear } from '../../ui/Appear'
import { NIGHT_IN, NIGHT_OUT, NIGHT_OUT_AT, introTime, nightHalfway, startNight, stopNight } from '../../three/sceneClock'
import { useCurtain } from '../../state/curtain'
import { useTheme } from '../../state/theme'
import styles from './Landing.module.css'

// Light theme: the welcome's dark-blue sky (D-072) belongs to the landing only. It starts as the page is revealed, together with
// every entrance, and while it lasts the text turns light, following the sweep: it crosses from the bottom left to the top right
// both ways, so the headline (`data-night`, tokens.css) turns first and back first, the HUD (`data-night-top`, Hud.module.css)
// after it each time. Each switches when its spot is half way through the tones. Dark theme never sets them.
function useNight() {
  const light = useTheme((s) => s.theme) === 'light'
  const revealed = useCurtain((s) => s.revealed)
  useEffect(() => {
    if (!light || !revealed || introTime() >= NIGHT_OUT_AT) return
    const root = document.documentElement
    startNight()
    const headline = nightHalfway((0.3 + 0.12) / 2) // its middle, low on the left
    const hud = nightHalfway((0.1 + 0.97) / 2) // the breadcrumb, high on the left
    const out = (NIGHT_OUT_AT - introTime()) * 1000
    const timers = [
      setTimeout(() => root.setAttribute('data-night', ''), NIGHT_IN * headline * 1000),
      setTimeout(() => root.setAttribute('data-night-top', ''), NIGHT_IN * hud * 1000),
      setTimeout(() => root.removeAttribute('data-night'), out + NIGHT_OUT * headline * 1000),
      setTimeout(() => root.removeAttribute('data-night-top'), out + NIGHT_OUT * hud * 1000),
    ]
    return () => {
      timers.forEach(clearTimeout)
      stopNight()
      root.removeAttribute('data-night')
      root.removeAttribute('data-night-top')
    }
  }, [light, revealed])
}

export function Landing({ error }: { error?: string | null }) {
  const [signInError, setSignInError] = useState<string | null>(null)
  const shownError = signInError ?? error
  useNight()
  // Read once: recomputing it on a later render would shift the running animation ahead.
  const [introAt] = useState(() => `${-introTime()}s`)

  return (
    <main className={styles.page}>
      <Hud />

      {/* The scrim under the headline fades in with the end of the welcome, so the dawn can rise from the bottom edge (D-072). */}
      <section className={styles.hero} style={{ '--intro-at': introAt } as CSSProperties}>
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
            <AsciiButton onClick={() => signInWithGoogle().catch((e: Error) => setSignInError(e.message))}>sign in with Google</AsciiButton>
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
