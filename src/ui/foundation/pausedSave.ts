// Saving while typing, written once (D-330, D-388): what is typed is kept after a pause of AUTOSAVE_MS, when the tab is
// hidden, and when whoever holds it goes. Canvas text (TextItems), a document's page (DocEditor) and AutosaveField
// stand on it; each had its own timer, and they had drifted (400 vs 500 ms, one never saving on a hidden tab).
import { useEffect, useRef } from 'react'
import { AUTOSAVE_MS } from './feel'

export type PausedSave = {
  /** Something changed: save after `ms` without another change. */
  later: (ms?: number) => void
  /** Save now if something is waiting (a blur, Enter). */
  flush: () => void
  /** Whoever held it is going: save what's waiting and stop listening. */
  close: () => void
}

// `save` should write only what differs from what it last wrote: it also runs when nothing new was typed since.
export function pausedSave(save: () => void): PausedSave {
  let timer: ReturnType<typeof setTimeout> | undefined
  let waiting = false
  const flush = () => {
    clearTimeout(timer)
    timer = undefined
    if (!waiting) return
    waiting = false
    save()
  }
  const hidden = () => document.visibilityState === 'hidden' && flush()
  document.addEventListener('visibilitychange', hidden)
  return {
    later: (ms = AUTOSAVE_MS) => {
      waiting = true
      clearTimeout(timer)
      timer = setTimeout(flush, ms)
    },
    flush,
    close: () => {
      document.removeEventListener('visibilitychange', hidden)
      flush()
    },
  }
}

// The same for a component: the latest `save` each time, closed (so saved) when it unmounts.
export function usePausedSave(save: () => void): Pick<PausedSave, 'later' | 'flush'> {
  const latest = useRef(save)
  latest.current = save
  const held = useRef<PausedSave | null>(null)
  // Made in the effect, not in render: dev mounts twice, and a closed one must not be used again.
  const api = useRef<Pick<PausedSave, 'later' | 'flush'>>({ later: (ms) => held.current?.later(ms), flush: () => held.current?.flush() })
  useEffect(() => {
    const p = pausedSave(() => latest.current())
    held.current = p
    return () => {
      held.current = null
      p.close()
    }
  }, [])
  return api.current
}

// `save` runs a pause after `deps` last changed (and when the tab is hidden or the component goes).
export function useWhilePaused(save: () => void, deps: unknown[]) {
  const { later } = usePausedSave(save)
  useEffect(() => {
    later()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
