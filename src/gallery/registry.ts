// Every example file (D-324, gallery.md §4): `*.gallery.tsx` anywhere under src/, found by Vite; no list to keep.
import { type Category, type Example } from './example'

const files = import.meta.glob<{ default: Example }>('/src/**/*.gallery.tsx', { eager: true })

export type Entry = Example & { id: string; path: string }

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export const ENTRIES: Entry[] = Object.entries(files)
  .map(([path, m]) => ({ ...m.default, id: slug(m.default.name), path }))
  .sort((a, b) => a.name.localeCompare(b.name))

// The map: every place (category/group) in the building's order, groups by name, with what's there (an example may be
// in several).
export type Spot = { category: Category; group: string; entries: Entry[] }

export const stateSlug = slug
