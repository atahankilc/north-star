// What the backoffice reads of North Star's key (D-434, docs/specs/agent-server.md §10), in one shape for the function that
// gathers it (functions/src/ledger/board.ts) and the page that shows it (src/views/backoffice). Money in micro-dollars,
// the month's rate beside it; counts and money only, never a message.
export type LabPublic = { on: boolean; hasKey: boolean; models: string[]; personCents: number }
export type LabPrivate = { keyHint?: string | null; keySetAt?: number; totalCents?: number | null; invitedOnly: boolean }
export type LabPerson = { blocked?: boolean; personCents?: number | null; agreedAt?: number; reason?: string }

export type BoardPerson = { uid: string; name: string | null; email: string | null; spent: number; reserved: number; calls: number; last: number | null; blocked: boolean; limitCents: number | null; agreed: boolean; invited: boolean; reason?: string }
export type BoardRun = { id: string; uid: string; status: string; model: string; steps: number; createdAt: number; endedAt: number | null; end: string | null; said: string | null; cost: number }
export type BoardCall = { id: string; uid: string; run: string | null; model: string; status: string; cost: number; reserved: number; input: number; cached: number; output: number; searches: number; at: number; ms?: number; estimated?: boolean; why?: string }
export type BoardEntry = { seq: number; at: number; what: string; by: string; from?: unknown; to?: unknown; reason?: string }
export type BoardTotal = { spent: number; reserved: number; calls: number; input: number; cached: number; output: number; searches: number; days?: Record<string, number>; models?: Record<string, number>; refused?: Record<string, number> }
export type Board = {
  month: string
  rate: number
  pub: LabPublic
  priv: LabPrivate
  total: BoardTotal
  people: BoardPerson[]
  invites: string[]
  runs: BoardRun[]
  calls: BoardCall[]
  audit: BoardEntry[]
  health: { open: number; failedHour: number; callsHour: number; stuck: number; chain: { ok: boolean; seen?: number; at?: number; why?: string } }
}

// The month so far, run on to its end at the pace of its days gone (a guess; shown as one).
export function forecast(spent: number, now: Date): number {
  const day = now.getUTCDate() - 1 + now.getUTCHours() / 24
  const days = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate()
  return day < 1 ? spent : Math.round((spent / day) * days)
}

// A table as CSV: every field quoted when it needs to be.
export function csv(head: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const cell = (v: string | number | boolean | null | undefined) => {
    const t = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  return [head, ...rows].map((r) => r.map(cell).join(',')).join('\n') + '\n'
}
