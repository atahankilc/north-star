// `documents` page 1 (onboarding-lessons.md §6), "Your files": 07 Research in focus, no HUD, its list looked at closer.
// The hand presses the dock's `[upload]` (the file chosen is shown, not asked: the demo opens no dialog): `pricing-notes.md`
// goes up and lands at the top of the list; the view closes in on it, `you ◐`: only you see it; the hand right-clicks its row and picks
// `share with everyone`: the mark goes, everyone here sees it now (each write shown with set()).
import type { Doc } from '../../data/documents'
import type { WithId } from '../../data/hooks'
import { useDocUi } from '../../views/workspace/Documents'
import { aim, camera, cursor, key, onStage, run, set, wait, type Scene } from '../director'
import { AT, base, rightClick } from '../fixtures/kit'
import { closeIn, row } from '../fixtures/o10'
import { NO_HUD, docsShut, pageStyle } from '../fixtures/o12'
import { DEMO_USER, WID, P } from '../fixtures/pazar'

const mine: WithId<Doc> = {
  id: 'doc-pricing',
  kind: 'markdown',
  title: 'Pricing notes: €39 or €45 a week',
  excerpt: 'What the pilot’s regulars said they’d pay, and what the cooks need to earn.',
  origin: 'upload',
  uid: DEMO_USER.uid,
  name: DEMO_USER.name,
  shared: false,
  contentType: 'text/markdown',
  size: 3600,
  words: 610,
  createdAt: AT + 3 * 24 * 3600 * 1000,
  updatedAt: AT + 3 * 24 * 3600 * 1000,
}
const FILE = 'pricing-notes.md'
// Two a page, so the list's box stays the same as the third comes (a box that changes is fitted again, far smaller in
// this small stage): the newest on top, the oldest to page 2.
const pieces = base.pieces.map((p) => (p.id === P.docs ? { ...p, documents: { ...p.documents!, pageSize: 2 } } : p))
const UPLOAD = aim('button[title^="add .md files"]')
const ROW = aim('[data-target="doc:doc-pricing"]', 0.45, 0.5)
const SHARE = row('share with everyone')

const scene: Scene = {
  id: 'documents',
  fixture: { ...base, pieces },
  view: 'focus',
  route: `/workspaces/${WID}?focus=${P.docs}`,
  size: [768, 480],
  length: 7900,
  poster: 7800,
  cursor: onStage(200, 250),
  setup: [pageStyle('documents', NO_HUD), docsShut()],
  steps: [
    // At 0, after the list's own fit as the stage settles (as in doc-beside).
    { at: 0, do: camera.frame({ x: 0, y: 0, w: 640, h: 200 }, 16) },
    { at: 300, do: cursor.to(UPLOAD, 900) },
    { do: wait(350) },
    { do: cursor.press() },
    // Off the dock, which grows as the upload's name comes into it.
    { do: cursor.to(onStage(560, 330), 600) },
    { at: 1800, do: run(() => useDocUi.setState({ uploads: [{ name: FILE, state: 'sending' }] }), 'it goes up') },
    {
      at: 2400,
      do: run((c) => {
        useDocUi.setState({ uploads: [{ name: FILE, state: 'done' }] })
        const ws = c.store.get()
        c.store.set({ ...ws, documents: [mine, ...ws.documents] })
        c.store.tell()
      }, 'it lands, only yours'),
    },
    // Looked at closer: the end of its title and who added it, `you ◐`, only you see it.
    { at: 2800, do: closeIn({ x: 300, y: 28, w: 300, h: 84 }, 800, 16, 2.5) },
    { do: wait(400) },
    { do: cursor.to(ROW, 700) },
    { do: wait(300) },
    { do: rightClick(ROW) },
    { do: wait(600) },
    { do: cursor.to(SHARE, 700) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: set((ws) => ({ ...ws, documents: ws.documents.map((d) => (d.id === mine.id ? { ...d, shared: true } : d)) }), 'shared') },
    // The menu closes as the app's does once the share is written (the demo's refused write stops it short: closed here,
    // no key shown).
    { do: key('Esc', 0) },
    { do: cursor.to(onStage(600, 400), 600) },
  ],
}
export default scene
