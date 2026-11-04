import { example } from '../../gallery/example'
import { Markdown } from './Markdown'

const DOC = `# Pazar · interviews

What six home cooks told us in October.

## What they want

- pickup, not delivery
- to cook **once** for many orders
- a fixed menu each day

### Numbers

| cook | orders / day | price |
|---|---|---|
| Ayşe | 14 | €8 |
| Mert | 9 | €7.50 |

> "I don't want to run a restaurant. I want to cook a little more."

\`\`\`
orders close 21:00 the day before
\`\`\`

1. call the office park
2. test with ten people

Plain links work too: https://example.com/report, and \`snake_case_names\` or snake_case_names stay whole.`

export default example({
  name: 'Markdown',
  place: 'text/markdown',
  file: 'src/ui/primitives/Markdown.tsx',
  note: 'documents: headings, lists, tables, quotes, code',
  states: {
    document: () => (
      <div style={{ width: 640, maxHeight: '70vh', overflow: 'auto' }}>
        <Markdown text={DOC} />
      </div>
    ),
    links: () => (
      <div style={{ width: 480 }}>
        <Markdown text={'See [the survey](https://example.com) and [the notes](https://example.com/notes).'} links />
      </div>
    ),
  },
})
