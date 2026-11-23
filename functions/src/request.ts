// What the workspace key may be asked for (D-427): the agent's own request (src/agent/openai.ts' `requestBody`), field
// by field; anything else is dropped or refused. Answers are streamed and never stored at OpenAI. Kept apart from
// index.ts so it's tested against `requestBody()` without Firebase (tests/unit/workspaceKeyRequest.test.ts).

const EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh']
const INCLUDES = ['reasoning.encrypted_content', 'web_search_call.action.sources']
// The agent's tools are functions; the one built-in it uses is OpenAI's web search (D-360). No other built-in (they
// cost the workspace's account in ways the owners never chose).
const TOOL_TYPES = ['function', 'web_search']

const MAX = {
  instructions: 400_000,
  input: 4000,
  tools: 64,
  // A researcher may search up to 15 times (D-360, src/agent/web.ts).
  searches: 15,
  outputTokens: 128_000,
  cacheKey: 64,
}

export class BadRequest extends Error {}
const bad = (what: string): never => {
  throw new BadRequest(what)
}

export const MODEL_ID = /^[A-Za-z0-9._:-]{1,100}$/

export function cleanBody(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>
  if (typeof b.model !== 'string' || !MODEL_ID.test(b.model)) bad('model')
  if (b.instructions !== undefined && (typeof b.instructions !== 'string' || b.instructions.length > MAX.instructions)) bad('instructions')
  if (!Array.isArray(b.input) || b.input.length > MAX.input) bad('input')
  const tools = b.tools
  if (tools !== undefined) {
    if (!Array.isArray(tools) || tools.length > MAX.tools) bad('tools')
    for (const t of tools as unknown[]) if (!t || typeof t !== 'object' || !TOOL_TYPES.includes(String((t as { type?: unknown }).type))) bad('tools')
  }
  const reasoning = b.reasoning as { effort?: unknown } | undefined
  if (reasoning !== undefined && (typeof reasoning !== 'object' || !EFFORTS.includes(String(reasoning?.effort)))) bad('reasoning')
  const include = Array.isArray(b.include) ? b.include.filter((x): x is string => INCLUDES.includes(String(x))) : []
  const searches = typeof b.max_tool_calls === 'number' && Number.isInteger(b.max_tool_calls) ? Math.min(Math.max(b.max_tool_calls, 1), MAX.searches) : undefined
  const output = typeof b.max_output_tokens === 'number' && Number.isInteger(b.max_output_tokens) ? Math.min(Math.max(b.max_output_tokens, 1), MAX.outputTokens) : undefined
  const cacheKey = typeof b.prompt_cache_key === 'string' && b.prompt_cache_key.length <= MAX.cacheKey ? b.prompt_cache_key : undefined
  return {
    model: b.model as string,
    ...(b.instructions !== undefined ? { instructions: b.instructions as string } : {}),
    input: b.input as unknown[],
    ...(tools ? { tools, tool_choice: b.tool_choice === 'none' || b.tool_choice === 'required' ? b.tool_choice : 'auto', parallel_tool_calls: b.parallel_tool_calls !== false } : {}),
    ...(searches ? { max_tool_calls: searches } : {}),
    ...(reasoning ? { reasoning: { effort: reasoning.effort as string } } : {}),
    ...(include.length ? { include } : {}),
    ...(output ? { max_output_tokens: output } : {}),
    ...(cacheKey ? { prompt_cache_key: cacheKey } : {}),
    store: false,
    stream: true,
  }
}

// The models the workspace key runs (D-427): the owners' pick (`allowedModels`); none picked, none.
export const modelsAllowed = (config: { allowedModels?: unknown }) =>
  new Set(Array.isArray(config.allowedModels) ? config.allowedModels.filter((m): m is string => typeof m === 'string') : [])
