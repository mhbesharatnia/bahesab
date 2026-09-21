import { useEffect, useMemo, useState } from 'react'
import { listAccounts } from '../domain/accounts'
import { listCategories } from '../domain/categories'
import {
  createInstallmentSeries,
  deleteInstallmentSeries,
  listInstallmentSeries,
  updateInstallmentSeries,
} from '../domain/installments'
import { JalaliDateField } from '../components/forms/JalaliDateField'
import { MoneyField } from '../components/forms/MoneyField'
import { getSettings } from '../lib/db'
import { countMonthsThroughJalaliYearEnd, todayISO, toJalaliDisplay } from '../lib/dates'
import { formatMoney } from '../lib/money'
import type { Account, Category, Direction, DisplayUnit, InstallmentSeries } from '../lib/types'

export function InstallmentsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [seriesList, setSeriesList] = useState<InstallmentSeries[]>([])
  const [unit, setUnit] = useState<DisplayUnit>('toman')
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState(0)
  const [count, setCount] = useState(12)
  const [direction, setDirection] = useState<Direction>('in')
  const [startDateISO, setStartDateISO] = useState(todayISO())
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filteredCategories = useMemo(() => {
    if (direction === 'in') return categories.filter((c) => c.kind === 'income')
    return categories.filter((c) => c.kind === 'expense')
  }, [categories, direction])

  async function reload() {
    const [a, c, s, series] = await Promise.all([
      listAccounts(),
      listCategories(),
      getSettings(),
      listInstallmentSeries(),
    ])
    setAccounts(a)
    setCategories(c)
    setUnit(s.displayUnit)
    setSeriesList(series)
    if (!accountId && a[0]) setAccountId(a[0].id)
  }

  useEffect(() => {
    void reload()
  }, [])

  useEffect(() => {
    if (editId) return
    const preferred = filteredCategories[0]
    if (preferred) setCategoryId(preferred.id)
    else setCategoryId('')
  }, [direction, filteredCategories, editId])

  function resetCreateForm() {
    setEditId(null)
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
    setCategoryId(s.categoryId)
    setError(null)
    setMessage(null)
  }

  return (
    <section>
      <h2>سری اقساط و مطالبات</h2>
      <p className="muted">
        برای حقوق تا آخر سال: نوع «مطالبه / دریافت»، حساب بانکی، دسته درآمد، شروع اولین حقوق، دکمه «تا پایان سال
        شمسی».
      </p>
      <form
        className="card-form"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          setMessage(null)
          if (!categoryId) {
            setError(
              direction === 'in'
                ? 'ابتدا یک دسته درآمد بسازید'
                : 'ابتدا یک دسته هزینه بسازید',
            )
            return
          }
          if (editId) {
            void updateInstallmentSeries(editId, {
              name,
              amountRial: amount,
              accountId,
              categoryId,
              direction,
              startDateISO,
              count,
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
            categoryId,
            amountRial: amount,
            direction,
            startDateISO,
            count,
          })
            .then((r) => {
              setMessage(
                `${r.items.length} مورد برای «${r.series.name}» (${
                  direction === 'in' ? 'مطالبه' : 'تعهد'
                }) ساخته شد`,
              )
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
            placeholder={direction === 'in' ? 'مثلاً حقوق ۱۴۰۵' : 'مثلاً قسط صندوق'}
            required
          />
        </label>
        <label className="field">
          <span>نوع سری</span>
          <select value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
            <option value="in">مطالبه / دریافت (حقوق، اجاره دریافتی، …)</option>
            <option value="out">تعهد / پرداخت (قسط وام، صندوق، …)</option>
          </select>
        </label>
        <label className="field">
          <span>حساب مقصد</span>
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
            ذخیره روی اقلام pending و skipped اعمال می‌شود. اقساطی که قبلاً تأیید شده‌اند عوض نمی‌شوند.
          </p>
        )}
        <div className="row">
          <button type="submit">{editId ? 'ذخیره تغییرات' : 'ساخت سری'}</button>
          {editId && (
            <button type="button" className="ghost" onClick={resetCreateForm}>
              انصراف
            </button>
          )}
        </div>
        {message && <p className="ok">{message}</p>}
        {error && <p className="error">{error}</p>}
      </form>

      <h3>سری‌های موجود</h3>
      <ul className="list">
        {seriesList.length === 0 ? (
          <li>هنوز سری‌ای نیست.</li>
        ) : (
          seriesList.map((s) => {
            const acc = accounts.find((a) => a.id === s.accountId)
            return (
              <li key={s.id}>
                <div>
                  <strong>{s.name || 'بدون نام'}</strong>
                  <span className="badge">{s.direction === 'in' ? 'مطالبه' : 'تعهد'}</span>
                  <div className="muted">
                    {formatMoney(s.amountRial, unit)} × {s.count} — شروع {toJalaliDisplay(s.startDateISO)}
                    {acc ? ` · ${acc.name}` : ''}
                  </div>
                </div>
                <div className="row">
                  <button type="button" className="ghost" onClick={() => startEdit(s)}>
                    ویرایش
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
                          setMessage('سری حذف شد')
                          return reload()
                        })
                        .catch((err) => setError(err instanceof Error ? err.message : 'خطا'))
                    }}
                  >
                    حذف
                  </button>
                </div>
              </li>
            )
          })
        )}
      </ul>
    </section>
  )
}
