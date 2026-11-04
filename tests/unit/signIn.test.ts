// A failed Google sign-in says plain words; closing the popup yourself says nothing (the sweep's 17).
import { beforeEach, describe, expect, it, vi } from 'vitest'

const popup = vi.fn()
const out = vi.fn()
const leave = vi.fn(async () => {})
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  onAuthStateChanged: vi.fn(),
  signInWithCredential: vi.fn(),
  signInWithPopup: (...a: unknown[]) => popup(...a),
  signOut: (...a: unknown[]) => out(...a),
}))
vi.mock('../../src/data/firebase', () => ({ firebase: { auth: {} }, isDemo: false, useEmulators: false }))
vi.mock('../../src/data/presence', () => ({ leavePresence: () => leave() }))

const { signInWithGoogle, signOut } = await import('../../src/data/auth')
const failWith = (code: string) => popup.mockRejectedValueOnce(Object.assign(new Error(`Firebase: Error (${code}).`), { code }))

describe('signInWithGoogle', () => {
  beforeEach(() => popup.mockReset())

  it('says nothing when the person closes the popup', async () => {
    failWith('auth/popup-closed-by-user')
    await expect(signInWithGoogle()).resolves.toBeUndefined()
    failWith('auth/cancelled-popup-request')
    await expect(signInWithGoogle()).resolves.toBeUndefined()
  })

  it('says a blocked popup or no connection in plain words', async () => {
    failWith('auth/popup-blocked')
    await expect(signInWithGoogle()).rejects.toThrow(/Allow pop-ups/)
    failWith('auth/network-request-failed')
    await expect(signInWithGoogle()).rejects.toThrow(/connection/)
  })

  it('passes anything else on as it is', async () => {
    failWith('auth/internal-error')
    await expect(signInWithGoogle()).rejects.toThrow('auth/internal-error')
  })
})

describe('signOut', () => {
  it('leaves presence first: after it the rules refuse the write (the sweep\'s 22)', async () => {
    await signOut()
    expect(leave.mock.invocationCallOrder[0]).toBeLessThan(out.mock.invocationCallOrder[0])
  })
})
