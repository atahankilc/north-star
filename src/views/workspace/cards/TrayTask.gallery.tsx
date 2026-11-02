import { example } from '../../../gallery/example'
import type { Task } from '../../../data/tasks'
import { TrayTask } from './TrayTask'

const base: Task = { id: 't', pieceId: 'deck', col: 'todo', order: 1, title: 'Price the QR stickers', uid: 'u', createdAt: 0, updatedAt: 0 }
const row = (n: React.ReactNode) => <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center', maxWidth: 640 }}>{n}</div>

export default example({
  name: 'TrayTask',
  place: 'canvas/cards',
  also: ['canvas/pieces'],
  file: 'src/views/workspace/cards/TrayTask.tsx',
  note: 'a task in a timeline’s no-day tray (D-358): a small sheet on the card face, dragged onto a day to give it one',
  states: {
    'with a card, without': () =>
      row(
        <>
          <TrayTask task={{ ...base, cardId: 'f', cardType: 'feature' }} selected={false} live />
          <TrayTask task={{ ...base, id: 't2', title: 'Ask five stall owners what they lose a week', cardId: 'c', cardType: 'customer' }} selected={false} live />
          <TrayTask task={{ ...base, id: 't3', title: 'Book the market stall for a Saturday' }} selected={false} live />
        </>,
      ),
    selected: () => row(<TrayTask task={{ ...base, cardId: 'f', cardType: 'feature' }} selected live />),
    'a long title, cut': () => row(<TrayTask task={{ ...base, title: 'Walk the whole market on a Saturday morning and count how many stalls already take cards' }} selected={false} live />),
  },
})
