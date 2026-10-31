// Every example file (D-324, gallery.md §4): `*.gallery.tsx` anywhere under src/, found by Vite; no list to keep.
import { CATEGORIES, type Category, type Example } from './example'

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
export const MAP: Spot[] = (() => {
  const spots = new Map<string, Spot>()
  for (const e of ENTRIES)
    for (const place of [e.place, ...(e.also ?? [])]) {
      const [category, group] = place.split('/') as [Category, string]
      const spot = spots.get(place) ?? { category, group, entries: [] }
      spot.entries.push(e)
      spots.set(place, spot)
    }
  return [...spots.values()].sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.group.localeCompare(b.group))
})()

export const entryById = (id: string | null) => ENTRIES.find((e) => e.id === id)
export const stateSlug = slug
