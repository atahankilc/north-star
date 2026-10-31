import { example } from '../gallery/example'
import { Fresh } from '../gallery/onboarding'
import { lessonById, type LineLesson } from './lessons'
import { EmptyHint } from './EmptyHint'

const line = (id: string) => (lessonById(id) as LineLesson).line ?? ''

// A stand-in for the side nav's `+` (`data-learn="plus"`), which the empty canvas's arrow points at.
const Plus = () => (
  <span data-learn="plus" style={{ position: 'absolute', left: 'var(--space-6)', top: '40%', color: 'var(--accent-magenta)', fontSize: 'var(--text-lg)' }}>
    +
  </span>
)

export default example({
  name: 'EmptyHint',
  place: 'onboarding/hints',
  also: ['feedback/empty'],
  file: 'src/onboarding/EmptyHint.tsx',
  note: 'a teaching empty state: faint words, never pressed; the canvas’s points at the `+`',
  states: {
    'empty canvas': {
      size: 'full',
      render: () => (
        <Fresh>
          <Plus />
          <EmptyHint line={line('empty-canvas')} toward="plus" />
        </Fresh>
      ),
      note: 'the `+` here is a stand-in for the side nav’s',
    },
    'empty plane': { size: 'full', render: () => <Fresh><EmptyHint line={line('empty-plane')} /></Fresh> },
    'empty timeline': { size: 'full', render: () => <Fresh><EmptyHint line={line('empty-timeline')} /></Fresh> },
  },
})
