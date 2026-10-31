// The foundations floor of the gallery (D-326): every token in src/styles/tokens.css, read from the page's own style
// sheets as they are now (so a token changed there shows here at once, in the theme picked), grouped by what it is:
// colours as swatches, type as samples, spacing and sizes as bars, durations as a moving dot, the rest as values.
import { useEffect, useState, type CSSProperties } from 'react'
import { example } from './example'
import { useTheme } from '../state/theme'

type Token = { name: string; value: string }

// Every custom property declared on :root (and the light theme's), in the order written.
function readTokens(): Token[] {
  const names: string[] = []
  const walk = (rules: CSSRuleList) => {
    for (const r of Array.from(rules)) {
      if (r instanceof CSSStyleRule && /^:root\b/.test(r.selectorText))
        for (const p of Array.from(r.style)) if (p.startsWith('--') && !names.includes(p)) names.push(p)
      if ('cssRules' in r && (r as CSSGroupingRule).cssRules) walk((r as CSSGroupingRule).cssRules)
    }
  }
  for (const s of Array.from(document.styleSheets)) {
    try {
      walk(s.cssRules)
    } catch {
      // Another origin's sheet: none of ours.
    }
  }
  const cs = getComputedStyle(document.documentElement)
  return names.map((name) => ({ name, value: cs.getPropertyValue(name).trim() }))
}

const GROUPS: { id: string; title: string; test: RegExp }[] = [
  { id: 'colour', title: 'colour', test: /^--(bg|fg|line|edge|accent|surface|wash|scrim|menu|chip|card|piece|placeholder|grid|on-|ink|paper|sticky|link|diff|night|pom|mix|o-|dot)/ },
  { id: 'type', title: 'type', test: /^--(font|text|track|weight|lh)/ },
  { id: 'space', title: 'spacing and sizes', test: /^--(space|size|control|w-|hud|corner|head|measure|line-w|modal)/ },
  { id: 'motion', title: 'motion', test: /^--(dur|ease|mark-spring)/ },
  { id: 'marks', title: 'marks', test: /^--mark/ },
  { id: 'layers', title: 'layers', test: /^--z/ },
]
const groupOf = (t: Token) => GROUPS.find((g) => g.test.test(t.name))?.id ?? 'other'
const isColour = (v: string) => /^(#|rgb|hsl|color-mix|oklch|transparent)/.test(v)

const cell: CSSProperties = { display: 'grid', gridTemplateColumns: '220px 1fr', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-1) 0', borderBottom: '1px solid var(--line)' }
const nameStyle: CSSProperties = { color: 'var(--fg-dim)', fontSize: 'var(--text-xs)' }

function Row({ t, group }: { t: Token; group: string }) {
  let show: React.ReactNode = <code style={{ color: 'var(--fg-muted)', fontSize: 'var(--text-xs)' }}>{t.value}</code>
  if (group === 'colour' && isColour(t.value))
    show = (
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span style={{ width: 48, height: 20, background: `var(${t.name})`, border: '1px solid var(--line-hover)' }} />
        <code style={{ color: 'var(--fg-faint)', fontSize: 'var(--text-xs)' }}>{t.value}</code>
      </span>
    )
  else if (t.name.startsWith('--text-')) show = <span style={{ fontSize: `var(${t.name})`, fontFamily: 'var(--font-display)', whiteSpace: 'nowrap' }}>Home cooks · {t.value}</span>
  else if (t.name.startsWith('--font-')) show = <span style={{ fontFamily: `var(${t.name})` }}>Pazar 0123 — {t.value.split(',')[0]}</span>
  else if (group === 'space' && /^-?\d+(\.\d+)?px$/.test(t.value))
    show = (
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span style={{ width: `min(var(${t.name}), 100%)`, height: 8, background: 'var(--accent-cyan)' }} />
        <code style={{ color: 'var(--fg-faint)', fontSize: 'var(--text-xs)' }}>{t.value}</code>
      </span>
    )
  else if (t.name.startsWith('--dur-')) show = <Duration t={t} />
  return (
    <div style={cell}>
      <span style={nameStyle}>{t.name}</span>
      {show}
    </div>
  )
}

// A dot crossing its track in the duration, again and again (still under reduced motion: the global rule).
function Duration({ t }: { t: Token }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <span style={{ position: 'relative', width: 160, height: 8, borderBottom: '1px solid var(--line-hover)' }}>
        <span className="gallery-dur" style={{ position: 'absolute', left: 0, top: 0, width: 8, height: 8, background: 'var(--accent-magenta)', animation: `gallery-dur calc(var(${t.name}) * 3) var(--ease-out) infinite alternate` }} />
      </span>
      <code style={{ color: 'var(--fg-faint)', fontSize: 'var(--text-xs)' }}>{t.value}</code>
    </span>
  )
}

function Tokens({ only }: { only: string }) {
  const theme = useTheme((s) => s.theme)
  const [tokens, setTokens] = useState<Token[]>([])
  useEffect(() => setTokens(readTokens()), [theme])
  const shown = tokens.filter((t) => groupOf(t) === only)
  return (
    <div style={{ width: 'min(880px, 100%)', maxHeight: '100%', overflow: 'auto', padding: 'var(--space-6)' }}>
      <style>{'@keyframes gallery-dur { to { transform: translateX(152px); } }'}</style>
      <p style={{ color: 'var(--fg-faint)', fontSize: 'var(--text-xs)', margin: '0 0 var(--space-4)' }}>
        {shown.length} tokens · src/styles/tokens.css · {theme}
      </p>
      {shown.map((t) => (
        <Row key={t.name} t={t} group={only} />
      ))}
    </div>
  )
}

export default example({
  name: 'Tokens',
  place: 'foundations/tokens',
  file: 'src/styles/tokens.css',
  note: 'every token as it is now, in the theme picked (D-069, D-325); read from the page’s style sheets',
  states: Object.fromEntries([...GROUPS.map((g) => [g.title, { size: 'full' as const, render: () => <Tokens only={g.id} /> }]), ['other', { size: 'full' as const, render: () => <Tokens only="other" /> }]]),
})
