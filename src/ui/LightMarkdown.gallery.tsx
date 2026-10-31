import { example } from '../gallery/example'
import { LightMarkdown } from './LightMarkdown'

const TEXT = `Talked to **six cooks** this week.

- two already sell on *Instagram*
- all want pickup, not delivery
- one asked about \`VAT\`

1. call the office park
2. read [their survey](https://example.com)`

export default example({
  name: 'LightMarkdown',
  section: 'ui',
  file: 'src/ui/LightMarkdown.tsx',
  note: 'paragraphs and sticky notes: bold, italic, code, links, bullets, numbers',
  states: {
    default: () => (
      <div style={{ width: 360 }}>
        <LightMarkdown text={TEXT} />
      </div>
    ),
    'canvas mark': () => (
      <div style={{ width: 360 }}>
        <LightMarkdown text={TEXT} mark="•" />
      </div>
    ),
    ink: { render: () => (
      <div style={{ width: 360 }}>
        <LightMarkdown text={TEXT} ink />
      </div>
    ), note: 'each line on its own shade (D-277)' },
  },
})
