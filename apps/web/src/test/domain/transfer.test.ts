import { describe, expect, it } from 'vitest'
import { buildInstallmentItems } from '../../domain/installments'
import { buildCashProjection } from '../../domain/liquidity'

describe('transfer installments', () => {
  it('builds transfer series with counter account on every item', () => {
    const { series, items } = buildInstallmentItems({
      name: 'تسویه مفید',
      startDateISO: '2026-09-21',
      count: 3,
      amountRial: 10_000_000,
      direction: 'out',
      accountId: 'bank',
      categoryId: null,
      counterAccountId: 'fund',
    })
    expect(series.counterAccountId).toBe('fund')
    expect(series.categoryId).toBeNull()
    expect(series.direction).toBe('out')
    expect(items).toHaveLength(3)
    expect(items.every((i) => i.counterAccountId === 'fund')).toBe(true)
    expect(items.every((i) => i.accountId === 'bank')).toBe(true)
  })

  it('rejects same from and to account', () => {
    expect(() =>
      buildInstallmentItems({
        name: 'بد',
        startDateISO: '2026-09-21',
        count: 1,
        amountRial: 100,
        direction: 'out',
        accountId: 'bank',
        categoryId: null,
        counterAccountId: 'bank',
      }),
    ).toThrow(/مبدأ و مقصد/)
  })

  it('cash projection drops when transfer leaves a liquid account', () => {
    const { items } = buildInstallmentItems({
      name: 'قسط',
      startDateISO: '2026-10-01',
      count: 1,
      amountRial: 30_000_000,
      direction: 'out',
      accountId: 'bank',
      categoryId: null,
      counterAccountId: 'fund',
    })
    const points = buildCashProjection({
      startingCash: 50_000_000,
      pending: items,
      liquidAccountIds: new Set(['bank']),
      fromISO: '2026-09-01',
      toISO: '2026-11-01',
    })
    const after = points.find((p) => p.dateISO === '2026-10-01')
    expect(after?.cash).toBe(20_000_000)
  })
})
