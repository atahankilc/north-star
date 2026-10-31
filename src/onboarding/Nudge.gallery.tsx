import { example } from '../gallery/example'
import { Fresh, NAMES, none } from '../gallery/onboarding'
import { lessonById, type LineLesson } from './lessons'
import { Nudge } from './Nudge'

// A stand-in for the tool a nudge points at (its `data-learn` anchor: the side nav, the finder's compass, the people
// here), at the left of the middle: the nudge sits to its right with its magenta lead.
const Tool = ({ name }: { name: string }) => (
  <span data-learn={name} style={{ position: 'absolute', left: 'var(--space-12)', top: '45%', padding: 'var(--space-2)', border: '1px dashed var(--line-hover)', color: 'var(--fg-faint)', fontSize: 'var(--text-xs)' }}>
    {name}
  </span>
)

const nudge = (id: string) => {
  const l = lessonById(id) as LineLesson
  return {
    size: 'full' as const,
    render: () => (
      <Fresh>
        {l.anchor && <Tool name={l.anchor} />}
        <Nudge line={l.line ?? ''} anchor={l.anchor} names={NAMES} onClose={none} />
      </Fresh>
    ),
    note: `${id}; the dashed box stands in for its anchor (\`${l.anchor ?? 'none'}\`)`,
  }
}

export default example({
  name: 'Nudge',
  place: 'onboarding/hints',
  file: 'src/onboarding/Nudge.tsx',
  note: 'one line by the tool it points at, at most one a session (D-315)',
  states: {
    finder: nudge('nudge-finder'),
    focus: nudge('nudge-focus'),
    help: nudge('nudge-help'),
    'side view': nudge('nudge-side'),
    follow: nudge('nudge-follow'),
  },
})
