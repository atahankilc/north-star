// A CSS token's value for TS that has to count in pixels (D-325): a tooltip's offset, a tray's top. tokens.css stays
// the one source; this reads the value once and keeps it until the interface's size changes (D-417: sizes are
// `calc(Npx * var(--ui))`, which getPropertyValue hands back unevaluated, so a probe on the page measures it).
// Browser only. For a style, write the token itself (`'var(--space-2)'`), not its number.
const known = new Map<string, number>()
let probe: HTMLElement | null = null

// The page's size: the number on the screen (what's at screen size, outside a world).
export function tokenPx(name: `--${string}`): number {
  let v = known.get(name)
  if (v === undefined) {
    if (!probe) {
      probe = document.createElement('div')
      probe.setAttribute('aria-hidden', 'true')
      probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;height:0;left:0;top:0'
      document.documentElement.appendChild(probe)
    }
    probe.style.width = `var(${name})`
    v = parseFloat(getComputedStyle(probe).width) || 0
    known.set(name, v)
  }
  return v
}

// The interface's size (D-417): the factor every screen token is multiplied by.
const uiScale = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-page')) || 1

// A token's number inside a world (a canvas, a plane, a piece's contents), where `--ui` is 1: canvas px.
export const worldPx = (name: `--${string}`) => tokenPx(name) / uiScale()

// Called when the interface's size changes (src/state/display.ts).
export const forgetTokens = () => known.clear()

// A token's raw text (a font stack, a colour), for what wants it whole. A size reads tokenPx or worldPx instead.
export const tokenText = (name: `--${string}`) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
