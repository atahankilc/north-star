// The only entry point to Firebase. All DB access goes through src/data/ (CLAUDE.md).
// The web config is public by design; security lives in firestore.rules / database.rules.json.
import { initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth'
import { connectDatabaseEmulator, getDatabase, type Database } from 'firebase/database'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  type Firestore,
} from 'firebase/firestore'

const env = import.meta.env

// `npm run dev:emu`: talk to local emulators with a `demo-` project, so nothing can reach production.
export const useEmulators = env.VITE_USE_EMULATORS === 'true'

const config = useEmulators
  ? {
      apiKey: 'demo-key',
      authDomain: 'localhost',
      projectId: 'demo-north-star',
      databaseURL: 'http://127.0.0.1:9010?ns=demo-north-star-default-rtdb',
      appId: 'demo-app',
    }
  : {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      databaseURL: env.VITE_FIREBASE_DATABASE_URL,
      appId: env.VITE_FIREBASE_APP_ID,
    }

export const isConfigured = Boolean(config.apiKey && config.projectId)

type Services = { app: FirebaseApp; auth: Auth; firestore: Firestore; rtdb: Database | null }

// Null until the VITE_FIREBASE_* vars are set, so the UI can still render (e.g. local design work).
export const firebase: Services | null = isConfigured ? init() : null

function init(): Services {
  const app = initializeApp(config)
  const auth = getAuth(app)
  // Offline cache: instant reloads, edits survive a flaky connection.
  // The emulator data is throwaway, so keep its cache in memory.
  const firestore = initializeFirestore(app, {
    localCache: useEmulators ? memoryLocalCache() : persistentLocalCache(),
  })
  // Realtime Database: ephemeral presence and cursors only (D-016).
  const rtdb = config.databaseURL ? getDatabase(app) : null

  if (useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(firestore, '127.0.0.1', 8080)
    if (rtdb) connectDatabaseEmulator(rtdb, '127.0.0.1', 9010)
  }

  return { app, auth, firestore, rtdb }
}

export function db(): Firestore {
  if (!firebase) throw new Error('Firebase is not configured')
  return firebase.firestore
}
