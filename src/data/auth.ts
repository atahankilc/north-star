import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut as fbSignOut,
} from 'firebase/auth'
import { useEffect, useState } from 'react'
import { firebase, useEmulators } from './firebase'

export type AuthUser = { id: string; email: string | null; name: string | null; photoURL: string | null }

type Auth = {
  isLoading: boolean
  user: AuthUser | null
  error: { message: string } | null
}

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

  return state
}

// Google sign-in (D-011). A popup keeps the HashRouter state intact.
export async function signInWithGoogle() {
  if (!firebase) return
  await signInWithPopup(firebase.auth, new GoogleAuthProvider())
}

// Emulator only: sign in as a fake Google user. The auth emulator accepts unsigned ID tokens.
export async function signInAsTestUser(name: string) {
  if (!firebase || !useEmulators) return
  const slug = name.toLowerCase()
  const idToken = JSON.stringify({ sub: `test-${slug}`, email: `${slug}@example.com`, email_verified: true, name })
  await signInWithCredential(firebase.auth, GoogleAuthProvider.credential(idToken))
}

export function signOut() {
  if (!firebase) return
  return fbSignOut(firebase.auth)
}
