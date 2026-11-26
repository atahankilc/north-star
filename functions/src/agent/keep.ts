// What a run and a chat keep on the server between two steps (D-434, docs/specs/agent-server.md §5.2): the message, the
// loop's checkpoint, the chat's history with its short ids, pending changes and job. In Storage, gzipped, under the
// person's own folder, which no client can read (storage.rules names no such path); a bucket lifecycle drops it after a week.
import { gunzipSync, gzipSync } from 'node:zlib'
import type { Bucket } from '@google-cloud/storage'

export type Keep = {
  save: (path: string, value: unknown) => Promise<void>
  load: <T>(path: string) => Promise<T | null>
  drop: (prefix: string) => Promise<void>
}

export const runPath = (uid: string, run: string, what: 'ask' | 'step' | 'done') => `agent/${uid}/runs/${run}/${what}.json.gz`
export const threadPath = (uid: string, wid: string, chatId: string) => `agent/${uid}/threads/${wid}/${chatId}/thread.json.gz`
export const changesPath = (uid: string, wid: string, chatId: string) => `agent/${uid}/threads/${wid}/${chatId}/changes.json.gz`
export const personFolder = (uid: string) => `agent/${uid}/`

export function bucketKeep(bucket: () => Pick<Bucket, 'file' | 'deleteFiles'>): Keep {
  return {
    save: async (path, value) => {
      await bucket().file(path).save(gzipSync(Buffer.from(JSON.stringify(value))), { resumable: false, contentType: 'application/gzip', metadata: { cacheControl: 'no-store' } })
    },
    load: async <T>(path: string) => {
      try {
        const [bytes] = await bucket().file(path).download()
        return JSON.parse(gunzipSync(bytes).toString('utf8')) as T
      } catch (e) {
        if ((e as { code?: number }).code === 404) return null
        throw e
      }
    },
    drop: async (prefix) => {
      await bucket().deleteFiles({ prefix, force: true })
    },
  }
}
