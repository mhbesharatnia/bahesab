import { useEffect, useId, useRef, useState } from 'react'
import {
  JALALI_MONTH_NAMES,
  buildJalaliMonthGrid,
  parseJalaliDisplay,
  toJalaliDisplay,
  toJalaliParts,
  todayISO,
} from '../../lib/dates'

type Props = {
  value: string
  onChange: (iso: string) => void
  label?: string
}

export function JalaliDateField({ value, onChange, label = 'تاریخ شمسی' }: Props) {
  const [text, setText] = useState(() => (value ? toJalaliDisplay(value) : ''))
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const initialParts = toJalaliParts(value || todayISO())
  const [viewYear, setViewYear] = useState(initialParts.year)
  const [viewMonth, setViewMonth] = useState(initialParts.month)

  useEffect(() => {
    if (value) setText(toJalaliDisplay(value))
  }, [value])

  useEffect(() => {
    if (!open) return
    const parts = toJalaliParts(value || todayISO())
    setViewYear(parts.year)
    setViewMonth(parts.month)
  }, [open, value])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function commitText(raw: string) {
    try {
      const iso = parseJalaliDisplay(raw)
      onChange(iso)
      setText(toJalaliDisplay(iso))
      setError(null)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تاریخ نامعتبر')
      return false
    }
  }

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

  const cells = buildJalaliMonthGrid(viewYear, viewMonth)
  const today = todayISO()

  return (
    <div className="field jalali-date-field" ref={rootRef}>
      <span>{label}</span>
      <div className="jalali-date-row">
        <input
          dir="ltr"
          value={text}
          placeholder="۱۴۰۳/۰۱/۰۱"
          aria-expanded={open}
          aria-controls={listId}
          onChange={(e) => {
            setText(e.target.value)
            setError(null)
          }}
          onBlur={() => {
            if (text.trim()) commitText(text)
          }}
          onFocus={() => setOpen(true)}
        />
        <button
          type="button"
          className="ghost jalali-date-toggle"
          aria-label="انتخاب از تقویم"
          onClick={() => setOpen((v) => !v)}
        >
          تقویم
        </button>
      </div>
      {error && <small className="error">{error}</small>}

      {open && (
        <div className="jalali-picker" id={listId} role="dialog" aria-label="تقویم شمسی">
          <div className="jalali-picker-nav">
            <button type="button" className="ghost" onClick={() => shiftMonth(-1)} aria-label="ماه قبل">
              ›
            </button>
            <strong>
              {JALALI_MONTH_NAMES[viewMonth - 1]} {viewYear}
            </strong>
            <button type="button" className="ghost" onClick={() => shiftMonth(1)} aria-label="ماه بعد">
              ‹
            </button>
          </div>
          <div className="jalali-picker-weekdays">
            {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="jalali-picker-grid">
            {cells.map((c, i) => {
              const selected = c.dateISO === value
              const isToday = c.dateISO === today
              return (
                <button
                  key={`${c.dateISO}-${i}`}
                  type="button"
                  className={[
                    'jalali-day',
                    c.inMonth ? '' : 'muted-day',
                    selected ? 'selected' : '',
                    isToday ? 'today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    onChange(c.dateISO)
                    setText(toJalaliDisplay(c.dateISO))
                    setError(null)
                    setOpen(false)
                  }}
                >
                  {c.day}
                </button>
              )
            })}
          </div>
          <div className="jalali-picker-footer">
            <button
              type="button"
              className="ghost"
              onClick={() => {
                const t = todayISO()
                onChange(t)
                setText(toJalaliDisplay(t))
                setError(null)
                setOpen(false)
              }}
            >
              امروز
            </button>
            <button type="button" className="ghost" onClick={() => setOpen(false)}>
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
