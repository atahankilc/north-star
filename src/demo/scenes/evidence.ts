// `status-evidence` (onboarding-lessons.md §3), "Is it true?": 01 Lunch in focus, no HUD, a problem selected, its panel
// open, a hypothesis with one finding for it and one against (`+1 −1` on the card). The hand presses `testing`: the
// card reads `testing +1 −1`; it presses `evidence`, the form opens, a finding is typed, Enter: one more for it, the card
// reads `testing +2 −1`. What each would write shown with set().
import type { Evidence } from '../../data/evidence'
import { cursor, inFocus, key, set, ui, wait, type Scene } from '../director'
import { AT, PLANE_K, byText, focusRoute, moved, smallPlane, type } from '../fixtures/kit'
import { closeIn, stage, view } from '../fixtures/o10'

const card = moved('r-same', PLANE_K, 0, 75, { validation: 'hypothesis' })
const ev = (id: string, stance: Evidence['stance'], text: string, n: number): Evidence => ({ id, nodeId: card.id, nodeType: 'problem', kind: 'interview', stance, text, source: 'Lunch-break interviews', date: '2026-10-12', createdAt: AT + n })
const BEFORE = [ev('v-a', 'supports', 'The menu repeats every Monday', 1), ev('v-b', 'contradicts', 'Two like knowing what’s coming', 2)]
const TEXT = '7 of 9 eat the same dish twice a week'
const TESTING = byText('[data-learn="panel-status"] button', 'testing')
const ADD = byText('[data-learn="card-panel"] section button', 'evidence')

const scene: Scene = {
  id: 'evidence',
  fixture: smallPlane([card], { evidence: BEFORE }),
  view: 'focus',
  route: focusRoute(),
  size: [640, 400],
  length: 7700,
  poster: 7600,
  cursor: inFocus(120, 330),
  setup: [...stage('evidence'), ui.select(`card:${card.id}`), view(0.85, 14, 60)],
  steps: [
    { at: 300, do: cursor.to(TESTING, 800) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: set((ws) => ({ ...ws, cards: ws.cards.map((c) => (c.id === card.id ? { ...c, validation: 'testing' } : c)) }), 'testing') },
    { do: wait(550) },
    { do: cursor.to(ADD, 800) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: wait(500) },
    ...type(TEXT, 45),
    { do: wait(300) },
    { do: key('↵') },
    { do: set((ws) => ({ ...ws, evidence: [...ws.evidence, { ...ev('v-c', 'supports', TEXT, 3) }] }), 'one more for it') },
    { do: wait(450) },
    // The panel closed, the view closes in on the card: what it says now.
    { do: key('Esc') },
    { do: closeIn({ x: -10, y: 65, w: 220, h: 120 }, 800, 40) },
    { do: wait(300) },
  ],
}
export default scene
