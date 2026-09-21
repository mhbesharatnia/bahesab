import { describe, expect, it } from 'vitest'
import { resolveTxnOrigin } from '../../domain/txn-origin'
import type { InstallmentSeries, ScheduledItem, Transaction } from '../../lib/types'

const baseTxn = (partial: Partial<Transaction> & Pick<Transaction, 'id' | 'kind'>): Transaction => ({
  accountId: 'a',
  categoryId: 'c',
  amountRial: 100,
  direction: 'in',
  dateISO: '2026-01-01',
  note: null,
  scheduledItemId: null,
  createdAt: '',
  updatedAt: '',
  ...partial,
})

describe('resolveTxnOrigin', () => {
  it('labels opening and manual', () => {
    expect(resolveTxnOrigin(baseTxn({ id: '1', kind: 'opening' }), new Map(), new Map()).badge).toBe(
      'افتتاحیه',
    )
    expect(resolveTxnOrigin(baseTxn({ id: '2', kind: 'normal' }), new Map(), new Map()).badge).toBe(
      'دستی',
    )
  })

  it('labels one-off commitment', () => {
    const item: ScheduledItem = {
      id: 's1',
      accountId: 'a',
      categoryId: 'c',
      amountRial: 100,
      direction: 'out',
      dueDateISO: '2026-02-01',
      status: 'confirmed',
      seriesId: null,
      seriesIndex: null,
      note: 'اجاره',
      createdAt: '',
      updatedAt: '',
    }
    const txn = baseTxn({
      id: 't',
      kind: 'scheduled_conversion',
      scheduledItemId: 's1',
    })
    const o = resolveTxnOrigin(txn, new Map([['s1', item]]), new Map())
    expect(o.kind).toBe('commitment')
    expect(o.badge).toBe('از تعهد')
    expect(o.detail).toBe('اجاره')
  })

  it('labels installment series', () => {
    const series: InstallmentSeries = {
      id: 'ser',
      name: 'حقوق',
      accountId: 'a',
      categoryId: 'c',
      amountRial: 100,
      direction: 'in',
      startDateISO: '2026-01-01',
      count: 12,
      interval: 'monthly',
      createdAt: '',
    }
    const item: ScheduledItem = {
      id: 's1',
      accountId: 'a',
      categoryId: 'c',
      amountRial: 100,
      direction: 'in',
      dueDateISO: '2026-03-01',
      status: 'confirmed',
      seriesId: 'ser',
      seriesIndex: 3,
      note: null,
      createdAt: '',
      updatedAt: '',
    }
    const txn = baseTxn({
      id: 't',
      kind: 'scheduled_conversion',
      scheduledItemId: 's1',
    })
    const o = resolveTxnOrigin(txn, new Map([['s1', item]]), new Map([['ser', series]]))
    expect(o.kind).toBe('series')
    expect(o.badge).toBe('از سری')
    expect(o.detail).toBe('«حقوق» — قسط 3 از 12')
  })
})
