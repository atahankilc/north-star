import { example } from '../../../gallery/example'
import { ALL_TYPES } from '../../../model/cards'
import { PIECE_TONE } from '../../../ui/foundation/pieceTone'
import { TypeBadge } from './TypeBadge'

const row = (size: string) => ({ display: 'flex', flexWrap: 'wrap' as const, gap: 'var(--space-3)', alignItems: 'center', fontSize: size })

export default example({
  name: 'TypeBadge',
  place: 'canvas/cards',
  file: 'src/views/workspace/cards/TypeBadge.tsx',
  note: 'a card’s type as a badge (D-409): a pill of its colour, on a plane card, a package’s band and a deck’s sheets; the pill alone on a timeline’s bar and in the tray; a thread’s thing with its own word and colour (D-414)',
  states: {
    'every type (a plane card’s size)': () => (
      <div style={row('var(--w-text-2xs)')}>
        {ALL_TYPES.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
      </div>
    ),
    'every type (a deck sheet’s size)': () => (
      <div style={row('var(--text-xs)')}>
        {ALL_TYPES.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
      </div>
    ),
    'a piece’s kind (a thread’s head and rows)': () => (
      <div style={row('var(--text-xs)')}>
        {(Object.keys(PIECE_TONE) as (keyof typeof PIECE_TONE)[]).map((k) => (
          <TypeBadge key={k} kind={k} tone={PIECE_TONE[k]} />
        ))}
      </div>
    ),
    'no word (a timeline bar, the tray)': () => (
      <div style={row('var(--text-sm)')}>
        {ALL_TYPES.map((t) => (
          <TypeBadge key={t} type={t} word={false} />
        ))}
      </div>
    ),
  },
})
