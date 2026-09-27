import { db } from '../lib/db'
import { newId, nowISO } from '../lib/id'
import type { Direction, Transaction, TxnKind } from '../lib/types'

export async function listTransactions(): Promise<Transaction[]> {
  const all = await db.transactions.toArray()
  return all
    .map(normalizeTxn)
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO) || b.createdAt.localeCompare(a.createdAt))
}

function normalizeTxn(t: Transaction): Transaction {
  return {
    ...t,
    transferGroupId: t.transferGroupId ?? null,
  }
}

export async function createTransaction(input: {
  accountId: string
  categoryId: string | null
  amountRial: number
  direction: Direction
  dateISO: string
  note?: string | null
  kind?: TxnKind
  scheduledItemId?: string | null
  transferGroupId?: string | null
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
    transferGroupId: input.transferGroupId ?? null,
    createdAt: t,
    updatedAt: t,
  }
  await db.transactions.add(txn)
  return txn
}

/**
 * Move money from one account to another: out on from, in on to (same transferGroupId).
 * Example: bank → fund repayment.
 */
export async function createTransfer(input: {
  fromAccountId: string
  toAccountId: string
  amountRial: number
  dateISO: string
  note?: string | null
  scheduledItemId?: string | null
}): Promise<{ groupId: string; out: Transaction; inn: Transaction }> {
  if (input.amountRial <= 0) throw new Error('مبلغ باید بزرگ‌تر از صفر باشد')
  if (input.fromAccountId === input.toAccountId) {
    throw new Error('حساب مبدأ و مقصد باید متفاوت باشند')
  }
  const [from, to] = await Promise.all([
    db.accounts.get(input.fromAccountId),
    db.accounts.get(input.toAccountId),
  ])
  if (!from) throw new Error('حساب مبدأ یافت نشد')
  if (!to) throw new Error('حساب مقصد یافت نشد')

  const groupId = newId()
  const t = nowISO()
  const note = input.note ?? null
  const scheduledItemId = input.scheduledItemId ?? null

  const out: Transaction = {
    id: newId(),
    accountId: input.fromAccountId,
    categoryId: null,
    amountRial: input.amountRial,
    direction: 'out',
    dateISO: input.dateISO,
    kind: 'transfer',
    note,
    scheduledItemId,
    transferGroupId: groupId,
    createdAt: t,
    updatedAt: t,
  }
  const inn: Transaction = {
    id: newId(),
    accountId: input.toAccountId,
    categoryId: null,
    amountRial: input.amountRial,
    direction: 'in',
    dateISO: input.dateISO,
    kind: 'transfer',
    note,
    scheduledItemId,
    transferGroupId: groupId,
    createdAt: t,
    updatedAt: t,
  }

  await db.transaction('rw', db.transactions, async () => {
    await db.transactions.bulkAdd([out, inn])
  })
  return { groupId, out, inn }
}

export async function updateTransaction(
  id: string,
  patch: Partial<
    Pick<Transaction, 'amountRial' | 'direction' | 'dateISO' | 'categoryId' | 'note' | 'accountId'>
  >,
): Promise<void> {
  const txn = await db.transactions.get(id)
  if (!txn) throw new Error('تراکنش یافت نشد')
  if (txn.kind === 'transfer') {
    throw new Error('ویرایش انتقال مجاز نیست؛ حذف و دوباره ثبت کنید')
  }
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
  if (txn.kind === 'transfer' && txn.transferGroupId) {
    await db.transactions.where('transferGroupId').equals(txn.transferGroupId).delete()
    return
  }
  await db.transactions.delete(id)
}
