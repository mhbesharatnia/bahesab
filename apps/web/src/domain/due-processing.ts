import { compareISO } from '../lib/dates'
import { db } from '../lib/db'
import { newId, nowISO } from '../lib/id'
import type { Direction, ScheduledItem, Transaction } from '../lib/types'

export function listAwaitingConfirm(
  pending: ScheduledItem[],
  today: string,
): ScheduledItem[] {
  return pending.filter(
    (s) => s.status === 'pending' && compareISO(s.dueDateISO, today) <= 0,
  )
}

export function processAutoDue(
  items: ScheduledItem[],
  today: string,
): { toConvert: ScheduledItem[] } {
  return {
    toConvert: items.filter(
      (s) => s.status === 'pending' && compareISO(s.dueDateISO, today) <= 0,
    ),
  }
}

/** Fields applied when converting a scheduled item into a transaction. */
export type ConfirmOverrides = {
  accountId?: string
  categoryId?: string
  amountRial?: number
  direction?: Direction
  dateISO?: string
  note?: string | null
}

export async function confirmItems(
  ids: string[],
  overridesById?: Record<string, ConfirmOverrides>,
): Promise<void> {
  await db.transaction('rw', db.scheduledItems, db.transactions, async () => {
    for (const id of ids) {
      const item = await db.scheduledItems.get(id)
      if (!item || item.status !== 'pending') continue
      const o = overridesById?.[id]
      if (o?.amountRial !== undefined && o.amountRial <= 0) {
        throw new Error('مبلغ باید بزرگ‌تر از صفر باشد')
      }
      const t = nowISO()
      const txn: Transaction = {
        id: newId(),
        accountId: o?.accountId ?? item.accountId,
        categoryId: o?.categoryId ?? item.categoryId,
        amountRial: o?.amountRial ?? item.amountRial,
        direction: o?.direction ?? item.direction,
        dateISO: o?.dateISO ?? item.dueDateISO,
        kind: 'scheduled_conversion',
        note: o?.note !== undefined ? o.note : item.note,
        scheduledItemId: item.id,
        createdAt: t,
        updatedAt: t,
      }
      await db.transactions.add(txn)
      await db.scheduledItems.update(id, { status: 'confirmed', updatedAt: t })
    }
  })
}

export async function skipItems(ids: string[]): Promise<void> {
  await db.transaction('rw', db.scheduledItems, async () => {
    for (const id of ids) {
      const item = await db.scheduledItems.get(id)
      if (!item || item.status !== 'pending') continue
      await db.scheduledItems.update(id, { status: 'skipped', updatedAt: nowISO() })
    }
  })
}

export async function runDueBootstrap(today: string, dueMode: 'confirm' | 'auto'): Promise<number> {
  const pending = await db.scheduledItems.where('status').equals('pending').toArray()
  if (dueMode !== 'auto') return 0
  const { toConvert } = processAutoDue(pending, today)
  if (toConvert.length === 0) return 0
  await confirmItems(toConvert.map((i) => i.id))
  return toConvert.length
}
