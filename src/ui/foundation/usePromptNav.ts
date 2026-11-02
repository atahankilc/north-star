// The prompt's keys (D-222), one copy for every list in the prompt family. The keyboard never leaves the `>` line: ↑ ↓
// move what's picked (round the ends), Home / End jump, Enter picks it (with whether shift or alt was held), → opens
// the picked row's fold and ← shuts it, Escape closes and gives focus back, Tab closes and lets focus go on. What's
// picked is the first row until the keys or the pointer move it (`start`: a Select's current value), so Enter always
// has something to pick. The pointer and the keys move the same pick: never two rows lit.
import { useMemo, useState, type KeyboardEvent } from 'react'
import { labelText, pickable, type How, type PromptEntry, type PromptItem } from './promptModel'

type Options = {
  onPick: (item: PromptItem, how: How) => void
  // `refocus`: give focus back to what opened it (Escape), or let it go on (Tab).
  onClose: (refocus?: boolean) => void
  start?: string | null
  // With no `>` line (a short Select): a letter jumps to the next row starting with it.
  letters?: boolean
}

export function usePromptNav(shown: PromptEntry[], { onPick, onClose, start, letters }: Options) {
  const rows = useMemo(() => pickable(shown), [shown])
  const [chosen, setPicked] = useState<string | null>(start ?? null)
  const at = rows.findIndex((r) => r.key === chosen)
  const now: PromptItem | undefined = at >= 0 ? rows[at] : rows[0]

  const onKeyDown = (e: KeyboardEvent) => {
    const go = (n: number) => rows.length && setPicked(rows[(n + rows.length) % rows.length].key)
    const i = at >= 0 ? at : 0
    if (e.key === 'ArrowDown') (e.preventDefault(), go(i + 1))
    else if (e.key === 'ArrowUp') (e.preventDefault(), go(i - 1))
    else if (e.key === 'Home') (e.preventDefault(), go(0))
    else if (e.key === 'End') (e.preventDefault(), go(rows.length - 1))
    else if (e.key === 'Enter' && now && !e.nativeEvent.isComposing) (e.preventDefault(), onPick(now, { shift: e.shiftKey, alt: e.altKey }))
    else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && now?.fold && now.fold.open === (e.key === 'ArrowLeft')) {
      // Only when the caret is at the field's end, so ← → still move it through what's typed.
      const field = e.target as HTMLInputElement
      if (field.value && field.selectionStart !== field.value.length) return
      e.preventDefault()
      now.fold.onToggle()
    } else if (e.key === 'Escape') (e.preventDefault(), onClose(true))
    else if (e.key === 'Tab') onClose(false)
    else if (letters && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const k = e.key.toLowerCase()
      const starts = (r: PromptItem) => labelText(r).toLowerCase().startsWith(k)
      const next = rows.findIndex((r, n) => n > i && starts(r))
      const to = next >= 0 ? next : rows.findIndex(starts)
      if (to >= 0) (e.preventDefault(), setPicked(rows[to].key))
    }
  }

  return { picked: now?.key ?? null, pickedItem: now ?? null, setPicked, onKeyDown }
}
