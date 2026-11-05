import { example } from '../../../gallery/example'
import { onCanvas } from '../../../gallery/canvas'
import { CANVAS, type Label } from '../../../model/labels'
import { MAIN } from '../../../data/canvases'

const AT = Date.UTC(2026, 9, 19, 9, 0)
let n = 0
const t = (l: Omit<Label, 'createdAt' | 'pieceId' | 'canvasId'>): Label => ({ pieceId: CANVAS, canvasId: MAIN, createdAt: AT + ++n, ...l })

const HEADINGS = [
  t({ id: 'h1', text: 'Pazar', size: 'heading', x: 0, y: 0 }),
  t({ id: 'h2', text: 'Who we beat', size: 'subheading', kicker: '02 ── WHO WE BEAT', x: 0, y: 125 }),
  t({ id: 'h3', text: 'Open questions', size: 'minor', x: 0, y: 250 }),
  t({ id: 'h4', text: 'Turned', size: 'subheading', rotate: 90, x: 700, y: 0 }),
]
const PARAGRAPHS = [
  t({ id: 'p1', text: 'Home cooks sell **tomorrow’s lunch** to the offices round the corner.\n\n- orders close at 9 pm\n- pickup at noon, in the lobby', size: 'note', w: 400, x: 0, y: 0 }),
  t({ id: 'p2', text: 'Large and *italic*: the pilot sold 31 portions in its first week.', size: 'note', scale: 'large', italic: true, w: 400, x: 475, y: 0 }),
  t({ id: 'p3', text: 'Small, magenta, caps.', size: 'note', scale: 'small', color: 'magenta', caps: true, w: 300, x: 0, y: 225 }),
]
const STICKIES = (['yellow', 'magenta', 'cyan', 'green', 'blue'] as const).map((color, i) =>
  t({ id: `s${i}`, kind: 'sticky', color, text: ['Which permit? Ask the Bezirksamt', '€39 or €45 for the weekly plan?', 'Two lobbies said yes to a shelf!', 'Call Factory on Monday', 'A fridge for two cooks?'][i], w: 150, uid: i % 2 ? 'u-ayla' : 'demo', author: i % 2 ? 'Ayla' : 'You', x: i * 175, y: 0 }),
)
const LONG_STICKY = t({ id: 's-long', kind: 'sticky', color: 'yellow', text: 'Ask Jonas before Friday:\n- which permit?\n- one fridge for two cooks?\n- who checks the labels?\n- is a lobby shelf storage?\n- a hygiene course?\n- kitchen insurance?', w: 150, uid: 'demo', author: 'You', x: 0, y: 200 })
const SECTION = [
  t({ id: 'sec', kind: 'section', text: 'This week', x: 0, y: 0, w: 450, h: 300 }),
  t({ id: 'sec-s1', kind: 'sticky', color: 'yellow', text: 'Which permit?', w: 150, uid: 'demo', author: 'You', x: 50, y: 100 }),
  t({ id: 'sec-s2', kind: 'sticky', color: 'magenta', text: '€39 or €45?', w: 150, uid: 'u-ayla', author: 'Ayla', x: 250, y: 100 }),
  t({ id: 'sec2', kind: 'section', text: 'Left edge', side: 'left', kicker: '', x: 550, y: 0, w: 300, h: 300 }),
]
const TITLE = [t({ id: 'title', kind: 'title', text: '', w: 800, x: 0, y: 0 })]

const only = (labels: Label[]) => onCanvas({ only: [], change: (ws) => ({ ...ws, labels }) })

export default example({
  name: 'Text',
  place: 'canvas/text',
  also: ['text/on the canvas'],
  file: 'src/views/workspace/text/TextItems.tsx',
  note: 'text on the canvas: headings, paragraphs, sticky notes, sections, the project title (D-188, D-194)',
  states: {
    headings: only(HEADINGS),
    paragraphs: only(PARAGRAPHS),
    'sticky notes': only([...STICKIES, LONG_STICKY]),
    sections: only(SECTION),
    'project title': { ...only(TITLE), note: 'the workspace’s name and description, one per workspace' },
    'heading picked': { ...onCanvas({ only: [], change: (ws) => ({ ...ws, labels: HEADINGS }), label: 'h2' }), note: 'its bar under it' },
    'sticky picked': onCanvas({ only: [], change: (ws) => ({ ...ws, labels: STICKIES }), label: 's2' }),
    'sticky picked, far out': { ...onCanvas({ only: [], change: (ws) => ({ ...ws, labels: STICKIES }), label: 's2', zoom: 0.25 }), note: 'the bar stays under its L’s at every zoom' },
    'paragraph picked, far out': onCanvas({ only: [], change: (ws) => ({ ...ws, labels: PARAGRAPHS }), label: 'p2', zoom: 0.25 }),
    'section picked, far out': onCanvas({ only: [], change: (ws) => ({ ...ws, labels: SECTION }), label: 'sec', zoom: 0.25 }),
  },
})
