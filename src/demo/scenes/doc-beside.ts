// `documents` page 2 (onboarding-lessons.md §6), "Read beside": 07 Research in focus, no HUD, its list looked at
// closer. The hand clicks
// "Interviews: Kreuzberg offices" in the list: the list moves to the left, pinned (at this width only a sketch of it:
// the document keeps its 420 px), its row lit, and the document opens
// beside it to read, as a page (its head, its title, its text). All real: opening one writes nothing. (The text is drawn
// where the document's content goes: the demo has no Firestore to read it from.)
import { aim, camera, cursor, onStage, wait, type Scene } from '../director'
import { base } from '../fixtures/kit'
import { DOC_TEXTS, NO_HUD, docText, docsShut, pageStyle } from '../fixtures/o12'
import { WID, P } from '../fixtures/pazar'

const ROW = aim('[data-target="doc:doc-interviews"]', 0.3, 0.5)

const scene: Scene = {
  id: 'doc-beside',
  fixture: base,
  view: 'focus',
  route: `/workspaces/${WID}?focus=${P.docs}`,
  size: [640, 400],
  length: 4300,
  poster: 4200,
  cursor: onStage(420, 330),
  setup: [pageStyle('doc-beside', NO_HUD), docsShut(), docText(DOC_TEXTS)],
  steps: [
    // At 0, not in the setup: closing what the loop before left open fits the list again as the stage settles, and this
    // comes after it.
    { at: 0, do: camera.frame({ x: 0, y: 0, w: 600, h: 160 }, 16) },
    { at: 300, do: cursor.to(ROW, 1000) },
    { do: wait(400) },
    { do: cursor.press() },
    { do: wait(1200) },
    { do: cursor.to(onStage(470, 250), 900) },
    { do: wait(300) },
  ],
}
export default scene
