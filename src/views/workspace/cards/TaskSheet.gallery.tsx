import type { ReactNode } from 'react'
import { example } from '../../../gallery/example'
import type { Card } from '../../../data/cards'
import type { Task } from '../../../data/tasks'
import { today } from '../../../model/tasks'
import { TaskSheet } from './TaskSheet'

const day = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return today(d)
}
const office: Card = { id: 'c-office', type: 'customer', pieceId: 'p', title: 'Office workers near the market', x: 0, y: 0 }
const qr: Card = { id: 'f-qr', type: 'feature', pieceId: 'p', title: 'Order by QR code', x: 0, y: 0 }
const base: Task = { id: 't', pieceId: 'deck', col: 'todo', order: 1, title: 'Ask five stall owners what they lose a week', uid: 'u', createdAt: 0, updatedAt: 0 }
const full: Task = {
  ...base,
  id: 't-full',
  cardId: qr.id,
  cardType: 'feature',
  due: day(3),
  priority: 'P1',
  labels: ['pilot', 'berlin'],
  checks: [
    { id: 'a', text: 'a', done: true },
    { id: 'b', text: 'b', done: true },
    { id: 'c', text: 'c' },
  ],
  assignee: 'u2',
  assigneeName: 'Atahan Kılıç',
}

// Sheets at a column's width, as on a deck at 100 %.
const col = (n: ReactNode) => <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', width: 240 }}>{n}</div>
const sheet = (t: Task, card: Card | null, more: Partial<Parameters<typeof TaskSheet>[0]> = {}) => <TaskSheet key={t.id} task={t} card={card} finished={false} selected={false} live {...more} />

export default example({
  name: 'TaskSheet',
  place: 'canvas/cards',
  also: ['canvas/pieces'],
  file: 'src/views/workspace/cards/TaskSheet.tsx',
  note: 'a task on a deck (D-251, D-358): on the card face, edged in its card’s colour; the title, then only what it has',
  states: {
    'title only': () => col(sheet(base, null)),
    'for a card': () => col(sheet({ ...base, id: 't-c', cardId: office.id, cardType: 'customer' }, office)),
    everything: () => col(sheet(full, qr)),
    'late (magenta day)': () => col(sheet({ ...base, id: 't-late', due: day(-2), cardId: office.id, cardType: 'customer' }, office)),
    finished: () => col(sheet({ ...full, id: 't-done', due: day(-2) }, qr, { finished: true })),
    'finished, log what it taught': () => col(sheet({ ...base, id: 't-learn', title: 'Test: Order by QR code', cardId: qr.id, cardType: 'feature' }, qr, { finished: true, learn: () => {} })),
    'card gone': () => col(sheet({ ...base, id: 't-gone', cardId: 'nope', cardType: 'idea' }, null)),
    'long title': () => col(sheet({ ...base, id: 't-long', title: 'Walk the whole market on a Saturday morning and count how many stalls already take cards, which ones ask for cash only and why' }, null)),
    selected: () => col(sheet({ ...full, id: 't-sel' }, qr, { selected: true })),
    'held (lifted)': () => col(sheet({ ...full, id: 't-held' }, qr, { lifted: true })),
    'a column of them': () =>
      col(
        <>
          {sheet(full, qr)}
          {sheet({ ...base, id: 't-2', cardId: office.id, cardType: 'customer', due: day(0) }, office)}
          {sheet({ ...base, id: 't-3', title: 'Price the QR stickers' }, null)}
        </>,
      ),
  },
})
