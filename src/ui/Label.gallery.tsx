import { example } from '../gallery/example'
import { Label } from './Label'

const col = { display: 'grid', gap: 'var(--space-3)', justifyItems: 'start' } as const

export default example({
  name: 'Label',
  place: 'text/labels',
  file: 'src/ui/Label.tsx',
  note: 'small mono caps (D-093); Frame’s fieldLabel composes it; CSS: composes: label from Label.module.css',
  states: {
    tones: () => (
      <div style={col}>
        <Label>status · dim (default)</Label>
        <Label tone="faint">evidence · faint</Label>
        <Label tone="default">theme · default</Label>
      </div>
    ),
    'for a field': () => (
      <div style={col}>
        <Label as="label" htmlFor="g-name">name</Label>
        <input id="g-name" defaultValue="Pazar" style={{ background: 'none', border: '1px solid var(--line)', color: 'var(--fg)', font: 'inherit', padding: 'var(--space-1) var(--space-2)' }} />
      </div>
    ),
    'as a heading': () => <Label as="h3" tone="default">Who we beat</Label>,
  },
})
