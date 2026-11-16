import { example } from '../../gallery/example'
import { Button } from './Button'
import { ButtonGroup } from './ButtonGroup'
import { ToolButton } from './ToolButton'
import { Avatar } from './Avatar'
import { FitIcon, ThreadsIcon } from './hudIcons'
import { none } from '../../gallery/samples'


export default example({
  name: 'ButtonGroup',
  place: 'actions/buttons',
  file: 'src/ui/primitives/ButtonGroup.tsx',
  note: 'buttons that belong together, a small gap apart, no strip and no line between them (D-344, D-384): docks, consoles, panel and wizard feet, a zoom, a deck column’s tools, a Choice; `vertical` is the HUD’s column, where a filled cell gets an icon’s air so the seen gaps are one (D-402)',
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
    // The HUD's column (D-402): icons and a person's circle, every seen gap one; the circle says `data-filled`.
    'stacked (a HUD column)': () => (
      <ButtonGroup vertical label="tools">
        <ToolButton label="fit" onClick={none}><FitIcon /></ToolButton>
        <ToolButton label="threads" dot onClick={none}><ThreadsIcon /></ToolButton>
        <span data-filled><Avatar name="Ada" color="var(--accent-cyan)" /></span>
        <ToolButton label="fit" onClick={none}><FitIcon /></ToolButton>
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
