// What atem-lab.com sends by email (D-432), through Resend: the waitlist's confirmation and the contact form's message.
// Plain text, built here without Firebase so it's tested; index.ts sends it. (The notice to the lab: waitlist.ts.)
import { NOTICE_FROM, NOTICE_TO, type WaitlistEntry, WAITLIST_EMAIL_MAX, WaitlistError } from './waitlist.js'

export type Mail = { from: string; to: string[]; subject: string; text: string; reply_to?: string }

// How long an unconfirmed address is kept, and how soon the same one may be written to again.
export const PENDING_KEPT_MS = 7 * 24 * 60 * 60 * 1000
export const RESEND_AFTER_MS = 10 * 60 * 1000
// A day's most: a flood stops here instead of becoming mail to strangers.
export const CONFIRMS_A_DAY = 200
export const CONTACTS_A_DAY = 100

export const CONFIRM_PAGE = 'https://atem-lab.com/confirm.html'
const TOKEN = /^[a-f0-9]{64}$/
const PENDING_ID = /^(orrery|granat)_[a-f0-9]{64}$/

// The link holds no address: the list's id (a hash) and the token, after `#` so neither reaches a server's log.
export function confirmMail(entry: WaitlistEntry, id: string, token: string): Mail {
  return {
    from: NOTICE_FROM,
    to: [entry.email],
    subject: 'Confirm your place on the Orrery waitlist',
    text: `Someone, hopefully you, asked to be told when Orrery is ready.\n\nTo confirm, open this and press the button:\n${CONFIRM_PAGE}#${id}.${token}\n\nIf it wasn't you, do nothing: your address is deleted after 7 days and you won't hear from us.\n\nATEM · Impressum: https://atem-lab.com/impressum.html · Privacy: https://atem-lab.com/privacy.html\n`,
  }
}

export function readConfirmBody(body: unknown): { id: string; token: string } {
  const { id, token } = (body ?? {}) as Record<string, unknown>
  if (typeof id !== 'string' || typeof token !== 'string' || !PENDING_ID.test(id) || !TOKEN.test(token)) {
    throw new WaitlistError('This link is not complete. Open it from the email again.')
  }
  return { id, token }
}

// ---- The contact form: questions, privacy requests and reports of illegal content (DSA Art. 16) ----

export const TOPICS = { question: 'A question', privacy: 'A privacy request', report: 'A report of illegal content' } as const
export type Topic = keyof typeof TOPICS
export const MESSAGE_MAX = 5000
const LINE_MAX = 200
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export class ContactError extends Error {}
export type Contact = { topic: Topic; name: string; email: string; link: string; message: string }

const line = (v: unknown, max = LINE_MAX) => (typeof v === 'string' ? v.replace(/[\r\n\t]+/g, ' ').trim().slice(0, max) : '')

export function readContactBody(body: unknown): Contact | 'bot' {
  const b = (body ?? {}) as Record<string, unknown>
  if (typeof b.website === 'string' && b.website.length > 0) return 'bot'
  if (typeof b.topic !== 'string' || !Object.hasOwn(TOPICS, b.topic)) throw new ContactError('Choose what it is about.')
  const email = line(b.email, WAITLIST_EMAIL_MAX + 1)
  if (email.length > WAITLIST_EMAIL_MAX || !EMAIL.test(email)) throw new ContactError("That doesn't look like an email.")
  const message = typeof b.message === 'string' ? b.message.trim() : ''
  if (!message) throw new ContactError('Write a message.')
  if (message.length > MESSAGE_MAX) throw new ContactError(`Keep the message under ${MESSAGE_MAX} characters.`)
  const c = { topic: b.topic as Topic, name: line(b.name), email, link: line(b.link, 2000), message }
  if (c.topic === 'report' && !c.link) throw new ContactError('Say where the content is.')
  if (c.topic === 'report' && !c.name) throw new ContactError('Enter your name.')
  if (c.topic === 'report' && b.goodFaith !== true) throw new ContactError('Confirm that what you report is accurate and complete.')
  return c
}

const contactText = (c: Contact) =>
  `${TOPICS[c.topic]}\nName: ${c.name || '(none)'}\nEmail: ${c.email}\n${c.link ? `Where: ${c.link}\n` : ''}${c.topic === 'report' ? 'Good faith: confirmed\n' : ''}\n${c.message}\n`

export const contactMail = (c: Contact): Mail => ({
  from: NOTICE_FROM,
  to: [NOTICE_TO],
  reply_to: c.email,
  subject: `atem-lab.com: ${TOPICS[c.topic].toLowerCase()}`,
  text: contactText(c),
})
