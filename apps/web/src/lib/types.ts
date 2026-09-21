export type AccountType = 'cash' | 'bank' | 'person' | 'fund'
export type CategoryKind = 'income' | 'expense'
export type Direction = 'in' | 'out'
export type TxnKind = 'opening' | 'normal' | 'scheduled_conversion'
export type ScheduledStatus = 'pending' | 'confirmed' | 'skipped'
export type DisplayUnit = 'rial' | 'toman'
export type DueMode = 'confirm' | 'auto'

export interface Account {
  id: string
  name: string
  type: AccountType
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  name: string
  kind: CategoryKind
  systemKey: string | null
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: string
  accountId: string
  categoryId: string | null
  amountRial: number
  direction: Direction
  dateISO: string
  kind: TxnKind
  note: string | null
  scheduledItemId: string | null
  createdAt: string
  updatedAt: string
}

export interface ScheduledItem {
  id: string
  accountId: string
  categoryId: string
  amountRial: number
  direction: Direction
  dueDateISO: string
  status: ScheduledStatus
  seriesId: string | null
  seriesIndex: number | null
  note: string | null
  createdAt: string
  updatedAt: string
}

export interface InstallmentSeries {
  id: string
  name: string
  accountId: string
  categoryId: string
  amountRial: number
  direction: Direction
  startDateISO: string
  count: number
  interval: 'monthly'
  createdAt: string
}

export interface Settings {
  id: 'default'
  displayUnit: DisplayUnit
  dueMode: DueMode
  updatedAt: string
  /** Local-only Arvan Object Storage sync — never included in ledger backup file */
  arvanSync?: ArvanSyncConfig | null
}

/** Connection + runtime state for Arvan S3-compatible object sync. */
export interface ArvanSyncConfig {
  enabled: boolean
  /** e.g. https://s3.ir-thr-at1.arvanstorage.ir */
  endpoint: string
  /** e.g. ir-thr-at1 */
  region: string
  bucket: string
  /** Object key inside bucket, e.g. bahesab/ledger.json */
  objectKey: string
  accessKeyId: string
  secretAccessKey: string
  dirty: boolean
  localChangedAt: string | null
  lastSyncAt: string | null
  lastSyncError: string | null
  lastRemoteExportedAt: string | null
  lastPushedContentHash: string | null
}

/** Portable Arvan connection settings (no runtime sync state). */
export interface ArvanConnectionExport {
  schemaVersion: 1
  app: 'bahesab-arvan'
  endpoint: string
  region: string
  bucket: string
  objectKey: string
  accessKeyId: string
  secretAccessKey: string
}

export interface BackupDocumentV1 {
  schemaVersion: 1
  exportedAt: string
  app: 'bahesab'
  settings: Omit<Settings, 'id' | 'updatedAt' | 'arvanSync'> & {
    displayUnit: DisplayUnit
    dueMode: DueMode
  }
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  scheduledItems: ScheduledItem[]
  installmentSeries: InstallmentSeries[]
}
