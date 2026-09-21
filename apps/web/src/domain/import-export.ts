import { db, ensureBootstrap } from '../lib/db'
import { nowISO } from '../lib/id'
import type { ArvanSyncConfig, BackupDocumentV1, Settings } from '../lib/types'

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export async function exportBackup(): Promise<BackupDocumentV1> {
  await ensureBootstrap()
  const settings = await db.settings.get('default')
  if (!settings) throw new Error('تنظیمات یافت نشد')
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    app: 'bahesab',
    settings: {
      displayUnit: settings.displayUnit,
      dueMode: settings.dueMode,
    },
    accounts: await db.accounts.toArray(),
    categories: await db.categories.toArray(),
    transactions: await db.transactions.toArray(),
    scheduledItems: await db.scheduledItems.toArray(),
    installmentSeries: await db.installmentSeries.toArray(),
  }
}

/** Suppress dirty-marking while applying a remote ledger (avoids push loop). */
let suppressChangeMarks = false

export function runWithoutChangeMarks<T>(fn: () => Promise<T>): Promise<T> {
  suppressChangeMarks = true
  return fn().finally(() => {
    suppressChangeMarks = false
  })
}

export function areChangeMarksSuppressed(): boolean {
  return suppressChangeMarks
}

export async function importBackupReplace(
  doc: unknown,
): Promise<{ ok: true } | { ok: false; errorFa: string }> {
  if (!isObject(doc)) return { ok: false, errorFa: 'فایل پشتیبان نامعتبر است' }
  if (doc.schemaVersion !== 1) return { ok: false, errorFa: 'نسخهٔ طرح‌واره پشتیبانی نمی‌شود' }
  if (doc.app !== 'bahesab') return { ok: false, errorFa: 'این فایل برای باحساب نیست' }
  if (!Array.isArray(doc.accounts) || !Array.isArray(doc.categories) || !Array.isArray(doc.transactions)) {
    return { ok: false, errorFa: 'ساختار فایل ناقص است' }
  }
  if (!Array.isArray(doc.scheduledItems) || !Array.isArray(doc.installmentSeries)) {
    return { ok: false, errorFa: 'ساختار فایل ناقص است' }
  }
  if (!isObject(doc.settings)) return { ok: false, errorFa: 'تنظیمات در فایل نیست' }

  const accounts = doc.accounts as BackupDocumentV1['accounts']
  const transactions = doc.transactions as BackupDocumentV1['transactions']
  for (const a of accounts) {
    const openings = transactions.filter((t) => t.accountId === a.id && t.kind === 'opening')
    if (openings.length !== 1) {
      return { ok: false, errorFa: `حساب «${a.name}» باید دقیقاً یک افتتاحیه داشته باشد` }
    }
  }

  const prev = await db.settings.get('default')
  const preservedArvan: ArvanSyncConfig | null | undefined = prev?.arvanSync

  try {
    await runWithoutChangeMarks(async () => {
      await db.transaction(
        'rw',
        [
          db.accounts,
          db.categories,
          db.transactions,
          db.scheduledItems,
          db.installmentSeries,
          db.settings,
        ],
        async () => {
          await Promise.all([
            db.accounts.clear(),
            db.categories.clear(),
            db.transactions.clear(),
            db.scheduledItems.clear(),
            db.installmentSeries.clear(),
            db.settings.clear(),
          ])
          const settings = doc.settings as BackupDocumentV1['settings']
          const nextSettings: Settings = {
            id: 'default',
            displayUnit: settings.displayUnit === 'rial' ? 'rial' : 'toman',
            dueMode: settings.dueMode === 'auto' ? 'auto' : 'confirm',
            updatedAt: nowISO(),
            arvanSync: preservedArvan ?? null,
          }
          await db.settings.put(nextSettings)
          await db.accounts.bulkAdd(accounts)
          await db.categories.bulkAdd(doc.categories as BackupDocumentV1['categories'])
          await db.transactions.bulkAdd(transactions)
          await db.scheduledItems.bulkAdd(doc.scheduledItems as BackupDocumentV1['scheduledItems'])
          await db.installmentSeries.bulkAdd(
            doc.installmentSeries as BackupDocumentV1['installmentSeries'],
          )
        },
      )
    })
    return { ok: true }
  } catch {
    return { ok: false, errorFa: 'وارد کردن پشتیبان ناموفق بود؛ دادهٔ فعلی حفظ شد' }
  }
}
