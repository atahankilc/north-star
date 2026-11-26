import { example } from '../../../gallery/example'
import { onCanvas, P } from '../../../gallery/canvas'
import { threadMessages, withThreads } from '../../../gallery/panels'
import { openThread, startComment, toggleInbox } from './Threads'
import { demoThreads } from '../../../data/threads'
import { DEMO_DAY } from '../../../demo/clock'

export default example({
  name: 'Threads',
  place: 'panels/comments',
  file: 'src/views/workspace/threads/Threads.tsx',
  note: 'comments on components (D-192): chips under what they’re on, and a conversation (D-435): its head the thing, its messages lines, a run of one writer’s under one name',
  states: {
    'chips on cards': onCanvas({ only: [P.lunch], focus: P.lunch, change: withThreads, then: threadMessages, note: 'magenta: new to you; `@`: you’re mentioned' }),
    'thread open': onCanvas({ only: [P.product], focus: P.product, change: withThreads, then: () => (threadMessages(), openThread('t-pickup')) }),
    'thread from the list': onCanvas({ only: [P.lunch, P.product], change: withThreads, then: () => (threadMessages(), toggleInbox(true), openThread('t-break')) }),
    'yours and theirs': onCanvas({ only: [P.lunch, P.product], change: withThreads, then: () => (threadMessages(), toggleInbox(true), openThread('t-pickup')), note: 'yours like everyone’s; its tools while pointed at' }),
    'new since you looked': onCanvas({
      only: [P.lunch, P.product], change: withThreads,
      then: () => (threadMessages(), (demoThreads.seen = { 't-pickup': DEMO_DAY - 100 * 60 * 1000 }), toggleInbox(true), openThread('t-pickup')),
      note: 'a magenta `NEW` line over the first message you hadn’t read (D-405)',
    }),
    'over days': onCanvas({
      only: [P.lunch, P.product], change: withThreads,
      then: () => (threadMessages(), toggleInbox(true), openThread('t-cooks')),
      note: 'each day’s name, the clock instead of how long ago (D-405)',
    }),
    'new comment': onCanvas({
      only: [P.lunch], focus: P.lunch, change: withThreads,
      then: () => (threadMessages(), startComment({ on: 'card', targetId: 'r-same', planeId: P.lunch, at: [650, 250] })),
      note: 'a new conversation on a card, typing',
    }),
  },
})
