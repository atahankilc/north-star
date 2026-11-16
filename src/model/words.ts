// Small words every layer writes the same way (D-361): pure, for the views, the ops and the agent alike.

// `1 card`, `3 cards`, `0 cards`; `many` for a word that doesn't take an s (`person`, `people`).
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// `person` / `people`, counted.
export const people = (n: number) => plural(n, 'person', 'people')

// The first word of a name, for a short greeting or a tag (`Ada` from `Ada Lovelace`, `ada` from `ada@x.com`).
export const firstName = (name: string) => name.trim().split(/[\s@]+/)[0] ?? ''

// An invite code as it's shown and copied: `ABCD-EFGH` (D-062).
export const codeText = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`

// Text on one line: every run of spaces and line ends one space, none at the ends.
export const flat = (s: string) => s.replace(/\s+/g, ' ').trim()
// Text no longer than `n`, ending in `…` when it was (D-361's round 2: written about twenty times).
export const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
// What's kept of text that came from outside (a model's answer, a saved chat): one line, at most `n`; nothing if it
// isn't text.
export const kept = (s: unknown, n: number) => (typeof s === 'string' ? flat(s).slice(0, n) : '')
// A name as typed by a person or a model, to compare: no quotes round it, one line, lower case.
export const norm = (s: string) => s.trim().replace(/^["'`]+|["'`]+$/g, '').replace(/\s+/g, ' ').toLowerCase()
// A name's leading number, apart (D-266): `04 Rivals` → `04`, `Rivals`; `null` when it starts with none.
export function leadingNumber(name: string): { num: string; rest: string } | null {
  const m = /^(\d{1,4})(?:[\s.·:—–-]+(.*))?$/.exec(name.trim())
  return m ? { num: m[1], rest: m[2] ?? '' } : null
}
// The signed-in person as a name on what they make (a note, a document, a member's row): their name, else their
// email (D-361's round 2: written about twelve times, `Someone` and `someone`).
export const authorName = (user: { name?: string | null; email?: string | null } | null | undefined) => user?.name || user?.email || 'Someone'
