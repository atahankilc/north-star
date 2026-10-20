// The assistant's workspace key and usage log (D-079). The key itself never reaches a browser: the owner hands it to
// setWorkspaceKey once, and members call OpenAI through the `ai` function. Rules: firestore.rules (ai, aiUsage, aiSecrets).
import { addDoc, collection, doc, getDocs, orderBy, query, setDoc, where, type Query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { useAuth } from './auth'
import { aiProxyUrl, db, firebase, useEmulators } from './firebase'
import { useDoc, usePaged } from './hooks'

// The workspace key needs our Cloud Functions, which need the Blaze plan (D-079). Until they're deployed on the live
// project, the feature is shown only on the emulators. Set to true in the same change that runs `npm run deploy:functions`.
const WORKSPACE_KEYS_LIVE = false
export const workspaceKeysAvailable = useEmulators || WORKSPACE_KEYS_LIVE

export type KeyAccess = 'everyone' | 'chosen'

// workspaces/{wid}/ai/config. hasKey and keyHint are written by the server only.
// `models`: the owners' model per task on the workspace key; `allowedModels`: others members may switch to (D-104).
// The server refuses any other model on this key.
export type AiConfig = {
  hasKey?: boolean
  keyHint?: string
  keySetAt?: number
  access?: KeyAccess
  allowed?: string[]
  models?: Partial<Record<'chat' | 'research' | 'deep', string>>
  allowedModels?: string[]
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

const configPath = (wid: string) => `workspaces/${wid}/ai/config`

export function useAiConfig(wid: string | null) {
  return useDoc<AiConfig>(wid ? configPath(wid) : null)
}

// May this person use the workspace key? Owners always may (D-098: any of them). The server checks the same on every call.
export function canUseWorkspaceKey(config: AiConfig | null | undefined, uid: string | undefined, owner: boolean): boolean {
  if (!workspaceKeysAvailable || !config?.hasKey || !uid) return false
  return owner || config.access === 'everyone' || (config.allowed ?? []).includes(uid)
}

export function setKeyAccess(wid: string, access: KeyAccess, allowed: string[]) {
  return setDoc(doc(db(), configPath(wid)), { access, allowed }, { merge: true })
}

// Owners: the workspace key's model for one task, and the models members may switch to (D-104).
export function setWorkspaceModels(wid: string, patch: Pick<AiConfig, 'models' | 'allowedModels'>) {
  return setDoc(doc(db(), configPath(wid)), patch, { merge: true })
}

// Owners: is this model there for the workspace key? A free call made by the server with the key (D-104).
export async function checkWorkspaceModel(wid: string, model: string): Promise<void> {
  await call<{ wid: string; model: string }, { ok: true }>('checkWorkspaceModel')({ wid, model })
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

const usageOf = (wid: string) => collection(db(), 'workspaces', wid, 'aiUsage')

// This month's entries, for the totals (D-098: fetched once when the usage page opens, not kept live): your own on
// either key, and for an owner everyone's on the workspace key. The rules allow exactly these two queries.
export function useUsageMonth(wid: string, isOwner: boolean, since: number) {
  const { user } = useAuth()
  const uid = user?.id
  const [state, setState] = useState<{ mine: AiUsage[]; shared: AiUsage[]; isLoading: boolean; error: Error | null }>({
    mine: [],
    shared: [],
    isLoading: true,
    error: null,
  })
  useEffect(() => {
    if (!uid) return
    let live = true
    const month = (q: Query) => getDocs(query(q, where('at', '>=', since), orderBy('at', 'desc'))).then((s) => s.docs.map((d) => d.data() as AiUsage))
    Promise.all([month(query(usageOf(wid), where('uid', '==', uid))), isOwner ? month(query(usageOf(wid), where('keySource', '==', 'workspace'))) : []])
      .then(([mine, shared]) => live && setState({ mine, shared, isLoading: false, error: null }))
      .catch((error: Error) => live && setState({ mine: [], shared: [], isLoading: false, error }))
    return () => {
      live = false
    }
  }, [wid, uid, isOwner, since])
  return state
}

export type UsageShow = 'all' | 'workspace' | 'own'

// The call log, newest first, a page at a time (D-098). Which queries depends on what's shown and who you are.
export function useUsageCalls(wid: string, isOwner: boolean, show: UsageShow) {
  const { user } = useAuth()
  const uid = user?.id
  const mine = uid ? query(usageOf(wid), where('uid', '==', uid)) : null
  const queries =
    show === 'own'
      ? [uid ? query(usageOf(wid), where('uid', '==', uid), where('keySource', '==', 'own')) : null]
      : show === 'workspace'
        ? [isOwner ? query(usageOf(wid), where('keySource', '==', 'workspace')) : uid ? query(usageOf(wid), where('uid', '==', uid), where('keySource', '==', 'workspace')) : null]
        : [mine, isOwner ? query(usageOf(wid), where('keySource', '==', 'workspace')) : null]
  return usePaged<AiUsage>(queries, `usage:${wid}:${uid}:${isOwner}:${show}`, 'at', 'desc')
}
