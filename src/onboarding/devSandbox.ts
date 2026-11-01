// Dev only: a tab that sees the onboarding as a new person (`?onboarding=reset`), on a test copy of the seen-state in
// this tab's sessionStorage; the real one (localStorage, Firestore) is never read or written meanwhile (progress.ts).
// Wiping the real one instead doesn't hold: any other tab of the person, the live site's too, writes its copy back.
// No imports, so main.tsx reads the address before the router or any redirect can drop it. Production: sandboxOn()
// is false and nothing reads the address.
export const SANDBOX_KEY = 'north-star:dev-onboarding-sandbox'

export function sandboxOn(): boolean {
  if (!import.meta.env.DEV) return false
  try {
    return sessionStorage.getItem(SANDBOX_KEY) !== null
  } catch {
    return false
  }
}

// On: a fresh, empty test copy (again if one was on); off: back to the real seen-state.
export function setSandbox(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(SANDBOX_KEY, '')
    else sessionStorage.removeItem(SANDBOX_KEY)
  } catch {
    // sessionStorage blocked: no test copy.
  }
}

// `?onboarding=reset` / `?onboarding=real` in the address: applied, then taken out of the address (the rest kept), so
// the page goes on at its normal address. Called once from main.tsx; window.__onboarding does the same from the console.
export function takeSandboxParam(): void {
  if (!import.meta.env.DEV || typeof location === 'undefined') return
  const url = new URL(location.href)
  const q = url.searchParams.get('onboarding')
  if (q === 'reset' || q === 'real') {
    setSandbox(q === 'reset')
    url.searchParams.delete('onboarding')
    history.replaceState(history.state, '', url.pathname + url.search + url.hash)
  }
  if (sandboxOn()) console.info('[onboarding] test mode in this tab: shown as a new person; ?onboarding=real to leave')
  ;(window as unknown as { __onboarding: unknown }).__onboarding = {
    reset() {
      setSandbox(true)
      location.reload()
    },
    real() {
      setSandbox(false)
      location.reload()
    },
  }
}
