import { describe, expect, it } from 'vitest'
import { forecastAsOf, settledBalancesAsOf } from '../../domain/balances'
import type { ScheduledItem, Transaction } from '../../lib/types'

const txn = (
  partial: Partial<Transaction> & Pick<Transaction, 'id' | 'accountId' | 'amountRial' | 'direction' | 'dateISO'>,
): Transaction => ({
  categoryId: 'c1',
  kind: 'normal',
  note: null,
  scheduledItemId: null,
  createdAt: '',
  updatedAt: '',
  ...partial,
})

describe('balances', () => {
  it('settledBalancesAsOf sums effects up to date', () => {
    const txns = [
      txn({ id: '1', accountId: 'a', amountRial: 1000, direction: 'in', dateISO: '2026-01-01' }),
      txn({ id: '2', accountId: 'a', amountRial: 200, direction: 'out', dateISO: '2026-01-10' }),
      txn({ id: '3', accountId: 'a', amountRial: 50, direction: 'out', dateISO: '2026-02-01' }),
    ]
    expect(settledBalancesAsOf('2026-01-15', txns).get('a')).toBe(800)
  })

  it('forecast includes pending when report date is future', () => {
    const txns = [
      txn({ id: '1', accountId: 'a', amountRial: 1000, direction: 'in', dateISO: '2026-01-01' }),
    ]
    const pending: ScheduledItem[] = [
      {
        id: 's1',
        accountId: 'a',
        categoryId: 'c',
        amountRial: 100,
        direction: 'out',
        dueDateISO: '2026-01-05',
        status: 'pending',
        seriesId: null,
        seriesIndex: null,
        note: null,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 's2',
        accountId: 'a',
        categoryId: 'c',
        amountRial: 50,
        direction: 'in',
        dueDateISO: '2026-03-01',
        status: 'pending',
        seriesId: null,
        seriesIndex: null,
        note: null,
        createdAt: '',
        updatedAt: '',
      },
    ]
    const past = forecastAsOf('2026-01-20', '2026-01-20', txns, pending)
    expect(past.mode).toBe('settled')
    expect(past.pendingEffect.size).toBe(0)

    const future = forecastAsOf('2026-02-01', '2026-01-20', txns, pending)
    expect(future.mode).toBe('forecast')
    expect(future.pendingEffect.get('a')).toBe(-100)
  })
})
