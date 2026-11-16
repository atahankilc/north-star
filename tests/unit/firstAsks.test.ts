// The empty chat's first asks call a deck late as the deck itself does (D-394): a task past its day, not finished.
import { describe, expect, it } from 'vitest'
import { firstAsks } from '../../src/agent/ui/suggest'
import type { WorkspaceCtx } from '../../src/state/wsStore'

const deck = { id: 'k', kind: 'kanban', name: 'Build', kanban: { cols: [{ id: 'todo', name: 'todo' }, { id: 'done', name: 'done', done: true }] } }
const ws = (col: string, due: string) => ({ pieces: [deck], cards: [], evidence: [], tasks: [{ id: 't', pieceId: 'k', col, due }] }) as unknown as WorkspaceCtx

describe('firstAsks', () => {
  it('a task past its day makes its deck late', () => {
    expect(firstAsks(ws('todo', '2001-01-01'))).toContain('what\'s late on "Build"?')
  })
  it('a finished task past its day does not', () => {
    expect(firstAsks(ws('done', '2001-01-01'))).toContain('what\'s next on "Build"?')
  })
  it('a task due far ahead does not', () => {
    expect(firstAsks(ws('todo', '2999-01-01'))).toContain('what\'s next on "Build"?')
  })
})
