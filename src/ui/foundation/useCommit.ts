// A field's text kept apart from what's stored until it's committed (Enter or leaving it, D-221): a change from
// elsewhere shows unless it's being typed in; leaving (the panel closing) with something typed keeps it. CommitField's
// (D-359; was in CardPanel.tsx).
import { useEffect, useRef, useState } from 'react'

export function useCommit(value: string, save: (v: string) => void) {
  const [draft, setDraft] = useState(value)
  const dirty = useRef(false)
  const latest = useRef({ draft, save, value })
  latest.current = { draft, save, value }
  useEffect(() => {
    if (!dirty.current) setDraft(value)
  }, [value])
  useEffect(
    () => () => {
      const { draft: d, save: s, value: v } = latest.current
      if (dirty.current && d !== v) s(d)
    },
    [],
  )
  return {
    draft,
    setDraft: (v: string) => ((dirty.current = true), setDraft(v)),
    commit: () => {
      if (dirty.current && draft !== value) save(draft)
      dirty.current = false
    },
    revert: () => ((dirty.current = false), setDraft(value)),
  }
}
