// atem-lab.com's waitlist (D-429): someone leaves an email for a product that isn't out yet (Orrery, once Granat). The page is
// static, so the email comes here and goes to `waitlist/{product}_{sha256(email)}`, which no client can read or write
// (firestore.rules denies every collection it doesn't name). Only the email, the product and when it came are kept.

// Products with a waitlist today. Granat was renamed Orrery (2026-11-23); `granat` stays for a page still open from before.
export const WAITLIST_PRODUCTS = ['orrery', 'granat'] as const
export type WaitlistProduct = (typeof WAITLIST_PRODUCTS)[number]

// The same cap as src/model/limits.ts' EMAIL_MAX (held equal by tests/unit/waitlist.test.ts).
export const WAITLIST_EMAIL_MAX = 320
// Something@something.tld, no spaces: enough to catch a typo, not a full RFC check (the mail sent later is the check).
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export class WaitlistError extends Error {}

export type WaitlistEntry = { email: string; product: WaitlistProduct }

// The request's body, checked. `website` is a field no person sees (a bot fills it): such a request is dropped quietly.
export function readWaitlistBody(body: unknown): WaitlistEntry | 'bot' {
  const { email, product, website } = (body ?? {}) as Record<string, unknown>
  if (typeof website === 'string' && website.length > 0) return 'bot'
  if (typeof product !== 'string' || !(WAITLIST_PRODUCTS as readonly string[]).includes(product)) {
    throw new WaitlistError('No such product.')
  }
  if (typeof email !== 'string') throw new WaitlistError('Enter your email.')
  const clean = email.trim().toLowerCase()
  if (clean.length > WAITLIST_EMAIL_MAX || !EMAIL.test(clean)) throw new WaitlistError("That doesn't look like an email.")
  return { email: clean, product: product as WaitlistProduct }
}

// ---- Telling the lab (D-431): a new name on a list sends one email to the lab's own inbox, through Resend ----

// Who sends and who reads. The sender is the domain verified at Resend; the reader is the address in the Impressum.
export const NOTICE_FROM = 'ATEM <hello@atem-lab.com>'
export const NOTICE_TO = 'atahankilic.dev@gmail.com'
const PRODUCT_NAMES: Record<WaitlistProduct, string> = { orrery: 'Orrery', granat: 'Orrery' }

// The email Resend sends (its POST /emails body): plain text, the address, the product, how many are on its list now.
export function waitlistNotice(entry: WaitlistEntry, count: number | null) {
  const name = PRODUCT_NAMES[entry.product]
  const place = count ? ` (${count} on the list)` : ''
  return {
    from: NOTICE_FROM,
    to: [NOTICE_TO],
    subject: `New on the ${name} waitlist: ${entry.email}`,
    text: `${entry.email} joined the ${name} waitlist${place}.\n\nAll of it: Firebase console → Firestore → waitlist\nhttps://console.firebase.google.com/project/north-star-db/firestore/databases/-default-/data/~2Fwaitlist\n`,
  }
}
