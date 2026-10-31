import { example, type GalleryCtx } from '../../gallery/example'
import { screen } from '../../gallery/screens'
import { openFinder } from './find'

const find = (q: string) => async (c: GalleryCtx) => {
  openFinder()
  await c.wait(200)
  c.type(q, '[data-learn="finder-panel"] input, [role="dialog"] input, input[aria-label*="ind"]')
}

export default example({
  name: 'Find preview',
  place: 'overlays/finder',
  file: 'src/views/workspace/FindPreview.tsx',
  note: 'the live preview of where the finder will land (D-201)',
  states: {
    'a card': screen({ then: find('permit') }),
    'a piece': screen({ then: find('launch days') }),
    'a task': screen({ then: find('bezirksamt') }),
  },
})
