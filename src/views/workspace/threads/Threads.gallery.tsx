import { example } from '../../../gallery/example'
import { onCanvas, P } from '../../../gallery/canvas'
import { threadMessages, withThreads } from '../../../gallery/panels'
import { openThread, startComment, toggleInbox } from './Threads'

export default example({
  name: 'Threads',
  place: 'panels/comments',
  file: 'src/views/workspace/threads/Threads.tsx',
  note: 'comments on components (D-192): chips under what they’re on, a thread’s panel',
  states: {
    'chips on cards': onCanvas({ only: [P.lunch], focus: P.lunch, change: withThreads, then: threadMessages, note: 'magenta: new to you; `@`: you’re mentioned' }),
    'thread open': onCanvas({ only: [P.product], focus: P.product, change: withThreads, then: () => (threadMessages(), openThread('t-pickup')) }),
    'thread from the list': onCanvas({ only: [P.lunch, P.product], change: withThreads, then: () => (threadMessages(), toggleInbox(true), openThread('t-break')) }),
    'new comment': onCanvas({
      only: [P.lunch], focus: P.lunch, change: withThreads,
      then: () => (threadMessages(), startComment({ on: 'card', targetId: 'r-same', planeId: P.lunch, at: [650, 250] })),
      note: 'a new conversation on a card, typing',
    }),
  },
})
