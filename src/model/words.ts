// Small words every layer writes the same way (D-361): pure, for the views, the ops and the agent alike.

// `1 card`, `3 cards`, `0 cards`; `many` for a word that doesn't take an s (`person`, `people`).
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// `person` / `people`, counted.
export const people = (n: number) => plural(n, 'person', 'people')

// The first word of a name, for a short greeting or a tag (`Ada` from `Ada Lovelace`, `ada` from `ada@x.com`).
export const firstName = (name: string) => name.trim().split(/[\s@]+/)[0] ?? ''

// An invite code as it's shown and copied: `ABCD-EFGH` (D-062).
export const codeText = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`
