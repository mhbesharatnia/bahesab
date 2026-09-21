import { areChangeMarksSuppressed, exportBackup, importBackupReplace } from './import-export'
import { arvanGetBackup, arvanPutBackup, hashBackupContent } from './arvan-s3'
import { db, getSettings } from '../lib/db'
import { nowISO } from '../lib/id'
import type { ArvanSyncConfig, BackupDocumentV1, Settings } from '../lib/types'

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

/** True when ledger has no user accounts (fresh device / bootstrap only). */
export function isSparseLedger(doc: BackupDocumentV1): boolean {
  return doc.accounts.length === 0
}

/** First time this browser connects to this Arvan object (never successfully synced). */
export function isFirstRemoteConnect(cfg: ArvanSyncConfig): boolean {
  return !cfg.lastPushedContentHash && !cfg.lastRemoteExportedAt
}

/**
 * Decide sync action without I/O.
 * Priority: never overwrite a non-empty remote with an empty/first-connect local push.
 */
export function decideArvanSyncAction(input: {
  cfg: ArvanSyncConfig
  local: BackupDocumentV1
  localHash: string
  remote: BackupDocumentV1 | null
  remoteHash: string | null
}): 'noop' | 'push' | 'pull' | 'push-new' {
  const { cfg, local, localHash, remote, remoteHash } = input
  const localSparse = isSparseLedger(local)

  if (!remote) {
    if (localSparse) return 'noop'
    return 'push-new'
  }

  const hashesEqual = remoteHash === localHash
  if (hashesEqual) return 'noop'

  const firstConnect = isFirstRemoteConnect(cfg)
  const remoteSparse = isSparseLedger(remote)

  // New device / empty local: always take remote if it has data
  if (localSparse && !remoteSparse) return 'pull'

  // First connect with both sides having data: prefer remote (joining an existing cloud ledger)
  if (firstConnect && !remoteSparse) return 'pull'

  // Local edits on a known connection: push (but never push sparse over non-sparse remote)
  if (cfg.dirty || (cfg.lastPushedContentHash && localHash !== cfg.lastPushedContentHash)) {
    if (localSparse && !remoteSparse) return 'pull'
    return 'push'
  }

  // Remote moved ahead
  if (!cfg.lastRemoteExportedAt || remote.exportedAt > cfg.lastRemoteExportedAt) {
    return 'pull'
  }

  // Stale remote marker but content differs — pull to be safe on join
  if (firstConnect) return 'pull'

  return 'noop'
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

/**
 * Apply Arvan connection from another device: enable sync but do NOT mark dirty
 * (first sync must pull cloud ledger, not push empty local).
 */
export async function applyArvanConnectionImport(input: {
  endpoint: string
  region: string
  bucket: string
  objectKey: string
  accessKeyId: string
  secretAccessKey: string
}): Promise<ArvanSyncConfig> {
  return saveArvanSyncConfig({
    ...input,
    enabled: true,
    dirty: false,
    localChangedAt: null,
    lastSyncAt: null,
    lastSyncError: null,
    lastRemoteExportedAt: null,
    lastPushedContentHash: null,
  })
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

export async function runArvanSync(): Promise<SyncResult> {
  const settings = await getSettings()
  const cfg = { ...defaultArvan(), ...(settings.arvanSync ?? {}) }
  if (!cfg.enabled) return { ok: true, action: 'noop', message: 'همگام‌سازی خاموش است' }

  try {
    const localDoc = await exportBackup()
    const localHash = await hashBackupContent(localDoc)
    const { doc: remote } = await arvanGetBackup(cfg)
    const remoteHash = remote ? await hashBackupContent(remote) : null

    const action = decideArvanSyncAction({
      cfg,
      local: localDoc,
      localHash,
      remote,
      remoteHash,
    })

    if (action === 'noop') {
      await persistSyncOk(settings, cfg, {
        dirty: false,
        lastRemoteExportedAt: remote?.exportedAt ?? cfg.lastRemoteExportedAt,
        lastPushedContentHash: localHash,
      })
      return { ok: true, action: 'noop', message: 'همه‌چیز هم‌خوان است' }
    }

    if (action === 'push-new' || action === 'push') {
      await arvanPutBackup(cfg, localDoc)
      await persistSyncOk(settings, cfg, {
        dirty: false,
        lastRemoteExportedAt: localDoc.exportedAt,
        lastPushedContentHash: localHash,
      })
      return {
        ok: true,
        action: action === 'push-new' ? 'pushed-new' : 'pushed',
        message:
          action === 'push-new'
            ? 'فایل جدید روی آروان ساخته شد'
            : 'تغییرات محلی روی آروان نوشته شد',
      }
    }

    // pull
    if (!remote) {
      return { ok: true, action: 'noop', message: 'روی آروان فایلی نیست' }
    }
    const imported = await importBackupReplace(remote)
    if (!imported.ok) throw new Error(imported.errorFa)
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
