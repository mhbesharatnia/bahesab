import { useEffect, useMemo, useState } from 'react'
import { listAccounts } from '../domain/accounts'
import { listCategories } from '../domain/categories'
import {
  confirmItems,
  listAwaitingConfirm,
  skipItems,
  type ConfirmOverrides,
} from '../domain/due-processing'
import { listInstallmentSeries } from '../domain/installments'
import { listScheduled } from '../domain/scheduled'
import { JalaliDateField } from '../components/forms/JalaliDateField'
import { MoneyField } from '../components/forms/MoneyField'
import { todayISO, toJalaliDisplay } from '../lib/dates'
import { getSettings } from '../lib/db'
import { formatMoney } from '../lib/money'
import type {
  Account,
  Category,
  Direction,
  DisplayUnit,
  InstallmentSeries,
  ScheduledItem,
} from '../lib/types'

type ReviewMode = 'confirm' | 'skip'

type Draft = {
  itemId: string
  accountId: string
  categoryId: string
  amountRial: number
  direction: Direction
  dateISO: string
  note: string
}

function draftFromItem(item: ScheduledItem): Draft {
  return {
    itemId: item.id,
    accountId: item.accountId,
    categoryId: item.categoryId,
    amountRial: item.amountRial,
    direction: item.direction,
    dateISO: item.dueDateISO,
    note: item.note ?? '',
  }
}

export function AwaitingConfirmPage() {
  const [items, setItems] = useState<ScheduledItem[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [series, setSeries] = useState<InstallmentSeries[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [unit, setUnit] = useState<DisplayUnit>('toman')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<ReviewMode | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [queue, setQueue] = useState<string[]>([])

  async function reload() {
    const [all, s, a, c, ser] = await Promise.all([
      listScheduled('pending'),
      getSettings(),
      listAccounts(),
      listCategories(),
      listInstallmentSeries(),
    ])
    setUnit(s.displayUnit)
    setAccounts(a)
    setCategories(c)
    setSeries(ser)
    setItems(listAwaitingConfirm(all, todayISO()))
    setSelected(new Set())
  }

  useEffect(() => {
    void reload()
  }, [])

  const seriesById = useMemo(() => new Map(series.map((s) => [s.id, s])), [series])
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const reviewing = draft ? itemsById.get(draft.itemId) : undefined

  function openReview(item: ScheduledItem, nextMode: ReviewMode, restQueue: string[] = []) {
    setError(null)
    setMessage(null)
    setMode(nextMode)
    setDraft(draftFromItem(item))
    setQueue(restQueue)
  }

  function closeReview() {
    setMode(null)
    setDraft(null)
    setQueue([])
  }

  function startBulk(nextMode: ReviewMode) {
    const ids = items.filter((i) => selected.has(i.id)).map((i) => i.id)
    if (ids.length === 0) return
    const [first, ...rest] = ids
    const item = itemsById.get(first!)
    if (!item) return
    openReview(item, nextMode, rest)
  }

  async function submitConfirm() {
    if (!draft) return
    setError(null)
    const overrides: ConfirmOverrides = {
      accountId: draft.accountId,
      categoryId: draft.categoryId,
      amountRial: draft.amountRial,
      direction: draft.direction,
      dateISO: draft.dateISO,
      note: draft.note.trim() || null,
    }
    try {
      await confirmItems([draft.itemId], { [draft.itemId]: overrides })
      setMessage('تراکنش ثبت شد')
      await advanceOrFinish()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا')
    }
  }

  async function submitSkip() {
    if (!draft) return
    setError(null)
    try {
      await skipItems([draft.itemId])
      setMessage('رد شد — تراکنشی ثبت نشد')
      await advanceOrFinish()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا')
    }
  }

  async function advanceOrFinish() {
    const [nextId, ...rest] = queue
    if (nextId && mode) {
      // reload list so next item still exists; then open
      const all = await listScheduled('pending')
      const awaiting = listAwaitingConfirm(all, todayISO())
      setItems(awaiting)
      const next = awaiting.find((i) => i.id === nextId)
      if (next) {
        openReview(next, mode, rest)
        return
      }
      // skipped missing ids
      if (rest.length > 0) {
        setQueue(rest)
        const fallback = awaiting.find((i) => rest.includes(i.id))
        if (fallback) {
          openReview(
            fallback,
            mode,
            rest.filter((id) => id !== fallback.id),
          )
          return
        }
      }
    }
    closeReview()
    await reload()
  }

  function originLine(item: ScheduledItem): string {
    if (item.seriesId) {
      const ser = seriesById.get(item.seriesId)
      const name = ser?.name ?? 'سری'
      const idx =
        item.seriesIndex != null && ser
          ? `قسط ${item.seriesIndex} از ${ser.count}`
          : item.seriesIndex != null
            ? `قسط ${item.seriesIndex}`
            : null
      return idx ? `منبع: سری «${name}» — ${idx}` : `منبع: سری «${name}»`
    }
    return item.note ? `منبع: تعهد — ${item.note}` : 'منبع: تعهد تکی'
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (draft && mode) {
    return (
      <section>
        <h2>{mode === 'confirm' ? 'بررسی و ثبت تراکنش' : 'بررسی قبل از رد'}</h2>
        <p className="muted">
          {mode === 'confirm'
            ? 'می‌توانید قبل از ثبت، همهٔ فیلدها را عوض کنید.'
            : 'این قلم رد می‌شود و تراکنشی ساخته نمی‌شود. جزئیات را چک کنید.'}
        </p>
        {reviewing && <p className="muted">{originLine(reviewing)}</p>}
        {queue.length > 0 && (
          <p className="muted">{queue.length} مورد دیگر در صف بررسی است.</p>
        )}

        <form
          className="card-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (mode === 'confirm') void submitConfirm()
            else void submitSkip()
          }}
        >
          <label className="field">
            <span>حساب</span>
            <select
              value={draft.accountId}
              onChange={(e) => setDraft({ ...draft, accountId: e.target.value })}
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
              value={draft.categoryId}
              onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <MoneyField
            amountRial={draft.amountRial}
            unit={unit}
            onChangeRial={(rial) => setDraft({ ...draft, amountRial: rial })}
          />
          <label className="field">
            <span>جهت</span>
            <select
              value={draft.direction}
              onChange={(e) => setDraft({ ...draft, direction: e.target.value as Direction })}
            >
              <option value="out">خروجی / تعهد</option>
              <option value="in">ورودی / مطالبه</option>
            </select>
          </label>
          <JalaliDateField
            value={draft.dateISO}
            onChange={(v) => setDraft({ ...draft, dateISO: v })}
            label="تاریخ تراکنش"
          />
          <label className="field">
            <span>توضیحات</span>
            <input
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="اختیاری"
            />
          </label>

          <div className="row" style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
            {mode === 'confirm' ? (
              <button type="submit">ثبت به‌عنوان تراکنش</button>
            ) : (
              <button type="submit" className="danger">
                تأیید رد (بدون تراکنش)
              </button>
            )}
            {mode === 'confirm' && (
              <button
                type="button"
                className="danger"
                onClick={() => {
                  setMode('skip')
                }}
              >
                رد به‌جای ثبت
              </button>
            )}
            {mode === 'skip' && (
              <button
                type="button"
                onClick={() => {
                  setMode('confirm')
                }}
              >
                برگشت به ثبت
              </button>
            )}
            <button type="button" className="ghost" onClick={closeReview}>
              انصراف
            </button>
          </div>
          {error && <p className="error">{error}</p>}
          {message && <p className="ok">{message}</p>}
        </form>

        {mode === 'skip' && (
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            رد فقط وضعیت را عوض می‌کند؛ ویرایش‌های بالا ذخیره نمی‌شوند مگر «برگشت به ثبت» بزنید.
          </p>
        )}
      </section>
    )
  }

  return (
    <section>
      <h2>نیازمند تأیید</h2>
      <p className="muted">
        با تأیید یا رد، فرم کامل تراکنش باز می‌شود تا قبل از تصمیم بتوانید جزئیات را ببینید و در حالت
        تأیید ویرایش کنید.
      </p>
      <div className="row">
        <button type="button" disabled={selected.size === 0} onClick={() => startBulk('confirm')}>
          تأیید انتخاب‌شده‌ها
        </button>
        <button
          type="button"
          className="danger"
          disabled={selected.size === 0}
          onClick={() => startBulk('skip')}
        >
          رد انتخاب‌شده‌ها
        </button>
      </div>
      {message && <p className="ok">{message}</p>}
      {error && <p className="error">{error}</p>}
      {items.length === 0 ? (
        <p>موردی برای تأیید نیست.</p>
      ) : (
        <ul className="list">
          {items.map((s) => {
            const acc = accounts.find((a) => a.id === s.accountId)
            return (
              <li key={s.id}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                  />
                  <span>
                    <strong>{formatMoney(s.amountRial, unit)}</strong> —{' '}
                    {s.direction === 'in' ? 'مطالبه' : 'تعهد'} — {toJalaliDisplay(s.dueDateISO)}
                    <div className="muted">
                      {acc?.name ?? 'حساب'} · {originLine(s)}
                    </div>
                  </span>
                </label>
                <div className="row">
                  <button type="button" className="ghost" onClick={() => openReview(s, 'confirm')}>
                    تأیید
                  </button>
                  <button type="button" className="ghost" onClick={() => openReview(s, 'skip')}>
                    رد
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
