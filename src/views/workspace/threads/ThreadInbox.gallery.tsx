import { example } from '../../../gallery/example'
import { onCanvas, P } from '../../../gallery/canvas'
import { threadMessages, withThreads } from '../../../gallery/panels'
import { toggleInbox } from './Threads'
import { demoThreads } from '../../../data/threads'
import { DEMO_DAY } from '../../../demo/clock'

// The list open, then a word at its foot pressed as a person would (`resolved · 1`, D-405).
const list = (press?: string, seen?: Record<string, number>) => async () => {
  threadMessages()
  if (seen) demoThreads.seen = seen
  toggleInbox(true)
  if (!press) return
  await new Promise((r) => setTimeout(r, 400))
  ;[...document.querySelectorAll<HTMLButtonElement>('[data-learn="threads"] button')].find((b) => b.textContent?.trim().startsWith(press))?.click()
}

export default example({
  name: 'Threads panel',
  place: 'panels/comments',
  file: 'src/views/workspace/threads/ThreadInbox.tsx',
  note: 'every conversation in the workspace (D-197): the list a column on the left ground, a conversation a column on the right (D-393); a row leading with the thing (D-398); what’s new on top, the read ones one line under their place, the resolved ones behind a word at the foot (D-405)',
  states: {
    'the list': onCanvas({ only: [P.lunch, P.product], change: withThreads, then: list(), note: 'everything new to you: all on top, under `NEW`' }),
    'some read': onCanvas({ only: [P.lunch, P.product], change: withThreads, then: list(undefined, { 't-break': DEMO_DAY, 't-cooks': DEMO_DAY }), note: 'two read: one line each, under their place' }),
    resolved: onCanvas({ only: [P.lunch, P.product], change: withThreads, then: list('resolved') }),
    'inside a plane': onCanvas({ only: [P.lunch, P.product], focus: P.lunch, change: withThreads, then: () => (threadMessages(), toggleInbox(true, P.lunch)) }),
    empty: onCanvas({ only: [P.lunch], then: list() }),
  },
})
