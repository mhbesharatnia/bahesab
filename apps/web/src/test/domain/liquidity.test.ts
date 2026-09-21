import { describe, expect, it } from 'vitest'
import { buildCashProjection, buildLiquidityBuckets } from '../../domain/liquidity'
import type { ScheduledItem } from '../../lib/types'

const item = (
  partial: Partial<ScheduledItem> &
    Pick<ScheduledItem, 'id' | 'accountId' | 'amountRial' | 'direction' | 'dueDateISO'>,
): ScheduledItem => ({
  categoryId: 'c',
  status: 'pending',
  seriesId: null,
  seriesIndex: null,
  note: null,
  createdAt: '',
  updatedAt: '',
  ...partial,
})

describe('liquidity', () => {
  it('filters buckets by date range', () => {
    const pending = [
      item({ id: '1', accountId: 'bank', amountRial: 100, direction: 'in', dueDateISO: '2026-01-01' }),
      item({ id: '2', accountId: 'bank', amountRial: 50, direction: 'out', dueDateISO: '2026-02-01' }),
      item({ id: '3', accountId: 'bank', amountRial: 20, direction: 'in', dueDateISO: '2026-03-01' }),
    ]
    const buckets = buildLiquidityBuckets(pending, { fromISO: '2026-01-15', toISO: '2026-02-15' })
    expect(buckets).toHaveLength(1)
    expect(buckets[0]!.dateISO).toBe('2026-02-01')
    expect(buckets[0]!.outflow).toBe(50)
  })

  it('projects cash with pending on liquid accounts only', () => {
    const pending = [
      item({ id: '1', accountId: 'bank', amountRial: 1000, direction: 'in', dueDateISO: '2026-02-01' }),
      item({ id: '2', accountId: 'bank', amountRial: 300, direction: 'out', dueDateISO: '2026-03-01' }),
      item({ id: '3', accountId: 'fund', amountRial: 999, direction: 'out', dueDateISO: '2026-02-15' }),
    ]
    const points = buildCashProjection({
      startingCash: 5000,
      pending,
      liquidAccountIds: new Set(['bank']),
      fromISO: '2026-01-01',
      toISO: '2026-03-15',
    })
    expect(points[0]!.dateISO).toBe('2026-01-01')
    expect(points[0]!.cash).toBe(5000)
    const feb = points.find((p) => p.dateISO === '2026-02-01')!
    expect(feb.cash).toBe(6000)
    const mar = points.find((p) => p.dateISO === '2026-03-01')!
    expect(mar.cash).toBe(5700)
    expect(points[points.length - 1]!.dateISO).toBe('2026-03-15')
    expect(points[points.length - 1]!.cash).toBe(5700)
  })
})
