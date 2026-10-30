// `matrix-wizard` (onboarding-lessons.md §5), "Four questions": the real matrix wizard, laid out over the small stage.
// It opens on `start from`, features × competitors chosen, the preview beside it. The hand picks `problems × customers`:
// the preview turns into Pazar's problems against its customers. Then the third question, `columns`; the hand picks
// `competitors`: the preview's columns turn into Wolt, Lieferando… The wizard works on a draft, so every click here is
// the app's own (nothing is written until it's made).
import { cursor, onStage, wait, type Scene } from '../director'
import { base, byText } from '../fixtures/kit'
import { openWizard, NO_HUD, fresh, pageStyle, wizardCss } from '../fixtures/o11'

const ID = 'matrix-wizard'
const TEMPLATE = byText('[data-learn="wizard"] button', 'problems × customers', 0.3, 0.5)
const COLUMNS = byText('[data-learn="wizard"] [role="tab"]', '3', 0.4, 0.5)
const COMPETITORS = byText('[data-learn="wizard"] button', 'competitors', 0.4, 0.5)

const scene: Scene = {
  id: ID,
  fixture: base,
  view: 'canvas',
  size: [480, 300],
  length: 7100,
  poster: 7000,
  cursor: onStage(150, 276),
  setup: [fresh(), pageStyle(ID, `${NO_HUD} ${wizardCss}`), openWizard('matrix')],
  steps: [
    { at: 400, do: cursor.to(TEMPLATE, 900) },
    { do: wait(350) },
    { do: cursor.press() },
    // The preview changes: a look.
    { do: wait(1100) },
    { do: cursor.to(COLUMNS, 800) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: wait(600) },
    { do: cursor.to(COMPETITORS, 700) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: wait(500) },
    { do: cursor.to(onStage(120, 250), 700) },
  ],
}
export default scene
