import { useEffect, useMemo, useState } from 'react'
import { listAccounts } from '../domain/accounts'
import { settledBalancesAsOf } from '../domain/balances'
import { listCategories } from '../domain/categories'
import { listInstallmentSeries } from '../domain/installments'
import {
  buildCashProjection,
  buildLiquidityBuckets,
  isLiquidAccount,
} from '../domain/liquidity'
import { listScheduled } from '../domain/scheduled'
import { listTransactions } from '../domain/transactions'
import { CashProjectionChart } from '../components/charts/CashProjectionChart'
import { LiquidityChart } from '../components/charts/LiquidityChart'
import { JalaliDateField } from '../components/forms/JalaliDateField'
import { getSettings } from '../lib/db'
import { compareISO, endOfJalaliMonthAheadISO, endOfJalaliYearISO, todayISO, toJalaliDisplay } from '../lib/dates'
import { formatMoney } from '../lib/money'
import type {
  Account,
  Category,
  DisplayUnit,
  InstallmentSeries,
  ScheduledItem,
  Transaction,
} from '../lib/types'

export function LiquidityPage() {
  const today = todayISO()
  const [pending, setPending] = useState<ScheduledItem[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [seriesList, setSeriesList] = useState<InstallmentSeries[]>([])
  const [txns, setTxns] = useState<Transaction[]>([])
  const [unit, setUnit] = useState<DisplayUnit>('toman')
  const [fromISO, setFromISO] = useState(today)
  const [toISO, setToISO] = useState(endOfJalaliYearISO(today))

  useEffect(() => {
    void (async () => {
      const [p, s, a, t, c, ser] = await Promise.all([
        listScheduled('pending'),
        getSettings(),
        listAccounts(),
        listTransactions(),
        listCategories(),
        listInstallmentSeries(),
      ])
      setPending(p)
      setUnit(s.displayUnit)
      setAccounts(a)
      setTxns(t)
      setCategories(c)
      setSeriesList(ser)
    })()
  }, [])

  const liquidIds = useMemo(
    () => new Set(accounts.filter(isLiquidAccount).map((a) => a.id)),
    [accounts],
  )

  const seriesById = useMemo(() => new Map(seriesList.map((s) => [s.id, s])), [seriesList])

  const totalBalance = useMemo(() => {
    const bal = settledBalancesAsOf(todayISO(), txns)
    return accounts.filter(isLiquidAccount).reduce((sum, a) => sum + (bal.get(a.id) ?? 0), 0)
  }, [accounts, txns])

  const range = useMemo(() => ({ fromISO, toISO }), [fromISO, toISO])

  const buckets = useMemo(() => buildLiquidityBuckets(pending, range), [pending, range])

  const cashPoints = useMemo(
    () =>
      buildCashProjection({
        startingCash: totalBalance,
        pending,
        liquidAccountIds: liquidIds,
        fromISO,
        toISO,
      }),
    [totalBalance, pending, liquidIds, fromISO, toISO],
  )

  const projectedNet = useMemo(() => buckets.reduce((sum, b) => sum + b.net, 0), [buckets])

  const endCash = cashPoints[cashPoints.length - 1]?.cash ?? totalBalance

  /** Pending items in range, chronological (date then amount). */
  const flowRows = useMemo(() => {
    return pending
      .filter((s) => {
        if (compareISO(s.dueDateISO, fromISO) < 0) return false
        if (compareISO(s.dueDateISO, toISO) > 0) return false
        return true
      })
      .slice()
      .sort((a, b) => {
        const d = a.dueDateISO.localeCompare(b.dueDateISO)
        if (d !== 0) return d
        return a.direction === b.direction ? 0 : a.direction === 'in' ? -1 : 1
      })
  }, [pending, fromISO, toISO])

  function setPreset(kind: 'this-month' | 'next-month' | 'plus-3-months' | 'year') {
    const start = todayISO()
    setFromISO(start)
    if (kind === 'year') setToISO(endOfJalaliYearISO(start))
    else if (kind === 'this-month') setToISO(endOfJalaliMonthAheadISO(start, 0))
    else if (kind === 'next-month') setToISO(endOfJalaliMonthAheadISO(start, 1))
    else setToISO(endOfJalaliMonthAheadISO(start, 3))
  }

  function typeBadge(item: ScheduledItem): { label: string; detail: string | null } {
    if (item.seriesId) {
      const ser = seriesById.get(item.seriesId)
      const name = ser?.name ?? 'سری'
      const idx =
        item.seriesIndex != null && ser
          ? `قسط ${item.seriesIndex} از ${ser.count}`
          : item.seriesIndex != null
            ? `قسط ${item.seriesIndex}`
            : null
      return {
        label: 'سری',
        detail: idx ? `«${name}» — ${idx}` : `«${name}»`,
      }
    }
    return {
      label: 'تعهد',
      detail: item.note,
    }
  }

  return (
    <section>
      <h2>نقدینگی آینده</h2>
      <div className="totals-card">
        <h3>موجودی نقدی فعلی</h3>
        <strong className="total-value">{formatMoney(totalBalance, unit)}</strong>
        <p className="muted">
          فقط نقدی/بانکی. خالص pending در بازه: {formatMoney(projectedNet, unit)} — تقریبی پایان بازه:{' '}
          {formatMoney(endCash, unit)}
        </p>
      </div>

      <div className="card-form">
        <h3>بازهٔ نمودار</h3>
        <JalaliDateField value={fromISO} onChange={setFromISO} label="از تاریخ" />
        <JalaliDateField value={toISO} onChange={setToISO} label="تا تاریخ" />
        <div className="row" style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
          <button type="button" className="ghost" onClick={() => setPreset('this-month')}>
            پایان این ماه
          </button>
          <button type="button" className="ghost" onClick={() => setPreset('next-month')}>
            پایان ماه بعد
          </button>
          <button type="button" className="ghost" onClick={() => setPreset('plus-3-months')}>
            پایان ۳ ماه بعد
          </button>
          <button type="button" className="ghost" onClick={() => setPreset('year')}>
            تا پایان سال شمسی
          </button>
        </div>
      </div>

      <h3>موجودی نقدی با pending</h3>
      <p className="muted">فقط اثر pending روی حساب‌های نقد/بانک در بازهٔ انتخابی.</p>
      {cashPoints.length === 0 ? (
        <p className="muted">بازه نامعتبر است.</p>
      ) : (
        <CashProjectionChart points={cashPoints} unit={unit} />
      )}

      <h3>ورودی / خروجی pending</h3>
      <p className="muted">واحد: {unit === 'toman' ? 'تومان' : 'ریال'}</p>
      {buckets.length === 0 ? (
        <p>قلم pending در این بازه نیست.</p>
      ) : (
        <LiquidityChart buckets={buckets} unit={unit} />
      )}

      <h3>لیست ورودی و خروجی ({flowRows.length})</h3>
      <p className="muted">مرتب‌شده بر اساس تاریخ سررسید در بازهٔ انتخابی.</p>
      {flowRows.length === 0 ? (
        <p className="muted">موردی در این بازه نیست.</p>
      ) : (
        <ul className="list">
          {flowRows.map((s) => {
            const acc = accounts.find((a) => a.id === s.accountId)
            const cat = categories.find((c) => c.id === s.categoryId)
            const { label, detail } = typeBadge(s)
            const isIn = s.direction === 'in'
            return (
              <li key={s.id} className={isIn ? 'flow-in' : 'flow-out'}>
                <div>
                  <strong>{formatMoney(s.amountRial, unit)}</strong>{' '}
                  {isIn ? 'ورودی' : 'خروجی'}
                  <span className="badge">{label}</span>
                  <span className="badge">{isIn ? 'مطالبه' : 'تعهد'}</span>
                  {!liquidIds.has(s.accountId) && <span className="badge forecast">غیرنقدی</span>}
                  <div className="muted">
                    {toJalaliDisplay(s.dueDateISO)}
                    {acc ? ` · ${acc.name}` : ''}
                    {cat ? ` · ${cat.name}` : ''}
                    {detail ? ` · ${detail}` : ''}
                    {s.note && s.note !== detail ? ` · ${s.note}` : ''}
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
