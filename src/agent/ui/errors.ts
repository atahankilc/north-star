// The agent's errors in plain words (S14): what the chat and Settings → the agent say. No imports, so Settings can use
// it without the workspace's code.

export const KEY_REFUSED = 'your key was refused — check it in Settings → the agent'
export const NO_KEY = 'add your OpenAI key in Settings → the agent first: it stays in this browser'

export function plainError(raw: string): { text: string; settings?: boolean } {
  const m = raw.replace(/^the model failed: /, '')
  if (/didn't accept this key|key is needed/i.test(m)) return { text: /needed/i.test(m) ? NO_KEY : KEY_REFUSED, settings: true }
  if (/can't use .* Pick another model/i.test(m)) return { text: `${m.split(' Pick')[0]} — pick another model in the header or in Settings → the agent`, settings: true }
  if (/out of credit/i.test(m)) return { text: 'the OpenAI account behind your key is out of credit (or hit its spending limit)' }
  if (/Couldn't reach OpenAI/i.test(m)) return { text: "couldn't reach OpenAI — check your connection and send again" }
  return { text: m }
}

