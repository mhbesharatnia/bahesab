import Dexie, { type Table } from 'dexie'
import type {
  Account,
  Category,
  InstallmentSeries,
  ScheduledItem,
  Settings,
  Transaction,
} from './types'
import { newId, nowISO } from './id'

export class BahesabDB extends Dexie {
  accounts!: Table<Account, string>
  categories!: Table<Category, string>
  transactions!: Table<Transaction, string>
  scheduledItems!: Table<ScheduledItem, string>
  installmentSeries!: Table<InstallmentSeries, string>
  settings!: Table<Settings, string>

  constructor() {
    super('bahesab')
    this.version(1).stores({
      accounts: 'id, name, type, archived',
      categories: 'id, name, kind, systemKey, archived',
      transactions: 'id, accountId, categoryId, dateISO, kind, scheduledItemId',
      scheduledItems: 'id, accountId, categoryId, dueDateISO, status, seriesId',
      installmentSeries: 'id, accountId',
      settings: 'id',
    })
  }
}

export const db = new BahesabDB()

export async function ensureBootstrap(): Promise<void> {
  const settings = await db.settings.get('default')
  if (!settings) {
    await db.settings.put({
      id: 'default',
      displayUnit: 'toman',
      dueMode: 'confirm',
      updatedAt: nowISO(),
    })
  }

  const opening = await db.categories.filter((c) => c.systemKey === 'opening').first()
  if (!opening) {
    const t = nowISO()
    await db.categories.add({
      id: newId(),
      name: 'افتتاحیه',
      kind: 'income',
      systemKey: 'opening',
      archived: false,
      createdAt: t,
      updatedAt: t,
    })
  }
}

export async function getSettings(): Promise<Settings> {
  await ensureBootstrap()
  const s = await db.settings.get('default')
  if (!s) throw new Error('تنظیمات یافت نشد')
  return s
}

export async function getOpeningCategoryId(): Promise<string> {
  await ensureBootstrap()
  const c = await db.categories.filter((x) => x.systemKey === 'opening').first()
  if (!c) throw new Error('دسته افتتاحیه یافت نشد')
  return c.id
}
