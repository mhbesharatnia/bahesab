import { useEffect, useMemo, useState } from 'react'
import { listAccounts } from '../domain/accounts'
import { listCategories } from '../domain/categories'
import {
  createInstallmentSeries,
  deleteInstallmentSeries,
  listInstallmentSeries,
  updateInstallmentSeries,
} from '../domain/installments'
import {
  deleteScheduled,
  listScheduled,
  restoreScheduled,
  updateScheduled,
} from '../domain/scheduled'
import { JalaliDateField } from '../components/forms/JalaliDateField'
import { MoneyField } from '../components/forms/MoneyField'
import { getSettings } from '../lib/db'
import { countMonthsThroughJalaliYearEnd, todayISO, toJalaliDisplay } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { formatTransferPath } from '../lib/transfer-label'
import {
  CategoryMultiFilter,
  categoryOptionsFromIds,
  matchesCategoryMultiFilter,
  type CategoryMultiFilterState,
} from '../components/filters/CategoryMultiFilter'
import type {
  Account,
  Category,
  Direction,
  DisplayUnit,
  InstallmentSeries,
  ScheduledItem,
  ScheduledStatus,
} from '../lib/types'

type SeriesKind = 'single' | 'transfer'
type TypeFilter = 'all' | 'in' | 'out' | 'transfer'

const statusLabel: Record<ScheduledStatus, string> = {
  pending: 'در انتظار',
  confirmed: 'تأیید شده',
  skipped: 'رد شده',
}

function seriesType(s: InstallmentSeries): TypeFilter {
  if (s.counterAccountId) return 'transfer'
  return s.direction === 'in' ? 'in' : 'out'
}

export function InstallmentsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [seriesList, setSeriesList] = useState<InstallmentSeries[]>([])
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([])
  const [unit, setUnit] = useState<DisplayUnit>('toman')
  const [editId, setEditId] = useState<string | null>(null)
  const [seriesKind, setSeriesKind] = useState<SeriesKind>('single')
  const [name, setName] = useState('')
  const [accountId, setAccountId] = useState('')
  const [counterAccountId, setCounterAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState(0)
  const [count, setCount] = useState(12)
  const [direction, setDirection] = useState<Direction>('in')
  const [startDateISO, setStartDateISO] = useState(todayISO())
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryMultiFilterState>(() => new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const [itemEditId, setItemEditId] = useState<string | null>(null)
  const [itemAmount, setItemAmount] = useState(0)
  const [itemDueISO, setItemDueISO] = useState(todayISO())
  const [itemNote, setItemNote] = useState('')
  const [itemAccountId, setItemAccountId] = useState('')
  const [itemCounterId, setItemCounterId] = useState('')
  const [itemCategoryId, setItemCategoryId] = useState('')

  const filteredCategories = useMemo(() => {
    if (direction === 'in') return categories.filter((c) => c.kind === 'income')
    return categories.filter((c) => c.kind === 'expense')
  }, [categories, direction])

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

  const itemsBySeries = useMemo(() => {
    const map = new Map<string, ScheduledItem[]>()
    for (const s of scheduled) {
      if (!s.seriesId) continue
      const list = map.get(s.seriesId) ?? []
      list.push(s)
      map.set(s.seriesId, list)
    }
    for (const [, list] of map) {
      list.sort(
        (a, b) =>
          (a.seriesIndex ?? 0) - (b.seriesIndex ?? 0) || a.dueDateISO.localeCompare(b.dueDateISO),
      )
    }
    return map
  }, [scheduled])

  const visibleSeries = useMemo(() => {
    return seriesList.filter((s) => {
      const t = seriesType(s)
      if (typeFilter !== 'all' && t !== typeFilter) return false
      return matchesCategoryMultiFilter(s.categoryId, categoryFilter)
    })
  }, [seriesList, typeFilter, categoryFilter])

  const filterCategoryOptions = useMemo(() => {
    const ids = new Set<string>()
    let hasNone = false
    for (const s of seriesList) {
      if (!s.categoryId) hasNone = true
      else ids.add(s.categoryId)
    }
    return {
      ids: [...ids].sort((a, b) =>
        (categoryById.get(a)?.name ?? a).localeCompare(categoryById.get(b)?.name ?? b, 'fa'),
      ),
      hasNone,
    }
  }, [seriesList, categoryById])

  const categoryMultiOptions = useMemo(
    () =>
      categoryOptionsFromIds(
        filterCategoryOptions.ids,
        categoryById,
        filterCategoryOptions.hasNone,
      ),
    [filterCategoryOptions, categoryById],
  )

  async function reload() {
    const [a, c, s, series, sch] = await Promise.all([
      listAccounts(),
      listCategories(),
      getSettings(),
      listInstallmentSeries(),
      listScheduled(),
    ])
    setAccounts(a)
    setCategories(c)
    setUnit(s.displayUnit)
    setSeriesList(series)
    setScheduled(sch)
    if (!accountId && a[0]) setAccountId(a[0].id)
    if (!counterAccountId && a[1]) setCounterAccountId(a[1].id)
    else if (!counterAccountId && a[0]) setCounterAccountId(a[0].id)
  }

  useEffect(() => {
    void reload()
  }, [])

  useEffect(() => {
    if (editId || seriesKind === 'transfer') return
    const preferred = filteredCategories[0]
    if (preferred) setCategoryId(preferred.id)
    else setCategoryId('')
  }, [direction, filteredCategories, editId, seriesKind])

  function resetCreateForm() {
    setEditId(null)
    setSeriesKind('single')
    setName('')
    setAmount(0)
    setCount(12)
    setDirection('in')
    setStartDateISO(todayISO())
  }

  function startEdit(s: InstallmentSeries) {
    setEditId(s.id)
    setName(s.name || '')
    setAmount(s.amountRial)
    setCount(s.count)
    setDirection(s.direction)
    setStartDateISO(s.startDateISO)
    setAccountId(s.accountId)
    setCategoryId(s.categoryId ?? '')
    setSeriesKind(s.counterAccountId ? 'transfer' : 'single')
    setCounterAccountId(s.counterAccountId ?? accounts.find((a) => a.id !== s.accountId)?.id ?? '')
    setItemEditId(null)
    setError(null)
    setMessage(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function beginItemEdit(item: ScheduledItem) {
    if (item.status === 'confirmed') {
      setError('قلم تأییدشده قابل ویرایش نیست')
      return
    }
    setItemEditId(item.id)
    setItemAmount(item.amountRial)
    setItemDueISO(item.dueDateISO)
    setItemNote(item.note ?? '')
    setItemAccountId(item.accountId)
    setItemCounterId(item.counterAccountId ?? '')
    setItemCategoryId(item.categoryId ?? '')
    setError(null)
    setMessage(null)
  }

  function cancelItemEdit() {
    setItemEditId(null)
  }

  async function saveItemEdit() {
    if (!itemEditId) return
    setError(null)
    const item = scheduled.find((s) => s.id === itemEditId)
    if (!item) return
    try {
      const isTransfer = Boolean(item.counterAccountId ?? itemCounterId)
      await updateScheduled(itemEditId, {
        amountRial: itemAmount,
        dueDateISO: itemDueISO,
        note: itemNote.trim() || null,
        accountId: itemAccountId,
        categoryId: isTransfer ? null : itemCategoryId || null,
        counterAccountId: isTransfer ? itemCounterId || null : null,
        direction: isTransfer ? 'out' : item.direction,
      })
      setMessage('قسط به‌روز شد')
      setItemEditId(null)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا')
    }
  }

  return (
    <section>
      <div className="page-head">
        <h2>سری اقساط و مطالبات</h2>
        <p className="sub">مدیریت سری‌ها و اقساط</p>
      </div>
      <p className="muted">
        بازپرداخت صندوق: نوع «انتقال بین حساب‌ها». روی هر سری بزن تا اقساطش باز شود و بتوانی یکی را تکی
        ویرایش کنی.
      </p>
      <form
        className="card-form"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          setMessage(null)
          const isTransfer = seriesKind === 'transfer'
          if (!isTransfer && !categoryId) {
            setError(
              direction === 'in'
                ? 'ابتدا یک دسته درآمد بسازید'
                : 'ابتدا یک دسته هزینه بسازید',
            )
            return
          }
          if (isTransfer && (!counterAccountId || counterAccountId === accountId)) {
            setError('مبدأ و مقصد انتقال باید دو حساب متفاوت باشند')
            return
          }
          const counter = isTransfer ? counterAccountId : null
          if (editId) {
            void updateInstallmentSeries(editId, {
              name,
              amountRial: amount,
              accountId,
              categoryId: isTransfer ? null : categoryId,
              direction: isTransfer ? 'out' : direction,
              startDateISO,
              count,
              counterAccountId: counter,
            })
              .then(() => {
                setMessage('سری به‌روز شد (اقلام باز اعمال شد؛ تأییدشده‌ها دست‌نخورده ماندند)')
                resetCreateForm()
                return reload()
              })
              .catch((err) => setError(err instanceof Error ? err.message : 'خطا'))
            return
          }
          void createInstallmentSeries({
            name,
            accountId,
            categoryId: isTransfer ? null : categoryId,
            amountRial: amount,
            direction: isTransfer ? 'out' : direction,
            startDateISO,
            count,
            counterAccountId: counter,
          })
            .then((r) => {
              setMessage(
                `${r.items.length} مورد برای «${r.series.name}» (${
                  isTransfer ? 'انتقال' : direction === 'in' ? 'مطالبه' : 'تعهد'
                }) ساخته شد`,
              )
              setExpanded((prev) => new Set(prev).add(r.series.id))
              resetCreateForm()
              return reload()
            })
            .catch((err) => setError(err instanceof Error ? err.message : 'خطا'))
        }}
      >
        <h3>{editId ? 'ویرایش کامل سری' : 'ثبت سری جدید'}</h3>
        <label className="field">
          <span>نام سری</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              seriesKind === 'transfer'
                ? 'مثلاً تسویه بدهی مفید'
                : direction === 'in'
                  ? 'مثلاً حقوق ۱۴۰۵'
                  : 'مثلاً قسط صندوق'
            }
            required
          />
        </label>
        <label className="field">
          <span>نوع سری</span>
          <select
            value={seriesKind}
            onChange={(e) => setSeriesKind(e.target.value as SeriesKind)}
          >
            <option value="single">مطالبه یا تعهد روی یک حساب</option>
            <option value="transfer">انتقال بین حساب‌ها (از بانک به صندوق، …)</option>
          </select>
        </label>
        {seriesKind === 'single' ? (
          <>
            <label className="field">
              <span>جهت</span>
              <select value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
                <option value="in">مطالبه / دریافت</option>
                <option value="out">تعهد / پرداخت</option>
              </select>
            </label>
            <label className="field">
              <span>حساب</span>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
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
                {filteredCategories.length === 0 ? (
                  <option value="">دسته مناسب ندارید</option>
                ) : (
                  filteredCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))
                )}
              </select>
            </label>
          </>
        ) : (
          <>
            <label className="field">
              <span>از حساب</span>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>به حساب</span>
              <select value={counterAccountId} onChange={(e) => setCounterAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <JalaliDateField value={startDateISO} onChange={setStartDateISO} label="شروع شمسی" />
        <label className="field">
          <span>تعداد ماه (۱ تا ۱۲۰)</span>
          <input
            type="number"
            min={1}
            max={120}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </label>
        <div className="row">
          <button
            type="button"
            className="ghost"
            onClick={() => setCount(countMonthsThroughJalaliYearEnd(startDateISO))}
          >
            تا پایان سال شمسی ({countMonthsThroughJalaliYearEnd(startDateISO)} ماه)
          </button>
        </div>
        <MoneyField amountRial={amount} unit={unit} onChangeRial={setAmount} />
        {editId && (
          <p className="muted">
            ذخیره روی اقلام pending و skipped اعمال می‌شود. تأییدشده‌ها دست‌نخورده می‌مانند.
          </p>
        )}
        <div className="row">
          <button type="submit">{editId ? 'ذخیره تغییرات سری' : 'ساخت سری'}</button>
          {editId && (
            <button type="button" className="ghost" onClick={resetCreateForm}>
              انصراف
            </button>
          )}
        </div>
        {message && <p className="ok">{message}</p>}
        {error && <p className="error">{error}</p>}
      </form>

      <h3>سری‌های موجود ({visibleSeries.length})</h3>
      <div className="card-form" style={{ marginBottom: '0.75rem' }}>
        <div className="row" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <label className="field" style={{ flex: '1 1 10rem', margin: 0 }}>
            <span>فیلتر نوع</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            >
              <option value="all">همه</option>
              <option value="in">مطالبه</option>
              <option value="out">تعهد</option>
              <option value="transfer">انتقال</option>
            </select>
          </label>
        </div>
        <CategoryMultiFilter
          options={categoryMultiOptions}
          selected={categoryFilter}
          onChange={setCategoryFilter}
        />
      </div>

      {visibleSeries.length === 0 ? (
        <p className="muted">سری‌ای با این فیلتر نیست.</p>
      ) : (
        <ul className="list series-list">
          {visibleSeries.map((s) => {
            const from = accountById.get(s.accountId)
            const to = s.counterAccountId ? accountById.get(s.counterAccountId) : undefined
            const cat = s.categoryId ? categoryById.get(s.categoryId) : undefined
            const items = itemsBySeries.get(s.id) ?? []
            const openCount = items.filter((i) => i.status === 'pending').length
            const isOpen = expanded.has(s.id)
            return (
              <li key={s.id} className="series-row">
                <div className="series-head">
                  <button
                    type="button"
                    className="ghost series-toggle"
                    onClick={() => toggleExpand(s.id)}
                    aria-expanded={isOpen}
                  >
                    <span className="series-chevron" aria-hidden>
                      {isOpen ? '▾' : '◂'}
                    </span>
                    <span>
                      <strong>{s.name || 'بدون نام'}</strong>
                      <span className="badge">
                        {s.counterAccountId ? 'انتقال' : s.direction === 'in' ? 'مطالبه' : 'تعهد'}
                      </span>
                      {cat && <span className="badge">{cat.name}</span>}
                      <div className="muted">
                        {formatMoney(s.amountRial, unit)} × {s.count} — شروع{' '}
                        {toJalaliDisplay(s.startDateISO)}
                    {s.counterAccountId
                      ? ` · ${formatTransferPath(from?.name ?? '؟', to?.name ?? '؟')}`
                      : from
                        ? ` · ${from.name}`
                        : ''}
                        {` · ${openCount} در انتظار از ${items.length}`}
                      </div>
                    </span>
                  </button>
                  <div className="row" style={{ flexWrap: 'wrap', gap: '0.25rem' }}>
                    <button type="button" className="ghost" onClick={() => startEdit(s)}>
                      ویرایش سری
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        if (
                          !confirm(
                            `سری «${s.name}» و اقلام باز آن حذف شود؟ (تراکنش‌های تأییدشده می‌مانند)`,
                          )
                        ) {
                          return
                        }
                        void deleteInstallmentSeries(s.id)
                          .then(() => {
                            if (editId === s.id) resetCreateForm()
                            if (itemEditId && items.some((i) => i.id === itemEditId)) {
                              setItemEditId(null)
                            }
                            setMessage('سری حذف شد')
                            return reload()
                          })
                          .catch((err) => setError(err instanceof Error ? err.message : 'خطا'))
                      }}
                    >
                      حذف
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <ul className="list series-items">
                    {items.length === 0 ? (
                      <li className="muted">قلمی برای این سری نیست.</li>
                    ) : (
                      items.map((item) => {
                        const editing = itemEditId === item.id
                        const editable = item.status === 'pending' || item.status === 'skipped'
                        return (
                          <li key={item.id} className={item.direction === 'in' ? 'flow-in' : 'flow-out'}>
                            {editing ? (
                              <div className="card-form" style={{ width: '100%', margin: 0 }}>
                                <p className="muted">
                                  ویرایش قسط {item.seriesIndex ?? '—'} از {s.count}
                                </p>
                                <MoneyField
                                  amountRial={itemAmount}
                                  unit={unit}
                                  onChangeRial={setItemAmount}
                                />
                                <JalaliDateField
                                  value={itemDueISO}
                                  onChange={setItemDueISO}
                                  label="سررسید"
                                />
                                {item.counterAccountId || itemCounterId ? (
                                  <>
                                    <label className="field">
                                      <span>از حساب</span>
                                      <select
                                        value={itemAccountId}
                                        onChange={(e) => setItemAccountId(e.target.value)}
                                      >
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
                                        value={itemCounterId}
                                        onChange={(e) => setItemCounterId(e.target.value)}
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
                                      <select
                                        value={itemAccountId}
                                        onChange={(e) => setItemAccountId(e.target.value)}
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
                                        value={itemCategoryId}
                                        onChange={(e) => setItemCategoryId(e.target.value)}
                                      >
                                        {categories.map((c) => (
                                          <option key={c.id} value={c.id}>
                                            {c.name}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                  </>
                                )}
                                <label className="field">
                                  <span>توضیحات</span>
                                  <input
                                    value={itemNote}
                                    onChange={(e) => setItemNote(e.target.value)}
                                  />
                                </label>
                                <div className="row">
                                  <button type="button" onClick={() => void saveItemEdit()}>
                                    ذخیره قسط
                                  </button>
                                  <button type="button" className="ghost" onClick={cancelItemEdit}>
                                    انصراف
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div>
                                  <strong>{formatMoney(item.amountRial, unit)}</strong>
                                  <span className="badge">{statusLabel[item.status]}</span>
                                  {item.seriesIndex != null && (
                                    <span className="badge">
                                      قسط {item.seriesIndex}/{s.count}
                                    </span>
                                  )}
                                  <div className="muted">
                                    سررسید {toJalaliDisplay(item.dueDateISO)}
                                    {item.counterAccountId
                                      ? ` · ${formatTransferPath(
                                          accountById.get(item.accountId)?.name ?? '؟',
                                          accountById.get(item.counterAccountId)?.name ?? '؟',
                                        )}`
                                      : ` · ${accountById.get(item.accountId)?.name ?? ''}`}
                                    {item.note ? ` · ${item.note}` : ''}
                                  </div>
                                </div>
                                <div className="row" style={{ flexWrap: 'wrap', gap: '0.25rem' }}>
                                  {editable && (
                                    <button
                                      type="button"
                                      className="ghost"
                                      onClick={() => beginItemEdit(item)}
                                    >
                                      ویرایش
                                    </button>
                                  )}
                                  {item.status === 'skipped' && (
                                    <button
                                      type="button"
                                      className="ghost"
                                      onClick={() =>
                                        void restoreScheduled(item.id)
                                          .then(() => {
                                            setMessage('قسط به در انتظار برگشت')
                                            return reload()
                                          })
                                          .catch((err) =>
                                            setError(err instanceof Error ? err.message : 'خطا'),
                                          )
                                      }
                                    >
                                      بازگردانی
                                    </button>
                                  )}
                                  {editable && (
                                    <button
                                      type="button"
                                      className="danger"
                                      onClick={() => {
                                        if (!confirm('این قسط حذف شود؟')) return
                                        void deleteScheduled(item.id)
                                          .then(() => {
                                            setMessage('قسط حذف شد')
                                            return reload()
                                          })
                                          .catch((err) =>
                                            setError(err instanceof Error ? err.message : 'خطا'),
                                          )
                                      }}
                                    >
                                      حذف
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </li>
                        )
                      })
                    )}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
