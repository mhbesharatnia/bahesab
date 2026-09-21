import { useEffect, useState } from 'react'
import type { DisplayUnit } from '../../lib/types'
import { formatMoney, parseMoneyInput } from '../../lib/money'

type Props = {
  amountRial: number
  unit: DisplayUnit
  onChangeRial: (rial: number) => void
  label?: string
  allowNegative?: boolean
  hint?: string
}

export function MoneyField({
  amountRial,
  unit,
  onChangeRial,
  label = 'مبلغ',
  allowNegative = false,
  hint,
}: Props) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const display = unit === 'toman' ? String(amountRial / 10) : String(amountRial)
    setText(display === '0' ? '0' : display)
  }, [amountRial, unit])

  return (
    <label className="field">
      <span>
        {label} ({unit === 'toman' ? 'تومان' : 'ریال'})
      </span>
      <input
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setError(null)
        }}
        onBlur={() => {
          try {
            const r = parseMoneyInput(text || '0', unit, { allowNegative })
            onChangeRial(r)
            setError(null)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'مبلغ نامعتبر')
          }
        }}
      />
      <small className="muted">{formatMoney(amountRial, unit)}</small>
      {hint && <small className="muted">{hint}</small>}
      {error && <small className="error">{error}</small>}
    </label>
  )
}
