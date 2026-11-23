// The workspace key (D-079, D-427): an OpenAI key an owner gives the workspace, so members the owners allow use the
// agent without a key of their own. It's sent once to `setWorkspaceKey`, kept only encrypted where no client reads it
// (`aiSecrets/`), and never comes back to a browser (CLAUDE.md's hard rule): what the workspace shows is `ai/config`
// (whether there's one, `sk-…abcd`, who may use it, which models). A call goes through the `ai` function, which checks
// all of it again and logs what each call used (`aiUsage`, workspace-key entries the owners read).
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { KEY_ALLOWED_MAX, KEY_MODELS_MAX } from '../model/limits'
import type { Role } from './model'
import { db, firebase, functionsOf, functionUrl } from './firebase'
import { useDoc } from './hooks'

export type KeyAccess = 'everyone' | 'chosen'
export type AiConfig = { hasKey?: boolean; keyHint?: string; access?: KeyAccess; allowed?: string[]; allowedModels?: string[] }

const configRef = (wid: string) => doc(db(), 'workspaces', wid, 'ai', 'config')

export const useAiConfig = (wid: string) => useDoc<AiConfig>(`workspaces/${wid}/ai/config`)

async function call<T>(name: string, data: unknown): Promise<T> {
  const [f, { httpsCallable }] = await Promise.all([functionsOf(), import('firebase/functions')])
  try {
    return (await httpsCallable(f, name)(data)).data as T
  } catch (e) {
    // The function's own words ("OpenAI didn't accept this key."), never the SDK's code.
    throw new Error((e as Error)?.message || "The workspace key couldn't be saved.")
  }
}

// Owners: give the workspace this key (checked with OpenAI first), or none (null). The models it runs start as `first`
// when none were chosen yet.
export async function setWorkspaceKey(wid: string, key: string | null, first?: string[]) {
  await call<{ keyHint: string | null }>('setWorkspaceKey', { wid, key: key ?? '' })
  if (key && first?.length) await setDoc(configRef(wid), { allowedModels: first }, { merge: true })
}

// Owners: who may use it (D-098, D-318: owners always, viewers never) and which models it runs (≤ 20, firestore.rules).
export const setKeyAccess = (wid: string, access: KeyAccess, allowed: string[]) => setDoc(configRef(wid), { access, allowed: allowed.slice(0, KEY_ALLOWED_MAX) }, { merge: true })
export const setKeyModels = (wid: string, models: string[]) => setDoc(configRef(wid), { allowedModels: models.slice(0, KEY_MODELS_MAX) }, { merge: true })

// Whether `uid` may use the key (the function's `mayUseKey`, read here to say so before a call): owners always; editors
// when everyone may or they were chosen; viewers never.
export function mayUseWorkspaceKey(config: AiConfig | null | undefined, uid: string | undefined, role: Role | null | undefined): boolean {
  if (!config?.hasKey || !uid || !role || role === 'viewer') return false
  if (role === 'owner') return true
  return config.access === 'everyone' || (config.allowed ?? []).includes(uid)
}

// How a call reaches OpenAI on the workspace key: the function's address and the signed-in person's token (sent each
// call; the function checks it, the membership, the access and the model).
export type WorkspaceRoute = { url: string; token: () => Promise<string>; wid: string }
export function workspaceRoute(wid: string): WorkspaceRoute | null {
  const url = functionUrl('ai')
  const auth = firebase?.auth
  if (!url || !auth) return null
  return {
    url,
    wid,
    token: async () => {
      const u = auth.currentUser
      if (!u) throw new Error('Sign in again.')
      return u.getIdToken()
    },
  }
}

// For a chat about to call OpenAI with no key of the person's own: the route through the workspace key when they may
// use it, else null (the chat then asks for a key as before).
export async function workspaceKeyFor(wid: string, uid: string | undefined, role: Role | null | undefined): Promise<WorkspaceRoute | null> {
  try {
    const config = (await getDoc(configRef(wid))).data() as AiConfig | undefined
    return mayUseWorkspaceKey(config, uid, role) ? workspaceRoute(wid) : null
  } catch {
    return null
  }
}
