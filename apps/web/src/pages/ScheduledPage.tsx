import { useEffect, useMemo, useState } from 'react'
import { listAccounts } from '../domain/accounts'
import { listCategories } from '../domain/categories'
import {
  createScheduled,
  deleteScheduled,
  listScheduled,
  restoreScheduled,
  updateScheduled,
} from '../domain/scheduled'
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
  ScheduledItem,
  ScheduledStatus,
} from '../lib/types'

const statusLabel: Record<ScheduledStatus, string> = {
  pending: 'در انتظار',
  confirmed: 'تأیید شده',
  skipped: 'رد شده',
}

type StatusFilter = 'all' | ScheduledStatus

export function ScheduledPage() {
  const [items, setItems] = useState<ScheduledItem[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [unit, setUnit] = useState<DisplayUnit>('toman')
  const [editId, setEditId] = useState<string | null>(null)
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState(0)
  const [direction, setDirection] = useState<Direction>('out')
  const [dueDateISO, setDueDateISO] = useState(todayISO())
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  async function reload() {
    const [i, a, c, s] = await Promise.all([
      listScheduled(),
      listAccounts(),
      listCategories(),
      getSettings(),
    ])
    setItems(i)
    setAccounts(a)
    setCategories(c)
    setUnit(s.displayUnit)
    if (!accountId && a[0]) setAccountId(a[0].id)
    if (!categoryId && c[0]) setCategoryId(c[0].id)
  }

  useEffect(() => {
    void reload()
  }, [])

  function resetForm() {
    setEditId(null)
    setAmount(0)
    setNote('')
    setDirection('out')
    setDueDateISO(todayISO())
  }

  function beginEdit(s: ScheduledItem) {
    setEditId(s.id)
    setAccountId(s.accountId)
    setCategoryId(s.categoryId)
    setAmount(s.amountRial)
    setDirection(s.direction)
    setDueDateISO(s.dueDateISO)
    setNote(s.note ?? '')
    setError(null)
    setMessage(null)
  }

  const visible = useMemo(
    () => (statusFilter === 'all' ? items : items.filter((s) => s.status === statusFilter)),
    [items, statusFilter],
  )

  const editingItem = editId ? items.find((i) => i.id === editId) : undefined

  return (
    <section>
      <h2>تعهدات و مطالبات</h2>
      <form
        className="card-form"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          setMessage(null)
          const payload = {
            accountId,
            categoryId,
            amountRial: amount,
            direction,
            dueDateISO,
            note: note.trim() || null,
          }
          const action = editId
            ? updateScheduled(editId, payload).then(() => {
                setMessage(
                  editingItem?.status === 'skipped'
                    ? 'قلم ردشده به‌روز شد — برای صف تأیید، «بازگردانی» بزنید'
                    : 'قلم به‌روز شد',
                )
                resetForm()
              })
            : createScheduled(payload).then(resetForm)
          void action
            .then(reload)
            .catch((err) => setError(err instanceof Error ? err.message : 'خطا'))
        }}
      >
        <h3>{editId ? 'ویرایش قلم' : 'قلم جدید'}</h3>
        {editingItem?.status === 'skipped' && (
          <p className="muted">این قلم رد شده است. بعد از ویرایش می‌توانید بازگردانی کنید.</p>
        )}
        <label className="field">
          <span>نوع</span>
          <select value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
            <option value="out">تعهد (خروجی آینده)</option>
            <option value="in">مطالبه (ورودی آینده)</option>
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
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <MoneyField amountRial={amount} unit={unit} onChangeRial={setAmount} />
        <JalaliDateField value={dueDateISO} onChange={setDueDateISO} label="سررسید شمسی" />
        <label className="field">
          <span>توضیحات (اختیاری)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="row">
          <button type="submit">{editId ? 'ذخیره' : 'ثبت'}</button>
          {editId && editingItem?.status === 'skipped' && (
            <button
              type="button"
              onClick={() =>
                void restoreScheduled(editId)
                  .then(() => {
                    setMessage('به وضعیت در انتظار برگشت')
                    resetForm()
                    return reload()
                  })
                  .catch((err) => setError(err instanceof Error ? err.message : 'خطا'))
              }
            >
              بازگردانی به انتظار
            </button>
          )}
          {editId && (
            <button type="button" className="ghost" onClick={resetForm}>
              انصراف
            </button>
          )}
        </div>
        {message && <p className="ok">{message}</p>}
        {error && <p className="error">{error}</p>}
      </form>

      <div className="row" style={{ marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.35rem' }}>
        {(
          [
            ['all', 'همه'],
            ['pending', 'در انتظار'],
            ['skipped', 'رد شده'],
            ['confirmed', 'تأیید شده'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={statusFilter === key ? undefined : 'ghost'}
            onClick={() => setStatusFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="list">
        {visible.length === 0 ? (
          <li className="muted">موردی نیست.</li>
        ) : (
          visible.map((s) => (
            <li key={s.id}>
              <div>
                <strong>{formatMoney(s.amountRial, unit)}</strong>{' '}
                {s.direction === 'in' ? 'مطالبه' : 'تعهد'}
                <span className={`badge${s.status === 'skipped' ? ' forecast' : ''}`}>
                  {statusLabel[s.status]}
                </span>
                <div className="muted">
                  سررسید {toJalaliDisplay(s.dueDateISO)}
                  {s.seriesId ? ` · سری قسط ${s.seriesIndex}` : ''}
                  {s.note ? ` · ${s.note}` : ''}
                </div>
              </div>
              {(s.status === 'pending' || s.status === 'skipped') && (
                <div className="row">
                  <button type="button" className="ghost" onClick={() => beginEdit(s)}>
                    ویرایش
                  </button>
                  {s.status === 'skipped' && (
                    <button
                      type="button"
                      onClick={() =>
                        void restoreScheduled(s.id)
                          .then(() => {
                            setMessage('بازگردانی شد')
                            return reload()
                          })
                          .catch((err) => setError(err instanceof Error ? err.message : 'خطا'))
                      }
                    >
                      بازگردانی
                    </button>
                  )}
                  <button
                    type="button"
                    className="danger"
                    onClick={() =>
                      void deleteScheduled(s.id)
                        .then(reload)
                        .catch((err) => setError(err instanceof Error ? err.message : 'خطا'))
                    }
                  >
                    حذف
                  </button>
                </div>
              )}
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
