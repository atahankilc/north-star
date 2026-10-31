import { useState } from 'react'
import { example } from '../gallery/example'
import { Fresh, NAMES, shown } from '../gallery/onboarding'
import { newsPages, welcomePages } from './words'
import { SAMPLE_RELEASES } from './releases.sample'
import type { Role } from './lessons'
import { Pages, type PagesEnd } from './Pages'

// A modal: skip or done ends it, `[show again]` brings it back.
function Shown({ kind, role = 'owner' }: { kind: 'welcome' | 'news'; role?: Role }) {
  const [end, setEnd] = useState<PagesEnd | null>(null)
  if (end)
    return (
      <p style={{ color: 'var(--fg-dim)' }}>
        {end.how}
        {end.go ? ` · go: ${end.go}` : ''} ·{' '}
        <button style={{ background: 'none', border: 0, color: 'var(--accent-cyan)', font: 'inherit', cursor: 'pointer' }} onClick={() => setEnd(null)}>
          [show again]
        </button>
      </p>
    )
  const pages = kind === 'welcome' ? welcomePages(shown('welcome', { role }).pages, role, NAMES) : newsPages(SAMPLE_RELEASES)
  return <Pages kind={kind} pages={pages} onEnd={setEnd} />
}

export default example({
  name: 'Pages',
  place: 'onboarding/welcome',
  file: 'src/onboarding/Pages.tsx',
  note: 'the welcome on the first canvas, and what’s new after a release (D-315, D-316)',
  states: {
    welcome: () => <Fresh><Shown kind="welcome" /></Fresh>,
    'welcome: viewer': () => <Fresh role="viewer"><Shown kind="welcome" role="viewer" /></Fresh>,
    'second page': { render: () => <Fresh><Shown kind="welcome" /></Fresh>, setup: (c) => c.key('ArrowRight') , note: '→ steps on' },
    'what’s new': { render: () => <Fresh><Shown kind="news" /></Fresh>, note: 'releases.sample.ts' },
  },
})
