import { useEffect, useMemo, useState } from 'react'
import { listAccounts } from '../domain/accounts'
import { buildCalendarEvents, groupEventsByDate, type CalendarEvent } from '../domain/calendar-events'
import { listCategories } from '../domain/categories'
import { listInstallmentSeries } from '../domain/installments'
import { listScheduled } from '../domain/scheduled'
import { listTransactions } from '../domain/transactions'
import { getSettings } from '../lib/db'
import {
  JALALI_MONTH_NAMES,
  buildJalaliMonthGrid,
  toJalaliDisplay,
  toJalaliParts,
  todayISO,
} from '../lib/dates'
import { formatMoney } from '../lib/money'
import type { DisplayUnit } from '../lib/types'

export function CalendarPage() {
  const today = todayISO()
  const todayParts = toJalaliParts(today)
  const [viewYear, setViewYear] = useState(todayParts.year)
  const [viewMonth, setViewMonth] = useState(todayParts.month)
  const [selectedISO, setSelectedISO] = useState(today)
  const [unit, setUnit] = useState<DisplayUnit>('toman')
  const [events, setEvents] = useState<CalendarEvent[]>([])

  useEffect(() => {
    void (async () => {
      const [txns, scheduled, accounts, categories, series, s] = await Promise.all([
        listTransactions(),
        listScheduled(),
        listAccounts(),
        listCategories(),
        listInstallmentSeries(),
        getSettings(),
      ])
      setUnit(s.displayUnit)
      setEvents(
        buildCalendarEvents({
          transactions: txns,
          scheduled,
          accounts,
          categories,
          series,
        }),
      )
    })()
  }, [])

  const byDate = useMemo(() => groupEventsByDate(events), [events])
  const cells = useMemo(() => buildJalaliMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])

  const selectedEvents = useMemo(
    () => byDate.get(selectedISO) ?? [],
    [byDate, selectedISO],
  )

  const monthInflow = useMemo(() => {
    let sum = 0
    for (const c of cells) {
      if (!c.inMonth) continue
      for (const e of byDate.get(c.dateISO) ?? []) {
        if (e.direction === 'in') sum += e.amountRial
      }
    }
    return sum
  }, [cells, byDate])

  const monthOutflow = useMemo(() => {
    let sum = 0
    for (const c of cells) {
      if (!c.inMonth) continue
      for (const e of byDate.get(c.dateISO) ?? []) {
        if (e.direction === 'out') sum += e.amountRial
      }
    }
    return sum
  }, [cells, byDate])

  function shiftMonth(delta: number) {
    let m = viewMonth + delta
    let y = viewYear
    while (m > 12) {
      m -= 12
      y += 1
    }
    while (m < 1) {
      m += 12
      y -= 1
    }
    setViewYear(y)
    setViewMonth(m)
  }

  function goToday() {
    const p = toJalaliParts(todayISO())
    setViewYear(p.year)
    setViewMonth(p.month)
    setSelectedISO(todayISO())
  }

  return (
    <section>
      <h2>تقویم</h2>
      <p className="muted">تراکنش‌های ثبت‌شده و اقلام در انتظار / ردشده روی روز سررسید.</p>

      <div className="cal-nav">
        <button type="button" className="ghost" onClick={() => shiftMonth(-1)} aria-label="ماه قبل">
          › ماه قبل
        </button>
        <strong>
          {JALALI_MONTH_NAMES[viewMonth - 1]} {viewYear}
        </strong>
        <button type="button" className="ghost" onClick={() => shiftMonth(1)} aria-label="ماه بعد">
          ماه بعد ‹
        </button>
        <button type="button" className="ghost" onClick={goToday}>
          امروز
        </button>
      </div>

      <div className="totals-grid" style={{ marginBottom: '0.75rem' }}>
        <div>
          <span className="muted">ورودی ماه</span>
          <strong className="flow-in-text">{formatMoney(monthInflow, unit)}</strong>
        </div>
        <div>
          <span className="muted">خروجی ماه</span>
          <strong className="flow-out-text">{formatMoney(monthOutflow, unit)}</strong>
        </div>
      </div>

      <div className="cal-weekdays">
        {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="cal-grid">
        {cells.map((c, i) => {
          const dayEvents = byDate.get(c.dateISO) ?? []
          const hasIn = dayEvents.some((e) => e.direction === 'in')
          const hasOut = dayEvents.some((e) => e.direction === 'out')
          const hasPending = dayEvents.some((e) => e.statusLabel === 'در انتظار')
          const selected = c.dateISO === selectedISO
          const isToday = c.dateISO === today
          return (
            <button
              key={`${c.dateISO}-${i}`}
              type="button"
              className={[
                'cal-cell',
                c.inMonth ? '' : 'cal-outside',
                selected ? 'cal-selected' : '',
                isToday ? 'cal-today' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setSelectedISO(c.dateISO)}
            >
              <span className="cal-daynum">{c.day}</span>
              <span className="cal-dots" aria-hidden>
                {hasIn && <i className="dot-in" />}
                {hasOut && <i className="dot-out" />}
                {hasPending && <i className="dot-pending" />}
              </span>
              {dayEvents.length > 0 && (
                <span className="cal-count">{dayEvents.length}</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="cal-legend muted">
        <span>
          <i className="dot-in" /> ورودی
        </span>
        <span>
          <i className="dot-out" /> خروجی
        </span>
        <span>
          <i className="dot-pending" /> در انتظار
        </span>
      </div>

      <h3>رویدادهای {toJalaliDisplay(selectedISO)}</h3>
      {selectedEvents.length === 0 ? (
        <p className="muted">رویدادی در این روز نیست.</p>
      ) : (
        <ul className="list">
          {selectedEvents.map((e) => {
            const isIn = e.direction === 'in'
            return (
              <li key={e.id} className={isIn ? 'flow-in' : 'flow-out'}>
                <div>
                  <strong>{formatMoney(e.amountRial, unit)}</strong> {isIn ? 'ورودی' : 'خروجی'}
                  <span className="badge">{e.typeLabel}</span>
                  <span className="badge">{e.statusLabel}</span>
                  <div className="muted">
                    {e.accountName}
                    {e.detail ? ` · ${e.detail}` : ''}
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
