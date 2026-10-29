// A small JSON Schema check for the stand-in `change` tool (S11): the subset the ops registry's ArgSchema uses (type,
// enum, anyOf, items, properties, required). An object schema with `properties` refuses keys it doesn't list (the
// registry's schemas are closed, agent-run.md "S13 must"); one without (`setup`) takes anything. Errors read as paths.
import type { ArgSchema } from '../src/ops/registry'

const typeOf = (v: unknown): string => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'number' ? (Number.isInteger(v) ? 'integer' : 'number') : typeof v)
const fits = (t: string, actual: string) => t === actual || (t === 'number' && actual === 'integer')

export function checkArgs(v: unknown, s: ArgSchema, path = 'args'): string[] {
  if (s.anyOf) {
    const each = s.anyOf.map((b) => checkArgs(v, b, path))
    if (each.some((e) => !e.length)) return []
    return [`${path}: fits none of its forms (${each.map((e) => e[0]).join(' | ')})`]
  }
  const types = s.type === undefined ? [] : Array.isArray(s.type) ? s.type : [s.type]
  const actual = typeOf(v)
  if (types.length && !types.some((t) => fits(t, actual))) return [`${path}: ${actual} where ${types.join(' or ')} goes`]
  if (s.enum && !s.enum.includes(v as string | number)) return [`${path}: ${JSON.stringify(v)} is not one of ${s.enum.join(', ')}`]
  const out: string[] = []
  if (actual === 'array' && s.items) (v as unknown[]).forEach((x, i) => out.push(...checkArgs(x, s.items!, `${path}[${i}]`)))
  if (actual === 'object' && s.properties) {
    const o = v as Record<string, unknown>
    for (const k of s.required ?? []) if (o[k] === undefined) out.push(`${path}.${k}: required`)
    for (const [k, x] of Object.entries(o)) {
      const sub = s.properties[k]
      if (!sub) out.push(`${path}.${k}: not taken here (it takes ${Object.keys(s.properties).join(', ')})`)
      else if (x !== undefined) out.push(...checkArgs(x, sub, `${path}.${k}`))
    }
  }
  return out
}
