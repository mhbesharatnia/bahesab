import { describe, expect, it } from 'vitest'
import { buildCalendarEvents, groupEventsByDate } from '../../domain/calendar-events'
import type { Account, Category, ScheduledItem, Transaction } from '../../lib/types'

const account: Account = {
  id: 'a1',
  name: 'بانک',
  type: 'bank',
  archived: false,
  createdAt: '',
  updatedAt: '',
}

const category: Category = {
  id: 'c1',
  name: 'هزینه',
  kind: 'expense',
  systemKey: null,
  archived: false,
  createdAt: '',
  updatedAt: '',
}

describe('calendar-events', () => {
  it('includes transactions and open scheduled, skips confirmed duplicates', () => {
    const txns: Transaction[] = [
      {
        id: 't1',
        accountId: 'a1',
        categoryId: 'c1',
        amountRial: 1000,
        direction: 'out',
        dateISO: '2026-09-21',
        kind: 'normal',
        note: null,
        scheduledItemId: null,
        createdAt: '',
        updatedAt: '',
      },
    ]
    const scheduled: ScheduledItem[] = [
      {
        id: 's1',
        accountId: 'a1',
        categoryId: 'c1',
        amountRial: 2000,
        direction: 'in',
        dueDateISO: '2026-09-22',
        status: 'pending',
        seriesId: null,
        seriesIndex: null,
        note: 'حقوق',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 's2',
        accountId: 'a1',
        categoryId: 'c1',
        amountRial: 500,
        direction: 'out',
        dueDateISO: '2026-09-23',
        status: 'confirmed',
        seriesId: null,
        seriesIndex: null,
        note: null,
        createdAt: '',
        updatedAt: '',
      },
    ]
    const events = buildCalendarEvents({
      transactions: txns,
      scheduled,
      accounts: [account],
      categories: [category],
      series: [],
    })
    expect(events).toHaveLength(2)
    expect(events.map((e) => e.dateISO)).toEqual(['2026-09-21', '2026-09-22'])
    const grouped = groupEventsByDate(events)
    expect(grouped.get('2026-09-21')).toHaveLength(1)
  })
})
