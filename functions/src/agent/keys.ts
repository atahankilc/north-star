// Whose key a run is paid with (D-434, docs/specs/agent-server.md §6). The workspace's (D-427: owners, the editors they
// let, never viewers; the models they ticked) or the person's own: kept in their account, or in their browser and here
// only while the run needs it (`aiSecrets/run_{id}`, gone at its end). A key is opened only here, in the worker's memory.
import type { Firestore } from 'firebase-admin/firestore'
import type { AgentModel } from '../../../src/agent/contract'
import { cacheKeyOf, effortFor, providerOf } from '../../../src/agent/models'
import { openaiModel, type Effort } from '../../../src/agent/openai'
import { mayUseKey, type Access, type Workspace } from '../access'
import { modelsAllowed } from '../request'
import { CLAUDE_KEY, OPENAI_KEY, seal, unseal, type Box } from '../seal'
import type { PaidBy } from './ask'
import { Refused, type Run } from './runs'

export type Provider = 'openai' | 'anthropic'
const bare = (model: string) => model.replace(/^(anthropic|openai):/, '')
const NAME: Record<Provider, string> = { openai: 'OpenAI', anthropic: 'Claude' }

export const wsSecret = (db: Firestore, wid: string) => db.doc(`aiSecrets/${wid}`)
export const runSecret = (db: Firestore, run: string) => db.doc(`aiSecrets/run_${run}`)
export const ownSecret = (db: Firestore, uid: string, p: Provider) => db.doc(`aiSecrets/user_${uid}_${p}`)
export const ownKeys = (db: Firestore, uid: string) => db.doc(`users/${uid}/private/aiKeys`)

export const keyLooksRight = (key: string, p: Provider) => (p === 'openai' ? OPENAI_KEY : CLAUDE_KEY).test(key)

type AiConfig = { hasKey?: boolean; access?: Access; allowed?: string[]; allowedModels?: string[] }

// Whether this person may pay this way for this model; says why not, before anything starts.
export async function mayPay(db: Firestore, o: { uid: string; wid: string; paidBy: PaidBy; model: string; key?: string }): Promise<Provider> {
  const provider = providerOf(o.model)
  if (o.paidBy === 'workspace') {
    if (provider !== 'openai') throw new Refused("The workspace's key runs OpenAI models only.")
    const [w, c] = await Promise.all([db.doc(`workspaces/${o.wid}`).get(), db.doc(`workspaces/${o.wid}/ai/config`).get()])
    const ws = w.data() as Workspace | undefined
    const config = (c.data() ?? {}) as AiConfig
    if (!config.hasKey) throw new Refused('This workspace has no key (Settings → workspace → agent key).')
    if (!ws || !mayUseKey(ws, o.uid, config)) throw new Refused(ws?.roles?.[o.uid] === 'viewer' ? 'Viewers use their own key.' : "The owners haven't let you use the workspace key (Settings → workspace → agent key).", 'permission-denied')
    if (!modelsAllowed(config).has(bare(o.model))) throw new Refused(`The owners haven't allowed ${bare(o.model)} on the workspace key (Settings → workspace → agent key).`)
    return provider
  }
  if (o.key) {
    if (!keyLooksRight(o.key, provider)) throw new Refused(`That doesn't look like ${provider === 'openai' ? 'an OpenAI' : 'a Claude'} key.`)
    return provider
  }
  if (!(await ownSecret(db, o.uid, provider).get()).exists) throw new Refused(`Add your ${NAME[provider]} key in Settings → the agent first.`)
  return provider
}

export const keepRunKey = (db: Firestore, run: string, key: string, secret: string, now: number) => runSecret(db, run).set({ ...seal(key, secret), runAt: now })
export async function passRunKey(db: Firestore, run: string, next: string): Promise<void> {
  const box = (await runSecret(db, run).get()).data()
  if (box) await runSecret(db, next).set(box)
}
export const dropRunKey = async (db: Firestore, run: string) => void (await runSecret(db, run).delete())

// The model a run talks to, on its key. Who may pay is asked again: the owners may have changed their mind since.
export async function modelFor(db: Firestore, run: Run & { id: string }, o: { secret: string; safetyId: string; openai?: string }): Promise<AgentModel> {
  let box: Box | undefined
  if (run.paidBy === 'workspace') {
    await mayPay(db, { uid: run.uid, wid: run.wid, paidBy: 'workspace', model: run.model })
    box = (await wsSecret(db, run.wid).get()).data() as Box | undefined
  } else {
    box = (await runSecret(db, run.id).get()).data() as Box | undefined
    box ??= (await ownSecret(db, run.uid, run.provider).get()).data() as Box | undefined
  }
  if (!box) throw new Refused(run.paidBy === 'workspace' ? 'This workspace has no key.' : 'Your key is gone from the server; send the message again.')
  const key = unseal(box, o.secret)
  const effort = effortFor(run.model) ? ((run.effort as Effort | undefined) ?? effortFor(run.model)) : null
  if (run.provider === 'anthropic') return (await import('../../../src/agent/anthropic')).anthropicModel({ key, model: bare(run.model), effort })
  return openaiModel({ key, model: bare(run.model), reasoning: effort, cacheKey: cacheKeyOf(run.wid), safetyId: o.safetyId, ...(o.openai ? { baseUrl: o.openai } : {}) })
}
