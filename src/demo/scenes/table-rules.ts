// `table-wizard` (onboarding-lessons.md §5), "Rows by rules": the real table wizard, laid out over the small stage. The
// hand goes to its second question, `rows`: no rules yet, so the preview holds every card (33 rows). `+ type`, then
// `feature`: the preview is Pazar's eight features, its count says so. The wizard works on a draft, so every click is the app's own (nothing is written until it's made).
import { cursor, onStage, wait, type Scene } from '../director'
import { base, byText } from '../fixtures/kit'
import { openWizard, NO_HUD, fresh, pageStyle, wizardCss } from '../fixtures/o11'

const ID = 'table-rules'
const W = '[data-learn="wizard"]'
const ROWS = byText(`${W} [role="tab"]`, '2', 0.4, 0.5)
const PLUS = (f: string) => byText(`${W} button`, `+ ${f}`, 0.5, 0.5)
const VALUE = (v: string) => byText(`${W} button[aria-pressed]`, v, 0.5, 0.5)

const scene: Scene = {
  id: ID,
  fixture: base,
  view: 'canvas',
  size: [480, 300],
  length: 6200,
  poster: 6100,
  cursor: onStage(150, 276),
  setup: [fresh(), pageStyle(ID, `${NO_HUD} ${wizardCss} & [data-learn="wizard"] button[aria-pressed] { min-height: 20px; } & [data-learn="wizard"] > div:nth-child(2) { grid-template-columns: minmax(0, 1fr) 205px; }`), openWizard('table')],
  steps: [
    { at: 300, do: cursor.to(ROWS, 800) },
    { do: wait(250) },
    { do: cursor.press() },
    { do: wait(450) },
    { do: cursor.to(PLUS('type'), 650) },
    { do: wait(250) },
    { do: cursor.press() },
    { do: wait(300) },
    { do: cursor.to(VALUE('feature'), 650) },
    { do: wait(250) },
    { do: cursor.press() },
    // Every card → the eight features: the preview and its count change. A look.
    { do: wait(700) },
    { do: cursor.to(onStage(225, 140), 700) },
    { do: wait(400) },
  ],
}
export default scene
