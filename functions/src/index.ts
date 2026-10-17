// The only server code (D-079): a workspace's shared OpenAI key lives here and nowhere else.
// The key is encrypted with AI_KEY_SECRET and kept in aiSecrets/{wid}, which no client can read (firestore.rules).
// Members the owner allows call OpenAI through `ai`, which streams the answer back and logs what each call used.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { onDocumentDeleted } from 'firebase-functions/firestore'
import { HttpsError, onCall, onRequest } from 'firebase-functions/https'
import { logger } from 'firebase-functions'
import { setGlobalOptions } from 'firebase-functions/options'
import { defineSecret } from 'firebase-functions/params'

initializeApp()
setGlobalOptions({ region: 'europe-west1', maxInstances: 10 })

const AI_KEY_SECRET = defineSecret('AI_KEY_SECRET')
// OPENAI_API_BASE is set only in functions/.env.local, for emulator tests against a fake OpenAI; never deployed.
const OPENAI = process.env.OPENAI_API_BASE ?? 'https://api.openai.com/v1'
// The Pages site and local dev servers.
const ORIGINS = [/^https:\/\/atahankilc\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/]

type Access = 'everyone' | 'chosen'
type AiConfig = { hasKey?: boolean; keyHint?: string; access?: Access; allowed?: string[] }
type Workspace = { ownerId: string; memberIds: string[] }

const db = () => getFirestore()
const configRef = (wid: string) => db().doc(`workspaces/${wid}/ai/config`)
const secretRef = (wid: string) => db().doc(`aiSecrets/${wid}`)

// ---- The key at rest: AES-256-GCM with a key derived from the secret ----

function cipherKey() {
  return createHash('sha256').update(AI_KEY_SECRET.value()).digest()
}

function encrypt(text: string) {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', cipherKey(), iv)
  const data = Buffer.concat([c.update(text, 'utf8'), c.final()])
  return { data: data.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64') }
}

function decrypt(box: { data: string; iv: string; tag: string }) {
  const d = createDecipheriv('aes-256-gcm', cipherKey(), Buffer.from(box.iv, 'base64'))
  d.setAuthTag(Buffer.from(box.tag, 'base64'))
  return Buffer.concat([d.update(Buffer.from(box.data, 'base64')), d.final()]).toString('utf8')
}

// OpenAI quotes part of a bad key in its errors; never pass that on.
const scrub = (text: string) => text.replace(/sk-[A-Za-z0-9_*.-]+/g, 'sk-…')

async function workspaceOf(wid: unknown): Promise<Workspace> {
  if (typeof wid !== 'string' || !/^[A-Za-z0-9]{1,128}$/.test(wid)) throw new HttpsError('invalid-argument', 'No such workspace.')
  const snap = await db().doc(`workspaces/${wid}`).get()
  if (!snap.exists) throw new HttpsError('not-found', 'No such workspace.')
  return snap.data() as Workspace
}

// ---- Owner: set, replace or remove the workspace key ----

export const setWorkspaceKey = onCall({ secrets: [AI_KEY_SECRET], cors: ORIGINS }, async (req) => {
  const uid = req.auth?.uid
  const { wid, key } = (req.data ?? {}) as { wid?: unknown; key?: unknown }
  const ws = await workspaceOf(wid)
  if (!uid || ws.ownerId !== uid) throw new HttpsError('permission-denied', 'Only the owner manages the workspace key.')
  const id = wid as string

  if (key === '' || key === null) {
    await secretRef(id).delete()
    await configRef(id).set({ hasKey: false, keyHint: FieldValue.delete(), keySetAt: FieldValue.delete() }, { merge: true })
    return { keyHint: null }
  }
  if (typeof key !== 'string' || !/^sk-[A-Za-z0-9_-]{20,300}$/.test(key.trim())) {
    throw new HttpsError('invalid-argument', "That doesn't look like an OpenAI API key.")
  }
  const clean = key.trim()
  // A free call that proves the key works.
  const check = await fetch(`${OPENAI}/models`, { headers: { Authorization: `Bearer ${clean}` } })
  if (!check.ok) throw new HttpsError('failed-precondition', check.status === 401 ? "OpenAI didn't accept this key." : `OpenAI answered ${check.status}.`)

  const keyHint = `${clean.slice(0, 3)}…${clean.slice(-4)}`
  await secretRef(id).set({ ...encrypt(clean), setBy: uid, setAt: Date.now() })
  await configRef(id).set({ hasKey: true, keyHint, keySetAt: Date.now() }, { merge: true })
  return { keyHint }
})

// ---- Owner: members' names, for choosing who may use the key ----

export const aiMembers = onCall({ cors: ORIGINS }, async (req) => {
  const uid = req.auth?.uid
  const ws = await workspaceOf((req.data as { wid?: unknown } | undefined)?.wid)
  if (!uid || ws.ownerId !== uid) throw new HttpsError('permission-denied', 'Only the owner sees this.')
  const { users } = await getAuth().getUsers(ws.memberIds.map((id) => ({ uid: id })))
  return users.map((u) => ({ uid: u.uid, name: u.displayName ?? u.email ?? 'Someone', email: u.email ?? null }))
})

// ---- Members: one OpenAI call on the workspace key, streamed back and logged ----

type Usage = {
  input_tokens?: number
  output_tokens?: number
  input_tokens_details?: { cached_tokens?: number }
  output_tokens_details?: { reasoning_tokens?: number }
}

// Only what the assistant sends; everything else is dropped. Answers are streamed and never stored at OpenAI.
function cleanBody(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>
  if (typeof b.model !== 'string' || !/^[A-Za-z0-9._:-]{1,100}$/.test(b.model)) throw new Error('model')
  if (typeof b.instructions !== 'string' || b.instructions.length > 400_000) throw new Error('instructions')
  if (!Array.isArray(b.input) || b.input.length > 200) throw new Error('input')
  if (b.tools !== undefined && (!Array.isArray(b.tools) || b.tools.length > 5)) throw new Error('tools')
  return {
    model: b.model,
    instructions: b.instructions,
    input: b.input,
    ...(b.tools ? { tools: b.tools, tool_choice: b.tool_choice === 'none' || b.tool_choice === 'required' ? b.tool_choice : 'auto', parallel_tool_calls: false } : {}),
    ...(b.reasoning ? { reasoning: b.reasoning } : {}),
    // Reasoning carried between an answer's steps (D-084); nothing else may be asked back.
    ...(Array.isArray(b.include) && b.include.includes('reasoning.encrypted_content') ? { include: ['reasoning.encrypted_content'] } : {}),
    stream: true,
    store: false,
  }
}

export const ai = onRequest({ secrets: [AI_KEY_SECRET], cors: ORIGINS, timeoutSeconds: 300 }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'POST only.' } })
    return
  }
  const fail = (status: number, message: string) => void res.status(status).json({ error: { message } })

  let uid: string
  let name: string
  try {
    const token = await getAuth().verifyIdToken((req.headers.authorization ?? '').replace(/^Bearer /, ''))
    uid = token.uid
    name = (token.name as string | undefined) ?? token.email ?? 'Someone'
  } catch {
    return fail(401, 'Sign in again.')
  }

  const { wid, task, body } = (req.body ?? {}) as { wid?: unknown; task?: unknown; body?: unknown }
  let ws: Workspace
  try {
    ws = await workspaceOf(wid)
  } catch {
    return fail(404, 'No such workspace.')
  }
  if (!ws.memberIds.includes(uid)) return fail(403, "You're not a member of this workspace.")
  const id = wid as string
  const config = ((await configRef(id).get()).data() ?? {}) as AiConfig
  const allowed = uid === ws.ownerId || config.access === 'everyone' || (config.allowed ?? []).includes(uid)
  if (!config.hasKey) return fail(412, 'This workspace has no key.')
  if (!allowed) return fail(403, "The owner hasn't let you use the workspace key.")

  let payload: ReturnType<typeof cleanBody>
  try {
    payload = cleanBody(body)
  } catch (e) {
    return fail(400, `Bad request (${(e as Error).message}).`)
  }

  const secret = (await secretRef(id).get()).data() as { data: string; iv: string; tag: string } | undefined
  if (!secret) return fail(412, 'This workspace has no key.')

  const started = Date.now()
  const upstream = new AbortController()
  res.on('close', () => upstream.abort())

  // What the call used, for the log.
  let usage: Usage = {}
  let webSearches = 0
  const tools = new Set<string>()
  let status: 'done' | 'stopped' | 'failed' = 'stopped'

  try {
    const r = await fetch(`${OPENAI}/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${decrypt(secret)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: upstream.signal,
    })
    if (!r.ok || !r.body) {
      status = 'failed'
      let message = `OpenAI answered ${r.status}.`
      try {
        message = ((await r.json()) as { error?: { message?: string } }).error?.message ?? message
      } catch {
        // The status says enough.
      }
      fail(r.status === 401 ? 502 : r.status, scrub(message))
      return
    }

    res.status(200)
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    const reader = r.body.pipeThrough(new TextDecoderStream()).getReader()
    let buffer = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      res.write(value)
      // Read the same events the browser gets, for the usage at the end.
      buffer += value
      let end: number
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, end)
        buffer = buffer.slice(end + 2)
        const data = block
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim())
          .join('')
        if (!data || data === '[DONE]') continue
        try {
          const event = JSON.parse(data) as { type: string; item?: { type?: string; name?: string }; response?: { usage?: Usage } }
          if (event.type === 'response.output_item.done' && event.item?.type === 'web_search_call') webSearches++
          if (event.type === 'response.output_item.done' && event.item?.type === 'function_call' && event.item.name) tools.add(event.item.name)
          if (event.type === 'response.completed' || event.type === 'response.incomplete') {
            usage = event.response?.usage ?? {}
            status = 'done'
          }
          if (event.type === 'response.failed') status = 'failed'
        } catch {
          // Not ours to judge; the browser handles malformed events.
        }
      }
    }
    res.end()
  } catch (e) {
    if (!upstream.signal.aborted) {
      status = 'failed'
      logger.warn('ai call failed', { wid: id, error: scrub(String(e)) })
      if (!res.headersSent) fail(502, "Couldn't reach OpenAI.")
      else res.end()
    }
  } finally {
    if (webSearches) tools.add('web_search')
    await db()
      .collection(`workspaces/${id}/aiUsage`)
      .add({
        uid,
        name: name.slice(0, 200),
        keySource: 'workspace',
        task: task === 'research' ? 'research' : 'chat',
        model: payload.model,
        inputTokens: usage.input_tokens ?? 0,
        cachedTokens: usage.input_tokens_details?.cached_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
        reasoningTokens: usage.output_tokens_details?.reasoning_tokens ?? 0,
        webSearches,
        tools: [...tools],
        status,
        ms: Date.now() - started,
        at: Date.now(),
      })
      .catch((e) => logger.error('usage log failed', { wid: id, error: String(e) }))
  }
})

// ---- A deleted workspace takes its key and AI records with it ----

export const cleanUpWorkspaceAi = onDocumentDeleted('workspaces/{wid}', async (event) => {
  const wid = event.params.wid
  await secretRef(wid).delete()
  await db().recursiveDelete(db().collection(`workspaces/${wid}/ai`))
  await db().recursiveDelete(db().collection(`workspaces/${wid}/aiUsage`))
})
