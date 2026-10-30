// `headings-places` (onboarding-lessons.md §4), "Headings are places": the whole screen, Pazar's canvas fitted, three
// headings: `What we build` over Product, `The launch` over the deck, `Who we beat` on a clear stretch left of it all (so
// the glide there passes over no piece's name).
// `⌘F` (its key chip) opens the real finder: empty, it lists the places, the headings among them. `beat` typed at a
// readable pace narrows it to the heading; `↵`: the finder glides the canvas there, the heading in the middle.
import { CANVAS } from '../../data/labels'
import { key, wait, type Scene } from '../director'
import { base, text, type } from '../fixtures/kit'

const headings = [
  text({ id: 'h-beat', pieceId: CANVAS, text: 'Who we beat', size: 'heading', kicker: '03 the market', x: -1400, y: 300 }),
  text({ id: 'h-build', pieceId: CANVAS, text: 'What we build', size: 'heading', kicker: '02 product', x: 1300, y: -175 }),
  text({ id: 'h-launch', pieceId: CANVAS, text: 'The launch', size: 'heading', kicker: '05 next weeks', x: 0, y: 700 }),
]

const scene: Scene = {
  id: 'finder-heading',
  fixture: { ...base, labels: headings },
  view: 'canvas',
  size: [480, 300],
  length: 5000,
  poster: 4900,
  // The keyboard's scene: the hand off the stage.
  cursor: { x: 4000, y: 4000 },
  steps: [
    { at: 500, do: key('⌘F', 900) },
    // The places, the headings among them: a look.
    { do: wait(1100) },
    ...type('beat', 150),
    { do: wait(800) },
    { do: key('↵', 900) },
    { do: wait(1500) },
  ],
}
export default scene
