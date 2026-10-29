// What the demo realm's build gets for `firebase/*` (vite.demo.config.ts; D-315): the demo never starts Firebase
// (demo.html sets the flag src/data/firebase.ts reads, so `firebase` is null and every read and write stops before it
// reaches these), so it ships none of it. Every function the app imports from the SDK is here, by name, and refuses as
// the missing Firebase does (the demo counts that as a refused write). Types still come from the real package (tsc).
// A name the app starts importing that isn't here fails the demo's build, which says which.
const refuse = (): never => {
  throw new Error('Firebase is not configured')
}

// firebase/app
export const initializeApp = refuse
// firebase/auth
export class GoogleAuthProvider {
  static credential = refuse
}
export const connectAuthEmulator = refuse
export const getAuth = refuse
export const onAuthStateChanged = refuse
export const signInWithCredential = refuse
export const signInWithPopup = refuse
export const signOut = refuse
// firebase/database
export const connectDatabaseEmulator = refuse
export const getDatabase = refuse
export const onDisconnect = refuse
export const onValue = refuse
export const ref = refuse
export const remove = refuse
export const serverTimestamp = refuse
export const set = refuse
// firebase/firestore
export const arrayRemove = refuse
export const arrayUnion = refuse
export const collection = refuse
export const connectFirestoreEmulator = refuse
export const deleteDoc = refuse
export const deleteField = refuse
export const doc = refuse
export const getDoc = refuse
export const getDocFromCache = refuse
export const getDocs = refuse
export const increment = refuse
export const initializeFirestore = refuse
export const limit = refuse
export const memoryLocalCache = refuse
export const onSnapshot = refuse
export const orderBy = refuse
export const persistentLocalCache = refuse
export const query = refuse
export const setDoc = refuse
export const updateDoc = refuse
export const where = refuse
export const writeBatch = refuse
// firebase/functions
export const connectFunctionsEmulator = refuse
export const getFunctions = refuse
// firebase/storage
export const connectStorageEmulator = refuse
export const getStorage = refuse
