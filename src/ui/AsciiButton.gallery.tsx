import { example } from '../gallery/example'
import { AsciiButton } from './AsciiButton'

const ACCENTS = ['magenta', 'cyan', 'yellow', 'blue', 'green'] as const

export default example({
  name: 'AsciiButton',
  place: 'actions/buttons',
  file: 'src/ui/AsciiButton.tsx',
  states: {
    default: () => <AsciiButton>create workspace</AsciiButton>,
    accents: () => (
      <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        {ACCENTS.map((a) => (
          <AsciiButton key={a} accent={a}>
            {a}
          </AsciiButton>
        ))}
      </div>
    ),
    hover: { render: () => <AsciiButton data-g="b">create workspace</AsciiButton>, hover: '[data-g="b"]' },
    disabled: () => <AsciiButton disabled>create workspace</AsciiButton>,
  },
})
