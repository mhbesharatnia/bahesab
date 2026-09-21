import { useEffect, useState } from 'react'
import {
  createAccount,
  deleteAccount,
  getOpeningTransaction,
  listAccounts,
  updateOpeningTransaction,
} from '../domain/accounts'
import { JalaliDateField } from '../components/forms/JalaliDateField'
import { MoneyField } from '../components/forms/MoneyField'
import { getSettings } from '../lib/db'
import { todayISO } from '../lib/dates'
import { formatMoney, openingToSigned, signedToOpening } from '../lib/money'
import type { Account, AccountType, DisplayUnit } from '../lib/types'

const typeLabel: Record<AccountType, string> = {
  cash: 'نقدی',
  bank: 'بانکی',
  person: 'اشخاص',
  fund: 'صندوق',
}

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [unit, setUnit] = useState<DisplayUnit>('toman')
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('bank')
  /** Signed opening: + طلب/موجودی، − بدهی (بدهکار بودن شما) */
  const [signedOpening, setSignedOpening] = useState(0)
  const [dateISO, setDateISO] = useState(todayISO())
  const [error, setError] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)

  async function reload() {
    const [a, s] = await Promise.all([listAccounts(), getSettings()])
    setAccounts(a)
    setUnit(s.displayUnit)
  }

  useEffect(() => {
    void reload()
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const { amountRial, direction } = signedToOpening(signedOpening)
    try {
      if (editId) {
        await updateOpeningTransaction(editId, {
          amountRial,
          direction,
          dateISO,
        })
        setEditId(null)
        setSignedOpening(0)
      } else {
        await createAccount({
          name,
          type,
          openingAmountRial: amountRial,
          openingDirection: direction,
          openingDateISO: dateISO,
        })
        setName('')
        setSignedOpening(0)
      }
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا')
    }
  }

  async function startEdit(id: string) {
    const opening = await getOpeningTransaction(id)
    if (!opening) return
    setEditId(id)
    setSignedOpening(openingToSigned(opening.amountRial, opening.direction))
    setDateISO(opening.dateISO)
  }

  const openingHint =
    type === 'person'
      ? 'مثبت = طرف به شما بدهکار است (طلب). منفی = شما به طرف بدهکارید (بدهی).'
      : type === 'fund'
        ? 'موجودی خودِ صندوق را وارد نکنید. فقط بدهی/طلب شما با صندوق: منفی = از صندوق قرض گرفته‌اید؛ مثبت = صندوق به شما بدهکار است.'
        : 'برای حساب نقدی/بانکی معمولاً مثبت است. منفی یعنی اضافهبرداشت/بدهی اولیه.'

  return (
    <section>
      <h2>حساب‌ها</h2>
      <form className="card-form" onSubmit={onSubmit}>
        <h3>{editId ? 'ویرایش افتتاحیه' : 'حساب جدید'}</h3>
        {!editId && (
          <>
            <label className="field">
              <span>نام</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              <span>نوع</span>
              <select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
                <option value="cash">نقدی</option>
                <option value="bank">بانکی</option>
                <option value="person">اشخاص</option>
                <option value="fund">صندوق (قرض‌دهنده)</option>
              </select>
            </label>
          </>
        )}
        <MoneyField
          amountRial={signedOpening}
          unit={unit}
          onChangeRial={setSignedOpening}
          label="تراز اولیه"
          allowNegative
          hint={openingHint}
        />
        <JalaliDateField value={dateISO} onChange={setDateISO} label="تاریخ افتتاحیه" />
        <div className="row">
          <button type="submit">{editId ? 'ذخیره افتتاحیه' : 'ایجاد حساب'}</button>
          {editId && (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setEditId(null)
                setSignedOpening(0)
              }}
            >
              انصراف
            </button>
          )}
        </div>
        {error && <p className="error">{error}</p>}
      </form>

      <ul className="list">
        {accounts.map((a) => (
          <li key={a.id}>
            <div>
              <strong>{a.name}</strong>
              <span className="badge">{typeLabel[a.type]}</span>
            </div>
            <div className="row">
              <button type="button" className="ghost" onClick={() => void startEdit(a.id)}>
                افتتاحیه
              </button>
              <button
                type="button"
                className="danger"
                onClick={() =>
                  void deleteAccount(a.id)
                    .then(reload)
                    .catch((err) => setError(err instanceof Error ? err.message : 'خطا'))
                }
              >
                حذف
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="muted">
        صندوق‌ها طرف‌حساب قرض‌اند؛ موجودی صندوق مال تو نیست. قرض گرفتن: به حساب بانکی‌ات ورودی بزن و روی صندوق همان مبلغ را
        به‌صورت بدهی (تراز منفی یا تراکنش خروجی) ثبت کن. بازپرداخت: از بانک خروجی + روی صندوق ورودی (کاهش بدهی).
      </p>
      <p className="muted">
        نمونه بدهی به علی: حساب اشخاص با تراز {formatMoney(-5_000_000, unit)}. نمونه قرض از صندوق: نوع «صندوق» + تراز منفی
        به اندازهٔ اصل بدهی باقی‌مانده.
      </p>
    </section>
  )
}
