// `deck-wizard` (onboarding-lessons.md §7), "Tasks or cards": the `+`'s `deck…` wizard open over the canvas, no HUD. It
// starts on `tasks` (to do · doing · done in the preview); the hand presses `features by status`: the preview turns into
// the features' statuses with how many cards each gets; then, in `columns · rows`, it picks `impact`: the columns are
// high · medium · low. All real: the wizard writes nothing until it's made.
import { useKanbanUi } from '../../views/workspace/Kanban'
import { cursor, onStage, run, wait, type Scene } from '../director'
import { base, byText } from '../fixtures/kit'
import { NO_HUD, firstText, pageStyle, wizardCss } from '../fixtures/o12'

const FEATURES = byText('[data-learn="wizard"] button', 'features by status', 0.3, 0.35)
const COLUMNS = byText('[data-learn="wizard"] [role="tab"]', '3', 0.4, 0.5)
const IMPACT = firstText('[data-learn="wizard"] button', 'impact', 0.4, 0.5)

const scene: Scene = {
  id: 'deck-kinds',
  fixture: base,
  view: 'canvas',
  size: [480, 300],
  length: 7600,
  poster: 7500,
  cursor: onStage(200, 280),
  setup: [pageStyle('deck-kinds', `${NO_HUD} ${wizardCss}`), run(() => useKanbanUi.setState({ wizard: true }), 'the wizard open')],
  steps: [
    { at: 400, do: cursor.to(FEATURES, 900) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: wait(1200) },
    { do: cursor.to(COLUMNS, 800) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: wait(600) },
    { do: cursor.to(IMPACT, 700) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: wait(700) },
    { do: cursor.to(onStage(150, 262), 700) },
  ],
}
export default scene
