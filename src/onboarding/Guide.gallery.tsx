import { useState } from 'react'
import { example } from '../gallery/example'
import { Fresh, none } from '../gallery/onboarding'
import { LESSONS, type Role } from './lessons'
import { Guide } from './Guide'

function Open({ role = 'owner' }: { role?: Role | null }) {
  const [open, setOpen] = useState(true)
  if (!open)
    return (
      <button style={{ background: 'none', border: 0, color: 'var(--accent-cyan)', font: 'inherit', cursor: 'pointer' }} onClick={() => setOpen(true)}>
        [show again]
      </button>
    )
  return <Guide role={role} onClose={() => setOpen(false)} onPlay={none} />
}

// Half the lessons seen, three armed (NEW in their areas).
const ids = LESSONS.map((l) => l.id)
const SOME = { seen: Object.fromEntries(ids.filter((_, i) => i % 2 === 0).map((id) => [id, 1])), armed: ids.filter((_, i) => i % 2 === 1).slice(0, 3) }
const ALL = { seen: Object.fromEntries(ids.map((id) => [id, 1])), armed: [] }

export default example({
  name: 'Guide',
  place: 'onboarding/guides',
  file: 'src/onboarding/Guide.tsx',
  note: 'the `?` guide: every note again, by area, the keys, tips on/off (D-315)',
  states: {
    'nothing seen': () => <Fresh><Open /></Fresh>,
    'some seen, some new': () => <Fresh progress={SOME}><Open /></Fresh>,
    'all seen': () => <Fresh progress={ALL}><Open /></Fresh>,
    'tips off': () => <Fresh progress={{ tipsOff: true }}><Open /></Fresh>,
    viewer: () => <Fresh role="viewer"><Open role="viewer" /></Fresh>,
    'area open': { render: () => <Fresh><Open /></Fresh>, setup: async (c) => { await c.wait(400); c.key('ArrowDown'); c.key('ArrowDown'); c.key('ArrowDown'); c.key('ArrowRight') } },
    'typed': { render: () => <Fresh><Open /></Fresh>, setup: async (c) => { await c.wait(400); c.type('deck') } },
  },
})
