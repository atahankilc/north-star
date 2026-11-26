// The backoffice's calls (D-434, docs/specs/agent-server.md §10): North Star's key read in one go, and every change through
// a function that checks the caller is a lab admin, signed in within the hour, and writes the audit log. A change refused
// for an old sign-in asks Google's sign-in again, then goes once more.
import type { Board, LabPublic } from '../agent/labBoard'
import { freshSignIn } from './auth'
import { callFunction } from './firebase'
import { useDoc } from './hooks'

// Whether this person is a lab admin: a doc made by hand in the Firebase console, which only they read.
export const useLabAdmin = (uid: string | undefined) => {
  const d = useDoc<{ at: number }>(uid ? `admins/${uid}` : null)
  return { loading: d.isLoading, admin: !!d.data }
}

export const loadBoard = () => callFunction<Board>('labBoard', {}, "The backoffice couldn't be read.")

async function change<T>(name: string, data: unknown): Promise<T> {
  try {
    return await callFunction<T>(name, data, "That didn't go through.")
  } catch (e) {
    if (!/Sign in again/.test((e as Error).message)) throw e
    await freshSignIn()
    return callFunction<T>(name, data, "That didn't go through.")
  }
}

export type LabPatch = Partial<Pick<LabPublic, 'on' | 'models' | 'personCents'>> & { totalCents?: number | null; invitedOnly?: boolean; reason?: string }
export const setLab = (patch: LabPatch) => change<unknown>('setLab', patch)
// A key to set, or '' to take it away.
export const setLabKey = (key: string) => change<{ keyHint: string | null }>('setLabKey', { key })
export const setLabPerson = (uid: string, patch: { blocked?: boolean; personCents?: number | null }, reason: string) => change<unknown>('setLabPerson', { uid, ...patch, reason })
export const inviteToLab = (email: string, on: boolean) => change<unknown>('inviteToLab', { email, on })
export const stopLabRun = (run: string) => change<unknown>('labStopRun', { run })
