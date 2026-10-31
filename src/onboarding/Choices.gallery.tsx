import { example } from '../gallery/example'
import { EmptyBox, Fresh } from '../gallery/onboarding'
import { lessonById, type LineLesson } from './lessons'
import { Choices } from './Choices'

const CHOICES = (lessonById('workspaces-empty') as LineLesson).choices ?? []

export default example({
  name: 'Choices',
  place: 'onboarding/welcome',
  file: 'src/onboarding/Choices.tsx',
  note: 'the workspaces page with no workspaces: three framed ways to start, in the page’s empty box',
  states: {
    default: () => (
      <Fresh>
        <EmptyBox>{(into) => <Choices into={into} choices={CHOICES} />}</EmptyBox>
      </Fresh>
    ),
  },
})
