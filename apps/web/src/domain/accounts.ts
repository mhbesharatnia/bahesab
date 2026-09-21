import { db } from '../lib/db'
import { newId, nowISO } from '../lib/id'
import type { Account, AccountType, Direction, Transaction } from '../lib/types'
import { getOpeningCategoryId } from '../lib/db'

export async function listAccounts(includeArchived = false): Promise<Account[]> {
  const all = await db.accounts.toArray()
  return all
    .filter((a) => includeArchived || !a.archived)
    .sort((a, b) => a.name.localeCompare(b.name, 'fa'))
}

export async function createAccount(input: {
  name: string
  type: AccountType
  openingAmountRial: number
  openingDirection: Direction
  openingDateISO: string
}): Promise<Account> {
  const name = input.name.trim()
  if (!name) throw new Error('نام حساب الزامی است')
  if (input.openingAmountRial < 0) throw new Error('مبلغ افتتاحیه نامعتبر است')

  const existing = await db.accounts.toArray()
  if (existing.some((a) => a.name.trim().toLowerCase() === name.toLowerCase())) {
    throw new Error('حسابی با این نام وجود دارد')
  }

  const t = nowISO()
  const account: Account = {
    id: newId(),
    name,
    type: input.type,
    archived: false,
    createdAt: t,
    updatedAt: t,
  }
  const openingCat = await getOpeningCategoryId()
  const opening: Transaction = {
    id: newId(),
    accountId: account.id,
    categoryId: openingCat,
    amountRial: input.openingAmountRial,
    direction: input.openingDirection,
    dateISO: input.openingDateISO,
    kind: 'opening',
    note: 'تراکنش افتتاحیه',
    scheduledItemId: null,
    createdAt: t,
    updatedAt: t,
  }

  await db.transaction('rw', db.accounts, db.transactions, async () => {
    await db.accounts.add(account)
    await db.transactions.add(opening)
  })
  return account
}

export async function updateAccount(
  id: string,
  patch: Partial<Pick<Account, 'name' | 'type' | 'archived'>>,
): Promise<void> {
  const acc = await db.accounts.get(id)
  if (!acc) throw new Error('حساب یافت نشد')
  if (patch.name !== undefined) {
    const name = patch.name.trim()
    if (!name) throw new Error('نام حساب الزامی است')
    const existing = await db.accounts.toArray()
    if (existing.some((a) => a.id !== id && a.name.trim().toLowerCase() === name.toLowerCase())) {
      throw new Error('حسابی با این نام وجود دارد')
    }
    patch.name = name
  }
  await db.accounts.update(id, { ...patch, updatedAt: nowISO() })
}

export async function updateOpeningTransaction(
  accountId: string,
  input: { amountRial: number; direction: Direction; dateISO: string },
): Promise<void> {
  if (input.amountRial < 0) throw new Error('مبلغ افتتاحیه نامعتبر است')
  const opening = await db.transactions
    .where({ accountId })
    .filter((t) => t.kind === 'opening')
    .first()
  if (!opening) throw new Error('تراکنش افتتاحیه یافت نشد')
  await db.transactions.update(opening.id, {
    amountRial: input.amountRial,
    direction: input.direction,
    dateISO: input.dateISO,
    updatedAt: nowISO(),
  })
}

export async function getOpeningTransaction(accountId: string): Promise<Transaction | undefined> {
  return db.transactions.where({ accountId }).filter((t) => t.kind === 'opening').first()
}

export async function deleteAccount(id: string): Promise<void> {
  const extraTxns = await db.transactions
    .where({ accountId: id })
    .filter((t) => t.kind !== 'opening')
    .count()
  const schedCount = await db.scheduledItems.where({ accountId: id }).count()
  if (extraTxns > 0 || schedCount > 0) {
    throw new Error('حذف حساب دارای تراکنش یا تعهد/مطالبه مجاز نیست')
  }
  await db.transaction('rw', db.accounts, db.transactions, async () => {
    await db.transactions.where({ accountId: id }).delete()
    await db.accounts.delete(id)
  })
}
