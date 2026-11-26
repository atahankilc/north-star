// The backoffice's own sums (D-434, §10): the month's forecast and the CSVs it downloads.
import { describe, expect, it } from 'vitest'
import { csv, forecast } from '../../src/agent/labBoard'

describe('the backoffice', () => {
  it('runs the month on at the pace of its days gone', () => {
    expect(forecast(1000, new Date(Date.UTC(2026, 10, 16, 0)))).toBe(2000)
    expect(forecast(1000, new Date(Date.UTC(2026, 10, 1, 6)))).toBe(1000)
  })
  it('writes CSV a spreadsheet reads: quotes where needed, nothing for nothing', () => {
    expect(csv(['a', 'b'], [['x, y', null], ['say "hi"', 3]])).toBe('a,b\n"x, y",\n"say ""hi""",3\n')
  })
})
