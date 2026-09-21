import { describe, expect, it } from 'vitest'
import { listAwaitingConfirm, processAutoDue } from '../../domain/due-processing'
import type { ScheduledItem } from '../../lib/types'

const item = (partial: Partial<ScheduledItem> & Pick<ScheduledItem, 'id' | 'dueDateISO' | 'status'>): ScheduledItem => ({
  accountId: 'a',
  categoryId: 'c',
  amountRial: 10,
  direction: 'out',
  seriesId: null,
  seriesIndex: null,
  note: null,
  createdAt: '',
  updatedAt: '',
  ...partial,
})

describe('due-processing', () => {
  it('lists overdue pending for confirm queue', () => {
    const items = [
      item({ id: '1', dueDateISO: '2026-01-01', status: 'pending' }),
      item({ id: '2', dueDateISO: '2026-02-01', status: 'pending' }),
      item({ id: '3', dueDateISO: '2025-12-01', status: 'skipped' }),
    ]
    const awaiting = listAwaitingConfirm(items, '2026-01-15')
    expect(awaiting.map((i) => i.id)).toEqual(['1'])
  })

  it('processAutoDue selects due pending', () => {
    const items = [
      item({ id: '1', dueDateISO: '2026-01-01', status: 'pending' }),
      item({ id: '2', dueDateISO: '2026-02-01', status: 'pending' }),
    ]
    expect(processAutoDue(items, '2026-01-15').toConvert.map((i) => i.id)).toEqual(['1'])
  })
})
