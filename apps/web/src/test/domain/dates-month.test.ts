import { describe, expect, it } from 'vitest'
import {
  endOfJalaliMonthAheadISO,
  endOfJalaliMonthISO,
  fromJalaliInput,
  toJalaliDisplay,
  toJalaliParts,
} from '../../lib/dates'

describe('jalali month ends', () => {
  it('end of Shahrivar is day 31', () => {
    // 1405/06/15 → approx; use known conversion
    const mid = fromJalaliInput(1405, 6, 15)
    const end = endOfJalaliMonthISO(mid)
    const parts = toJalaliParts(end)
    expect(parts.year).toBe(1405)
    expect(parts.month).toBe(6)
    expect(parts.day).toBe(31)
  })

  it('next month end from 30 Shahrivar is 30 Mehr', () => {
    const lastShahrivar = fromJalaliInput(1405, 6, 30)
    const nextEnd = endOfJalaliMonthAheadISO(lastShahrivar, 1)
    expect(toJalaliDisplay(nextEnd)).toBe('1405/07/30')
  })

  it('three months ahead from Shahrivar ends in Azar', () => {
    const d = fromJalaliInput(1405, 6, 30)
    const end = endOfJalaliMonthAheadISO(d, 3)
    const parts = toJalaliParts(end)
    expect(parts.month).toBe(9) // آذر
    expect(parts.day).toBe(30)
  })
})
