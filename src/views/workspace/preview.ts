// The assistant's preview (D-087): while it's open, every view shows the workspace as it would be with the proposal's
// ticked changes applied, and nothing can be written. `useWs()` hands out the previewed workspace everywhere except
// inside <OutsidePreview> (the assistant's own window, which must keep seeing the real one).
import { createContext } from 'react'
import { create } from 'zustand'
import type { Simulation } from '../../ai/simulate'
import { setReadOnly } from '../../data/history'
import { usePreviewFocus, useStage } from './stage'

// What a change does to an item (or a matrix cell, or a label), shown on it in every view.
export type Mark = 'new' | 'edited' | 'moved' | 'deleted'

type PreviewState = {
  // The chat message whose proposal is shown; null when closed.
  messageId: number | null
  sim: Simulation | null
  count: number
  show: (messageId: number, sim: Simulation, count: number) => void
  close: () => void
}

const READ_ONLY = 'This is a preview: nothing changes here. Close it (Esc) to edit.'

export const usePreview = create<PreviewState>((set) => ({
  messageId: null,
  sim: null,
  count: 0,
  show: (messageId, sim, count) => {
    setReadOnly(READ_ONLY)
    set({ messageId, sim, count })
  },
  close: () => {
    setReadOnly(null)
    usePreviewFocus.setState({ lit: null, step: null })
    set({ messageId: null, sim: null, count: 0 })
  },
}))

// The marks as diff signs in diff colours (D-096): the checklist's own signs, never the type colours.
export const MARK_SIGN: Record<Mark, string> = { new: '+', edited: '~', moved: '→', deleted: '−' }
export const MARK_VAR: Record<Mark, string> = { new: 'var(--diff-new)', edited: 'var(--diff-edited)', moved: 'var(--diff-moved)', deleted: 'var(--diff-deleted)' }

// An edit's old value in a few words (D-096), for places with room for one line: the title if it changed, else the
// first field that did.
const FIELD_WORD: Record<string, string> = { body: 'notes', description: 'description', notes: 'notes', tags: 'tags', priority: 'priority', status: 'status', effort: 'effort', url: 'url', pricing: 'pricing', audience: 'audience', text: 'was' }
export function wasLine(before: Record<string, unknown> | undefined): { label: string; value: string } | undefined {
  if (!before) return undefined
  const key = ['title', 'name', 'text'].find((k) => k in before) ?? Object.keys(before)[0]
  if (!key) return undefined
  const v = before[key]
  const value = Array.isArray(v) ? (v.length ? v.map((t) => `#${t}`).join(' ') : '—') : v === undefined || v === null || v === '' ? '—' : String(v).replace(/\s+/g, ' ').trim()
  const word = FIELD_WORD[key]
  return { label: !word || word === 'was' ? 'was' : `${word} was`, value }
}

// Asked for or still on the stage (D-094): either way nothing may start an edit.
export const isPreviewing = () => usePreview.getState().sim !== null || useStage.getState().preview !== null

export const OutsidePreview = createContext(false)
