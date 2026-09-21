import { describe, expect, it } from 'vitest'
import { buildInstallmentItems } from '../../domain/installments'
import { addJalaliMonths, compareISO } from '../../lib/dates'

describe('installments', () => {
  it('builds N monthly items', () => {
    const { series, items } = buildInstallmentItems({
      name: 'وام تست',
      startDateISO: '2026-03-21',
      count: 3,
      amountRial: 1000,
      direction: 'out',
      accountId: 'a',
      categoryId: 'c',
    })
    expect(series.name).toBe('وام تست')
    expect(series.count).toBe(3)
    expect(items).toHaveLength(3)
    expect(items[0].dueDateISO).toBe('2026-03-21')
    expect(compareISO(items[1].dueDateISO, items[0].dueDateISO)).toBe(1)
    expect(items[2].seriesIndex).toBe(3)
  })

  it('rejects count over 120', () => {
    expect(() =>
      buildInstallmentItems({
        name: 'x',
        startDateISO: '2026-01-01',
        count: 121,
        amountRial: 1,
        direction: 'out',
        accountId: 'a',
        categoryId: 'c',
      }),
    ).toThrow()
  })

  it('addJalaliMonths advances', () => {
    const next = addJalaliMonths('2026-03-21', 1)
    expect(compareISO(next, '2026-03-21')).toBe(1)
  })
})
