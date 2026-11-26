// The workspace key (D-079, D-427): an OpenAI key an owner gives the workspace, so members the owners allow use the
// agent without a key of their own. It's sent once to `setWorkspaceKey`, kept only encrypted where no client reads it
// (`aiSecrets/`), and never comes back to a browser (CLAUDE.md's hard rule): what the workspace shows is `ai/config`
// (whether there's one, `sk-…abcd`, who may use it, which models). A call goes through the `ai` function, which checks
// all of it again and logs what each call used (`aiUsage`, workspace-key entries the owners read).
import { collection, doc, getDoc, query, where } from 'firebase/firestore'
import { KEY_ALLOWED_MAX, KEY_MODELS_MAX } from '../model/limits'
import type { Role } from './model'
import { callFunction, db, firebase, functionUrl } from './firebase'
import { useDoc, useQuery } from './hooks'

export type KeyAccess = 'everyone' | 'chosen'
// `limits`: a month's per person and in total, in euro cents (D-434); left out, none.
export type AiConfig = { hasKey?: boolean; keyHint?: string; access?: KeyAccess; allowed?: string[]; allowedModels?: string[]; limits?: { person?: number; total?: number } }

const configRef = (wid: string) => doc(db(), 'workspaces', wid, 'ai', 'config')

export const useAiConfig = (wid: string) => useDoc<AiConfig>(`workspaces/${wid}/ai/config`)

const call = <T,>(name: string, data: unknown) => callFunction<T>(name, data, "The workspace key couldn't be saved.")

// Owners: give the workspace this key (checked with OpenAI first), or none (null). The models it runs start as `first`
// when none were chosen yet.
export async function setWorkspaceKey(wid: string, key: string | null, first?: string[]) {
  await call<{ keyHint: string | null }>('setWorkspaceKey', { wid, key: key ?? '' })
  if (key && first?.length) await setKeyModels(wid, first)
}

// Owners: who may use it (D-098, D-318: owners always, viewers never), which models it runs and its month's limits, each
// through `setWorkspaceAi`, so every change is in the audit log (D-434).
const setAi = (wid: string, patch: Record<string, unknown>) => call<AiConfig>('setWorkspaceAi', { wid, ...patch })
export const setKeyAccess = (wid: string, access: KeyAccess, allowed: string[]) => setAi(wid, { access, allowed: allowed.slice(0, KEY_ALLOWED_MAX) })
export const setKeyModels = (wid: string, models: string[]) => setAi(wid, { allowedModels: models.slice(0, KEY_MODELS_MAX) })
// A limit in euro cents; null takes it away.
export const setKeyLimit = (wid: string, which: 'person' | 'total', cents: number | null) => setAi(wid, { limits: { [which]: cents } })

// A month of the workspace key's use (aiMeters, D-434): each person's and the total, in micro-dollars, as owners read it.
export type Spend = { uid: string | null; spent: number; reserved: number; calls: number }
export function useKeySpend(wid: string, month: string): Spend[] {
  const q = firebase ? query(collection(db(), 'aiMeters'), where('wid', '==', wid), where('source', '==', 'workspace'), where('month', '==', month)) : null
  return useQuery<Spend>(q, `aiMeters:${wid}:${month}`).data
}
// The month's rate (USD per EUR), when it was set; else the ledger's default.
export const useRate = (month: string) => useDoc<{ usdPerEur: number }>(`aiRates/${month}`).data?.usdPerEur

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
function workspaceRoute(wid: string): WorkspaceRoute | null {
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
