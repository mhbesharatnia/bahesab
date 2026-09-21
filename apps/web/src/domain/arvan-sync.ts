import { areChangeMarksSuppressed, exportBackup, importBackupReplace } from './import-export'
import { arvanGetBackup, arvanPutBackup, hashBackupContent } from './arvan-s3'
import { db, getSettings } from '../lib/db'
import { nowISO } from '../lib/id'
import type { ArvanSyncConfig, Settings } from '../lib/types'

export type SyncResult =
  | { ok: true; action: 'noop' | 'pushed' | 'pulled' | 'pushed-new'; message: string }
  | { ok: false; error: string }

function defaultArvan(): ArvanSyncConfig {
  return {
    enabled: false,
    endpoint: 'https://s3.ir-thr-at1.arvanstorage.ir',
    region: 'ir-thr-at1',
    bucket: '',
    objectKey: 'bahesab/ledger.json',
    accessKeyId: '',
    secretAccessKey: '',
    dirty: false,
    localChangedAt: null,
    lastSyncAt: null,
    lastSyncError: null,
    lastRemoteExportedAt: null,
    lastPushedContentHash: null,
  }
}

export async function getArvanSyncConfig(): Promise<ArvanSyncConfig> {
  const s = await getSettings()
  return { ...defaultArvan(), ...(s.arvanSync ?? {}) }
}

export async function saveArvanSyncConfig(
  patch: Partial<ArvanSyncConfig>,
): Promise<ArvanSyncConfig> {
  const s = await getSettings()
  const next: ArvanSyncConfig = { ...defaultArvan(), ...(s.arvanSync ?? {}), ...patch }
  await db.settings.put({ ...s, arvanSync: next, updatedAt: nowISO() })
  return next
}

let marking = false

/** Call after any ledger mutation so the next sync pushes. */
export async function markLocalDataChanged(): Promise<void> {
  if (marking || areChangeMarksSuppressed()) return
  marking = true
  try {
    const s = await getSettings()
    const arvan = { ...defaultArvan(), ...(s.arvanSync ?? {}) }
    await db.settings.put({
      ...s,
      arvanSync: {
        ...arvan,
        dirty: true,
        localChangedAt: nowISO(),
      },
      updatedAt: nowISO(),
    })
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('bahesab-data-changed'))
    }
  } finally {
    marking = false
  }
}

/**
 * Last-write-wins sync:
 * - If local dirty → push current ledger to Arvan
 * - Else if remote newer (by exportedAt) → pull & replace local ledger (keep arvan credentials)
 * - Else noop
 */
export async function runArvanSync(): Promise<SyncResult> {
  const settings = await getSettings()
  const cfg = { ...defaultArvan(), ...(settings.arvanSync ?? {}) }
  if (!cfg.enabled) return { ok: true, action: 'noop', message: 'همگام‌سازی خاموش است' }

  try {
    const localDoc = await exportBackup()
    const localHash = await hashBackupContent(localDoc)
    const { doc: remote } = await arvanGetBackup(cfg)

    if (!remote) {
      await arvanPutBackup(cfg, localDoc)
      await persistSyncOk(settings, cfg, {
        dirty: false,
        lastRemoteExportedAt: localDoc.exportedAt,
        lastPushedContentHash: localHash,
      })
      return { ok: true, action: 'pushed-new', message: 'فایل جدید روی آروان ساخته شد' }
    }

    const remoteHash = await hashBackupContent(remote)
    const remoteNewer =
      !cfg.lastRemoteExportedAt || remote.exportedAt > (cfg.lastRemoteExportedAt ?? '')

    if (cfg.dirty || localHash !== cfg.lastPushedContentHash) {
      // Local changes win when dirty — push
      if (remoteHash !== localHash) {
        await arvanPutBackup(cfg, localDoc)
        await persistSyncOk(settings, cfg, {
          dirty: false,
          lastRemoteExportedAt: localDoc.exportedAt,
          lastPushedContentHash: localHash,
        })
        return { ok: true, action: 'pushed', message: 'تغییرات محلی روی آروان نوشته شد' }
      }
      await persistSyncOk(settings, cfg, {
        dirty: false,
        lastRemoteExportedAt: remote.exportedAt,
        lastPushedContentHash: localHash,
      })
      return { ok: true, action: 'noop', message: 'قبلاً هم‌خوان بود' }
    }

    if (remoteHash !== localHash && remoteNewer) {
      const imported = await importBackupReplace(remote)
      if (!imported.ok) {
        throw new Error(imported.errorFa)
      }
      // re-read settings after import (arvan preserved)
      const after = await getSettings()
      await persistSyncOk(after, { ...defaultArvan(), ...(after.arvanSync ?? {}) }, {
        dirty: false,
        lastRemoteExportedAt: remote.exportedAt,
        lastPushedContentHash: remoteHash,
      })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('bahesab-ledger-pulled'))
      }
      return { ok: true, action: 'pulled', message: 'داده از آروان دریافت شد' }
    }

    await persistSyncOk(settings, cfg, {
      lastRemoteExportedAt: remote.exportedAt,
      lastPushedContentHash: cfg.lastPushedContentHash ?? localHash,
    })
    return { ok: true, action: 'noop', message: 'همه‌چیز هم‌خوان است' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'خطای همگام‌سازی'
    const s = await getSettings()
    const arvan = { ...defaultArvan(), ...(s.arvanSync ?? {}) }
    await db.settings.put({
      ...s,
      arvanSync: { ...arvan, lastSyncAt: nowISO(), lastSyncError: msg },
      updatedAt: nowISO(),
    })
    return { ok: false, error: msg }
  }
}

async function persistSyncOk(
  settings: Settings,
  cfg: ArvanSyncConfig,
  patch: Partial<ArvanSyncConfig>,
): Promise<void> {
  await db.settings.put({
    ...settings,
    arvanSync: {
      ...cfg,
      ...patch,
      lastSyncAt: nowISO(),
      lastSyncError: null,
    },
    updatedAt: nowISO(),
  })
}

let hooksInstalled = false

/** Install Dexie hooks once so any table write marks sync dirty. */
export function installArvanChangeHooks(): void {
  if (hooksInstalled) return
  hooksInstalled = true
  const tables = [
    db.accounts,
    db.categories,
    db.transactions,
    db.scheduledItems,
    db.installmentSeries,
  ] as const

  for (const table of tables) {
    table.hook('creating', () => {
      queueMicrotask(() => void markLocalDataChanged())
    })
    table.hook('updating', () => {
      queueMicrotask(() => void markLocalDataChanged())
    })
    table.hook('deleting', () => {
      queueMicrotask(() => void markLocalDataChanged())
    })
  }
}
