import { useEffect, useMemo, useState } from 'react'
import { listAccounts } from '../domain/accounts'
import { listCategories } from '../domain/categories'
import { listInstallmentSeries } from '../domain/installments'
import { listScheduled } from '../domain/scheduled'
import {
  createTransaction,
  createTransfer,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from '../domain/transactions'
import { resolveTxnOrigin } from '../domain/txn-origin'
import { JalaliDateField } from '../components/forms/JalaliDateField'
import { MoneyField } from '../components/forms/MoneyField'
import {
  CategoryMultiFilter,
  CATEGORY_NONE,
  matchesCategoryMultiFilter,
  type CategoryFilterOption,
  type CategoryMultiFilterState,
} from '../components/filters/CategoryMultiFilter'
import { getSettings } from '../lib/db'
import {
  compareISO,
  endOfJalaliMonthISO,
  endOfJalaliMonthAheadISO,
  endOfJalaliYearISO,
  todayISO,
  toJalaliDisplay,
  toJalaliParts,
  fromJalaliInput,
} from '../lib/dates'
import { formatMoney } from '../lib/money'
import { formatTransferPath } from '../lib/transfer-label'
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
type FlowFilter = 'all' | 'in' | 'out'
type PageTab = 'browse' | 'register'

const filterLabel: Record<OriginFilter, string> = {
  all: 'همه',
  opening: 'افتتاحیه',
  manual: 'دستی',
  commitment: 'از تعهد',
  series: 'از سری / قسط',
}

const flowLabel: Record<FlowFilter, string> = {
  all: 'همه جریان‌ها',
  in: 'درآمدها',
  out: 'هزینه‌ها',
}

function inDateRange(dateISO: string, fromISO: string, toISO: string): boolean {
  return compareISO(dateISO, fromISO) >= 0 && compareISO(dateISO, toISO) <= 0
}

function startOfJalaliMonthISO(dateISO: string): string {
  const p = toJalaliParts(dateISO)
  return fromJalaliInput(p.year, p.month, 1)
}

type TxnRow = {
  t: Transaction
  origin: ReturnType<typeof resolveTxnOrigin>
  acc: Account | undefined
  cat: Category | undefined
  mate: Transaction | undefined
}

export function TransactionsPage() {
  const today = todayISO()
  const [pageTab, setPageTab] = useState<PageTab>('browse')
  const [txns, setTxns] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([])
  const [series, setSeries] = useState<InstallmentSeries[]>([])
  const [unit, setUnit] = useState<DisplayUnit>('toman')
  const [accountId, setAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState(0)
  const [direction, setDirection] = useState<Direction>('out')
  const [dateISO, setDateISO] = useState(today)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [originFilter, setOriginFilter] = useState<OriginFilter>('all')
  const [flowFilter, setFlowFilter] = useState<FlowFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryMultiFilterState>(() => new Set())
  const [formMode, setFormMode] = useState<'normal' | 'transfer'>('normal')
  const [fromISO, setFromISO] = useState(() => startOfJalaliMonthISO(today))
  const [toISO, setToISO] = useState(() => endOfJalaliMonthISO(today))

  async function reload() {
    const [t, a, c, s, sch, ser] = await Promise.all([
      listTransactions(),
      listAccounts(),
      listCategories(false, { includeOpening: true }),
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
    if (!toAccountId && a[1]) setToAccountId(a[1].id)
    else if (!toAccountId && a[0]) setToAccountId(a[0].id)
    const formCats = c.filter((x) => x.systemKey !== 'opening')
    if (!categoryId && formCats[0]) setCategoryId(formCats[0].id)
  }

  useEffect(() => {
    void reload()
  }, [])

  const scheduledById = useMemo(() => new Map(scheduled.map((s) => [s.id, s])), [scheduled])
  const seriesById = useMemo(() => new Map(series.map((s) => [s.id, s])), [series])
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

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

  function matchesFlow(direction: Direction, kind?: Transaction['kind']): boolean {
    if (flowFilter === 'all') return true
    if (kind === 'transfer') return false
    return direction === flowFilter
  }

  const rows = useMemo(() => {
    return txns
      .map((t) => {
        const origin = resolveTxnOrigin(t, scheduledById, seriesById)
        const acc = accounts.find((a) => a.id === t.accountId)
        const cat = categories.find((c) => c.id === t.categoryId)
        const mate = transferMateById.get(t.id)
        return { t, origin, acc, cat, mate }
      })
      .filter((r) => inDateRange(r.t.dateISO, fromISO, toISO))
      .filter((r) => originFilter === 'all' || r.origin.kind === originFilter)
      .filter((r) => matchesFlow(r.t.direction, r.t.kind))
      .filter((r) => matchesCategoryMultiFilter(r.t.categoryId, categoryFilter))
  }, [
    txns,
    scheduledById,
    seriesById,
    accounts,
    categories,
    originFilter,
    categoryFilter,
    transferMateById,
    fromISO,
    toISO,
    flowFilter,
  ])

  const formCategories = useMemo(
    () => categories.filter((c) => c.systemKey !== 'opening'),
    [categories],
  )

  const pendingAhead = useMemo(
    () =>
      scheduled
        .filter((s) => s.status === 'pending')
        .filter((s) => inDateRange(s.dueDateISO, fromISO, toISO))
        .filter((s) => {
          if (flowFilter === 'all') return true
          if (s.counterAccountId) return false
          return s.direction === flowFilter
        })
        .filter((s) => matchesCategoryMultiFilter(s.categoryId, categoryFilter))
        .sort((a, b) => a.dueDateISO.localeCompare(b.dueDateISO)),
    [scheduled, categoryFilter, fromISO, toISO, flowFilter],
  )

  const totals = useMemo(() => {
    let settledIn = 0
    let settledOut = 0
    let pendingIn = 0
    let pendingOut = 0
    for (const { t } of rows) {
      if (t.kind === 'transfer') continue
      if (t.direction === 'in') settledIn += t.amountRial
      else settledOut += t.amountRial
    }
    for (const s of pendingAhead) {
      if (s.counterAccountId) continue
      if (s.direction === 'in') pendingIn += s.amountRial
      else pendingOut += s.amountRial
    }
    return { settledIn, settledOut, pendingIn, pendingOut }
  }, [rows, pendingAhead])

  const categoryTotals = useMemo(() => {
    const map = new Map<string, { settled: number; pending: number }>()
    const bump = (key: string, field: 'settled' | 'pending', amount: number) => {
      const cur = map.get(key) ?? { settled: 0, pending: 0 }
      cur[field] += amount
      map.set(key, cur)
    }
    const baseTxns = txns.filter(
      (t) =>
        inDateRange(t.dateISO, fromISO, toISO) &&
        (originFilter === 'all' ||
          resolveTxnOrigin(t, scheduledById, seriesById).kind === originFilter) &&
        matchesFlow(t.direction, t.kind),
    )
    const basePending = scheduled.filter((s) => {
      if (s.status !== 'pending') return false
      if (!inDateRange(s.dueDateISO, fromISO, toISO)) return false
      if (flowFilter === 'all') return true
      if (s.counterAccountId) return false
      return s.direction === flowFilter
    })

    for (const t of baseTxns) {
      if (t.kind === 'transfer') {
        bump(CATEGORY_NONE, 'settled', t.amountRial)
        continue
      }
      bump(t.categoryId ?? CATEGORY_NONE, 'settled', t.amountRial)
    }
    for (const s of basePending) {
      if (s.counterAccountId) bump(CATEGORY_NONE, 'pending', s.amountRial)
      else bump(s.categoryId ?? CATEGORY_NONE, 'pending', s.amountRial)
    }
    return map
  }, [
    txns,
    scheduled,
    fromISO,
    toISO,
    originFilter,
    flowFilter,
    scheduledById,
    seriesById,
  ])

  const incomeCategoryOptions = useMemo((): CategoryFilterOption[] => {
    const opts: CategoryFilterOption[] = []
    for (const [key, tot] of categoryTotals) {
      if (key === CATEGORY_NONE) continue
      const c = categoryById.get(key)
      if (!c || c.kind !== 'income') continue
      if (flowFilter === 'out') continue
      opts.push({
        key,
        label: c.name || 'دسته',
        settledRial: tot.settled,
        pendingRial: tot.pending,
      })
    }
    opts.sort((a, b) => a.label.localeCompare(b.label, 'fa'))
    return opts
  }, [categoryTotals, categoryById, flowFilter])

  const expenseCategoryOptions = useMemo((): CategoryFilterOption[] => {
    const opts: CategoryFilterOption[] = []
    for (const [key, tot] of categoryTotals) {
      if (key === CATEGORY_NONE) continue
      const c = categoryById.get(key)
      if (!c || c.kind !== 'expense') continue
      if (flowFilter === 'in') continue
      opts.push({
        key,
        label: c.name || 'دسته',
        settledRial: tot.settled,
        pendingRial: tot.pending,
      })
    }
    opts.sort((a, b) => a.label.localeCompare(b.label, 'fa'))
    return opts
  }, [categoryTotals, categoryById, flowFilter])

  const noneOption = useMemo((): CategoryFilterOption[] => {
    const tot = categoryTotals.get(CATEGORY_NONE)
    if (!tot) return []
    if (tot.settled === 0 && tot.pending === 0) return []
    return [
      {
        key: CATEGORY_NONE,
        label: 'بدون دسته / انتقال',
        settledRial: tot.settled,
        pendingRial: tot.pending,
      },
    ]
  }, [categoryTotals])

  const incomeRows = useMemo(
    () => rows.filter((r) => r.t.kind !== 'transfer' && r.t.direction === 'in'),
    [rows],
  )
  const expenseRows = useMemo(
    () => rows.filter((r) => r.t.kind !== 'transfer' && r.t.direction === 'out'),
    [rows],
  )
  const transferRows = useMemo(() => rows.filter((r) => r.t.kind === 'transfer'), [rows])

  const pendingInRows = useMemo(
    () => pendingAhead.filter((s) => !s.counterAccountId && s.direction === 'in'),
    [pendingAhead],
  )
  const pendingOutRows = useMemo(
    () => pendingAhead.filter((s) => !s.counterAccountId && s.direction === 'out'),
    [pendingAhead],
  )
  const pendingTransferRows = useMemo(
    () => pendingAhead.filter((s) => Boolean(s.counterAccountId)),
    [pendingAhead],
  )

  function setPreset(kind: 'this-month' | 'next-month' | 'year') {
    const start = todayISO()
    if (kind === 'this-month') {
      setFromISO(startOfJalaliMonthISO(start))
      setToISO(endOfJalaliMonthISO(start))
    } else if (kind === 'next-month') {
      setFromISO(start)
      setToISO(endOfJalaliMonthAheadISO(start, 1))
    } else {
      setFromISO(startOfJalaliMonthISO(start))
      setToISO(endOfJalaliYearISO(start))
    }
  }

  function transferPathFor(r: TxnRow): string | null {
    const { t, acc, mate } = r
    if (t.kind !== 'transfer' || !mate) return null
    return t.direction === 'out'
      ? formatTransferPath(acc?.name ?? '؟', accountById.get(mate.accountId)?.name ?? '؟')
      : formatTransferPath(accountById.get(mate.accountId)?.name ?? '؟', acc?.name ?? '؟')
  }

  function renderTxnTable(list: TxnRow[], emptyText: string, title: string) {
    return (
      <div className="card">
        <div className="card-head">
          <h3>
            {title} ({list.length})
          </h3>
        </div>
        <div className="card-body" style={{ padding: list.length === 0 ? 16 : 0 }}>
          {list.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              {emptyText}
            </p>
          ) : (
            <div className="table-scroll" style={{ margin: 0, border: 0, borderRadius: 0, boxShadow: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>تاریخ</th>
                    <th>مبلغ</th>
                    <th>حساب / مسیر</th>
                    <th>دسته</th>
                    <th>منبع</th>
                    <th>توضیح</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => {
                    const { t, origin, acc, cat } = r
                    const path = transferPathFor(r)
                    const noteText =
                      t.note && t.note !== origin.detail
                        ? t.note
                        : origin.detail
                          ? origin.detail
                          : '—'
                    return (
                      <tr key={t.id} className={t.direction === 'in' ? 'row-in' : 'row-out'}>
                        <td data-label="تاریخ">{toJalaliDisplay(t.dateISO)}</td>
                        <td data-label="مبلغ" className="num">
                          {formatMoney(t.amountRial, unit)}
                        </td>
                        <td data-label="حساب / مسیر">{path ?? acc?.name ?? '—'}</td>
                        <td data-label="دسته">{t.kind === 'transfer' ? '—' : cat?.name || '—'}</td>
                        <td data-label="منبع">
                          <span className="badge">{origin.badge}</span>
                        </td>
                        <td data-label="توضیح" className="cell-note">
                          {noteText}
                        </td>
                        <td data-label="عملیات" className="cell-actions">
                          {t.kind === 'opening' ? (
                            <button
                              type="button"
                              className="ghost sm"
                              onClick={() => {
                                const next = prompt('مبلغ ریال جدید', String(t.amountRial))
                                if (next == null) return
                                void updateTransaction(t.id, { amountRial: Number(next) })
                                  .then(reload)
                                  .catch((err) =>
                                    setError(err instanceof Error ? err.message : 'خطا'),
                                  )
                              }}
                            >
                              ویرایش
                            </button>
                          ) : (
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
    )
  }

  function renderPendingTable(list: ScheduledItem[], emptyText: string, title: string) {
    return (
      <div className="card">
        <div className="card-head">
          <h3>
            {title} ({list.length})
          </h3>
        </div>
        <div className="card-body" style={{ padding: list.length === 0 ? 16 : 0 }}>
          {list.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              {emptyText}
            </p>
          ) : (
            <div className="table-scroll" style={{ margin: 0, border: 0, borderRadius: 0, boxShadow: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>سررسید</th>
                    <th>مبلغ</th>
                    <th>حساب / مسیر</th>
                    <th>دسته</th>
                    <th>نوع</th>
                    <th>توضیح</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((s) => {
                    const acc = accounts.find((a) => a.id === s.accountId)
                    const cat = categories.find((c) => c.id === s.categoryId)
                    const ser = s.seriesId ? seriesById.get(s.seriesId) : undefined
                    const badge = s.counterAccountId ? 'انتقال' : ser ? 'سری' : 'تعهد'
                    const detail = ser
                      ? `«${ser.name}»${s.seriesIndex != null ? ` — قسط ${s.seriesIndex} از ${ser.count}` : ''}`
                      : s.note || '—'
                    const path = s.counterAccountId
                      ? formatTransferPath(
                          acc?.name ?? '؟',
                          accountById.get(s.counterAccountId)?.name ?? '؟',
                        )
                      : null
                    return (
                      <tr key={s.id} className={s.direction === 'in' ? 'row-in' : 'row-out'}>
                        <td data-label="سررسید">{toJalaliDisplay(s.dueDateISO)}</td>
                        <td data-label="مبلغ" className="num">
                          {formatMoney(s.amountRial, unit)}
                        </td>
                        <td data-label="حساب / مسیر">{path ?? acc?.name ?? '—'}</td>
                        <td data-label="دسته">
                          {s.counterAccountId ? '—' : cat?.name || '—'}
                        </td>
                        <td data-label="نوع">
                          <span className="badge forecast">{badge}</span>
                        </td>
                        <td data-label="توضیح" className="cell-note">
                          {detail}
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
    )
  }

  return (
    <section>
      <div className="page-head">
        <h2>تراکنش‌ها</h2>
        <p className="sub">مشاهده، فیلتر و ثبت درآمد / هزینه / انتقال</p>
      </div>

      <div className="page-tabs" role="tablist" aria-label="بخش تراکنش‌ها">
        <button
          type="button"
          role="tab"
          aria-selected={pageTab === 'browse'}
          className={pageTab === 'browse' ? 'page-tab active' : 'page-tab'}
          onClick={() => setPageTab('browse')}
        >
          مشاهده
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pageTab === 'register'}
          className={pageTab === 'register' ? 'page-tab active' : 'page-tab'}
          onClick={() => setPageTab('register')}
        >
          ثبت تراکنش
        </button>
      </div>

      {pageTab === 'register' && (
        <form
          className="card-form"
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            if (formMode === 'transfer') {
              void createTransfer({
                fromAccountId: accountId,
                toAccountId,
                amountRial: amount,
                dateISO,
                note: note || null,
              })
                .then(() => {
                  setAmount(0)
                  setNote('')
                  return reload()
                })
                .then(() => setPageTab('browse'))
                .catch((err) => setError(err instanceof Error ? err.message : 'خطا'))
              return
            }
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
              .then(() => setPageTab('browse'))
              .catch((err) => setError(err instanceof Error ? err.message : 'خطا'))
          }}
        >
          <label className="field">
            <span>نوع ثبت</span>
            <select
              value={formMode}
              onChange={(e) => setFormMode(e.target.value as 'normal' | 'transfer')}
            >
              <option value="normal">درآمد / هزینه</option>
              <option value="transfer">انتقال بین حساب‌ها</option>
            </select>
          </label>
          {formMode === 'transfer' ? (
            <>
              <label className="field">
                <span>از حساب</span>
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>به حساب</span>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  required
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
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
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
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
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as Direction)}
                >
                  <option value="out">خروجی</option>
                  <option value="in">ورودی</option>
                </select>
              </label>
            </>
          )}
          <MoneyField amountRial={amount} unit={unit} onChangeRial={setAmount} />
          <JalaliDateField value={dateISO} onChange={setDateISO} />
          <label className="field">
            <span>توضیحات (اختیاری)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={formMode === 'transfer' ? 'مثلاً واریز به صندوق' : 'مثلاً خرید هفتگی'}
            />
          </label>
          <button type="submit">{formMode === 'transfer' ? 'ثبت انتقال' : 'ثبت تراکنش'}</button>
          {error && <p className="error">{error}</p>}
        </form>
      )}

      {pageTab === 'browse' && (
        <>
          <div className="card-form">
            <h3>فیلترها</h3>
            <JalaliDateField value={fromISO} onChange={setFromISO} label="از تاریخ" />
            <JalaliDateField value={toISO} onChange={setToISO} label="تا تاریخ" />
            <div className="row" style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
              <button type="button" className="ghost" onClick={() => setPreset('this-month')}>
                این ماه
              </button>
              <button type="button" className="ghost" onClick={() => setPreset('next-month')}>
                تا پایان ماه بعد
              </button>
              <button type="button" className="ghost" onClick={() => setPreset('year')}>
                تا پایان سال
              </button>
            </div>
            <div className="row" style={{ flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
              {(Object.keys(flowLabel) as FlowFilter[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={flowFilter === key ? undefined : 'ghost'}
                  onClick={() => setFlowFilter(key)}
                >
                  {flowLabel[key]}
                </button>
              ))}
            </div>
            <div className="row" style={{ flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
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
          </div>

          <div className="totals-card" style={{ marginTop: '0.75rem' }}>
            <h3>جمع در بازهٔ فیلتر</h3>
            <div className="totals-grid">
              <div>
                <span className="muted">درآمد ثبت‌شده</span>
                <strong className="flow-in-text">{formatMoney(totals.settledIn, unit)}</strong>
              </div>
              <div>
                <span className="muted">هزینه ثبت‌شده</span>
                <strong className="flow-out-text">{formatMoney(totals.settledOut, unit)}</strong>
              </div>
              <div>
                <span className="muted">درآمد pending</span>
                <strong className="flow-in-text">{formatMoney(totals.pendingIn, unit)}</strong>
              </div>
              <div>
                <span className="muted">هزینه pending</span>
                <strong className="flow-out-text">{formatMoney(totals.pendingOut, unit)}</strong>
              </div>
              <div className="totals-grand">
                <span className="muted">خالص ثبت‌شده (درآمد − هزینه)</span>
                <strong>{formatMoney(totals.settledIn - totals.settledOut, unit)}</strong>
              </div>
            </div>
          </div>

          {flowFilter !== 'out' && incomeCategoryOptions.length > 0 && (
            <CategoryMultiFilter
              label="دسته‌های درآمد"
              options={incomeCategoryOptions}
              selected={categoryFilter}
              onChange={setCategoryFilter}
              unitLabel={(rial) => formatMoney(rial, unit)}
            />
          )}
          {flowFilter !== 'in' && expenseCategoryOptions.length > 0 && (
            <CategoryMultiFilter
              label="دسته‌های هزینه"
              options={expenseCategoryOptions}
              selected={categoryFilter}
              onChange={setCategoryFilter}
              unitLabel={(rial) => formatMoney(rial, unit)}
            />
          )}
          {noneOption.length > 0 && flowFilter === 'all' && (
            <CategoryMultiFilter
              label="بدون دسته / انتقال"
              options={noneOption}
              selected={categoryFilter}
              onChange={setCategoryFilter}
              unitLabel={(rial) => formatMoney(rial, unit)}
            />
          )}

          {error && <p className="error">{error}</p>}

          {flowFilter !== 'out' && (
            <>
              {renderTxnTable(incomeRows, 'درآمد ثبت‌شده‌ای در این فیلتر نیست.', 'درآمدهای ثبت‌شده')}
              {renderPendingTable(pendingInRows, 'درآمد pending در این فیلتر نیست.', 'درآمدهای در انتظار')}
            </>
          )}

          {flowFilter !== 'in' && (
            <>
              {renderTxnTable(expenseRows, 'هزینه ثبت‌شده‌ای در این فیلتر نیست.', 'هزینه‌های ثبت‌شده')}
              {renderPendingTable(pendingOutRows, 'هزینه pending در این فیلتر نیست.', 'هزینه‌های در انتظار')}
            </>
          )}

          {flowFilter === 'all' && (
            <>
              {renderTxnTable(transferRows, 'انتقال ثبت‌شده‌ای در این فیلتر نیست.', 'انتقال‌های ثبت‌شده')}
              {renderPendingTable(
                pendingTransferRows,
                'انتقال pending در این فیلتر نیست.',
                'انتقال‌های در انتظار',
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}
