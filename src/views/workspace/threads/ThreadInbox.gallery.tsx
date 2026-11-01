import { example } from '../../../gallery/example'
import { onCanvas, P } from '../../../gallery/canvas'
import { threadMessages, withThreads } from '../../../gallery/panels'
import { toggleInbox } from './Threads'

// The list open, then one of its filters pressed as a person would (`[new 3]`, `[mentions 1]`, `[resolved 1]`).
const list = (filter?: string) => async () => {
  threadMessages()
  toggleInbox(true)
  if (!filter) return
  await new Promise((r) => setTimeout(r, 400))
  ;[...document.querySelectorAll<HTMLButtonElement>('[data-learn="threads"] button')].find((b) => b.textContent?.trim().startsWith(filter))?.click()
}

export default example({
  name: 'Threads panel',
  place: 'panels/comments',
  file: 'src/views/workspace/threads/ThreadInbox.tsx',
  note: 'every conversation in the workspace (D-197): the list and a thread, two halves',
  states: {
    'the list': onCanvas({ only: [P.lunch, P.product], change: withThreads, then: list() }),
    resolved: onCanvas({ only: [P.lunch, P.product], change: withThreads, then: list('resolved') }),
    mentions: onCanvas({ only: [P.lunch, P.product], change: withThreads, then: list('mentions') }),
    'inside a plane': onCanvas({ only: [P.lunch, P.product], focus: P.lunch, change: withThreads, then: () => (threadMessages(), toggleInbox(true, P.lunch)) }),
    empty: onCanvas({ only: [P.lunch], then: list() }),
  },
})
