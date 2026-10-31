import { example, type GalleryCtx } from '../../gallery/example'
import { P } from '../../gallery/canvas'
import { screen } from '../../gallery/screens'
import { openFinder, useFind } from './find'

const find = (q?: string, scope?: 'here' | 'everywhere') => async (c: GalleryCtx) => {
  if (scope) useFind.setState({ scope })
  openFinder()
  if (!q) return
  await c.wait(200)
  c.type(q, '[data-learn="finder-panel"] input, [role="dialog"] input, input[aria-label*="ind"]')
}

export default example({
  name: 'Finder',
  place: 'overlays/finder',
  also: ['hud/navigation'],
  file: 'src/views/workspace/Finder.tsx',
  note: '⌘F: the places when empty, matches by space when typed (D-196, D-200, D-236)',
  states: {
    places: screen({ then: find() }),
    typed: { ...screen({ then: find('permit') }), note: '"permit": its matches and the preview of the first' },
    'typed, everywhere': screen({ then: find('lunch', 'everywhere') }),
    'no match': screen({ then: find('zzz') }),
    'in a focus': screen({ focus: P.lunch, then: find('cook') }),
  },
})
