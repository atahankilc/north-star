// The assistant's workspace key and usage log (D-079). The key itself never reaches a browser: the owner hands it to
// setWorkspaceKey once, and members call OpenAI through the `ai` function. Rules: firestore.rules (ai, aiUsage, aiSecrets).
import { addDoc, collection, doc, query, setDoc, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { useAuth } from './auth'
import { aiProxyUrl, db, firebase, useEmulators } from './firebase'
import { useDoc, useQuery } from './hooks'

// The workspace key needs our Cloud Functions, which need the Blaze plan (D-079). Until they're deployed on the live
// project, the feature is shown only on the emulators. Set to true in the same change that runs `npm run deploy:functions`.
const WORKSPACE_KEYS_LIVE = false
export const workspaceKeysAvailable = useEmulators || WORKSPACE_KEYS_LIVE

export type KeyAccess = 'everyone' | 'chosen'

// workspaces/{wid}/ai/config. hasKey and keyHint are written by the server only.
export type AiConfig = {
  hasKey?: boolean
  keyHint?: string
  keySetAt?: number
  access?: KeyAccess
  allowed?: string[]
}

export type KeySource = 'own' | 'workspace'

// One assistant call: what it used, never what was said.
export type AiUsage = {
  uid: string
  name: string
  keySource: KeySource
  task: 'chat' | 'research'
  model: string
  inputTokens: number
  cachedTokens: number
  outputTokens: number
  reasoningTokens: number
  webSearches: number
  tools: string[]
  status: 'done' | 'stopped' | 'failed'
  ms: number
  at: number
}

export type Member = { uid: string; name: string; email: string | null }

const configPath = (wid: string) => `workspaces/${wid}/ai/config`

export function useAiConfig(wid: string | null) {
  return useDoc<AiConfig>(wid ? configPath(wid) : null)
}

// May this person use the workspace key? The server checks the same thing on every call.
export function canUseWorkspaceKey(config: AiConfig | null | undefined, uid: string | undefined, ownerId: string): boolean {
  if (!workspaceKeysAvailable || !config?.hasKey || !uid) return false
  return uid === ownerId || config.access === 'everyone' || (config.allowed ?? []).includes(uid)
}

export function setKeyAccess(wid: string, access: KeyAccess, allowed: string[]) {
  return setDoc(doc(db(), configPath(wid)), { access, allowed }, { merge: true })
}

const call = <In, Out>(name: string) => {
  if (!firebase) throw new Error('Firebase is not configured')
  return httpsCallable<In, Out>(firebase.functions, name)
}

// Sends the key to the server once; '' removes it. Resolves with the hint (`sk-…abcd`) or null.
export async function setWorkspaceKey(wid: string, key: string): Promise<string | null> {
  const res = await call<{ wid: string; key: string }, { keyHint: string | null }>('setWorkspaceKey')({ wid, key })
  return res.data.keyHint
}

export async function listMembers(wid: string): Promise<Member[]> {
  return (await call<{ wid: string }, Member[]>('aiMembers')({ wid })).data
}

// One call on the workspace key: the same request body OpenAI's Responses API takes, streamed back as it is.
export async function workspaceKeyFetch(wid: string, task: AiUsage['task'], body: object, signal: AbortSignal): Promise<Response> {
  const user = firebase?.auth.currentUser
  if (!user) throw new Error('Not signed in')
  return fetch(aiProxyUrl, {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ wid, task, body }),
  })
}

// Own-key calls are logged by the browser that made them (workspace-key calls are logged by the server), as you.
export function logOwnUsage(wid: string, entry: Omit<AiUsage, 'keySource' | 'uid' | 'name'>) {
  const user = firebase?.auth.currentUser
  if (!user) return Promise.resolve()
  const name = (user.displayName ?? user.email ?? 'Someone').slice(0, 200)
  return addDoc(collection(db(), 'workspaces', wid, 'aiUsage'), { ...entry, uid: user.uid, name, keySource: 'own' })
}

// Your own entries (both keys); the owner also gets everyone's workspace-key entries. Rules allow exactly these two queries.
export function useAiUsage(wid: string | null, isOwner: boolean) {
  const { user } = useAuth()
  const uid = user?.id
  const usage = (wid: string) => collection(db(), 'workspaces', wid, 'aiUsage')
  const mine = useQuery<AiUsage>(wid && uid ? query(usage(wid), where('uid', '==', uid)) : null, `${wid}/aiUsage/mine/${uid}`)
  const shared = useQuery<AiUsage>(
    wid && isOwner ? query(usage(wid), where('keySource', '==', 'workspace')) : null,
    `${wid}/aiUsage/workspace/${isOwner}`,
  )
  const byId = new Map([...mine.data, ...shared.data].map((e) => [e.id, e]))
  return {
    entries: [...byId.values()].sort((a, b) => b.at - a.at),
    isLoading: mine.isLoading || shared.isLoading,
    error: mine.error ?? shared.error,
  }
}
