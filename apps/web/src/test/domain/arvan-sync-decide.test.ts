import { describe, expect, it } from 'vitest'
import { decideArvanSyncAction, isFirstRemoteConnect, isSparseLedger } from '../../domain/arvan-sync'
import type { ArvanSyncConfig, BackupDocumentV1 } from '../../lib/types'

const cfg = (partial: Partial<ArvanSyncConfig> = {}): ArvanSyncConfig => ({
  enabled: true,
  endpoint: 'https://s3.example',
  region: 'ir-thr-at1',
  bucket: 'b',
  objectKey: 'bahesab/ledger.json',
  accessKeyId: 'a',
  secretAccessKey: 's',
  dirty: false,
  localChangedAt: null,
  lastSyncAt: null,
  lastSyncError: null,
  lastRemoteExportedAt: null,
  lastPushedContentHash: null,
  ...partial,
})

const doc = (accounts: BackupDocumentV1['accounts'], exportedAt = '2026-01-01T00:00:00.000Z'): BackupDocumentV1 => ({
  schemaVersion: 1,
  exportedAt,
  app: 'bahesab',
  settings: { displayUnit: 'toman', dueMode: 'confirm' },
  accounts,
  categories: [],
  transactions: [],
  scheduledItems: [],
  installmentSeries: [],
})

const account = {
  id: '1',
  name: 'بانک',
  type: 'bank' as const,
  archived: false,
  createdAt: '',
  updatedAt: '',
}

describe('arvan sync decisions', () => {
  it('detects sparse / first connect', () => {
    expect(isSparseLedger(doc([]))).toBe(true)
    expect(isSparseLedger(doc([account]))).toBe(false)
    expect(isFirstRemoteConnect(cfg())).toBe(true)
    expect(isFirstRemoteConnect(cfg({ lastPushedContentHash: 'abc' }))).toBe(false)
  })

  it('new empty device pulls existing remote instead of pushing wipe', () => {
    const action = decideArvanSyncAction({
      cfg: cfg({ dirty: true }), // even if wrongly dirty
      local: doc([]),
      localHash: 'empty',
      remote: doc([account], '2026-02-01T00:00:00.000Z'),
      remoteHash: 'cloud',
    })
    expect(action).toBe('pull')
  })

  it('first connect with local data still prefers non-empty remote', () => {
    const action = decideArvanSyncAction({
      cfg: cfg(),
      local: doc([account]),
      localHash: 'local',
      remote: doc([account], '2026-02-01T00:00:00.000Z'),
      remoteHash: 'remote',
    })
    expect(action).toBe('pull')
  })

  it('known device with dirty local pushes', () => {
    const action = decideArvanSyncAction({
      cfg: cfg({
        dirty: true,
        lastPushedContentHash: 'old',
        lastRemoteExportedAt: '2026-01-01T00:00:00.000Z',
      }),
      local: doc([account]),
      localHash: 'new',
      remote: doc([account], '2026-01-01T00:00:00.000Z'),
      remoteHash: 'old',
    })
    expect(action).toBe('push')
  })

  it('does not create remote file from empty local', () => {
    const action = decideArvanSyncAction({
      cfg: cfg({ dirty: true }),
      local: doc([]),
      localHash: 'empty',
      remote: null,
      remoteHash: null,
    })
    expect(action).toBe('noop')
  })
})
