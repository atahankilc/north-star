// Enter in a wizard (D-250): the next step, or on the last one makes it; ⌘Enter makes it from any step. Not while
// typing in one of its fields: there Enter is the field's own (adding a name).
export function wizardEnter(e: KeyboardEvent, step: number, steps: number, next: (step: number) => void, make: () => void) {
  if (e.key !== 'Enter' || e.isComposing) return
  if (e.metaKey || e.ctrlKey) return (e.preventDefault(), make())
  if ((e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable]')) return
  e.preventDefault()
  if (step < steps - 1) next(step + 1)
  else make()
}
