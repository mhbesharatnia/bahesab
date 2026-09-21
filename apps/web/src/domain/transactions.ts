import { db } from '../lib/db'
import { newId, nowISO } from '../lib/id'
import type { Direction, Transaction, TxnKind } from '../lib/types'

export async function listTransactions(): Promise<Transaction[]> {
  const all = await db.transactions.toArray()
  return all.sort((a, b) => b.dateISO.localeCompare(a.dateISO) || b.createdAt.localeCompare(a.createdAt))
}

export async function createTransaction(input: {
  accountId: string
  categoryId: string
  amountRial: number
  direction: Direction
  dateISO: string
  note?: string | null
  kind?: TxnKind
  scheduledItemId?: string | null
}): Promise<Transaction> {
  const kind = input.kind ?? 'normal'
  if (kind !== 'opening' && input.amountRial <= 0) throw new Error('مبلغ باید بزرگ‌تر از صفر باشد')
  if (input.amountRial < 0) throw new Error('مبلغ نامعتبر است')
  const acc = await db.accounts.get(input.accountId)
  if (!acc) throw new Error('حساب یافت نشد')
  const t = nowISO()
  const txn: Transaction = {
    id: newId(),
    accountId: input.accountId,
    categoryId: input.categoryId,
    amountRial: input.amountRial,
    direction: input.direction,
    dateISO: input.dateISO,
    kind,
    note: input.note ?? null,
    scheduledItemId: input.scheduledItemId ?? null,
    createdAt: t,
    updatedAt: t,
  }
  await db.transactions.add(txn)
  return txn
}

export async function updateTransaction(
  id: string,
  patch: Partial<
    Pick<Transaction, 'amountRial' | 'direction' | 'dateISO' | 'categoryId' | 'note' | 'accountId'>
  >,
): Promise<void> {
  const txn = await db.transactions.get(id)
  if (!txn) throw new Error('تراکنش یافت نشد')
  const amount = patch.amountRial ?? txn.amountRial
  if (txn.kind !== 'opening' && amount <= 0) throw new Error('مبلغ باید بزرگ‌تر از صفر باشد')
  if (amount < 0) throw new Error('مبلغ نامعتبر است')
  await db.transactions.update(id, { ...patch, updatedAt: nowISO() })
}

export async function deleteTransaction(id: string): Promise<void> {
  const txn = await db.transactions.get(id)
  if (!txn) throw new Error('تراکنش یافت نشد')
  if (txn.kind === 'opening') {
    throw new Error('حذف تراکنش افتتاحیه مجاز نیست؛ مبلغ را ویرایش کنید')
  }
  await db.transactions.delete(id)
}
