// @vitest-environment happy-dom
// A document nothing shows has no place to go to: the finder still finds it, to open in its own window.
import { describe, expect, it } from 'vitest'
import { aloneGroups } from '../../src/views/workspace/find/findIndex'

const doc = (id: string, title = 'SWOT') => ({ id, title, kind: 'markdown', uid: 'me', name: 'me', shared: false, origin: 'assistant', size: 1, createdAt: 1, updatedAt: 1 }) as never
const piece = (o: object) => ({ id: 'p', x: 0, y: 0, w: 1, h: 1, ...o }) as never
const bodies = { d1: { text: 'the moat is thin' } }
const re = /moat/gi

describe('aloneGroups', () => {
  it('finds a document in no list, by its text', () => {
    const g = aloneGroups([doc('d1')], [], bodies, re, 'me')
    expect(g).toHaveLength(1)
    expect(g[0].rows[0].dest).toMatchObject({ kind: 'alone', doc: { id: 'd1' } })
  })
  it('leaves one a list takes, or a piece shows, to where it is', () => {
    expect(aloneGroups([doc('d1')], [piece({ kind: 'documents', documents: { view: 'table' } })], bodies, re, 'me')).toEqual([])
    expect(aloneGroups([doc('d1')], [piece({ kind: 'document', docId: 'd1' })], bodies, re, 'me')).toEqual([])
  })
  it('counts it as alone when the only list leaves its kind out', () => {
    expect(aloneGroups([doc('d1')], [piece({ kind: 'documents', documents: { view: 'table', kinds: ['pdf'] } })], bodies, re, 'me')).toHaveLength(1)
  })
})
