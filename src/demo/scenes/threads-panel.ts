// `comment` "Every conversation" (lessons.ts, D-349): the whole screen, Pazar fitted, four threads
// in the workspace (on cards of both planes, one resolved, one mentioning you; the others new to you). The hand clicks
// the threads tool in the HUD's corner (D-402): the real list is uncovered on the left, under the screen (D-393), what's
// new on top under `NEW` (D-405), the resolved one behind a word at its foot; it opens the one that names you: the
// conversation builds on the right (the stage is narrow, so the list gives way to it), and the hand rests on its head,
// the card it's on, which takes you there.
// The messages, what you've read and who you are are the demo's (data/threads.ts' `demoThreads`, read instead of
// Firestore in the demo realm).
import { demoThreads } from '../../data/threads'
import { cursor, onStage, run, wait, type Scene } from '../director'
import { base } from '../fixtures/kit'
import { calm, cornerOnly } from '../fixtures/o13'
import { MESSAGES, THREADS } from '../fixtures/threads'
import { DEMO_USER } from '../fixtures/pazar'

const IN = '[data-learn="threads"]'
// The row that names you, under `NEW`: on a feature (D-435: its kind is its title's).
const ROW = `${IN} ol button[title^="feature"]`
// The conversation's head, the card it's on (D-405).
const THERE = '[data-learn="thread-column"] header [role="button"]'

const scene: Scene = {
  id: 'threads-panel',
  fixture: { ...base, threads: THREADS },
  view: 'canvas',
  // Wider than the others: the list (400 px) beside the screen needs the room.
  size: [768, 480],
  length: 7900,
  // The conversation open, the hand on the card it's on.
  poster: 7800,
  cursor: onStage(560, 200),
  setup: [
    cornerOnly('threads-panel'),
    calm(),
    run(() => {
      demoThreads.me = DEMO_USER.uid
      demoThreads.messages = MESSAGES
    }, 'the threads’ messages'),
  ],
  steps: [
    { at: 300, do: cursor.to('[aria-label^="Talk"]', 1000) },
    { do: wait(400) },
    { do: cursor.press() },
    // The panel opens; a look down what's new.
    { do: wait(1500) },
    { do: cursor.to(ROW, 900) },
    { do: wait(300) },
    { do: cursor.press() },
    // The conversation opens; a moment, then to the thing it's on.
    { do: wait(900) },
    { do: cursor.to(THERE, 800) },
    { do: wait(500) },
  ],
}
export default scene
