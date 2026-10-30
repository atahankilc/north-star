// What O12's scenes share (D-315, onboarding-lessons.md §6 documents, §7 decks and days): a stage looked at closer (a
// part of the screen framed: a wizard's choices, the side view's deck) as a camera on the stage would, the deck's own
// stores put back as each loop starts, and a document's text drawn where its content would be (the demo has no
// Firestore to read it from). Kept apart from kit.ts (O9's) and o10.ts (O10's).
import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { Markdown } from '../../ui/Markdown'
import { useDocUi } from '../../views/workspace/Documents'
import { camOf, setCam } from '../../state/canvasView'
import { isReducedMotion } from '../../state/motion'
import type { Task } from '../../data/tasks'
import { run, type Action } from '../director'

// ——— the stage ———
// CSS for this scene only, over the whole page (its portals too: a wizard, a panel), put in once.
export const pageStyle = (scene: string, css: string): Action =>
  run(() => {
    const id = `demo-o12-${scene}`
    if (document.getElementById(id)) return
    const st = document.createElement('style')
    st.id = id
    st.textContent = css.replaceAll('&', `html:has([data-scene="${scene}"])`)
    document.head.appendChild(st)
  }, 'scene css')
// No HUD (a lesson about one part shows that part).
export const NO_HUD = '& header { display: none !important; }'

// A wizard laid out for a small stage (as O11's): the whole stage, no dimmed margin, the preview beside the questions a
// little narrower, so its words read in the lesson's slot (~246 px wide) as the app's own wizard.
export const wizardCss = `
  & [data-learn="wizard"] { width: 100%; min-height: 100%; height: 100%; border: 0; }
  & body > div:has(> [data-learn="wizard"]) { padding: 0; }
  & [data-learn="wizard"] > div:nth-child(2) { grid-template-columns: minmax(0, 1fr) 200px; overflow: hidden; }
  & [data-learn="wizard"] [aria-label="Preview"] { padding: var(--space-3); border-top: 0; border-left: 1px solid var(--line); }
  & [data-learn="wizard"] [role="tab"] { padding: var(--space-2) var(--space-3); }
`

// ——— a document's text ———
// The text of each made-up document by its title: drawn with the app's own Markdown under its head, where the
// document's content goes (DocContent's article), as it reads once loaded.
let watching: MutationObserver | null = null
export const docText = (texts: Record<string, string>): Action =>
  run(() => {
    const fill = () => {
      for (const art of document.querySelectorAll('article')) {
        const title = art.querySelector('h1')?.textContent?.trim() ?? ''
        const text = texts[title]
        if (!text || art.querySelector(':scope > [data-demo-body]')) continue
        const box = document.createElement('div')
        box.dataset.demoBody = ''
        art.appendChild(box)
        // At once, in the same task: a frame drawn after the stage is made again already has it (the loop's seam).
        const root = createRoot(box)
        flushSync(() => root.render(createElement(Markdown, { text })))
      }
    }
    fill()
    watching?.disconnect()
    watching = new MutationObserver(fill)
    watching.observe(document.body, { childList: true, subtree: true })
  }, 'documents read')

// The first element matching `selector` whose text starts with `words` (kit's byText takes the last), at (ax, ay) in it.
export const firstText = (selector: string, words: string, ax = 0.5, ay = 0.5) => () => {
  const el = [...document.querySelectorAll(selector)].find((e) => (e.textContent ?? '').trim().startsWith(words))
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width * ax, y: r.top + r.height * ay }
}

// Pazar's unfinished tasks a week later: nothing due this week, so no SOON band over a deck's columns (it isn't what
// these scenes are about).
const DAY = 24 * 3600 * 1000
const later = (d?: string) => (d ? new Date(Date.parse(d) + 7 * DAY).toISOString().slice(0, 10) : d)
export const calmTasks = (tasks: Task[]) => tasks.map((t) => (t.col === 'done' ? t : { ...t, due: later(t.due), start: later(t.start) }))

// What Pazar's two documents say (fixtures/pazar.ts has their titles), and a third, yours.
export const DOC_TEXTS: Record<string, string> = {
  'Interviews: Kreuzberg offices': `Twelve people in three offices round Moritzplatz, one question first: *what did you eat yesterday, and why?*

## What we heard

- **9 of 12** skip delivery lunch most days: "it's heavy and it's dear".
- Most have **30 minutes or less**; the queue at the salad bar eats half of it.
- Three would pay **€8–9** for a home-cooked dish they ordered the night before.

## What surprised us

Nobody minded walking two minutes to a shelf in the lobby. Everybody minded not knowing who cooked it.

## Next

Ask the cooks in Neukölln how many portions they could promise by 9 pm.`,
  'Pilot, week one: 31 pre-orders': `Two cooks, one WhatsApp group, a shelf at Factory.

## Numbers

- **31** pre-orders, **27** picked up on time.
- Average order **€8.40**; nobody asked for delivery.
- Waste fell from six portions a night to one once Ayla sent the 9 pm count.

## What we'd change

Ordering the night before is too early for some: try a 10 am window for the same day.`,
  'Pricing notes: €39 or €45 a week': `What the pilot's regulars said they'd pay for a week of lunches, and what the cooks need to earn.

## Two prices

- **€39**: below the canteen's €4.20 a day plus a coffee; cooks earn €6.10 a portion.
- **€45**: cooks earn €7.30, the number Ayla thinks keeps them cooking after the first month.`,
}

// The documents' own state (which are open beside the list, an upload going) as it is when nothing's open: a module
// store, so each loop starts from it.
export const docsShut = (readerAt: number | null = null): Action => run(() => useDocUi.setState({ readers: [], sideBySide: false, listHidden: false, readerAt, readerZooms: {}, readerWeights: {}, renaming: null, placing: null, deleting: null, uploads: [] }), 'no documents open')

// The canvas's camera gliding (eased both ends) to a canvas point in the stage's middle at a zoom: as camera.set, over
// `ms` (a person scrolling along something long).
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const glideTo = (x: number, y: number, zoom: number, ms: number): Action => {
  let from = { x: 0, y: 0, zoom: 1 }
  return {
    what: `camera glides to ${x},${y}`,
    ms,
    start: (c) => void (from = camOf(c.wid)),
    frame: (c, k) => {
      const e = isReducedMotion() ? 1 : ease(k)
      const to = { x: -x * zoom, y: -y * zoom, zoom }
      setCam(c.wid, { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, zoom: from.zoom + (to.zoom - from.zoom) * e })
    },
  }
}
