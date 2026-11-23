// The workspace key's request filter (D-427, functions/src/request.ts) against what the agent sends
// (src/agent/openai.ts' requestBody): every field the agent uses passes as it is; what the agent never sends is dropped
// or refused (shared-code.md's "test cleanBody against requestBody()").
import { describe, expect, it } from 'vitest'
import { BadRequest, cleanBody, modelsAllowed } from '../../functions/src/request'
import { requestBody } from '../../src/agent/openai'
import type { ModelRequest } from '../../src/agent/contract'

const tool = { name: 'read_plane', description: 'Read a plane.', parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false } }
const req = (extra: Partial<ModelRequest> = {}): ModelRequest => ({
  messages: [
    { role: 'system', content: 'You are the agent.' },
    { role: 'user', content: 'What is on the plane?' },
  ],
  tools: [tool] as ModelRequest['tools'],
  ...extra,
})

describe("the agent's request through the workspace key", () => {
  it('passes whole: tools, reasoning, the cache key, store false', () => {
    const body = requestBody(req(), { model: 'gpt-5.6-terra', reasoning: 'medium', cacheKey: 'ns-1234abcd', maxOutputTokens: 4000 })
    expect(cleanBody(body)).toEqual(body)
  })
  it('passes with the web on (web_search, sources, a search cap)', () => {
    const body = requestBody(req({ web: true, searches: 15 }), { model: 'gpt-5.6-terra', reasoning: 'high' })
    expect(cleanBody(body)).toEqual(body)
  })
  it('passes with no tools and no reasoning', () => {
    const body = requestBody(req({ tools: [] }), { model: 'gpt-5.6-terra' })
    expect(cleanBody(body)).toEqual(body)
  })
  it('keeps answers unstored and streamed whatever is asked', () => {
    const body = { ...requestBody(req(), { model: 'gpt-5.6-terra' }), store: true, stream: false }
    expect(cleanBody(body)).toMatchObject({ store: false, stream: true })
  })
  it('drops what the agent never sends', () => {
    const body = { ...requestBody(req(), { model: 'gpt-5.6-terra' }), previous_response_id: 'r1', metadata: { a: 1 }, include: ['file_search_call.results'] }
    const out = cleanBody(body) as Record<string, unknown>
    expect(out.previous_response_id).toBeUndefined()
    expect(out.metadata).toBeUndefined()
    expect(out.include).toBeUndefined()
  })
  it('caps searches at a researcher\'s 15', () => {
    const body = { ...requestBody(req({ web: true }), { model: 'gpt-5.6-terra' }), max_tool_calls: 500 }
    expect(cleanBody(body).max_tool_calls).toBe(15)
  })
  it('refuses a built-in tool other than web search', () => {
    const body = { ...requestBody(req(), { model: 'gpt-5.6-terra' }), tools: [{ type: 'code_interpreter' }] }
    expect(() => cleanBody(body)).toThrow(BadRequest)
  })
  it('refuses a bad model id or effort', () => {
    expect(() => cleanBody({ ...requestBody(req(), { model: 'gpt-5.6-terra' }), model: 'a b' })).toThrow(BadRequest)
    expect(() => cleanBody({ ...requestBody(req(), { model: 'gpt-5.6-terra' }), reasoning: { effort: 'max' } })).toThrow(BadRequest)
  })
})

describe('the models the workspace key runs', () => {
  it("only the owners' pick", () => expect([...modelsAllowed({ allowedModels: ['gpt-5.6-terra'] })]).toEqual(['gpt-5.6-terra']))
  it('none picked, none', () => expect(modelsAllowed({}).size).toBe(0))
})
