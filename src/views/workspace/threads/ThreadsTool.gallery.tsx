import { useEffect, useState } from 'react'
import { example } from '../../../gallery/example'
import { PAZAR } from '../../../gallery/canvas'
import { threadMessages, THREADS, withThreads } from '../../../gallery/panels'
import { useThreadView } from './Threads'
import { ThreadsTool } from './ThreadsTool'

// You and the threads' messages in place before it draws (a state's `setup` runs after, too late for who you are).
function Fresh() {
  useState(threadMessages)
  return <ThreadsTool wid={PAZAR.wid} threads={THREADS} />
}

// The panel open while shown; closed again after, so the other states stay grey.
function Open() {
  useEffect(() => {
    useThreadView.setState({ inbox: true })
    return () => useThreadView.setState({ inbox: false })
  }, [])
  return <ThreadsTool wid={PAZAR.wid} threads={[]} />
}

export default example({
  name: 'ThreadsTool',
  place: 'hud/foot',
  file: 'src/views/workspace/threads/ThreadsTool.tsx',
  note: 'the threads tab on the screen’s foot, at its left (D-393): a magenta count with new ones (`@n` with a mention), its lamp lit while the list is open; fixed to the window’s foot',
  states: {
    'something new': { fixture: withThreads(PAZAR), render: () => <Fresh /> },
    'nothing new': { fixture: PAZAR, render: () => <ThreadsTool wid={PAZAR.wid} threads={[]} /> },
    open: { fixture: PAZAR, render: () => <Open /> },
  },
})
