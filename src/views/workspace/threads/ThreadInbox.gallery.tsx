import { example } from '../../../gallery/example'
import { onCanvas, P } from '../../../gallery/canvas'
import { threadMessages, withThreads } from '../../../gallery/panels'
import { toggleInbox } from './Threads'

// The list open, then one of its views pressed as a person would (`new 3`, `@you 1`, `done 1`).
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
  note: 'every conversation in the workspace (D-197): the list a column on the left ground, a conversation a column on the right (D-393); the threads under their place, a row leading with the thing (D-398)',
  states: {
    'the list': onCanvas({ only: [P.lunch, P.product], change: withThreads, then: list() }),
    resolved: onCanvas({ only: [P.lunch, P.product], change: withThreads, then: list('done') }),
    mentions: onCanvas({ only: [P.lunch, P.product], change: withThreads, then: list('@you') }),
    'inside a plane': onCanvas({ only: [P.lunch, P.product], focus: P.lunch, change: withThreads, then: () => (threadMessages(), toggleInbox(true, P.lunch)) }),
    empty: onCanvas({ only: [P.lunch], then: list() }),
  },
})
