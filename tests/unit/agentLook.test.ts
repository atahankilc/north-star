// D-327 phase 2: the `look` tool. A plane's and a canvas's picture (src/agent/read/picture.ts), the tool with and
// without a renderer, the picture carried to the model with the tool's result (never into the transcript), both
// adapters' image shapes, a cleared result losing its picture, resvg drawing a real PNG in node, and place_on's landing
// keeping clear of text (bug 6, found by these evals).
import { describe, expect, it } from 'vitest'
import { canvasPicture, LEGEND, planePicture } from '../../src/agent/picture'
import { makeIds } from '../../src/agent/read/ids'
import { workspaceMap } from '../../src/agent/read'
import { clean } from '../../src/agent/read/derive'
import { AGENT_TOOLS, TOOL_NAMES } from '../../src/agent/tools'
import { clearOldResults, runTurn } from '../../src/agent/loop'
import { stubModel } from '../../src/agent/stubModel'
import { toInput } from '../../src/agent/openai'
import { toClaude } from '../../src/agent/anthropic'
import { landing } from '../../src/model/placement'
import type { ImagePart, ModelMessage } from '../../src/agent/contract'
import { makeEnv } from '../../evals/env'
import { loadFixture } from '../../evals/fixtures'
import { nodeRender } from '../../evals/render'
import { realOf } from '../../evals/tasks/util'

const PNG: ImagePart = { mediaType: 'image/png', data: 'iVBORw0KGgo=' }
const look = AGENT_TOOLS.find((t) => t.def.name === 'look')!

describe('the picture', () => {
  const ws = clean(loadFixture('medium') as never)
  const ids = makeIds()
  workspaceMap(ws as never, ids)

  it('a plane: a box per card in its type colour with its short id, a line per link drawn, the plane\'s outline; words for the model', () => {
    const p = planePicture(ws, ids, realOf('medium', 'p1'))!
    expect(p.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(p.svg).toContain('>c4<')
    expect((p.svg.match(/<line /g) ?? []).length).toBe(11)
    expect(Math.max(p.w, p.h)).toBeLessThanOrEqual(1400)
    expect(p.text).toMatch(/^A picture of p1 "Segments" as it is now \(with your pending changes\): 33 cards, 0 unfolded packages, 11 links drawn/)
    expect(p.text).toContain(LEGEND)
    // A plane has no edge for its content (D-186, D-187): the words say how it fits the window, never "outside".
    expect(p.text).toMatch(/the app fits it into the plane's 2050 × 1125 window, shown there at \d+ %/)
    expect(p.text).not.toMatch(/outside/)
    expect(p.svg).not.toContain('stroke-dasharray="12')
    expect(planePicture(ws, ids, 'nope')).toBeNull()
  })

  it('text in the picture is escaped (a title is never markup)', () => {
    const evil = { ...ws, cards: ws.cards.map((c, i) => (i === 0 ? { ...c, title: '<script>&"x"</script>' } : c)) }
    const p = planePicture(evil, ids, ws.cards[0].pieceId)!
    expect(p.svg).not.toContain('<script>')
    expect(p.svg).toContain('&lt;script&gt;&amp;&quot;x&quot;')
  })

  it('a canvas: its planes with their card counts, a line between planes whose cards are linked, with the count', () => {
    const p = canvasPicture(ws, ids, realOf('medium', 'k1'))!
    expect(p.svg).toContain('plane · 33 cards')
    expect(p.svg).toMatch(/>33<\/text>/)
    expect(p.text).toMatch(/^A picture of k1/)
  })
})

describe('the look tool', () => {
  it('is a tool; with a renderer it gives the picture with its words; without one (or if it fails) words alone', async () => {
    expect(TOOL_NAMES).toContain('look')
    const env = makeEnv(loadFixture('medium'))
    workspaceMap(env.getWs() as never, env.ids)
    const seen: { w: number; h: number }[] = []
    env.render = async (svg, size) => (seen.push(size), svg.startsWith('<svg') ? PNG : null)
    const r = await look.run(env, { space: 'p1' })
    expect(r).toMatchObject({ ok: true, image: PNG, text: expect.stringMatching(/^A picture of p1/) })
    expect(seen).toHaveLength(1)
    env.render = async () => {
      throw new Error('no canvas')
    }
    expect(await look.run(env, { space: 'p1' })).toEqual({ ok: true, text: expect.stringMatching(/No picture can be drawn here/) })
    env.render = undefined
    expect((await look.run(env, { space: 'k1' })).image).toBeUndefined()
    expect((await look.run(env, { space: 'nothing like it' })).ok).toBe(false)
  })

  it('the picture reaches the model with the result, and stays out of the transcript', async () => {
    const env = makeEnv(loadFixture('medium'))
    env.render = async () => PNG
    const m = stubModel([{ calls: [{ name: 'look', args: { space: 'p1' } }] }, { answer: 'seen' }])
    const transcript = { model: 'stub', startedAt: 0, turns: [] }
    const { history } = await runTurn(m, env, AGENT_TOOLS, [], 'look at Segments', { transcript })
    const sent = m.seen[1].messages.find((x) => x.role === 'tool')
    expect(sent).toMatchObject({ role: 'tool', name: 'look', image: PNG })
    expect(history.find((x) => x.role === 'tool')).toMatchObject({ image: PNG })
    expect(JSON.stringify(transcript)).not.toContain(PNG.data)
  })

  it('a cleared result loses its picture too', () => {
    const msgs: ModelMessage[] = Array.from({ length: 12 }, (_, i) => ({ role: 'tool' as const, callId: `c${i}`, name: 'look', content: 'x'.repeat(500), image: PNG }))
    clearOldResults(msgs)
    expect(msgs[0]).not.toHaveProperty('image')
    expect(msgs[11]).toHaveProperty('image')
  })
})

describe('the adapters', () => {
  const msgs: ModelMessage[] = [
    { role: 'system', content: 'P' },
    { role: 'user', content: 'judge these', images: [PNG] },
    { role: 'assistant', content: '', toolCalls: [{ id: 'call_1', name: 'look', args: { space: 'p1' } }] },
    { role: 'tool', callId: 'call_1', name: 'look', content: 'A picture of p1', image: PNG },
  ]
  const url = `data:image/png;base64,${PNG.data}`

  it('OpenAI: a tool output as text and an input_image; a message with its images after its text', () => {
    const { input } = toInput(msgs)
    expect(input[0]).toEqual({ role: 'user', content: [{ type: 'input_text', text: 'judge these' }, { type: 'input_image', image_url: url }] })
    expect(input[2]).toEqual({ type: 'function_call_output', call_id: 'call_1', output: [{ type: 'input_text', text: 'A picture of p1' }, { type: 'input_image', image_url: url }] })
  })

  it('Claude: a tool_result with text and an image block; a message with its images after its text', () => {
    const { messages } = toClaude(msgs, 'claude-opus-5-5')
    const image = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG.data } }
    expect(messages[0]).toEqual({ role: 'user', content: [{ type: 'text', text: 'judge these' }, image] })
    expect(messages[2]).toEqual({ role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call_1', content: [{ type: 'text', text: 'A picture of p1' }, image] }] })
  })
})

describe('drawn for real, and kept clear', () => {
  it('resvg draws the picture into a PNG in node', async () => {
    const ws = clean(loadFixture('medium') as never)
    const ids = makeIds()
    workspaceMap(ws as never, ids)
    const p = planePicture(ws, ids, realOf('medium', 'p2'))!
    const png = await nodeRender(p.svg, { w: p.w, h: p.h })
    expect(png?.mediaType).toBe('image/png')
    expect(Buffer.from(png!.data, 'base64').subarray(1, 4).toString()).toBe('PNG')
  })

  it("place_on's landing keeps clear of the plane's text, not only its cards (bug 6)", () => {
    const card = { id: 'a', type: 'idea', pieceId: 'from', x: 0, y: 0 } as never
    const sticky = { x: 400, y: 250, w: 150, h: 125 }
    const at: [number, number] = [475, 300]
    const free = landing([card], [card], [], 'to', at, 'from')
    const clear = landing([card], [card], [], 'to', at, 'from', [sticky])
    const s = free.get('a')!
    expect(s.x < sticky.x + sticky.w && sticky.x < s.x + 200).toBe(true)
    expect(clear.get('a')!.x).toBeGreaterThanOrEqual(sticky.x + sticky.w)
  })
})
