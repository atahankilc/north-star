// Values worked out at run time that a few elements read as custom properties: how far the main screen has drawn back
// (sheet.ts), a dragged panel's width (panelWidth.ts), the agent's column's (Agent.tsx). Never written on <html>: a
// custom property there is inherited by everything, and each change has the browser work out the style of every
// element on the page again, the canvas's thousands too (24 ms against 1 on a small canvas), in the frame a panel opens
// or at every step of a drag. They are rules in a style sheet of their own, for the elements that say they read them:
//   `sheet`  `[data-sheet]`: what rides the sheet (the HUD's bar and rail, the foot's console and tabs, a docked column)
//   `app`    those and the app's box (`[data-app]`), which holds the whole canvas: only for a property registered with
//            `inherits: false`, or everything in the app is restyled after all
// tests/unit/sheetReaders.test.ts holds a style that reads one to its mark, and these names off the root.
const SELECTOR = { sheet: '[data-sheet]', app: '[data-sheet],[data-app]' } as const
type Scope = keyof typeof SELECTOR

const values = new Map<string, string>()
const heard = new Set<() => void>()
let rules: Record<Scope, CSSStyleRule> | null = null

function made(): Record<Scope, CSSStyleRule> {
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(`${SELECTOR.sheet}{}${SELECTOR.app}{}`)
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
  return { sheet: sheet.cssRules[0] as CSSStyleRule, app: sheet.cssRules[1] as CSSStyleRule }
}

// Written only when it changes; those who asked hear of it.
export function setPageValue(name: `--${string}`, value: string, scope: Scope = 'sheet') {
  if (values.get(name) === value) return
  values.set(name, value)
  ;(rules ??= made())[scope].style.setProperty(name, value)
  for (const fn of [...heard]) fn()
}

export const pageValue = (name: `--${string}`) => values.get(name)

// Told after any of them changes (what's placed by measuring the page: the agent's tab, clear of a panel).
export function onPageValue(fn: () => void) {
  heard.add(fn)
  return () => void heard.delete(fn)
}
