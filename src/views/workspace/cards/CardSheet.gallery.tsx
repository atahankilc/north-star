import type { ReactNode } from 'react'
import { example } from '../../../gallery/example'
import type { Card } from '../../../data/cards'
import { ALL_TYPES } from '../../../model/cards'
import { CardSheet } from './CardSheet'

const qr: Card = { id: 'f-qr', type: 'feature', pieceId: 'p', title: 'Order by QR code', x: 0, y: 0, priority: 'P1', status: 'planned', impact: 'high', effort: 'low' }
const TITLE = { customer: 'Office workers near the market', problem: 'Lunch takes too long', competitor: 'Lieferando', idea: 'Pre-order at the stall', feature: 'Order by QR code', package: 'Pickup at work' } as const
const col = (n: ReactNode) => <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', width: 240 }}>{n}</div>

export default example({
  name: 'CardSheet',
  place: 'canvas/cards',
  also: ['canvas/pieces'],
  file: 'src/views/workspace/cards/CardSheet.tsx',
  note: 'a card on a deck (D-252, D-358): the tinted card face, its type and priority, how sure we are, what the columns don’t say',
  states: {
    'every type': () =>
      col(
        ALL_TYPES.map((t) => (
          <CardSheet key={t} card={{ id: t, type: t, pieceId: 'p', title: TITLE[t], x: 0, y: 0 }} field="status" finished={false} selected={false} live />
        )),
      ),
    'a feature, every value': () => col(<CardSheet card={qr} field="none" sure="high" finished={false} selected={false} live />),
    'columns by priority (its priority left off)': () => col(<CardSheet card={qr} field="priority" sure="medium" finished={false} selected={false} live />),
    'how sure': () =>
      col(
        (['high', 'medium', 'low', 'broken'] as const).map((s) => (
          <CardSheet key={s} card={{ ...qr, id: s, title: `Sure: ${s}` }} field="status" sure={s} finished={false} selected={false} live />
        )),
      ),
    untitled: () => col(<CardSheet card={{ ...qr, title: '' }} field="priority" finished={false} selected={false} live />),
    selected: () => col(<CardSheet card={qr} field="status" sure="high" finished={false} selected live />),
    'held (lifted)': () => col(<CardSheet card={qr} field="status" finished={false} selected={false} live lifted />),
  },
})
