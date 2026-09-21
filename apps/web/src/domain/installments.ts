import { addJalaliMonths } from '../lib/dates'
import { db } from '../lib/db'
import { newId, nowISO } from '../lib/id'
import type { Direction, InstallmentSeries, ScheduledItem } from '../lib/types'

export function buildInstallmentItems(input: {
  name: string
  startDateISO: string
  count: number
  amountRial: number
  direction: Direction
  accountId: string
  categoryId: string
}): { series: InstallmentSeries; items: ScheduledItem[] } {
  const name = input.name.trim()
  if (!name) throw new Error('نام سری اقساط الزامی است')
  if (input.count < 1 || input.count > 120) throw new Error('تعداد اقساط باید بین ۱ تا ۱۲۰ باشد')
  if (input.amountRial <= 0) throw new Error('مبلغ باید بزرگ‌تر از صفر باشد')

  const t = nowISO()
  const seriesId = newId()
  const series: InstallmentSeries = {
    id: seriesId,
    name,
    accountId: input.accountId,
    categoryId: input.categoryId,
    amountRial: input.amountRial,
    direction: input.direction,
    startDateISO: input.startDateISO,
    count: input.count,
    interval: 'monthly',
    createdAt: t,
  }

  const items: ScheduledItem[] = []
  for (let i = 0; i < input.count; i++) {
    items.push({
      id: newId(),
      accountId: input.accountId,
      categoryId: input.categoryId,
      amountRial: input.amountRial,
      direction: input.direction,
      dueDateISO: addJalaliMonths(input.startDateISO, i),
      status: 'pending',
      seriesId,
      seriesIndex: i + 1,
      note: `${name} — قسط ${i + 1} از ${input.count}`,
      createdAt: t,
      updatedAt: t,
    })
  }
  return { series, items }
}

export async function createInstallmentSeries(input: {
  name: string
  startDateISO: string
  count: number
  amountRial: number
  direction: Direction
  accountId: string
  categoryId: string
}): Promise<{ series: InstallmentSeries; items: ScheduledItem[] }> {
  const built = buildInstallmentItems(input)
  await db.transaction('rw', db.installmentSeries, db.scheduledItems, async () => {
    await db.installmentSeries.add(built.series)
    await db.scheduledItems.bulkAdd(built.items)
  })
  return built
}

export async function listInstallmentSeries(): Promise<InstallmentSeries[]> {
  const all = await db.installmentSeries.toArray()
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export type SeriesUpdatePatch = {
  name?: string
  amountRial?: number
  accountId?: string
  categoryId?: string
  direction?: Direction
  startDateISO?: string
  count?: number
}

function noteFor(name: string, index: number, count: number): string {
  return `${name} — قسط ${index} از ${count}`
}

/**
 * Full series edit. Updates open items (pending + skipped).
 * Confirmed installments are left unchanged (already converted to transactions).
 * Increasing count adds new pending items; decreasing removes open items beyond the new count.
 */
export async function updateInstallmentSeries(id: string, patch: SeriesUpdatePatch): Promise<void> {
  const series = await db.installmentSeries.get(id)
  if (!series) throw new Error('سری اقساط یافت نشد')

  const next: InstallmentSeries = {
    ...series,
    name: patch.name !== undefined ? patch.name.trim() : series.name,
    amountRial: patch.amountRial ?? series.amountRial,
    accountId: patch.accountId ?? series.accountId,
    categoryId: patch.categoryId ?? series.categoryId,
    direction: patch.direction ?? series.direction,
    startDateISO: patch.startDateISO ?? series.startDateISO,
    count: patch.count ?? series.count,
  }

  if (!next.name) throw new Error('نام سری اقساط الزامی است')
  if (next.count < 1 || next.count > 120) throw new Error('تعداد اقساط باید بین ۱ تا ۱۲۰ باشد')
  if (next.amountRial <= 0) throw new Error('مبلغ باید بزرگ‌تر از صفر باشد')

  const t = nowISO()

  await db.transaction('rw', db.installmentSeries, db.scheduledItems, async () => {
    await db.installmentSeries.put(next)

    const items = await db.scheduledItems.where({ seriesId: id }).toArray()
    const open = items.filter((s) => s.status === 'pending' || s.status === 'skipped')
    const byIndex = new Map(open.map((s) => [s.seriesIndex ?? 0, s]))

    // Drop open items beyond new count
    for (const item of open) {
      const idx = item.seriesIndex ?? 0
      if (idx > next.count) {
        await db.scheduledItems.delete(item.id)
        byIndex.delete(idx)
      }
    }

    // Update remaining open items
    for (const item of [...byIndex.values()]) {
      const idx = item.seriesIndex ?? 1
      await db.scheduledItems.update(item.id, {
        accountId: next.accountId,
        categoryId: next.categoryId,
        amountRial: next.amountRial,
        direction: next.direction,
        dueDateISO: addJalaliMonths(next.startDateISO, idx - 1),
        note: noteFor(next.name, idx, next.count),
        updatedAt: t,
      })
    }

    // Add missing indices as pending
    for (let i = 1; i <= next.count; i++) {
      if (byIndex.has(i)) continue
      // skip if a confirmed item already occupies this index
      const confirmedAtIndex = items.some(
        (s) => s.status === 'confirmed' && s.seriesIndex === i,
      )
      if (confirmedAtIndex) continue

      const item: ScheduledItem = {
        id: newId(),
        accountId: next.accountId,
        categoryId: next.categoryId,
        amountRial: next.amountRial,
        direction: next.direction,
        dueDateISO: addJalaliMonths(next.startDateISO, i - 1),
        status: 'pending',
        seriesId: id,
        seriesIndex: i,
        note: noteFor(next.name, i, next.count),
        createdAt: t,
        updatedAt: t,
      }
      await db.scheduledItems.add(item)
    }
  })
}

/** Deletes series and all non-confirmed items. Confirmed items stay for history. */
export async function deleteInstallmentSeries(id: string): Promise<void> {
  const series = await db.installmentSeries.get(id)
  if (!series) throw new Error('سری اقساط یافت نشد')

  await db.transaction('rw', db.installmentSeries, db.scheduledItems, async () => {
    const items = await db.scheduledItems.where({ seriesId: id }).toArray()
    for (const item of items) {
      if (item.status === 'confirmed') continue
      await db.scheduledItems.delete(item.id)
    }
    await db.installmentSeries.delete(id)
  })
}
