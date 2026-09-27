import { useEffect, useMemo, useState } from 'react'
import {
  createAccount,
  deleteAccount,
  getOpeningTransaction,
  listAccounts,
  updateOpeningTransaction,
} from '../domain/accounts'
import { settledBalancesAsOf } from '../domain/balances'
import { listCategories } from '../domain/categories'
import { deleteTransaction, listTransactions, updateTransaction } from '../domain/transactions'
import { JalaliDateField } from '../components/forms/JalaliDateField'
import { MoneyField } from '../components/forms/MoneyField'
import { getSettings } from '../lib/db'
import { todayISO, toJalaliDisplay } from '../lib/dates'
import { formatMoney, openingToSigned, signedToOpening } from '../lib/money'
import { formatTransferPath } from '../lib/transfer-label'
import type {
  Account,
  AccountType,
  Category,
  Direction,
  DisplayUnit,
  Transaction,
} from '../lib/types'

const typeLabel: Record<AccountType, string> = {
  cash: 'نقدی',
  bank: 'بانکی',
  person: 'اشخاص',
  fund: 'صندوق',
}

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [txns, setTxns] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [unit, setUnit] = useState<DisplayUnit>('toman')
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('bank')
  /** Signed opening: + طلب/موجودی، − بدهی (بدهکار بودن شما) */
  const [signedOpening, setSignedOpening] = useState(0)
  const [dateISO, setDateISO] = useState(todayISO())
  const [error, setError] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)

  const [txnEditId, setTxnEditId] = useState<string | null>(null)
  const [txnEditKind, setTxnEditKind] = useState<Transaction['kind'] | null>(null)
  const [txnAccountId, setTxnAccountId] = useState('')
  const [txnCategoryId, setTxnCategoryId] = useState('')
  const [txnAmount, setTxnAmount] = useState(0)
  const [txnDirection, setTxnDirection] = useState<Direction>('out')
  const [txnDateISO, setTxnDateISO] = useState(todayISO())
  const [txnNote, setTxnNote] = useState('')

  async function reload() {
    const [a, s, t, c] = await Promise.all([
      listAccounts(),
      getSettings(),
      listTransactions(),
      listCategories(false, { includeOpening: true }),
    ])
    setAccounts(a)
    setUnit(s.displayUnit)
    setTxns(t)
    setCategories(c)
  }

  useEffect(() => {
    void reload()
  }, [])

  const balances = useMemo(() => settledBalancesAsOf(todayISO(), txns), [txns])
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const formCategories = useMemo(
    () => categories.filter((c) => c.systemKey !== 'opening'),
    [categories],
  )

  const transferMateById = useMemo(() => {
    const map = new Map<string, Transaction>()
    const byGroup = new Map<string, Transaction[]>()
    for (const t of txns) {
      if (t.kind !== 'transfer' || !t.transferGroupId) continue
      const list = byGroup.get(t.transferGroupId) ?? []
      list.push(t)
      byGroup.set(t.transferGroupId, list)
    }
    for (const [, pair] of byGroup) {
      if (pair.length < 2) continue
      const a = pair[0]!
      const b = pair[1]!
      map.set(a.id, b)
      map.set(b.id, a)
    }
    return map
  }, [txns])

  const selectedAccount = selectedAccountId
    ? accounts.find((a) => a.id === selectedAccountId) ?? null
    : null

  const accountTxns = useMemo(() => {
    if (!selectedAccountId) return []
    return txns
      .filter((t) => t.accountId === selectedAccountId)
      .sort(
        (a, b) =>
          a.dateISO.localeCompare(b.dateISO) || a.createdAt.localeCompare(b.createdAt),
      )
  }, [txns, selectedAccountId])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const { amountRial, direction } = signedToOpening(signedOpening)
    try {
      if (editId) {
        await updateOpeningTransaction(editId, {
          amountRial,
          direction,
          dateISO,
        })
        setEditId(null)
        setSignedOpening(0)
      } else {
        await createAccount({
          name,
          type,
          openingAmountRial: amountRial,
          openingDirection: direction,
          openingDateISO: dateISO,
        })
        setName('')
        setSignedOpening(0)
      }
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا')
    }
  }

  async function startEdit(id: string) {
    const opening = await getOpeningTransaction(id)
    if (!opening) return
    setEditId(id)
    setSignedOpening(openingToSigned(opening.amountRial, opening.direction))
    setDateISO(opening.dateISO)
  }

  function startTxnEdit(t: Transaction) {
    setError(null)
    if (t.kind === 'transfer') {
      setError('ویرایش انتقال مجاز نیست؛ حذف و دوباره ثبت کنید')
      return
    }
    setTxnEditId(t.id)
    setTxnEditKind(t.kind)
    setTxnAccountId(t.accountId)
    setTxnCategoryId(t.categoryId ?? formCategories[0]?.id ?? '')
    setTxnAmount(t.amountRial)
    setTxnDirection(t.direction)
    setTxnDateISO(t.dateISO)
    setTxnNote(t.note ?? '')
  }

  function cancelTxnEdit() {
    setTxnEditId(null)
    setTxnEditKind(null)
    setTxnAmount(0)
    setTxnNote('')
  }

  const isEditingOpeningTxn = txnEditKind === 'opening'

  const openingHint =
    type === 'person'
      ? 'مثبت = طرف به شما بدهکار است (طلب). منفی = شما به طرف بدهکارید (بدهی).'
      : type === 'fund'
        ? 'موجودی خودِ صندوق را وارد نکنید. فقط بدهی/طلب شما با صندوق: منفی = از صندوق قرض گرفته‌اید؛ مثبت = صندوق به شما بدهکار است.'
        : 'برای حساب نقدی/بانکی معمولاً مثبت است. منفی یعنی اضافهبرداشت/بدهی اولیه.'

  return (
    <section>
      <div className="page-head">
        <h2>حساب‌ها</h2>
        <p className="sub">مدیریت حساب‌ها، مانده و تراکنش‌های هر حساب</p>
      </div>
      <form className="card-form" onSubmit={onSubmit}>
        <h3>{editId ? 'ویرایش افتتاحیه' : 'حساب جدید'}</h3>
        {!editId && (
          <>
            <label className="field">
              <span>نام</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              <span>نوع</span>
              <select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
                <option value="cash">نقدی</option>
                <option value="bank">بانکی</option>
                <option value="person">اشخاص</option>
                <option value="fund">صندوق (قرض‌دهنده)</option>
              </select>
            </label>
          </>
        )}
        <MoneyField
          amountRial={signedOpening}
          unit={unit}
          onChangeRial={setSignedOpening}
          label="تراز اولیه"
          allowNegative
          hint={openingHint}
        />
        <JalaliDateField value={dateISO} onChange={setDateISO} label="تاریخ افتتاحیه" />
        <div className="row">
          <button type="submit">{editId ? 'ذخیره افتتاحیه' : 'ایجاد حساب'}</button>
          {editId && (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setEditId(null)
                setSignedOpening(0)
              }}
            >
              انصراف
            </button>
          )}
        </div>
        {error && !txnEditId && <p className="error">{error}</p>}
      </form>

      <div className="card">
        <div className="card-head">
          <h3>فهرست حساب‌ها</h3>
        </div>
        <div className="card-body">
          <ul className="list" style={{ marginBottom: 0 }}>
            {accounts.map((a) => {
              const balance = balances.get(a.id) ?? 0
              const selected = selectedAccountId === a.id
              return (
                <li key={a.id} className={selected ? 'list-item-selected' : undefined}>
                  <div>
                    <strong>{a.name}</strong>
                    <span className="badge">{typeLabel[a.type]}</span>
                    {(a.type === 'person' || a.type === 'fund') && balance < 0 && (
                      <span className="badge">بدهی</span>
                    )}
                    {(a.type === 'person' || a.type === 'fund') && balance > 0 && (
                      <span className="badge">طلب</span>
                    )}
                    <div className="muted" style={{ marginTop: 4 }}>
                      مانده: <strong>{formatMoney(balance, unit)}</strong>
                    </div>
                  </div>
                  <div className="row" style={{ flexWrap: 'wrap', gap: '0.25rem' }}>
                    <button
                      type="button"
                      className={selected ? undefined : 'ghost sm'}
                      onClick={() =>
                        setSelectedAccountId((cur) => (cur === a.id ? null : a.id))
                      }
                    >
                      {selected ? 'بستن' : 'تراکنش‌ها'}
                    </button>
                    <button type="button" className="ghost sm" onClick={() => void startEdit(a.id)}>
                      افتتاحیه
                    </button>
                    <button
                      type="button"
                      className="danger sm"
                      onClick={() =>
                        void deleteAccount(a.id)
                          .then(() => {
                            if (selectedAccountId === a.id) setSelectedAccountId(null)
                            return reload()
                          })
                          .catch((err) => setError(err instanceof Error ? err.message : 'خطا'))
                      }
                    >
                      حذف
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {selectedAccount && (
        <div className="card">
          <div className="card-head">
            <h3>
              تراکنش‌های «{selectedAccount.name}»
              <span className="muted" style={{ fontWeight: 500, marginInlineStart: 8 }}>
                مانده {formatMoney(balances.get(selectedAccount.id) ?? 0, unit)}
              </span>
            </h3>
          </div>
          <div className="card-body" style={{ padding: accountTxns.length === 0 ? 16 : 0 }}>
            {accountTxns.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                تراکنشی برای این حساب ثبت نشده.
              </p>
            ) : (
              <div
                className="table-scroll"
                style={{ margin: 0, border: 0, borderRadius: 0, boxShadow: 'none' }}
              >
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>تاریخ</th>
                      <th>مبلغ</th>
                      <th>جهت / مسیر</th>
                      <th>دسته</th>
                      <th>توضیح</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountTxns.map((t) => {
                      const mate = transferMateById.get(t.id)
                      const cat = t.categoryId ? categoryById.get(t.categoryId) : undefined
                      const path =
                        t.kind === 'transfer' && mate
                          ? t.direction === 'out'
                            ? formatTransferPath(
                                selectedAccount.name,
                                accountById.get(mate.accountId)?.name ?? '؟',
                              )
                            : formatTransferPath(
                                accountById.get(mate.accountId)?.name ?? '؟',
                                selectedAccount.name,
                              )
                          : null
                      const kindLabel =
                        t.kind === 'opening'
                          ? 'افتتاحیه'
                          : t.kind === 'transfer'
                            ? 'انتقال'
                            : t.direction === 'in'
                              ? 'ورودی'
                              : 'خروجی'
                      return (
                        <tr key={t.id} className={t.direction === 'in' ? 'row-in' : 'row-out'}>
                          <td data-label="تاریخ">{toJalaliDisplay(t.dateISO)}</td>
                          <td data-label="مبلغ" className="num">
                            {formatMoney(t.amountRial, unit)}
                          </td>
                          <td data-label="جهت / مسیر">{path ?? kindLabel}</td>
                          <td data-label="دسته">
                            {t.kind === 'transfer' ? '—' : cat?.name || '—'}
                          </td>
                          <td data-label="توضیح" className="cell-note">
                            {t.note || '—'}
                          </td>
                          <td data-label="عملیات" className="cell-actions">
                            <div
                              className="row"
                              style={{ justifyContent: 'flex-end', gap: '0.25rem' }}
                            >
                              {t.kind !== 'transfer' && (
                                <button
                                  type="button"
                                  className="ghost sm"
                                  onClick={() => startTxnEdit(t)}
                                >
                                  ویرایش
                                </button>
                              )}
                              {t.kind !== 'opening' && (
                                <button
                                  type="button"
                                  className="danger sm"
                                  onClick={() =>
                                    void deleteTransaction(t.id)
                                      .then(reload)
                                      .catch((err) =>
                                        setError(err instanceof Error ? err.message : 'خطا'),
                                      )
                                  }
                                >
                                  حذف
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {txnEditId && (
        <form
          className="card-form"
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            const patch: Parameters<typeof updateTransaction>[1] = {
              amountRial: txnAmount,
              dateISO: txnDateISO,
              note: txnNote || null,
            }
            if (!isEditingOpeningTxn) {
              patch.accountId = txnAccountId
              patch.categoryId = txnCategoryId || null
              patch.direction = txnDirection
            }
            void updateTransaction(txnEditId, patch)
              .then(() => {
                cancelTxnEdit()
                return reload()
              })
              .catch((err) => setError(err instanceof Error ? err.message : 'خطا'))
          }}
        >
          <h3>ویرایش تراکنش</h3>
          {isEditingOpeningTxn ? (
            <p className="muted">افتتاحیه: فقط مبلغ، تاریخ و توضیح قابل تغییر است.</p>
          ) : (
            <>
              <label className="field">
                <span>حساب</span>
                <select
                  value={txnAccountId}
                  onChange={(e) => setTxnAccountId(e.target.value)}
                  required
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>دسته</span>
                <select
                  value={txnCategoryId}
                  onChange={(e) => setTxnCategoryId(e.target.value)}
                  required
                >
                  {formCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>جهت</span>
                <select
                  value={txnDirection}
                  onChange={(e) => setTxnDirection(e.target.value as Direction)}
                >
                  <option value="out">خروجی</option>
                  <option value="in">ورودی</option>
                </select>
              </label>
            </>
          )}
          <MoneyField amountRial={txnAmount} unit={unit} onChangeRial={setTxnAmount} />
          <JalaliDateField value={txnDateISO} onChange={setTxnDateISO} />
          <label className="field">
            <span>توضیحات (اختیاری)</span>
            <input value={txnNote} onChange={(e) => setTxnNote(e.target.value)} />
          </label>
          <div className="row">
            <button type="submit">ذخیره تغییرات</button>
            <button type="button" className="ghost" onClick={cancelTxnEdit}>
              انصراف
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </form>
      )}

      <p className="muted">
        بازپرداخت: از بانک خروجی + روی صندوق ورودی (کاهش بدهی). یا از «تراکنش‌ها / اقساط» نوع{' '}
        <strong>انتقال بین حساب‌ها</strong> را بزن تا هر دو طرف یکجا ثبت شود.
      </p>
      <p className="muted">
        نمونه بدهی به علی: حساب اشخاص با تراز {formatMoney(-5_000_000, unit)}. نمونه قرض از صندوق: نوع «صندوق» + تراز منفی
        به اندازهٔ اصل بدهی باقی‌مانده.
      </p>
    </section>
  )
}
