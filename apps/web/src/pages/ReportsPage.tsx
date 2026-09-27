import { useEffect, useMemo, useState } from 'react'
import { listAccounts } from '../domain/accounts'
import { forecastAsOf } from '../domain/balances'
import { listScheduled } from '../domain/scheduled'
import { listTransactions } from '../domain/transactions'
import { JalaliDateField } from '../components/forms/JalaliDateField'
import { getSettings } from '../lib/db'
import { todayISO, toJalaliDisplay } from '../lib/dates'
import { formatMoney } from '../lib/money'
import type { Account, DisplayUnit } from '../lib/types'

const typeLabel: Record<Account['type'], string> = {
  cash: 'نقدی',
  bank: 'بانکی',
  person: 'اشخاص',
  fund: 'صندوق',
}

function isCounterparty(a: Account) {
  return a.type === 'person' || a.type === 'fund'
}

function isLiquid(a: Account) {
  return a.type === 'cash' || a.type === 'bank'
}

export function ReportsPage() {
  const [reportDate, setReportDate] = useState(todayISO())
  const [accounts, setAccounts] = useState<Account[]>([])
  const [unit, setUnit] = useState<DisplayUnit>('toman')
  const [txns, setTxns] = useState<Awaited<ReturnType<typeof listTransactions>>>([])
  const [pending, setPending] = useState<Awaited<ReturnType<typeof listScheduled>>>([])

  useEffect(() => {
    void (async () => {
      const [a, t, p, s] = await Promise.all([
        listAccounts(),
        listTransactions(),
        listScheduled('pending'),
        getSettings(),
      ])
      setAccounts(a)
      setTxns(t)
      setPending(p)
      setUnit(s.displayUnit)
    })()
  }, [])

  const report = useMemo(
    () => forecastAsOf(reportDate, todayISO(), txns, pending),
    [reportDate, txns, pending],
  )

  const totals = useMemo(() => {
    let cash = 0
    let receivables = 0 // طلب (+)
    let payables = 0 // بدهی as positive magnitude
    let pendingCash = 0
    let pendingRecv = 0
    let pendingDebtDelta = 0 // + means debt shrinks (e.g. transfer into fund)

    for (const a of accounts) {
      const settled = report.settled.get(a.id) ?? 0
      const pend = report.pendingEffect.get(a.id) ?? 0
      if (isLiquid(a)) {
        cash += settled
        pendingCash += pend
      } else if (isCounterparty(a)) {
        if (settled >= 0) {
          receivables += settled
          pendingRecv += pend
        } else {
          payables += -settled
          pendingDebtDelta += pend // inflow pending reduces debt
        }
      }
    }

    const payablesAfterPend = Math.max(0, payables - pendingDebtDelta)

    return {
      cash,
      receivables,
      payables,
      pendingCash,
      pendingRecv,
      pendingDebtDelta,
      payablesAfterPend,
      netWorth: cash + receivables - payables,
      forecastNet:
        cash + pendingCash + receivables + pendingRecv - payablesAfterPend,
    }
  }, [accounts, report])

  const liquidAccounts = accounts.filter(isLiquid)
  const debtAccounts = accounts.filter((a) => {
    if (!isCounterparty(a)) return false
    const settled = report.settled.get(a.id) ?? 0
    const pend = report.pendingEffect.get(a.id) ?? 0
    const combined = report.mode === 'forecast' ? settled + pend : settled
    return settled < 0 || combined < 0 || (report.mode === 'forecast' && pend !== 0 && settled <= 0)
  })
  const recvAccounts = accounts.filter((a) => {
    if (!isCounterparty(a)) return false
    if (debtAccounts.some((d) => d.id === a.id)) return false
    const settled = report.settled.get(a.id) ?? 0
    const pend = report.pendingEffect.get(a.id) ?? 0
    return settled > 0 || settled === 0 || (report.mode === 'forecast' && pend !== 0)
  })

  function renderAccountList(list: Account[], showAsDebtMagnitude = false) {
    if (list.length === 0) return <p className="muted">موردی نیست.</p>
    return (
      <ul className="list">
        {list.map((a) => {
          const settled = report.settled.get(a.id) ?? 0
          const pend = report.pendingEffect.get(a.id) ?? 0
          const shown = showAsDebtMagnitude ? -settled : settled
          return (
            <li key={a.id}>
              <div>
                <strong>{a.name}</strong>
                <span className="badge">{typeLabel[a.type]}</span>
                <div>
                  {showAsDebtMagnitude ? 'بدهی قطعی: ' : 'مانده قطعی: '}
                  {formatMoney(shown, unit)}
                </div>
                {report.mode === 'forecast' && pend !== 0 && (
                  <div className="forecast">اثر pending: {formatMoney(pend, unit)}</div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <section>
      <div className="page-head">
        <h2>ترازنامه / وضعیت</h2>
        <p className="sub">وضعیت حساب‌ها در تاریخ انتخابی</p>
      </div>
      <div className="card-form">
        <JalaliDateField value={reportDate} onChange={setReportDate} label="تاریخ گزارش شمسی" />
        <p>
          حالت:{' '}
          <strong>{report.mode === 'settled' ? 'قطعی (فقط تراکنش‌های واقعی)' : 'پیش‌بینی (قطعی + pending)'}</strong>
        </p>
        <p className="muted">امروز سیستم: {toJalaliDisplay(todayISO())}</p>
        <p className="muted">
          بدهی صندوق/اشخاص جدا از نقد است. برای دیدن اثر انتقال‌های pending، تاریخ گزارش را به آینده ببر
          (حالت پیش‌بینی).
        </p>
      </div>

      <div className="totals-card">
        <h3>خلاصهٔ جدا</h3>
        <div className="totals-grid">
          <div>
            <span className="muted">۱) موجودی نقدی (بانک/نقد)</span>
            <strong className="total-value">{formatMoney(totals.cash, unit)}</strong>
            {report.mode === 'forecast' && totals.pendingCash !== 0 && (
              <div className="forecast">
                اثر pending نقد: {formatMoney(totals.pendingCash, unit)} →{' '}
                {formatMoney(totals.cash + totals.pendingCash, unit)}
              </div>
            )}
          </div>
          <div>
            <span className="muted">۲) مطالبات (طلب از دیگران)</span>
            <strong>{formatMoney(totals.receivables, unit)}</strong>
            {report.mode === 'forecast' && totals.pendingRecv !== 0 && (
              <div className="forecast">اثر pending طلب: {formatMoney(totals.pendingRecv, unit)}</div>
            )}
          </div>
          <div>
            <span className="muted">۳) بدهی‌ها (به صندوق/اشخاص)</span>
            <strong className="forecast">{formatMoney(totals.payables, unit)}</strong>
            {report.mode === 'forecast' && totals.pendingDebtDelta !== 0 && (
              <div className="forecast">
                اثر pending بدهی: {formatMoney(totals.pendingDebtDelta, unit)} → بدهی تقریبی{' '}
                {formatMoney(totals.payablesAfterPend, unit)}
              </div>
            )}
          </div>
          <div className="totals-grand">
            <span className="muted">خالص وضعیت = نقد + طلب − بدهی</span>
            <strong className="total-value">{formatMoney(totals.netWorth, unit)}</strong>
          </div>
          {report.mode === 'forecast' && (
            <div className="totals-grand">
              <span className="muted">خالص با پیش‌بینی pending</span>
              <strong className="total-value">{formatMoney(totals.forecastNet, unit)}</strong>
            </div>
          )}
        </div>
      </div>

      <h3>۱) حساب‌های نقدی / بانکی</h3>
      {renderAccountList(liquidAccounts)}

      <h3>۲) مطالبات (مانده ≥ ۰)</h3>
      {renderAccountList(recvAccounts)}

      <h3>۳) بدهی‌ها (مانده منفی — هنوز پرداخت‌نشده هم اینجا است)</h3>
      {renderAccountList(debtAccounts, true)}
    </section>
  )
}
