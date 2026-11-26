// The workspace key's settings, written by owners through a function (D-434) so every change is in the audit log: who
// may use it, which models, and its month's limits per person and in total (euro cents; null: none).
import type { Firestore } from 'firebase-admin/firestore'
import { audited } from './audit'

export const LIMIT_MAX_CENTS = 1_000_000_00
const MODEL_ID = /^[A-Za-z0-9._:-]{1,100}$/
const UID = /^[A-Za-z0-9_-]{1,128}$/

export class BadSetting extends Error {}

export type WsAiPatch = { access?: 'everyone' | 'chosen'; allowed?: string[]; allowedModels?: string[]; limits?: { person?: number | null; total?: number | null } }

export function readPatch(data: unknown, o: { allowedMax: number; modelsMax: number }): { wid: string; patch: WsAiPatch } {
  const d = (data ?? {}) as Record<string, unknown>
  if (typeof d.wid !== 'string' || !/^[A-Za-z0-9]{1,128}$/.test(d.wid)) throw new BadSetting('No such workspace.')
  const patch: WsAiPatch = {}
  if (d.access !== undefined) {
    if (d.access !== 'everyone' && d.access !== 'chosen') throw new BadSetting('Who may use it: everyone or chosen.')
    patch.access = d.access
  }
  if (d.allowed !== undefined) {
    if (!Array.isArray(d.allowed) || d.allowed.length > o.allowedMax || !d.allowed.every((x) => typeof x === 'string' && UID.test(x))) throw new BadSetting('Who may use it: a list of people.')
    patch.allowed = [...new Set(d.allowed as string[])]
  }
  if (d.allowedModels !== undefined) {
    if (!Array.isArray(d.allowedModels) || d.allowedModels.length > o.modelsMax || !d.allowedModels.every((x) => typeof x === 'string' && MODEL_ID.test(x))) throw new BadSetting('Models: a list of model ids.')
    patch.allowedModels = [...new Set(d.allowedModels as string[])]
  }
  if (d.limits !== undefined) {
    const l = (d.limits ?? {}) as Record<string, unknown>
    const cents = (v: unknown) => (v === null ? null : typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= LIMIT_MAX_CENTS ? v : (() => { throw new BadSetting('A limit is whole euro cents, or none.') })())
    patch.limits = { ...(l.person !== undefined ? { person: cents(l.person) } : {}), ...(l.total !== undefined ? { total: cents(l.total) } : {}) }
  }
  return { wid: d.wid, patch }
}

type Config = { access?: string; allowed?: string[]; allowedModels?: string[]; limits?: { person?: number; total?: number } }

// The patch on the config, in a transaction with its audit entry: only what changed is told.
export async function setWsAi(db: Firestore, by: string, wid: string, patch: WsAiPatch): Promise<Config> {
  const ref = db.doc(`workspaces/${wid}/ai/config`)
  return audited(db, async (tx) => {
    const was = ((await tx.get(ref)).data() ?? {}) as Config
    const limits = { ...(was.limits ?? {}) }
    for (const k of ['person', 'total'] as const) {
      const v = patch.limits?.[k]
      if (v === null) delete limits[k]
      else if (v !== undefined) limits[k] = v
    }
    const next: Config = { ...was, ...(patch.access ? { access: patch.access } : {}), ...(patch.allowed ? { allowed: patch.allowed } : {}), ...(patch.allowedModels ? { allowedModels: patch.allowedModels } : {}), ...(patch.limits ? { limits } : {}) }
    const changed = (['access', 'allowed', 'allowedModels', 'limits'] as const).filter((k) => JSON.stringify(was[k] ?? null) !== JSON.stringify(next[k] ?? null))
    if (!changed.length) return { entry: null, value: next }
    tx.set(ref, next)
    const pick = (c: Config) => Object.fromEntries(changed.map((k) => [k, c[k] ?? null]))
    return { entry: { what: `workspace key: ${changed.join(', ')}`, by, wid, from: pick(was), to: pick(next) }, value: next }
  })
}
