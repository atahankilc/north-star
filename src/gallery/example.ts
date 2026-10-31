// The component gallery (D-324, docs/specs/gallery.md §4): what an example file (`X.gallery.tsx` beside `X.tsx`) says.
// A component's states, each a render function or one with more to it; the gallery finds the files itself
// (registry.ts) and mounts a state fresh each time it's picked (Mount.tsx).
import type { ReactNode } from 'react'
import type { Store } from '../state/wsStore'
import type { WorkspaceCtx } from '../state/wsStore'

export type Section = 'ui' | 'canvas' | 'panels' | 'screens' | 'onboarding'

// What a state's `setup` gets, once the state is drawn.
export type GalleryCtx = {
  // The example's own box (what it drew is inside it, but for what it put in the body: a portal).
  root: HTMLElement
  // The made-up workspace (set + tell to change it).
  store: Store
  // A real click on the first element matching `sel` (in the example, then the whole page): a person's click.
  click: (sel: string) => void
  // A key pressed where the focus is (or on `sel`).
  key: (key: string, sel?: string) => void
  // Text typed into the focused field (or `sel`), as React hears it.
  type: (text: string, sel?: string) => void
  // Wait, ms.
  wait: (ms: number) => Promise<void>
}

export type StateSpec = {
  render: () => ReactNode
  // After the first frame: open it, type in it… as a person would.
  setup?: (c: GalleryCtx) => void | Promise<void>
  // Held hovered: every element matching it gets `[data-demo-hover]`, which every `:hover` also matches (demoCss.ts).
  hover?: string
  // The made-up workspace with its id and doc (default: tiny, src/demo/fixtures/tiny.ts; Pazar's in canvas.tsx).
  fixture?: Omit<WorkspaceCtx, 'canvas'>
  // The router's address (`?focus=<id>`), default the made-up workspace's canvas.
  route?: string
  // The example's box: `[w, h]` css px, or `full` (the middle's whole size; for what places itself on the screen: the
  // HUD, a side panel, the toast). Default: as big as it draws, in the middle.
  size?: [number, number] | 'full'
  // A line about this state, under the bar.
  note?: string
}
export type State = (() => ReactNode) | StateSpec

export type Example = {
  name: string
  section: Section
  // The component's file, from the repo's root.
  file: string
  // A line about the component.
  note?: string
  states: Record<string, State>
}

export const example = (e: Example): Example => e

export const specOf = (s: State): StateSpec => (typeof s === 'function' ? { render: s } : s)
