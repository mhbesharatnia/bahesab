import { describe, expect, it } from 'vitest'
import { hashBackupContent } from '../../domain/arvan-s3'
import type { BackupDocumentV1 } from '../../lib/types'

const base = (): BackupDocumentV1 => ({
  schemaVersion: 1,
  exportedAt: '2026-01-01T00:00:00.000Z',
  app: 'bahesab',
  settings: { displayUnit: 'toman', dueMode: 'confirm' },
  accounts: [],
  categories: [],
  transactions: [],
  scheduledItems: [],
  installmentSeries: [],
})

describe('arvan hash', () => {
  it('ignores exportedAt when hashing', async () => {
    const a = base()
    const b = { ...base(), exportedAt: '2026-12-01T00:00:00.000Z' }
    expect(await hashBackupContent(a)).toBe(await hashBackupContent(b))
  })

  it('changes when ledger content changes', async () => {
    const a = base()
    const b = {
      ...base(),
      accounts: [
        {
          id: '1',
          name: 'x',
          type: 'cash' as const,
          archived: false,
          createdAt: '',
          updatedAt: '',
        },
      ],
    }
    expect(await hashBackupContent(a)).not.toBe(await hashBackupContent(b))
  })
})
