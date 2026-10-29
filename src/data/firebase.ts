// The only entry point to Firebase. All DB access goes through src/data/ (CLAUDE.md).
// The web config is public by design; security lives in firestore.rules / database.rules.json.
import { initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth'
import { connectDatabaseEmulator, getDatabase, type Database } from 'firebase/database'
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions'
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage'
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
      storageBucket: 'demo-north-star.appspot.com',
      appId: 'demo-app',
    }
  : {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      databaseURL: env.VITE_FIREBASE_DATABASE_URL,
      // Projects made since late 2024 get a `<project>.firebasestorage.app` bucket.
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || (env.VITE_FIREBASE_PROJECT_ID && `${env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`),
      appId: env.VITE_FIREBASE_APP_ID,
    }

export const isConfigured = Boolean(config.apiKey && config.projectId)

type Services = { app: FirebaseApp; auth: Auth; firestore: Firestore; rtdb: Database | null; functions: Functions; storage: FirebaseStorage }

// Our Cloud Functions live next to the Realtime Database (D-079).
const REGION = 'europe-west1'

// The onboarding's demo realm (demo.html, D-315): its own page in a sealed frame, drawing the real components on made-up
// data. demo.html sets the flag before any module loads, so nothing there ever reaches Firebase.
export const isDemo = typeof window !== 'undefined' && (window as { __northStarDemo?: boolean }).__northStarDemo === true

// Null until the VITE_FIREBASE_* vars are set, so the UI can still render (e.g. local design work); always in the demo.
export const firebase: Services | null = isConfigured && !isDemo ? init() : null

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
  // The assistant's workspace key (D-079): only server code ever holds it.
  const functions = getFunctions(app, REGION)
  // Attachment files (D-083); their metadata lives in Firestore.
  const storage = getStorage(app)

  if (useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(firestore, '127.0.0.1', 8080)
    if (rtdb) connectDatabaseEmulator(rtdb, '127.0.0.1', 9010)
    connectFunctionsEmulator(functions, '127.0.0.1', 5001)
    connectStorageEmulator(storage, '127.0.0.1', 9199)
  }

  return { app, auth, firestore, rtdb, functions, storage }
}

export function db(): Firestore {
  if (!firebase) throw new Error('Firebase is not configured')
  return firebase.firestore
}

// The streaming endpoint that calls OpenAI on a workspace's key (functions/src/index.ts `ai`).
export const aiProxyUrl = useEmulators
  ? `http://127.0.0.1:5001/${config.projectId}/${REGION}/ai`
  : `https://${REGION}-${config.projectId}.cloudfunctions.net/ai`
