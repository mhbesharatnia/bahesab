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
  categoryId?: string | null
  amountRial?: number
  direction?: Direction
  dateISO?: string
  note?: string | null
  counterAccountId?: string | null
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
      const amount = o?.amountRial ?? item.amountRial
      const dateISO = o?.dateISO ?? item.dueDateISO
      const note = o?.note !== undefined ? o.note : item.note
      const fromId = o?.accountId ?? item.accountId
      const counterId =
        o?.counterAccountId !== undefined ? o.counterAccountId : (item.counterAccountId ?? null)

      if (counterId) {
        if (fromId === counterId) throw new Error('حساب مبدأ و مقصد باید متفاوت باشند')
        const groupId = newId()
        const out: Transaction = {
          id: newId(),
          accountId: fromId,
          categoryId: null,
          amountRial: amount,
          direction: 'out',
          dateISO,
          kind: 'transfer',
          note,
          scheduledItemId: item.id,
          transferGroupId: groupId,
          createdAt: t,
          updatedAt: t,
        }
        const inn: Transaction = {
          id: newId(),
          accountId: counterId,
          categoryId: null,
          amountRial: amount,
          direction: 'in',
          dateISO,
          kind: 'transfer',
          note,
          scheduledItemId: item.id,
          transferGroupId: groupId,
          createdAt: t,
          updatedAt: t,
        }
        await db.transactions.bulkAdd([out, inn])
      } else {
        const txn: Transaction = {
          id: newId(),
          accountId: fromId,
          categoryId: o?.categoryId !== undefined ? o.categoryId : item.categoryId,
          amountRial: amount,
          direction: o?.direction ?? item.direction,
          dateISO,
          kind: 'scheduled_conversion',
          note,
          scheduledItemId: item.id,
          transferGroupId: null,
          createdAt: t,
          updatedAt: t,
        }
        await db.transactions.add(txn)
      }
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
