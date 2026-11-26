import { useState } from 'react'
import { example } from '../../../gallery/example'
import { PAZAR } from '../../../gallery/canvas'
import { none } from '../../../gallery/samples'
import { threadMessages, THREADS, withThreads } from '../../../gallery/panels'
import { ThreadAside } from './ThreadAside'

// In a box as wide as a page that has room for it.
function Beside({ id, channel }: { id: string; channel?: boolean }) {
  useState(threadMessages)
  const thread = THREADS.find((t) => t.id === id)!
  return (
    <div style={{ containerType: 'inline-size', width: '100%', height: '100%', display: 'flex', justifyContent: 'flex-end' }}>
      <ThreadAside wid={PAZAR.wid} thread={thread} thing={channel ? { kind: 'channel', name: '# general' } : { kind: 'feature', name: 'Pickup shelf', tone: 'var(--type-feature)' }} where={channel ? undefined : '02 Product'} channel={!!channel} onShow={channel ? undefined : none} />
    </div>
  )
}

export default example({
  name: 'ThreadAside',
  place: 'panels/comments',
  file: 'src/views/workspace/threads/ThreadAside.tsx',
  note: 'what a conversation is about, beside it on Talk’s page where there’s room (D-435): a picture of where the thing is, who has written in it and who of them is here',
  states: {
    'a card': { size: [1200, 600], fixture: withThreads(PAZAR), render: () => <Beside id="t-pickup" /> },
    'a channel': { size: [1200, 600], fixture: withThreads(PAZAR), render: () => <Beside id="ch-general" channel /> },
  },
})
