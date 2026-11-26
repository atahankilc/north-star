// Keys at rest (D-079, D-427, D-434): AES-256-GCM with a key derived from a secret. Cloud KMS takes its place before the
// lab's key is opened to anyone (docs/specs/agent-server.md §6.3); `v` says which way a box was sealed.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

export type Box = { data: string; iv: string; tag: string; v?: 1 }

const keyOf = (secret: string) => createHash('sha256').update(secret).digest()

export function seal(text: string, secret: string): Box {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', keyOf(secret), iv)
  const data = Buffer.concat([c.update(text, 'utf8'), c.final()])
  return { data: data.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), v: 1 }
}

export function unseal(box: Box, secret: string): string {
  const d = createDecipheriv('aes-256-gcm', keyOf(secret), Buffer.from(box.iv, 'base64'))
  d.setAuthTag(Buffer.from(box.tag, 'base64'))
  return Buffer.concat([d.update(Buffer.from(box.data, 'base64')), d.final()]).toString('utf8')
}

// Anything shaped like a provider's key, out of a text that may be logged or shown.
export const scrub = (text: string) => text.replace(/\b(sk|sess|rk)-[A-Za-z0-9_*.-]+/g, 'sk-…')

export const keyHint = (key: string) => `${key.slice(0, 3)}…${key.slice(-4)}`
export const OPENAI_KEY = /^sk-(?!ant-)[A-Za-z0-9_-]{20,300}$/
export const CLAUDE_KEY = /^sk-ant-[A-Za-z0-9_-]{20,300}$/
