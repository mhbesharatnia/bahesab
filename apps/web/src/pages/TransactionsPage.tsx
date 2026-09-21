import { useEffect, useMemo, useState } from 'react'
import { listAccounts } from '../domain/accounts'
import { listCategories } from '../domain/categories'
import { listInstallmentSeries } from '../domain/installments'
import { listScheduled } from '../domain/scheduled'
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from '../domain/transactions'
import { resolveTxnOrigin } from '../domain/txn-origin'
import { JalaliDateField } from '../components/forms/JalaliDateField'
import { MoneyField } from '../components/forms/MoneyField'
import { getSettings } from '../lib/db'
import { todayISO, toJalaliDisplay } from '../lib/dates'
import { formatMoney } from '../lib/money'
import type {
  Account,
  Category,
  Direction,
  DisplayUnit,
  InstallmentSeries,
  ScheduledItem,
  Transaction,
} from '../lib/types'

type OriginFilter = 'all' | 'opening' | 'manual' | 'commitment' | 'series'

const filterLabel: Record<OriginFilter, string> = {
  all: 'همه',
  opening: 'افتتاحیه',
  manual: 'دستی',
  commitment: 'از تعهد',
  series: 'از سری / قسط',
}

export function TransactionsPage() {
  const [txns, setTxns] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([])
  const [series, setSeries] = useState<InstallmentSeries[]>([])
  const [unit, setUnit] = useState<DisplayUnit>('toman')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState(0)
  const [direction, setDirection] = useState<Direction>('out')
  const [dateISO, setDateISO] = useState(todayISO())
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [originFilter, setOriginFilter] = useState<OriginFilter>('all')

  async function reload() {
    const [t, a, c, s, sch, ser] = await Promise.all([
      listTransactions(),
      listAccounts(),
      listCategories(),
      getSettings(),
      listScheduled(),
      listInstallmentSeries(),
    ])
    setTxns(t)
    setAccounts(a)
    setCategories(c)
    setUnit(s.displayUnit)
    setScheduled(sch)
    setSeries(ser)
    if (!accountId && a[0]) setAccountId(a[0].id)
    if (!categoryId && c[0]) setCategoryId(c[0].id)
  }

  useEffect(() => {
    void reload()
  }, [])

  const scheduledById = useMemo(() => new Map(scheduled.map((s) => [s.id, s])), [scheduled])
  const seriesById = useMemo(() => new Map(series.map((s) => [s.id, s])), [series])

  const rows = useMemo(() => {
    return txns
      .map((t) => {
        const origin = resolveTxnOrigin(t, scheduledById, seriesById)
        const acc = accounts.find((a) => a.id === t.accountId)
        const cat = categories.find((c) => c.id === t.categoryId)
        return { t, origin, acc, cat }
      })
      .filter((r) => originFilter === 'all' || r.origin.kind === originFilter)
  }, [txns, scheduledById, seriesById, accounts, categories, originFilter])

  const pendingAhead = useMemo(
    () =>
      scheduled
        .filter((s) => s.status === 'pending')
        .sort((a, b) => a.dueDateISO.localeCompare(b.dueDateISO)),
    [scheduled],
  )

  return (
    <section>
      <h2>تراکنش‌ها</h2>
      <form
        className="card-form"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          void createTransaction({
            accountId,
            categoryId,
            amountRial: amount,
            direction,
            dateISO,
            note: note || null,
          })
            .then(() => {
              setAmount(0)
              setNote('')
              return reload()
            })
            .catch((err) => setError(err instanceof Error ? err.message : 'خطا'))
        }}
      >
        <label className="field">
          <span>حساب</span>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>دسته</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <MoneyField amountRial={amount} unit={unit} onChangeRial={setAmount} />
        <label className="field">
          <span>جهت</span>
          <select value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
            <option value="out">خروجی</option>
            <option value="in">ورودی</option>
          </select>
        </label>
        <JalaliDateField value={dateISO} onChange={setDateISO} />
        <label className="field">
          <span>توضیحات (اختیاری)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً خرید هفتگی" />
        </label>
        <button type="submit">ثبت تراکنش</button>
        {error && <p className="error">{error}</p>}
      </form>

      <div className="row" style={{ marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.35rem' }}>
        {(Object.keys(filterLabel) as OriginFilter[]).map((key) => (
          <button
            key={key}
            type="button"
            className={originFilter === key ? undefined : 'ghost'}
            onClick={() => setOriginFilter(key)}
          >
            {filterLabel[key]}
          </button>
        ))}
      </div>

      <h3>ثبت‌شده ({rows.length})</h3>
      {rows.length === 0 ? (
        <p className="muted">موردی نیست.</p>
      ) : (
        <ul className="list">
          {rows.map(({ t, origin, acc, cat }) => (
            <li key={t.id}>
              <div>
                <strong>{formatMoney(t.amountRial, unit)}</strong>{' '}
                {t.direction === 'in' ? 'ورودی' : 'خروجی'}
                <span className="badge">{origin.badge}</span>
                <div className="muted">
                  {acc?.name}
                  {cat ? ` · ${cat.name}` : ''} — {toJalaliDisplay(t.dateISO)}
                  {origin.detail ? ` · ${origin.detail}` : ''}
                  {t.note && t.note !== origin.detail ? ` · ${t.note}` : ''}
                </div>
              </div>
              <div className="row">
                {t.kind === 'opening' ? (
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      const next = prompt('مبلغ ریال جدید', String(t.amountRial))
                      if (next == null) return
                      void updateTransaction(t.id, { amountRial: Number(next) })
                        .then(reload)
                        .catch((err) => setError(err instanceof Error ? err.message : 'خطا'))
                    }}
                  >
                    ویرایش مبلغ
                  </button>
                ) : (
                  <button
                    type="button"
                    className="danger"
                    onClick={() =>
                      void deleteTransaction(t.id)
                        .then(reload)
                        .catch((err) => setError(err instanceof Error ? err.message : 'خطا'))
                    }
                  >
                    حذف
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3>در انتظار / آینده ({pendingAhead.length})</h3>
      <p className="muted">تعهدها و اقساطی که هنوز به تراکنش تبدیل نشده‌اند.</p>
      {pendingAhead.length === 0 ? (
        <p className="muted">قلم pending نیست.</p>
      ) : (
        <ul className="list">
          {pendingAhead.map((s) => {
            const acc = accounts.find((a) => a.id === s.accountId)
            const cat = categories.find((c) => c.id === s.categoryId)
            const ser = s.seriesId ? seriesById.get(s.seriesId) : undefined
            const badge = ser ? 'سری' : 'تعهد'
            const detail = ser
              ? `«${ser.name}»${s.seriesIndex != null ? ` — قسط ${s.seriesIndex} از ${ser.count}` : ''}`
              : s.note
            return (
              <li key={s.id}>
                <div>
                  <strong>{formatMoney(s.amountRial, unit)}</strong>{' '}
                  {s.direction === 'in' ? 'ورودی' : 'خروجی'}
                  <span className="badge forecast">{badge}</span>
                  <div className="muted">
                    {acc?.name}
                    {cat ? ` · ${cat.name}` : ''} — سررسید {toJalaliDisplay(s.dueDateISO)}
                    {detail ? ` · ${detail}` : ''}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
