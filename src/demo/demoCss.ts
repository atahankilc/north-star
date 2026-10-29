// The demo realm's CSS states (D-315): the director's cursor sends made-up events, which the browser never answers with
// `:hover`, and a script's focus after a made-up click shows `:focus-visible` where a real click wouldn't. So in the
// demo's CSS only (never the app's), every `:hover` also matches `[data-demo-hover]` (the director puts it on what's under
// its cursor and the elements round it), and `:focus-visible` doesn't match while the pointer was the last input
// (`html[data-demo-input=pointer]`, as after a real click). In the coach's frame the focus is never really taken (the
// director marks the field instead), so `:focus` and `:focus-within` also match `[data-demo-focus]` and
// `[data-demo-focus-within]`.
// The demo's build rewrites its CSS with `demoStates` (a PostCSS step, vite.demo.config.ts); the dev server serves the
// app's own CSS to demo.html too, so there the demo page rewrites its style sheets as they arrive (`watchDemoCss`).

const HOVER = /:hover(?![\w-])/g
const FOCUS_VISIBLE = /:focus-visible(?![\w-])/g
const FOCUS = /:focus(?![\w-])/g
const FOCUS_WITHIN = /:focus-within(?![\w-])/g
const DONE = '[data-demo-'

export function demoSelector(selector: string): string {
  // Already rewritten, or one of the demo's own rules (Stage.module.css: the browser's own ring off).
  if (selector.includes(DONE) || /data-demo-input=['"]?pointer/.test(selector)) return selector
  return selector
    .replace(HOVER, ':is(:hover, [data-demo-hover])')
    .replace(FOCUS_VISIBLE, ':is(:focus-visible, [data-demo-focus]):not(:is(html[data-demo-input=pointer] *))')
    .replace(FOCUS, ':is(:focus, [data-demo-focus])')
    .replace(FOCUS_WITHIN, ':is(:focus-within, [data-demo-focus-within])')
}

// The PostCSS plugin (typed loosely: PostCSS is Vite's, not a dependency of the app).
export const demoStates = () => ({
  postcssPlugin: 'north-star-demo-states',
  Rule(rule: { selector: string }) {
    if (rule.selector.includes(':hover') || rule.selector.includes(':focus')) rule.selector = demoSelector(rule.selector)
  },
})
demoStates.postcss = true

// Dev only: the page's style sheets rewritten in place, now and as Vite adds or replaces them.
function rewrite(rules: CSSRuleList) {
  for (const r of Array.from(rules)) {
    if (r instanceof CSSStyleRule && (r.selectorText.includes(':hover') || r.selectorText.includes(':focus'))) {
      const next = demoSelector(r.selectorText)
      if (next !== r.selectorText) r.selectorText = next
    }
    if ('cssRules' in r && (r as CSSGroupingRule).cssRules) rewrite((r as CSSGroupingRule).cssRules)
  }
}
function sweep() {
  for (const s of Array.from(document.styleSheets)) {
    try {
      rewrite(s.cssRules)
    } catch {
      // Not readable (another origin): nothing of ours.
    }
  }
}
export function watchDemoCss() {
  sweep()
  new MutationObserver(sweep).observe(document.head, { childList: true, subtree: true, characterData: true })
  document.addEventListener('load', (e) => void ((e.target as Element)?.tagName === 'LINK' && sweep()), true)
}
