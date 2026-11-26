// One person's own session on the server (D-434, docs/specs/agent-server.md §5.3): an app instance of its own, signed in
// with a custom token, so every read the agent makes goes through firestore.rules as that person. The session renews
// itself past an hour; its token never leaves this process. `end` closes it whole (nothing of it stays in the instance).
import { getAuth as adminAuth } from 'firebase-admin/auth'
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore, memoryLocalCache, setLogLevel, terminate, type Firestore } from 'firebase/firestore'

// A refused read is an answer here, not news: the SDK's own lines would put paths in the log.
setLogLevel('silent')

// The project's web config (public by design, src/data/firebase.ts).
export type WebConfig = { projectId: string; apiKey: string }
export type Person = { uid: string; db: Firestore; end: () => Promise<void> }

let n = 0

export async function openAsPerson(uid: string, web: WebConfig): Promise<Person> {
  const app: FirebaseApp = initializeApp({ ...web, authDomain: `${web.projectId}.firebaseapp.com` }, `person-${++n}`)
  const auth = getAuth(app)
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST
  if (authHost) connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true })
  const db = initializeFirestore(app, { localCache: memoryLocalCache() })
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '').split(':')
  if (host && port) connectFirestoreEmulator(db, host, Number(port))
  const end = async () => {
    await terminate(db).catch(() => undefined)
    await deleteApp(app).catch(() => undefined)
  }
  try {
    await signInWithCustomToken(auth, await adminAuth().createCustomToken(uid))
  } catch (e) {
    await end()
    throw e
  }
  return { uid, db, end }
}
