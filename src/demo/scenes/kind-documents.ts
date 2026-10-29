// The kind guide's `documents` row (onboarding-lessons.md §2): Pazar's research list, no HUD. It appears (shown with
// set()) with the team's two shared documents; then a third arrives at the top, yours and still private (no one else
// sees it until you share it).
import type { Doc } from '../../data/documents'
import type { WithId } from '../../data/hooks'
import { camera, set, wait, type Scene } from '../director'
import { AT, AWAY, CLEAR, appear, bare, base, pazarPiece } from '../fixtures/kit'
import { DEMO_USER, P } from '../fixtures/pazar'

const d = { ...pazarPiece(P.docs), x: CLEAR.x, y: CLEAR.y, w: 800, h: 250 }
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
  createdAt: AT,
  updatedAt: AT,
}

const scene: Scene = {
  id: 'kind-documents',
  fixture: { ...base, pieces: base.pieces.filter((p) => p.id !== P.docs) },
  view: 'canvas',
  size: [480, 300],
  length: 3400,
  poster: 3300,
  cursor: AWAY,
  setup: [bare('kind-documents'), camera.set(d.x + d.w / 2, d.y + d.h / 2 - 10, 0.57)],
  steps: [
    { at: 300, do: appear(d, 'the list appears') },
    { at: 1700, do: set((ws) => ({ ...ws, documents: [mine, ...ws.documents] }), 'a private one arrives') },
    { do: wait(1500) },
  ],
}
export default scene
