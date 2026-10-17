// The only entry point to Firebase. All DB access goes through src/data/ (CLAUDE.md).
// The web config is public by design; security lives in firestore.rules / database.rules.json.
import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getDatabase, type Database } from 'firebase/database'
import { initializeFirestore, persistentLocalCache, type Firestore } from 'firebase/firestore'

const env = import.meta.env

const config = {
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
  return {
    app,
    auth: getAuth(app),
    // Offline cache: instant reloads, edits survive a flaky connection.
    firestore: initializeFirestore(app, { localCache: persistentLocalCache() }),
    // Realtime Database: ephemeral presence and cursors only (D-016).
    rtdb: config.databaseURL ? getDatabase(app) : null,
  }
}
