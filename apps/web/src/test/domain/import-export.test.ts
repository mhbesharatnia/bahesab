import { describe, expect, it } from 'vitest'

/** Mirrors importBackupReplace early validation without IndexedDB */
function validateBackupShape(doc: unknown): string | null {
  if (typeof doc !== 'object' || doc === null) return 'فایل پشتیبان نامعتبر است'
  const d = doc as Record<string, unknown>
  if (d.schemaVersion !== 1) return 'نسخهٔ طرح‌واره پشتیبانی نمی‌شود'
  if (d.app !== 'bahesab') return 'این فایل برای باحساب نیست'
  if (!Array.isArray(d.accounts) || !Array.isArray(d.categories) || !Array.isArray(d.transactions)) {
    return 'ساختار فایل ناقص است'
  }
  return null
}

describe('import-export validation', () => {
  it('rejects bad schema', () => {
    expect(validateBackupShape({ schemaVersion: 2, app: 'bahesab' })).toContain('طرح‌واره')
  })

  it('accepts minimal shape keys', () => {
    expect(
      validateBackupShape({
        schemaVersion: 1,
        app: 'bahesab',
        accounts: [],
        categories: [],
        transactions: [],
      }),
    ).toBeNull()
  })
})
