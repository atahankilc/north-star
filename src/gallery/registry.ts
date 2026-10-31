// Every example file (D-324, gallery.md §4): `*.gallery.tsx` anywhere under src/, found by Vite; no list to keep.
import type { Example, Section } from './example'

const files = import.meta.glob<{ default: Example }>('/src/**/*.gallery.tsx', { eager: true })

export type Entry = Example & { id: string; path: string }

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export const SECTIONS: Section[] = ['ui', 'canvas', 'panels', 'screens', 'onboarding']

export const ENTRIES: Entry[] = Object.entries(files)
  .map(([path, m]) => ({ ...m.default, id: slug(m.default.name), path }))
  .sort((a, b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) || a.name.localeCompare(b.name))

export const entryById = (id: string | null) => ENTRIES.find((e) => e.id === id)
export const stateSlug = slug
