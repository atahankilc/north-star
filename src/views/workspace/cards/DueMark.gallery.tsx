import { example } from '../../../gallery/example'
import { today } from '../../../model/tasks'
import { DueMark } from './DueMark'

const day = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return today(d)
}
const row = { display: 'flex', gap: 'var(--space-4)', alignItems: 'center', fontSize: 'var(--text-xs)' }

export default example({
  name: 'DueMark',
  place: 'canvas/cards',
  file: 'src/views/workspace/cards/DueMark.tsx',
  note: 'a task’s due day (D-358): near days by name, magenta once past unless finished',
  states: {
    'near and far': () => (
      <div style={row}>
        <DueMark due={day(0)} finished={false} />
        <DueMark due={day(1)} finished={false} />
        <DueMark due={day(12)} finished={false} />
        <DueMark due={day(400)} finished={false} />
      </div>
    ),
    'late, and late but finished': () => (
      <div style={row}>
        <DueMark due={day(-1)} finished={false} />
        <DueMark due={day(-9)} finished={false} />
        <DueMark due={day(-9)} finished />
      </div>
    ),
  },
})
