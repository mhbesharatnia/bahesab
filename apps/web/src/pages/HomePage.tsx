import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAccounts } from '../domain/accounts'
import { settledBalancesAsOf } from '../domain/balances'
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
import { endOfJalaliYearISO, todayISO } from '../lib/dates'
import { formatMoney } from '../lib/money'
import type { Account, DisplayUnit, ScheduledItem } from '../lib/types'

const typeLabel: Record<Account['type'], string> = {
  cash: 'نقدی',
  bank: 'بانکی',
  person: 'اشخاص',
  fund: 'صندوق',
}

export function HomePage() {
  const today = todayISO()
  const [rows, setRows] = useState<{ account: Account; balance: number }[]>([])
  const [unit, setUnit] = useState<DisplayUnit>('toman')
  const [pending, setPending] = useState<ScheduledItem[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [fromISO, setFromISO] = useState(today)
  const [toISO, setToISO] = useState(endOfJalaliYearISO(today))

  useEffect(() => {
    void (async () => {
      const settings = await getSettings()
      setUnit(settings.displayUnit)
      const [accs, t, p] = await Promise.all([
        listAccounts(),
        listTransactions(),
        listScheduled('pending'),
      ])
      const bal = settledBalancesAsOf(todayISO(), t)
      setAccounts(accs)
      setPending(p)
      setRows(accs.map((a) => ({ account: a, balance: bal.get(a.id) ?? 0 })))
    })()
  }, [])

  const liquidTotal = useMemo(
    () =>
      rows
        .filter((r) => isLiquidAccount(r.account))
        .reduce((sum, r) => sum + r.balance, 0),
    [rows],
  )
  const receivables = useMemo(
    () =>
      rows
        .filter((r) => (r.account.type === 'person' || r.account.type === 'fund') && r.balance > 0)
        .reduce((sum, r) => sum + r.balance, 0),
    [rows],
  )
  const payables = useMemo(
    () =>
      rows
        .filter((r) => (r.account.type === 'person' || r.account.type === 'fund') && r.balance < 0)
        .reduce((sum, r) => sum + -r.balance, 0),
    [rows],
  )

  const liquidIds = useMemo(
    () => new Set(accounts.filter(isLiquidAccount).map((a) => a.id)),
    [accounts],
  )

  const range = useMemo(() => ({ fromISO, toISO }), [fromISO, toISO])
  const buckets = useMemo(() => buildLiquidityBuckets(pending, range), [pending, range])
  const cashPoints = useMemo(
    () =>
      buildCashProjection({
        startingCash: liquidTotal,
        pending,
        liquidAccountIds: liquidIds,
        fromISO,
        toISO,
      }),
    [liquidTotal, pending, liquidIds, fromISO, toISO],
  )

  return (
    <section>
      <h2>خانه</h2>

      <div className="totals-card" aria-label="خلاصه وضعیت">
        <h3>موجودی نقدی</h3>
        <strong className="total-value">{formatMoney(liquidTotal, unit)}</strong>
        <p className="muted">فقط بانک و نقد — بدهی صندوق اینجا کم نمی‌شود</p>
        <div className="totals-grid" style={{ marginTop: '0.75rem' }}>
          <div>
            <span className="muted">مطالبات</span>
            <strong>{formatMoney(receivables, unit)}</strong>
          </div>
          <div>
            <span className="muted">بدهی‌ها (پرداخت‌نشده)</span>
            <strong className="forecast">{formatMoney(payables, unit)}</strong>
          </div>
          <div>
            <span className="muted">خالص = نقد + طلب − بدهی</span>
            <strong>{formatMoney(liquidTotal + receivables - payables, unit)}</strong>
          </div>
        </div>
      </div>

      <h3>حساب‌ها</h3>
      {rows.length === 0 ? (
        <p>هنوز حسابی ندارید. از بخش حساب‌ها شروع کنید.</p>
      ) : (
        <ul className="list">
          {rows.map(({ account, balance }) => (
            <li key={account.id}>
              <div>
                <strong>{account.name}</strong>
                <span className="badge">{typeLabel[account.type]}</span>
                {(account.type === 'person' || account.type === 'fund') && balance < 0 && (
                  <span className="badge">بدهی</span>
                )}
                {(account.type === 'person' || account.type === 'fund') && balance > 0 && (
                  <span className="badge">طلب</span>
                )}
              </div>
              <span>{formatMoney(balance, unit)}</span>
            </li>
          ))}
        </ul>
      )}

      <h3>نقدینگی در بازه</h3>
      <div className="card-form">
        <JalaliDateField value={fromISO} onChange={setFromISO} label="از تاریخ" />
        <JalaliDateField value={toISO} onChange={setToISO} label="تا تاریخ" />
        <p className="muted">
          جزئیات بیشتر در <Link to="/liquidity">نقدینگی</Link>.
        </p>
      </div>

      <h4>موجودی نقدی با pending</h4>
      {cashPoints.length === 0 ? (
        <p className="muted">بازه نامعتبر است.</p>
      ) : (
        <CashProjectionChart points={cashPoints} unit={unit} />
      )}

      <h4>ورودی / خروجی pending</h4>
      {buckets.length === 0 ? (
        <p className="muted">قلم pending در این بازه نیست.</p>
      ) : (
        <LiquidityChart buckets={buckets} unit={unit} />
      )}
    </section>
  )
}
