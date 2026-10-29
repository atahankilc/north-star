// The tools the evals give the model (S11, D-312): since S12 the agent's own list (src/agent/tools.ts: the read
// tools, where_am_i, the stand-in `change`, the UI tools), so what the evals measure is what the browser runs.
export { AGENT_TOOLS as EVAL_TOOLS, WRITE_TOOLS, ID_KEYS, realIds, OPS_LINES } from '../src/agent/tools'
