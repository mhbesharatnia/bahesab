import type {
  Account,
  Category,
  Direction,
  InstallmentSeries,
  ScheduledItem,
  ScheduledStatus,
  Transaction,
} from '../lib/types'
import { resolveTxnOrigin } from './txn-origin'

export type CalendarEventSource = 'transaction' | 'scheduled'

export interface CalendarEvent {
  id: string
  dateISO: string
  amountRial: number
  direction: Direction
  source: CalendarEventSource
  /** Badge: تراکنش / در انتظار / رد شده / تأیید شده */
  statusLabel: string
  /** سری / تعهد / دستی / افتتاحیه */
  typeLabel: string
  accountName: string
  detail: string | null
}

function accountName(accounts: Account[], id: string): string {
  return accounts.find((a) => a.id === id)?.name ?? 'حساب'
}

function categoryName(categories: Category[], id: string | null): string | null {
  if (!id) return null
  return categories.find((c) => c.id === id)?.name ?? null
}

const scheduledStatusLabel: Record<ScheduledStatus, string> = {
  pending: 'در انتظار',
  confirmed: 'تأیید شده',
  skipped: 'رد شده',
}

export function buildCalendarEvents(input: {
  transactions: Transaction[]
  scheduled: ScheduledItem[]
  accounts: Account[]
  categories: Category[]
  series: InstallmentSeries[]
}): CalendarEvent[] {
  const { transactions, scheduled, accounts, categories, series } = input
  const scheduledById = new Map(scheduled.map((s) => [s.id, s]))
  const seriesById = new Map(series.map((s) => [s.id, s]))
  const events: CalendarEvent[] = []

  for (const t of transactions) {
    const origin = resolveTxnOrigin(t, scheduledById, seriesById)
    const cat = categoryName(categories, t.categoryId)
    events.push({
      id: `txn-${t.id}`,
      dateISO: t.dateISO,
      amountRial: t.amountRial,
      direction: t.direction,
      source: 'transaction',
      statusLabel: 'تراکنش',
      typeLabel: origin.badge,
      accountName: accountName(accounts, t.accountId),
      detail: [cat, origin.detail, t.note].filter(Boolean).join(' · ') || null,
    })
  }

  for (const s of scheduled) {
    // Confirmed items already appear as transactions — skip to avoid double
    if (s.status === 'confirmed') continue
    const ser = s.seriesId ? seriesById.get(s.seriesId) : undefined
    const typeLabel = ser ? 'سری' : 'تعهد'
    const cat = categoryName(categories, s.categoryId)
    const seriesDetail = ser
      ? `«${ser.name}»${s.seriesIndex != null ? ` — قسط ${s.seriesIndex} از ${ser.count}` : ''}`
      : null
    events.push({
      id: `sch-${s.id}`,
      dateISO: s.dueDateISO,
      amountRial: s.amountRial,
      direction: s.direction,
      source: 'scheduled',
      statusLabel: scheduledStatusLabel[s.status],
      typeLabel,
      accountName: accountName(accounts, s.accountId),
      detail: [cat, seriesDetail, s.note && s.note !== seriesDetail ? s.note : null]
        .filter(Boolean)
        .join(' · ') || null,
    })
  }

  return events.sort((a, b) => {
    const d = a.dateISO.localeCompare(b.dateISO)
    if (d !== 0) return d
    return a.direction === b.direction ? 0 : a.direction === 'in' ? -1 : 1
  })
}

export function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>()
  for (const e of events) {
    const list = map.get(e.dateISO) ?? []
    list.push(e)
    map.set(e.dateISO, list)
  }
  return map
}
