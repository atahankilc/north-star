// The lab's mails about its key (D-434, §10): each threshold once a month, the rest once a day.
import { describe, expect, it } from 'vitest'
import { alertsFor, type Facts } from '../../functions/src/ledger/alerts'

const calm: Facts = { month: '2026-11', spentCents: 1000, totalCents: 10_000, failedHour: 0, callsHour: 30, stuck: 0, chainOk: true }

describe("the lab's alerts", () => {
  it('says nothing when all is well', () => expect(alertsFor(calm, {}, '2026-11-26')).toEqual([]))
  it('a threshold once, the highest reached', () => {
    expect(alertsFor({ ...calm, spentCents: 8_100 }, {}, 'd').map((a) => [a.key, a.mark])).toEqual([['total', 80]])
    expect(alertsFor({ ...calm, spentCents: 8_100 }, { total: 80 }, 'd')).toEqual([])
    expect(alertsFor({ ...calm, spentCents: 10_000 }, { total: 80 }, 'd')[0].subject).toMatch(/100 %/)
    expect(alertsFor({ ...calm, spentCents: 99_999, totalCents: null }, {}, 'd')).toEqual([])
  })
  it('failures over 5 % of at least 20 calls, stuck runs, a broken chain: once a day', () => {
    const bad = { ...calm, failedHour: 3, stuck: 1, chainOk: false }
    expect(alertsFor(bad, {}, 'd1').map((a) => a.key)).toEqual(['failures', 'stuck', 'chain'])
    expect(alertsFor(bad, { failures: 'd1', stuck: 'd1', chain: 'd1' }, 'd1')).toEqual([])
    expect(alertsFor({ ...calm, failedHour: 3, callsHour: 10 }, {}, 'd1')).toEqual([])
  })
})
