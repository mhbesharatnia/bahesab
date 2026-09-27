import { compareISO, todayISO } from '../lib/dates'
import { db } from '../lib/db'
import { newId, nowISO } from '../lib/id'
import type { Direction, ScheduledItem } from '../lib/types'

function normalizeScheduled(s: ScheduledItem): ScheduledItem {
  return {
    ...s,
    counterAccountId: s.counterAccountId ?? null,
    categoryId: s.categoryId ?? null,
  }
}

export async function listScheduled(status?: ScheduledItem['status']): Promise<ScheduledItem[]> {
  const all = await db.scheduledItems.toArray()
  return all
    .map(normalizeScheduled)
    .filter((s) => !status || s.status === status)
    .sort((a, b) => a.dueDateISO.localeCompare(b.dueDateISO))
}

export async function createScheduled(input: {
  accountId: string
  categoryId: string | null
  amountRial: number
  direction: Direction
  dueDateISO: string
  note?: string | null
  seriesId?: string | null
  seriesIndex?: number | null
  counterAccountId?: string | null
}): Promise<ScheduledItem> {
  if (input.amountRial <= 0) throw new Error('مبلغ باید بزرگ‌تر از صفر باشد')
  const counter = input.counterAccountId ?? null
  if (counter && counter === input.accountId) {
    throw new Error('حساب مبدأ و مقصد باید متفاوت باشند')
  }
  if (counter) {
    const to = await db.accounts.get(counter)
    if (!to) throw new Error('حساب مقصد یافت نشد')
  }
  const t = nowISO()
  const item: ScheduledItem = {
    id: newId(),
    accountId: input.accountId,
    categoryId: counter ? null : input.categoryId,
    amountRial: input.amountRial,
    direction: counter ? 'out' : input.direction,
    dueDateISO: input.dueDateISO,
    status: 'pending',
    seriesId: input.seriesId ?? null,
    seriesIndex: input.seriesIndex ?? null,
    note: input.note ?? null,
    counterAccountId: counter,
    createdAt: t,
    updatedAt: t,
  }
  await db.scheduledItems.add(item)
  return item
}

export async function updateScheduledDueDate(id: string, dueDateISO: string): Promise<void> {
  const item = await db.scheduledItems.get(id)
  if (!item) throw new Error('قلم یافت نشد')
  if (item.status !== 'pending') throw new Error('فقط اقلام در انتظار قابل تعویق هستند')
  // Must be after today so it leaves the awaiting-confirm queue
  if (compareISO(dueDateISO, todayISO()) <= 0) {
    throw new Error('تاریخ تعویق باید بعد از امروز باشد')
  }
  await db.scheduledItems.update(id, { dueDateISO, updatedAt: nowISO() })
}

export async function updateScheduled(
  id: string,
  patch: Partial<
    Pick<
      ScheduledItem,
      | 'accountId'
      | 'categoryId'
      | 'amountRial'
      | 'direction'
      | 'dueDateISO'
      | 'note'
      | 'counterAccountId'
    >
  >,
): Promise<void> {
  const item = await db.scheduledItems.get(id)
  if (!item) throw new Error('قلم یافت نشد')
  if (item.status !== 'pending' && item.status !== 'skipped') {
    throw new Error('فقط اقلام در انتظار یا ردشده قابل ویرایش هستند')
  }
  if (patch.amountRial !== undefined && patch.amountRial <= 0) {
    throw new Error('مبلغ باید بزرگ‌تر از صفر باشد')
  }
  const nextFrom = patch.accountId ?? item.accountId
  const nextCounter =
    patch.counterAccountId !== undefined ? patch.counterAccountId : (item.counterAccountId ?? null)
  if (nextCounter && nextCounter === nextFrom) {
    throw new Error('حساب مبدأ و مقصد باید متفاوت باشند')
  }
  await db.scheduledItems.update(id, { ...patch, updatedAt: nowISO() })
}

/** Return a skipped item to pending so it can be confirmed again. */
export async function restoreScheduled(id: string): Promise<void> {
  const item = await db.scheduledItems.get(id)
  if (!item) throw new Error('قلم یافت نشد')
  if (item.status !== 'skipped') throw new Error('فقط اقلام ردشده قابل بازگردانی هستند')
  await db.scheduledItems.update(id, { status: 'pending', updatedAt: nowISO() })
}

export async function deleteScheduled(id: string): Promise<void> {
  const item = await db.scheduledItems.get(id)
  if (!item) throw new Error('قلم یافت نشد')
  if (item.status !== 'pending' && item.status !== 'skipped') {
    throw new Error('فقط اقلام در انتظار یا ردشده قابل حذف هستند')
  }
  await db.scheduledItems.delete(id)
}
