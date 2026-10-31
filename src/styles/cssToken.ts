// A CSS token's value for TS that has to count in pixels (D-325): a tooltip's offset, a tray's top. tokens.css stays
// the one source; this reads the value from <html> once and keeps it (spacing and sizes don't change with the theme).
// Browser only. For a style, write the token itself (`'var(--space-2)'`), not its number.
const known = new Map<string, number>()

export function tokenPx(name: `--${string}`): number {
  let v = known.get(name)
  if (v === undefined) {
    v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0
    known.set(name, v)
  }
  return v
}

// A token's raw text (`13px`, a font stack), for what wants it whole: a canvas's font.
export const tokenText = (name: `--${string}`) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
