import type { ReactNode } from 'react'
import { example } from '../../../gallery/example'
import type { Task } from '../../../data/tasks'
import { STRIP_PX } from '../../../model/world'
import { TimelineBar } from './TimelineBar'

const base: Task = { id: 't', pieceId: 'deck', col: 'todo', order: 1, title: 'Ask five stall owners what they lose a week', uid: 'u', createdAt: 0, updatedAt: 0 }
const qr: Task = { ...base, id: 't-qr', title: 'Print the QR stickers', cardId: 'f-qr', cardType: 'feature' }
const office: Task = { ...base, id: 't-office', title: 'Survey 40 office workers', cardId: 'c-office', cardType: 'customer', priority: 'P1' }

// Bars on a strip, a row each, as on a timeline at its day scale (--bar is the timeline's own).
const strip = (rows: ReactNode[]) => (
  <div style={{ position: 'relative', width: 640, height: rows.length * (STRIP_PX.bar + STRIP_PX.gap) + 40, ['--bar' as string]: `${STRIP_PX.bar}px` }}>{rows}</div>
)
const at = (i: number, left: number, width: number) => ({ left, top: i * (STRIP_PX.bar + STRIP_PX.gap), width })
const bar = (t: Task, i: number, left: number, width: number, more: Partial<Parameters<typeof TimelineBar>[0]> = {}) => (
  <TimelineBar key={`${t.id}-${i}`} task={t} finished={false} late={false} point={false} out={false} selected={false} live editor style={at(i, left, width)} {...more} />
)

export default example({
  name: 'TimelineBar',
  place: 'canvas/cards',
  also: ['canvas/pieces'],
  file: 'src/views/workspace/cards/TimelineBar.tsx',
  note: 'a task on a timeline (D-262, D-358): a bar on the card face from its first day to its due day, tinted in its card’s colour',
  states: {
    'for a card, none, a priority': () => strip([bar(qr, 0, 20, 300), bar(base, 1, 80, 380), bar(office, 2, 40, 260)]),
    'checklist done so far': () => strip([bar({ ...qr, checks: [{ id: 'a', text: 'a', done: true }, { id: 'b', text: 'b' }, { id: 'c', text: 'c' }] }, 0, 20, 300, { checks: 1 / 3 })]),
    'late, finished': () => strip([bar(office, 0, 20, 240, { late: true }), bar(office, 1, 20, 120, { late: true, out: true, lateBy: 3 }), bar(qr, 2, 20, 300, { finished: true })]),
    'too short: name beside': () => strip([bar(qr, 0, 20, 60, { out: true })]),
    'only a due day (◆)': () => strip([bar(qr, 0, 40, 30, { point: true, out: true }), bar(base, 1, 40, 30, { point: true, out: true, late: true })]),
    'selected, its grips': () => strip([bar(qr, 0, 40, 300, { selected: true, onGrip: () => () => {} }), bar(qr, 1, 60, 30, { point: true, out: true, selected: true, onGrip: () => () => {} })]),
  },
})
