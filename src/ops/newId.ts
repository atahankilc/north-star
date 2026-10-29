// New doc ids as Firestore makes them (its autoId: 20 characters of A–Z a–z 0–9 from a secure random source, no modulo
// bias), without Firebase, so an op knows a new thing's id before anything is written. Called `autoId` so it's never
// taken for model/scales.ts' 6-character `newId` (a setup's own entries). Injectable for tests (OpCtx.newId).
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
// The largest multiple of 62 under 256: bytes from here up are thrown away, so every character is as likely.
const MAX_MULTIPLE = Math.floor(256 / CHARS.length) * CHARS.length

export type RandomBytes = (n: number) => Uint8Array

const secure: RandomBytes = (n) => crypto.getRandomValues(new Uint8Array(n))

export function autoId(random: RandomBytes = secure): string {
  let id = ''
  while (id.length < 20) {
    for (const b of random(40)) if (b < MAX_MULTIPLE && id.length < 20) id += CHARS.charAt(b % CHARS.length)
  }
  return id
}

// Ids that come out the same every run (`id001`, `id002`…), for tests and fixtures.
export function counterIds(prefix = 'id'): () => string {
  let n = 0
  return () => `${prefix}${String(++n).padStart(3, '0')}`
}
