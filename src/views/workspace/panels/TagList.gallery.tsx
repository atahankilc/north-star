import { useState } from 'react'
import { example } from '../../../gallery/example'
import { TagList } from './TagList'

function Demo({ start, editor = true, open = false, hash, word, inlineAdd, suggest, room }: { start: string[]; editor?: boolean; open?: boolean; hash?: boolean; word: string; inlineAdd?: boolean; suggest?: string[]; room?: number }) {
  const [items, setItems] = useState(start)
  const [draft, setDraft] = useState<string | null>(open ? '' : null)
  return (
    <div style={{ width: 340 }}>
      <TagList
        items={items}
        editor={editor}
        word={word}
        hash={hash}
        max={40}
        room={room}
        suggest={suggest}
        inlineAdd={inlineAdd}
        draft={draft}
        onDraft={setDraft}
        onAdd={(t) => setItems([...items, t])}
        onRemove={(t) => setItems(items.filter((x) => x !== t))}
      />
    </div>
  )
}

export default example({
  name: 'TagList',
  place: 'panels/cards',
  also: ['panels/tasks'],
  file: 'src/views/workspace/panels/TagList.tsx',
  note: 'chips with a + that types one more (D-361): a card’s tags, several cards’ tags, a task’s labels, a competitor’s regions',
  states: {
    tags: () => <Demo start={['lunch', 'b2b']} word="tag" />,
    'typing a tag': () => <Demo start={['lunch', 'b2b']} word="tag" open />,
    'labels with suggestions': () => <Demo start={['urgent']} word="label" open suggest={['design', 'backend', 'urgent', 'research']} room={20} />,
    'regions, + inline': () => <Demo start={['US', 'Germany']} word="region" hash={false} inlineAdd />,
    'read only': () => <Demo start={['lunch', 'b2b']} word="tag" editor={false} />,
  },
})
