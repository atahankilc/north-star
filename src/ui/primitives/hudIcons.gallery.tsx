import { example } from '../../gallery/example'
import { ToolButton } from './ToolButton'
import { Button } from './Button'
import { BinIcon, CheckIcon, CloseIcon, CompassIcon, DeckIcon, DocsIcon, DownloadIcon, FolderIcon, EditIcon, FitIcon, GearIcon, GuideIcon, LimitIcon, MinusIcon, MoreIcon, NextIcon, PlaceIcon, PlusIcon, PrevIcon, ShareIcon, ThreadsIcon, TurnLeftIcon, TurnRightIcon, WriteIcon } from './hudIcons'
import { none } from '../../gallery/samples'

const GLYPHS = [
  ['close', CloseIcon], ['before', PrevIcon], ['after', NextIcon], ['less', MinusIcon], ['more of it', PlusIcon], ['done', CheckIcon],
  ['at most', LimitIcon], ['rename', EditIcon], ['write', WriteIcon], ['place', PlaceIcon], ['download', DownloadIcon], ['delete', BinIcon],
  ['turn left', TurnLeftIcon], ['turn right', TurnRightIcon], ['more', MoreIcon], ['shared', ShareIcon],
] as const
const SET = [
  ['fit', FitIcon],
  ['find', CompassIcon],
  ['guide', GuideIcon],
  ['decks', DeckIcon],
  ['threads', ThreadsIcon],
  ['docs', DocsIcon],
  ['folder', FolderIcon],
  ['settings', GearIcon],
] as const

export default example({
  name: 'hudIcons',
  place: 'hud/navigation',
  also: ['hud/corner'],
  file: 'src/ui/primitives/hudIcons.tsx',
  note: 'the HUD’s icons (D-343): one 18-unit grid, 1.5 strokes, sized by ToolButton; top to bottom as on the screen',
  states: {
    'a Button’s glyphs (D-384)': {
      render: () => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center', maxWidth: 'var(--size-md)' }}>
          {GLYPHS.map(([k, I]) => (
            <Button key={k} icon title={k} onClick={none}>
              <I />
            </Button>
          ))}
          <Button icon onClick={none}>100%</Button>
          <Button icon pressed onClick={none}><CheckIcon /></Button>
          <Button icon tone="danger" title="take it out" onClick={none}><CloseIcon /></Button>
        </div>
      ),
      note: 'drawn, never typed: one 12-unit box, the same ink and stroke, 1em in the button',
    },
    set: () => (
      <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center' }}>
        {SET.map(([k, I]) => (
          <ToolButton key={k} label={k} onClick={none}>
            <I />
          </ToolButton>
        ))}
      </div>
    ),
    'one open': () => (
      <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center' }}>
        {SET.map(([k, I]) => (
          <ToolButton key={k} label={k} pressed={k === 'decks'} badge={k === 'threads' ? 2 : 0} dot={k === 'guide'} onClick={none}>
            <I />
          </ToolButton>
        ))}
      </div>
    ),
  },
})
