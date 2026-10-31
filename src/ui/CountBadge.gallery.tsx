import type { ReactNode } from 'react'
import { example } from '../gallery/example'
import { CountBadge } from './CountBadge'

// An icon button the badge sits on, as the side nav's and the corner's are.
const OnButton = ({ children }: { children: ReactNode }) => (
  <button type="button" aria-label="tasks" style={{ position: 'relative', display: 'grid', placeItems: 'center', width: 32, height: 32, border: '1px solid var(--line-hover)', background: 'none', color: 'var(--fg-dim)' }}>
    ☐{children}
  </button>
)
const row = (items: [string, ReactNode][]) => (
  <div style={{ display: 'flex', gap: 'var(--space-12)', alignItems: 'flex-end' }}>
    {items.map(([k, n]) => (
      <div key={k} style={{ display: 'grid', gap: 'var(--space-3)', justifyItems: 'center' }}>
        {n}
        <span style={{ color: 'var(--fg-faint)', fontSize: 'var(--text-xs)' }}>{k}</span>
      </div>
    ))}
  </div>
)

export default example({
  name: 'CountBadge',
  place: 'feedback/badges',
  also: ['hud/corner'],
  file: 'src/ui/CountBadge.tsx',
  note: 'a count on something (D-326): magenta new since you looked, cyan something to see to; 9+ past nine, gone at 0',
  states: {
    counts: () => row([0, 1, 9, 12].map((n) => [String(n), <OnButton key={n}><CountBadge count={n} /></OnButton>])),
    cyan: () => row([1, 3, 24].map((n) => [String(n), <OnButton key={n}><CountBadge count={n} tone="cyan" /></OnButton>])),
    inline: () => (
      <p style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', color: 'var(--fg-dim)' }}>
        people <CountBadge count={3} tone="cyan" placement="inline" /> · mentions <CountBadge count={14} placement="inline" />
      </p>
    ),
    'max 99': () => row([[`120, max 99`, <OnButton key="m"><CountBadge count={120} max={99} /></OnButton>]]),
  },
})
