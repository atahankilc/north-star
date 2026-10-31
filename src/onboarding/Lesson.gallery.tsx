import { example } from '../gallery/example'
import { Fresh, NAMES, none, shown, useShowNow, WhenReady } from '../gallery/onboarding'
import { onCanvas, P } from '../gallery/canvas'
import { Canvas } from '../gallery/canvas'
import { Lesson } from './Lesson'
import type { Role } from './lessons'

// Played from the guide: in the middle, no anchor needed.
const played = (id: string, role: Role = 'owner', extra: { done?: boolean; isNew?: boolean } = {}) => ({
  size: 'full' as const,
  render: () => (
    <Fresh role={role}>
      <Lesson shown={shown(id, { via: 'play', role, ...extra })} names={NAMES} onClose={none} onTipsOff={none} onGuide={none} />
    </Fresh>
  ),
})

// Beside what it's about, on the real canvas: drawn once the anchor is there.
const beside = (id: string, o: NonNullable<Parameters<typeof onCanvas>[0]>, extra: { done?: boolean; isNew?: boolean } = {}) => {
  const s = onCanvas({ ...o, then: async (c) => { await o.then?.(c); await c.wait(300); useShowNow.setState({ on: true }) } })
  return {
    ...s,
    render: () => (
      <>
        <Canvas />
        <Fresh>
          <WhenReady>
            <Lesson shown={shown(id, extra)} names={NAMES} onClose={none} onTipsOff={none} onGuide={none} />
          </WhenReady>
        </Fresh>
      </>
    ),
  }
}

export default example({
  name: 'Lesson',
  place: 'onboarding/lessons',
  file: 'src/onboarding/Lesson.tsx',
  note: 'the lesson card (the prompt card, D-316): ≤ 4 pages, ≤ 25 words, its demo; beside what was just opened',
  states: {
    'played: focus': played('focus-plane'),
    'played: card panel': played('card-panel'),
    'played: matrix keys': played('matrix-keys'),
    'played: viewer': played('viewer', 'viewer'),
    'beside the dock': beside('focus-plane', { only: [P.lunch], focus: P.lunch }),
    'beside a card panel': beside('card-panel', { only: [P.lunch], focus: P.lunch, card: 'i-preorder' }),
    'beside a piece': beside('piece-made', { only: [P.lunch], edit: [P.lunch], selected: P.lunch }),
    done: { ...beside('focus-plane', { only: [P.lunch], focus: P.lunch }, { done: true }), note: '✓ done, then it goes' },
    new: { ...played('deck', 'owner', { isNew: true }), note: 'after a release: NEW' },
  },
})
