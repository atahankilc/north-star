import {
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithCredential,
  signInWithPopup,
  signOut as fbSignOut,
} from 'firebase/auth'
import { useEffect, useState } from 'react'
import { ACCOUNT_DELETE_MS } from '../ui/foundation/feel'
import { firebase, functionsOf, isDemo, useEmulators } from './firebase'
import { leavePresence } from './presence'

export type AuthUser = { id: string; email: string | null; name: string | null; photoURL: string | null }

type Auth = {
  isLoading: boolean
  user: AuthUser | null
  error: { message: string } | null
}

// The onboarding's demo realm (demo.html, D-315): a made-up person, the made-up workspace's owner, never a Firebase user.
const DEMO: Auth = { isLoading: false, user: { id: 'demo', email: null, name: 'You', photoURL: null }, error: null }

export function useAuth(): Auth {
  const [state, setState] = useState<Auth>({ isLoading: Boolean(firebase), user: null, error: null })

  useEffect(() => {
    if (!firebase) return
    return onAuthStateChanged(
      firebase.auth,
      (u) =>
        setState({
          isLoading: false,
          error: null,
          user: u && { id: u.uid, email: u.email, name: u.displayName, photoURL: u.photoURL },
        }),
      (e) => setState({ isLoading: false, user: null, error: { message: e.message } }),
    )
  }, [])

  return isDemo ? DEMO : state
}

// What a failed sign-in says, in plain words. Closing the popup yourself is no error: nothing is said.
const SIGN_IN_SAYS: Record<string, string | null> = {
  'auth/popup-closed-by-user': null,
  'auth/cancelled-popup-request': null,
  'auth/user-cancelled': null,
  'auth/popup-blocked': 'The sign-in window was blocked. Allow pop-ups for this site and try again.',
  'auth/network-request-failed': 'Could not reach Google. Check your connection and try again.',
}

// Google sign-in (D-011). A popup keeps the page and its router state intact. Throws only what's worth saying.
export async function signInWithGoogle() {
  if (!firebase) return
  try {
    // Always Google's account list: without it Google takes the account it used last, so someone who signed in
    // with the wrong one could never pick another, even after signing out.
    const google = new GoogleAuthProvider()
    google.setCustomParameters({ prompt: 'select_account' })
    await signInWithPopup(firebase.auth, google)
  } catch (e) {
    const code = (e as { code?: string }).code ?? ''
    if (!(code in SIGN_IN_SAYS)) throw e
    const says = SIGN_IN_SAYS[code]
    if (says) throw new Error(says)
  }
}

// Emulator only: sign in as a fake Google user. The auth emulator accepts unsigned ID tokens.
export async function signInAsTestUser(name: string) {
  if (!firebase || !useEmulators) return
  const slug = name.toLowerCase()
  const idToken = JSON.stringify({ sub: `test-${slug}`, email: `${slug}@example.com`, email_verified: true, name })
  await signInWithCredential(firebase.auth, GoogleAuthProvider.credential(idToken))
}

// Deletes the account and what only its owner could see (D-432, functions/src/account.ts). Google's window comes first: the
// function takes only a sign-in of the last few minutes. Signed out at the end, the account being gone.
// Google's sign-in again, for what a function takes only from a sign-in of the last hour (deleting the account, the
// backoffice's changes, D-434); on the emulators a fresh token is enough.
export async function freshSignIn(otherAccount = "That's a different Google account.", failed = 'Sign in with Google to confirm.') {
  const user = firebase?.auth.currentUser
  if (!firebase || !user) throw new Error('Sign in first.')
  if (!useEmulators) {
    try {
      const google = new GoogleAuthProvider()
      if (user.email) google.setCustomParameters({ login_hint: user.email })
      await reauthenticateWithPopup(user, google)
    } catch (e) {
      const code = (e as { code?: string }).code ?? ''
      if (code === 'auth/user-mismatch') throw new Error(otherAccount)
      throw new Error(SIGN_IN_SAYS[code] ?? failed)
    }
  }
  await user.getIdToken(true)
}

export async function deleteAccount() {
  const user = firebase?.auth.currentUser
  if (!firebase || !user) return
  await freshSignIn("That's a different Google account. Sign in with the one you want to delete.", 'Your account was not deleted. Sign in with Google to confirm.')
  const [f, { httpsCallable }] = await Promise.all([functionsOf(), import('firebase/functions')])
  try {
    await httpsCallable(f, 'deleteAccount', { timeout: ACCOUNT_DELETE_MS })({})
  } catch (e) {
    throw new Error((e as Error)?.message || "The account couldn't be deleted. Try again.")
  }
  await fbSignOut(firebase.auth)
}

export async function signOut() {
  if (!firebase) return
  await leavePresence()
  return fbSignOut(firebase.auth)
}
