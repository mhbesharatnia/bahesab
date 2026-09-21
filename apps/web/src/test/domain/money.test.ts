import { describe, expect, it } from 'vitest'
import { formatGroupedNumber, formatMoney, formatTomanAxis, parseMoneyInput } from '../../lib/money'

describe('money', () => {
  it('formats small toman with comma and decimal for odd rial', () => {
    expect(formatMoney(999, 'toman')).toBe('99.9 تومان')
    expect(formatMoney(100, 'toman')).toBe('10 تومان')
  })

  it('uses هزار for toman >= 1,000', () => {
    // 6_000_000 ریال = 600_000 تومان
    expect(formatMoney(6_000_000, 'toman')).toBe('600 هزار تومان')
    expect(formatMoney(12_345, 'toman')).toBe('1.2 هزار تومان')
  })

  it('uses میلیون for toman >= 1,000,000', () => {
    // 30_000_000 ریال = 3_000_000 تومان
    expect(formatMoney(30_000_000, 'toman')).toBe('3 میلیون تومان')
    // 900_000_000 ریال = 90_000_000 تومان
    expect(formatMoney(900_000_000, 'toman')).toBe('90 میلیون تومان')
    expect(formatMoney(123_456_789, 'toman')).toBe('12.3 میلیون تومان')
  })

  it('formats rial with هزار / میلیون', () => {
    expect(formatMoney(500, 'rial')).toBe('500 ریال')
    expect(formatMoney(6_000_000, 'rial')).toBe('6 میلیون ریال')
    expect(formatMoney(12_000, 'rial')).toBe('12 هزار ریال')
  })

  it('formats chart axis toman', () => {
    expect(formatTomanAxis(600_000)).toBe('600 هزار')
    expect(formatTomanAxis(3_000_000)).toBe('3 میلیون')
    expect(formatTomanAxis(90_000_000)).toBe('90 میلیون')
    expect(formatTomanAxis(500)).toBe('500')
  })

  it('formatGroupedNumber separates thousands with comma', () => {
    expect(formatGroupedNumber(1234567.8, 1)).toBe('1,234,567.8')
    expect(formatGroupedNumber(-5000, 1)).toBe('-5,000')
  })

  it('parses toman input into integer rials for storage', () => {
    expect(parseMoneyInput('600000', 'toman')).toBe(6_000_000)
    expect(parseMoneyInput('3,000,000', 'toman')).toBe(30_000_000)
    expect(parseMoneyInput('90', 'toman')).toBe(900)
    expect(parseMoneyInput('10000', 'rial')).toBe(10_000)
  })

  it('parses negative opening when allowed', () => {
    expect(parseMoneyInput('-500', 'toman', { allowNegative: true })).toBe(-5000)
  })
})
