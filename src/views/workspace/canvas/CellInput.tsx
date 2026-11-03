// A value typed in place in a grid's cell (a matrix's number or text, a table's own column; D-361: each had its own):
// it has the keyboard at once; Enter or leaving keeps it, Escape drops it. A number reads `,` as `.`; what isn't one is
// refused (`null`, the cell left as it was), as is Escape; nothing typed clears the cell (`undefined`).
type Props = {
  className?: string
  label: string
  numeric: boolean
  initial: string
  max: number
  onTyped: (value: string | number | undefined | null) => void
}

export function CellInput({ className, label, numeric, initial, max, onTyped }: Props) {
  return (
    <input /* kit-ok: a value typed in place in its world-sized cell, the cell's own face */
      className={className}
      autoFocus
      aria-label={label}
      inputMode={numeric ? 'decimal' : undefined}
      defaultValue={initial}
      maxLength={max}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          e.currentTarget.dataset.cancel = 'true'
          e.currentTarget.blur()
        }
      }}
      onBlur={(e) => {
        if (e.currentTarget.dataset.cancel) return onTyped(null)
        const raw = e.currentTarget.value.trim()
        if (!numeric) return onTyped(raw || undefined)
        const n = Number(raw.replace(',', '.'))
        onTyped(raw === '' ? undefined : Number.isFinite(n) ? n : null)
      }}
    />
  )
}
