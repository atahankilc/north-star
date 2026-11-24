// The only server code (D-079): a workspace's shared OpenAI key lives here and nowhere else; besides it, atem-lab.com's waitlist (D-429).
// The key is encrypted with AI_KEY_SECRET and kept in aiSecrets/{wid}, which no client can read (firestore.rules).
// Members the owners allow call OpenAI through `ai` (the agent, D-427), which streams the answer back and logs what each
// call used.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getDatabaseWithUrl } from 'firebase-admin/database'
import { getStorage } from 'firebase-admin/storage'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { onDocumentDeleted, onDocumentWritten } from 'firebase-functions/firestore'
import { HttpsError, onCall, onRequest } from 'firebase-functions/https'
import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/scheduler'
import { setGlobalOptions } from 'firebase-functions/options'
import { defineSecret } from 'firebase-functions/params'
import { isOwner, mayUseKey, type Access, type Workspace } from './access.js'
import { accessOf, docAccessOf, sameAccess, sameDocAccess } from './mirror.js'
import { BadRequest, cleanBody, MODEL_ID, modelsAllowed } from './request.js'
import { readWaitlistBody, WaitlistError } from './waitlist.js'

initializeApp()
setGlobalOptions({ region: 'europe-west1', maxInstances: 10 })

const AI_KEY_SECRET = defineSecret('AI_KEY_SECRET')
// OPENAI_API_BASE is set only in functions/.env.local, for emulator tests against a fake OpenAI; never deployed.
const OPENAI = process.env.OPENAI_API_BASE ?? 'https://api.openai.com/v1'
// The app (north-star.atem-lab.com, D-430), the site (atem-lab.com: the waitlist) and local dev servers.
// atahankilc.github.io only until the repo's move to the atem-lab org is live.
const ORIGINS = [/^https:\/\/(www\.|north-star\.)?atem-lab\.com$/, /^https:\/\/atahankilc\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/]

type AiConfig = { hasKey?: boolean; keyHint?: string; access?: Access; allowed?: string[]; allowedModels?: string[] }

const db = () => getFirestore()
// RTDB's default instance (europe-west1), named outright: left to itself the admin SDK picks another namespace on the
// emulator than the app's (`<project>-default-rtdb`).
const PROJECT = process.env.GCLOUD_PROJECT ?? ''
const RTDB_URL =
  process.env.FUNCTIONS_EMULATOR === 'true'
    ? `https://${PROJECT}-default-rtdb.firebaseio.com`
    : `https://${PROJECT}-default-rtdb.europe-west1.firebasedatabase.app`
const rtdb = () => getDatabaseWithUrl(RTDB_URL)
// Firestore lives in europe-west3, and a Firestore trigger runs where its database is (the callables stay in europe-west1).
const FIRESTORE_REGION = 'europe-west3'
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
  if (!isOwner(ws, uid)) throw new HttpsError('permission-denied', 'Only an owner manages the workspace key.')
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

// ---- Owners: is a model there for the workspace key? (D-104) A free call with the key, so it's never sent anywhere ----

export const checkWorkspaceModel = onCall({ secrets: [AI_KEY_SECRET], cors: ORIGINS }, async (req) => {
  const uid = req.auth?.uid
  const { wid, model } = (req.data ?? {}) as { wid?: unknown; model?: unknown }
  const ws = await workspaceOf(wid)
  if (!isOwner(ws, uid)) throw new HttpsError('permission-denied', 'Only an owner chooses the workspace key\'s models.')
  if (typeof model !== 'string' || !MODEL_ID.test(model)) throw new HttpsError('invalid-argument', "That isn't a model id.")
  const secret = (await secretRef(wid as string).get()).data() as { data: string; iv: string; tag: string } | undefined
  if (!secret) throw new HttpsError('failed-precondition', 'This workspace has no key.')
  const r = await fetch(`${OPENAI}/models/${encodeURIComponent(model)}`, { headers: { Authorization: `Bearer ${decrypt(secret)}` } })
  if (r.status === 404) throw new HttpsError('not-found', `OpenAI has no model called ${model} for this key.`)
  if (!r.ok) throw new HttpsError('failed-precondition', `OpenAI answered ${r.status}.`)
  return { ok: true }
})

// ---- Members: one OpenAI call on the workspace key, streamed back and logged ----

type Usage = {
  input_tokens?: number
  output_tokens?: number
  input_tokens_details?: { cached_tokens?: number }
  output_tokens_details?: { reasoning_tokens?: number }
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
  if (!config.hasKey) return fail(412, 'This workspace has no key (Settings → workspace → agent key).')
  if (ws.roles?.[uid] === 'viewer') return fail(403, 'Viewers use their own key.')
  if (!mayUseKey(ws, uid, config)) return fail(403, "The owners haven't let you use the workspace key (Settings → workspace → agent key).")

  let payload: ReturnType<typeof cleanBody>
  try {
    payload = cleanBody(body)
  } catch (e) {
    if (!(e instanceof BadRequest)) throw e
    return fail(400, `Bad request (${e.message}).`)
  }
  if (!modelsAllowed(config).has(payload.model)) return fail(403, `The owners haven't allowed ${payload.model} on the workspace key (Settings → workspace → agent key).`)

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

// ---- A deleted workspace takes its key, AI records, reports, documents, agent chats and invites with it ----

export const cleanUpWorkspaceAi = onDocumentDeleted({ document: 'workspaces/{wid}', region: FIRESTORE_REGION }, async (event) => {
  const wid = event.params.wid
  await secretRef(wid).delete()
  await db().recursiveDelete(db().collection(`workspaces/${wid}/ai`))
  await db().recursiveDelete(db().collection(`workspaces/${wid}/aiUsage`))
  // Members' private research reports (D-090) with their bodies (D-098), which an owner's browser can't read to delete,
  // and anything left of the people list.
  await db().recursiveDelete(db().collection(`workspaces/${wid}/reports`))
  await db().recursiveDelete(db().collection(`workspaces/${wid}/members`))
  // Documents (D-232) with their content: members' private ones the owner's browser can't see (audit P2).
  await db().recursiveDelete(db().collection(`workspaces/${wid}/documents`))
  // The agent's saved chats with their bodies: members' private ones, the same (deleteWorkspace takes the rest).
  await db().recursiveDelete(db().collection(`workspaces/${wid}/agentChats`))
  // Invites (D-323) the client didn't get to.
  const invites = await db().collection('invites').where('workspaceId', '==', wid).get()
  await Promise.all(invites.docs.map((d) => d.ref.delete()))
  // Its documents' files (D-425), whoever's they were.
  await getStorage().bucket().deleteFiles({ prefix: `workspaces/${wid}/` }).catch((e) => logger.warn('files left', { wid, error: String(e) }))
})

// ---- Documents' files no summary points to any more (D-425): once a day, those over a day old ----
// Deleting a document leaves its file so an undo finds it (storage.rules); a day later nothing will undo it.
const FILE_KEPT_MS = 24 * 60 * 60 * 1000
const FILE_PATH = /^workspaces\/([A-Za-z0-9]+)\/documents\/([A-Za-z0-9_-]+)\//

export const sweepDocumentFiles = onSchedule({ schedule: 'every day 04:00', timeZone: 'Europe/Berlin', region: FIRESTORE_REGION }, async () => {
  const [files] = await getStorage().bucket().getFiles({ prefix: 'workspaces/' })
  const byDoc = new Map<string, typeof files>()
  for (const f of files) {
    const m = FILE_PATH.exec(f.name)
    const made = Date.parse(String(f.metadata.timeCreated ?? ''))
    if (!m || !(Date.now() - made > FILE_KEPT_MS)) continue
    const path = `workspaces/${m[1]}/documents/${m[2]}`
    byDoc.set(path, [...(byDoc.get(path) ?? []), f])
  }
  const paths = [...byDoc.keys()]
  for (let i = 0; i < paths.length; i += 100) {
    const some = paths.slice(i, i + 100)
    const snaps = await db().getAll(...some.map((p) => db().doc(p)))
    for (const snap of snaps) if (!snap.exists) await Promise.all(byDoc.get(snap.ref.path)!.map((f) => f.delete({ ignoreNotFound: true })))
  }
})

// ---- What RTDB's rules know about Firestore (D-426, mirror.ts) ----
// Each copy is made from what Firestore holds now, never from the event, so events that come late or out of order
// still leave the truth behind.

const DOC_ID = /^[A-Za-z0-9_-]{1,128}$/

// A workspace's roles; gone, everything it had in RTDB goes too (presence, the mirror, the shared texts).
async function mirrorWorkspace(wid: string) {
  const snap = await db().doc(`workspaces/${wid}`).get()
  const access = accessOf(snap.exists ? (snap.data() as Workspace) : undefined)
  if (access) return rtdb().ref(`access/${wid}`).set(access)
  return rtdb().ref().update({ [`access/${wid}`]: null, [`docAccess/${wid}`]: null, [`live/${wid}`]: null, [`presence/${wid}`]: null })
}

// A document's author, sharing and kind; gone, its shared text goes too (live/), and what writing together kept in
// Firestore before D-426 (`edits`, `live`) with it.
async function mirrorDocument(wid: string, id: string) {
  const ref = db().doc(`workspaces/${wid}/documents/${id}`)
  const snap = await ref.get()
  const access = docAccessOf(snap.exists ? snap.data() : undefined)
  if (access) return rtdb().ref(`docAccess/${wid}/${id}`).set(access)
  await rtdb().ref().update({ [`docAccess/${wid}/${id}`]: null, [`live/${wid}/${id}`]: null })
  await db().recursiveDelete(ref.collection('edits'))
  await db().recursiveDelete(ref.collection('live'))
}

export const mirrorWorkspaceAccess = onDocumentWritten({ document: 'workspaces/{wid}', region: FIRESTORE_REGION }, async (event) => {
  const before = event.data?.before.data() as Workspace | undefined
  const after = event.data?.after.data() as Workspace | undefined
  if (before && after && sameAccess(before, after)) return
  await mirrorWorkspace(event.params.wid)
})

export const mirrorDocAccess = onDocumentWritten({ document: 'workspaces/{wid}/documents/{id}', region: FIRESTORE_REGION }, async (event) => {
  const before = event.data?.before.data()
  const after = event.data?.after.data()
  if (before && after && sameDocAccess(before, after)) return
  await mirrorDocument(event.params.wid, event.params.id)
})

// A member whose copy isn't there yet (a workspace from before D-426, or a trigger still on its way) asks for it.
// Copies only the truth, so asking twice, or for a document they can't read, changes nothing anyone can see.
export const syncAccess = onCall({ cors: ORIGINS }, async (req) => {
  const uid = req.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in again.')
  const { wid, doc } = (req.data ?? {}) as { wid?: unknown; doc?: unknown }
  const ws = await workspaceOf(wid)
  if (!ws.memberIds.includes(uid)) throw new HttpsError('permission-denied', "You're not a member of this workspace.")
  await mirrorWorkspace(wid as string)
  if (doc !== undefined) {
    if (typeof doc !== 'string' || !DOC_ID.test(doc)) throw new HttpsError('invalid-argument', 'No such document.')
    await mirrorDocument(wid as string, doc)
  }
  return { ok: true }
})

// ---- atem-lab.com's waitlist (D-429): an email for a product that isn't out yet ----

export const joinWaitlist = onRequest({ cors: ORIGINS, maxInstances: 2 }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only.' })
    return
  }
  let entry: ReturnType<typeof readWaitlistBody>
  try {
    entry = readWaitlistBody(req.body)
  } catch (e) {
    if (!(e instanceof WaitlistError)) throw e
    res.status(400).json({ error: e.message })
    return
  }
  if (entry !== 'bot') {
    const id = `${entry.product}_${createHash('sha256').update(entry.email).digest('hex')}`
    try {
      // create(): a second time keeps the first date.
      await db().collection('waitlist').doc(id).create({ ...entry, createdAt: FieldValue.serverTimestamp() })
    } catch (e) {
      if ((e as { code?: number }).code !== 6) throw e // 6: already exists
    }
  }
  res.json({ ok: true })
})
