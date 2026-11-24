// The waitlist's confirmation and the contact form (D-432, functions/src/mail.ts).
import { describe, expect, it } from 'vitest'
import { confirmMail, ContactError, contactMail, MESSAGE_MAX, readConfirmBody, readContactBody } from '../../functions/src/mail'
import { WaitlistError } from '../../functions/src/waitlist'

const hex = 'a'.repeat(64)

describe('confirming', () => {
  it('links to the page with the id and the token after #, never the address', () => {
    const m = confirmMail({ email: 'ada@example.com', product: 'orrery' }, `orrery_${hex}`, hex)
    expect(m.to).toEqual(['ada@example.com'])
    expect(m.text).toContain(`https://atem-lab.com/confirm.html#orrery_${hex}.${hex}`)
    expect(m.text).not.toContain('ada@')
  })
  it('refuses a link that is not whole', () => {
    expect(readConfirmBody({ id: `orrery_${hex}`, token: hex })).toEqual({ id: `orrery_${hex}`, token: hex })
    for (const b of [null, {}, { id: `orrery_${hex}` }, { id: '../x', token: hex }, { id: `orrery_${hex}`, token: 'z' }]) expect(() => readConfirmBody(b)).toThrow(WaitlistError)
  })
})

describe('the contact form', () => {
  const ok = { topic: 'question', email: 'ada@example.com', message: 'Hi' }
  it('takes a question, and puts no line break in a header', () => {
    const c = readContactBody({ ...ok, name: 'Ada\r\nBcc: x@y.zz' })
    if (c === 'bot') throw new Error('not a bot')
    expect(c.name).toBe('Ada Bcc: x@y.zz')
    expect(contactMail(c)).toMatchObject({ reply_to: 'ada@example.com', subject: 'atem-lab.com: a question' })
  })
  it('asks a report for the place, a name and good faith', () => {
    const r = { ...ok, topic: 'report', name: 'Ada', link: 'https://north-star.atem-lab.com/x', goodFaith: true }
    expect(readContactBody(r)).toMatchObject({ topic: 'report' })
    for (const k of ['link', 'name', 'goodFaith']) expect(() => readContactBody({ ...r, [k]: undefined })).toThrow(ContactError)
  })
  it('refuses what is missing or too long, and drops a bot', () => {
    for (const b of [{}, { ...ok, topic: 'toString' }, { ...ok, email: 'no' }, { ...ok, message: ' ' }, { ...ok, message: 'x'.repeat(MESSAGE_MAX + 1) }]) expect(() => readContactBody(b)).toThrow(ContactError)
    expect(readContactBody({ ...ok, website: 'x' })).toBe('bot')
  })
})
