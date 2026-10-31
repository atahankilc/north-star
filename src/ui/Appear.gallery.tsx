import { example } from '../gallery/example'
import { Appear } from './Appear'

const box = { width: 320, padding: 'var(--space-6)', border: '1px solid var(--line-hover)', background: 'var(--bg-raised)' }

export default example({
  name: 'Appear',
  place: 'motion/entrance',
  file: 'src/ui/Appear.tsx',
  note: 'the one entrance: cell by cell in random order (D-034); \\ plays it again; reduced motion: there at once',
  states: {
    default: () => (
      <Appear style={box}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-display)' }}>Pazar</h3>
        <p style={{ color: 'var(--fg-dim)' }}>Home cooks sell tomorrow’s lunch to the offices round the corner.</p>
      </Appear>
    ),
    slow: { render: () => (
      <Appear style={box} duration={2000}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-display)' }}>Pazar</h3>
        <p style={{ color: 'var(--fg-dim)' }}>2000 ms, to watch the cells.</p>
      </Appear>
    ) },
    staggered: () => (
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        {['customers', 'problems', 'competitors', 'ideas'].map((t, i) => (
          <Appear key={t} delay={i * 120} style={{ ...box, padding: 'var(--space-3)' }}>
            {t}
          </Appear>
        ))}
      </div>
    ),
  },
})
