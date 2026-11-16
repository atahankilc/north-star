// What the provider adapters share (D-399, src/agent/provider.ts), and the small helpers the logic twins got.
import { describe, expect, it } from 'vitest'
import { abortError, ProviderError, respondFrom } from '../../src/agent/provider'
import { OpenAIError } from '../../src/agent/openai'
import { AnthropicError } from '../../src/agent/anthropic'
import type { ModelEvent, ModelResponse } from '../../src/agent/contract'
import { pieceName } from '../../src/ops/util'
import { OpsRefused } from '../../src/ops/types'
import { PIECE_NAME_MAX } from '../../src/model/limits'
import { authorName } from '../../src/model/words'
import { BOX_TONES, DOC_VIEWS, HEADING_SIZES, KANBAN_ROWS, STANCES, TEXT_SCALES, TIMELINE_ROWS } from '../../src/model/shapes'
import { LANES } from '../../src/ops/deck'

async function* events(list: ModelEvent[]) {
  yield* list
}

describe('provider', () => {
  it("each provider's error is a ProviderError under its own name", () => {
    const a = new OpenAIError('no', 'auth', 401)
    const b = new AnthropicError('no', 'quota')
    expect([a instanceof ProviderError, a.name, a.kind, a.status]).toEqual([true, 'OpenAIError', 'auth', 401])
    expect([b instanceof ProviderError, b.name, b.kind, b.status]).toEqual([true, 'AnthropicError', 'quota', undefined])
  })
  it('a stop is one error for both', () => {
    expect([abortError().name, abortError().message]).toEqual(['AbortError', 'Stopped.'])
  })
  it('respondFrom gives the done answer, or the provider’s own error when the stream ends without one', async () => {
    const response = { text: 'hi' } as ModelResponse
    expect(await respondFrom(events([{ type: 'text', delta: 'h' } as ModelEvent, { type: 'done', response }]), (m) => new Error(m))).toBe(response)
    await expect(respondFrom(events([]), (m) => new OpenAIError(m, 'stream'))).rejects.toMatchObject({ name: 'OpenAIError', kind: 'stream', message: 'The answer stopped before it finished.' })
  })
})

describe('the small twins', () => {
  it("pieceName: not said or blank leaves it, text is trimmed and cut, anything else is refused", () => {
    expect(pieceName('update_table', undefined)).toBeUndefined()
    expect(pieceName('update_table', '   ')).toBeUndefined()
    expect(pieceName('update_table', '  Rivals ')).toBe('Rivals')
    expect(pieceName('update_table', 'x'.repeat(500))).toHaveLength(PIECE_NAME_MAX)
    expect(() => pieceName('update_table', 3)).toThrow(OpsRefused)
  })
  it('authorName: the name, else the email, else Someone', () => {
    expect([authorName({ name: 'Ada', email: 'a@b.c' }), authorName({ name: '', email: 'a@b.c' }), authorName({}), authorName(null)]).toEqual(['Ada', 'a@b.c', 'Someone', 'Someone'])
  })
  it('the value lists are the ones stored', () => {
    expect(STANCES).toEqual(['supports', 'contradicts'])
    expect(HEADING_SIZES).toEqual(['heading', 'subheading', 'minor'])
    expect(TEXT_SCALES).toEqual(['small', 'medium', 'large'])
    expect(KANBAN_ROWS).toEqual(['assignee', 'card'])
    expect(LANES).toBe(KANBAN_ROWS)
    expect(TIMELINE_ROWS).toEqual(['kanban', 'assignee', 'card'])
    expect(DOC_VIEWS).toEqual(['table', 'shelf'])
    expect(BOX_TONES).toEqual(['good', 'bad'])
  })
})
