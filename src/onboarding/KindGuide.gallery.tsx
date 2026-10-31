import { example } from '../gallery/example'
import { Fresh, KindBeside } from '../gallery/onboarding'

export default example({
  name: 'KindGuide',
  place: 'onboarding/guides',
  file: 'src/onboarding/KindGuide.tsx',
  note: 'the glued column beside the `+` menu: what the row under the keys or the pointer makes (D-316); ↑↓ or point at a row',
  states: {
    canvas: { size: 'full', render: () => <Fresh><div style={{ position: 'absolute', left: 'var(--space-12)', top: 'var(--space-12)' }}><KindBeside /></div></Fresh> },
    'in a plane': { size: 'full', render: () => <Fresh><div style={{ position: 'absolute', left: 'var(--space-12)', top: 'var(--space-12)' }}><KindBeside where="plane" /></div></Fresh> },
    'a row picked': {
      size: 'full',
      render: () => <Fresh><div style={{ position: 'absolute', left: 'var(--space-12)', top: 'var(--space-12)' }}><KindBeside /></div></Fresh>,
      setup: async (c) => { await c.wait(200); c.key('ArrowDown', '[data-learn="plus-menu"] input'); c.key('ArrowDown'); c.key('ArrowDown') },
    },
  },
})
