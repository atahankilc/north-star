import { example } from '../../../gallery/example'
import { onCanvas, P } from '../../../gallery/canvas'
import { threadMessages, withThreads } from '../../../gallery/panels'
import { setPage } from '../places/placeStore'
import { openThread, toggleInbox } from './Threads'
import { demoThreads } from '../../../data/threads'
import { DEMO_DAY } from '../../../demo/clock'

// The list open, then a word at its foot pressed as a person would (`resolved · 1`, D-405).
const list = (press?: string, seen?: Record<string, number>) => async () => {
  threadMessages()
  if (seen) demoThreads.seen = seen
  toggleInbox(true)
  if (!press) return
  await new Promise((r) => setTimeout(r, 400))
  ;[...document.querySelectorAll<HTMLButtonElement>('[data-learn="threads"] button')].find((b) => b.textContent?.includes(press))?.click()
}

// Talk as the page, a conversation open in it.
const page = (id?: string) => () => (threadMessages(), toggleInbox(true), id && openThread(id), setPage(true))

export default example({
  name: 'Talk',
  place: 'panels/comments',
  file: 'src/views/workspace/threads/ThreadInbox.tsx',
  note: 'Talk (D-435): every conversation in the workspace; beside the canvas a column, the list two lines a row (what’s new, the channels, what’s said on the canvas, the resolved ones behind a word), a conversation with the list as a rail on its left; as the page the list, the conversation and what it’s about',
  states: {
    'the list': onCanvas({ only: [P.lunch, P.product], change: withThreads, then: list(), note: 'everything new to you: all on top, under `NEW`' }),
    'some read': onCanvas({ only: [P.lunch, P.product], change: withThreads, then: list(undefined, { 't-break': DEMO_DAY, 't-cooks': DEMO_DAY }), note: 'two read: under ON THE CANVAS' }),
    resolved: onCanvas({ only: [P.lunch, P.product], change: withThreads, then: list('resolved') }),
    'inside a plane': onCanvas({ only: [P.lunch, P.product], focus: P.lunch, change: withThreads, then: () => (threadMessages(), toggleInbox(true, P.lunch)) }),
    'a conversation and the rail': onCanvas({ only: [P.lunch, P.product], change: withThreads, then: () => (threadMessages(), toggleInbox(true), openThread('t-pickup')) }),
    'as the page': onCanvas({ only: [P.lunch, P.product], change: withThreads, then: page('t-pickup') }),
    'as the page, nothing picked': onCanvas({ only: [P.lunch, P.product], change: withThreads, then: page() }),
    empty: onCanvas({ only: [P.lunch], then: list() }),
  },
})
