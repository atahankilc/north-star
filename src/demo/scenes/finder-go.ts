// The welcome's third page for viewers (onboarding-lessons.md §1 `welcome` page 3, "Find your way"): the whole screen,
// the canvas fitted. `⌘F` (its key chip shown) opens the real finder in the middle; `permit` is typed at a readable
// pace and the finder opens out to its matches with the preview of the first; a moment to read, then `↵`: the finder
// goes there as it does, into the plane's focus (the ink spreads), and the hand goes to the card found, lighting it.
import { aim, cursor, key, onStage, wait, type Scene, type Step } from '../director'
import { pazar, workspace, WID } from '../fixtures/pazar'

// Typed into what has the focus (the finder's field), a person's pace, no key chips (it's a word, not a key).
const type = (text: string, each = 150): Step[] => [...text].map((ch) => ({ do: { ...key(ch, 0), ms: each } }))

const scene: Scene = {
  id: 'finder-go',
  fixture: { ...pazar, wid: WID, workspace },
  view: 'canvas',
  size: [960, 600],
  length: 4800,
  // There: in the plane, the card found lit under the hand.
  poster: 4700,
  cursor: onStage(840, 520),
  steps: [
    // The hand still, off to the side: this one is the keyboard's.
    { at: 500, do: key('⌘F', 900) },
    { do: wait(500) },
    ...type('permit', 130),
    // The matches and the preview settle; a look.
    { do: wait(850) },
    { do: key('↵', 900) },
    // The finder closes, the plane spreads like ink; there, the hand goes to the card found, lighting it (its hover marks,
    // its links).
    { do: wait(900) },
    { do: cursor.to(aim('[data-target="card:r-permit"]', 0.6, 0.6), 800) },
  ],
}
export default scene
