import { example } from '../../gallery/example'
import { Button } from './Button'
import { ButtonGroup } from './ButtonGroup'

const none = () => {}

export default example({
  name: 'ButtonGroup',
  place: 'actions/buttons',
  file: 'src/ui/primitives/ButtonGroup.tsx',
  note: 'buttons that belong together joined into one strip, a hairline between their cells (D-344): docks, consoles, panel and wizard feet, a zoom, a deck column’s tools, a Choice',
  states: {
    'a dock': () => (
      <ButtonGroup label="focus">
        <Button onClick={none}>filter</Button>
        <Button onClick={none}>linked · 2</Button>
        <Button pressed onClick={none}>setup</Button>
        <Button tone="main" onClick={none}>unfocus</Button>
      </ButtonGroup>
    ),
    'a console in edit mode': () => (
      <ButtonGroup label="edit">
        <Button onClick={none}>move to…</Button>
        <Button tone="danger" onClick={none}>delete</Button>
        <Button tone="primary" onClick={none}>done</Button>
      </ButtonGroup>
    ),
    'glyphs (a zoom)': () => (
      <ButtonGroup label="zoom">
        <Button icon onClick={none}>−</Button>
        <Button icon onClick={none}>100%</Button>
        <Button icon onClick={none}>+</Button>
      </ButtonGroup>
    ),
    'loose, for comparison': () => (
      <span style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
        <Button onClick={none}>filter</Button>
        <Button onClick={none}>linked · 2</Button>
        <Button pressed onClick={none}>setup</Button>
        <Button tone="main" onClick={none}>unfocus</Button>
      </span>
    ),
  },
})
