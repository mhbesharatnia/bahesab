import type { DisplayUnit } from './types'

/** Latin digits, `,` thousands, optional fraction (trim trailing zeros). */
export function formatGroupedNumber(value: number, maxFractionDigits = 1): string {
  if (!Number.isFinite(value)) return '—'
  const neg = value < 0
  const abs = Math.abs(value)
  const rounded =
    maxFractionDigits <= 0
      ? String(Math.round(abs))
      : abs.toFixed(maxFractionDigits).replace(/\.?0+$/, '')
  const [intRaw, frac] = rounded.split('.')
  const intPart = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const body = frac ? `${intPart}.${frac}` : intPart
  return neg ? `-${body}` : body
}

/**
 * Display money. Storage is always integer rials; this only affects presentation.
 * تومان: ریال فرد با ممیز؛ ≥۱٬۰۰۰ → هزار؛ ≥۱٬۰۰۰٬۰۰۰ → میلیون.
 */
export function formatMoney(amountRial: number, unit: DisplayUnit): string {
  if (unit === 'rial') {
    return `${formatCompactMagnitude(amountRial, 0)} ریال`
  }
  const toman = amountRial / 10
  return `${formatCompactMagnitude(toman, 1)} تومان`
}

/** Chart/axis values that are already in تومان. */
export function formatTomanAxis(value: number): string {
  return formatCompactMagnitude(value, 1)
}

function formatCompactMagnitude(value: number, maxFractionDigits: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    return `${formatGroupedNumber(value / 1_000_000, 1)} میلیون`
  }
  if (abs >= 1_000) {
    return `${formatGroupedNumber(value / 1_000, 1)} هزار`
  }
  return formatGroupedNumber(value, maxFractionDigits)
}
/** Parse money; by default non-negative. With allowNegative, leading - is kept as signed rials. */
export function parseMoneyInput(
  text: string,
  unit: DisplayUnit,
  options?: { allowNegative?: boolean },
): number {
  const allowNegative = options?.allowNegative ?? false
  let raw = text
    .trim()
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/,/g, '')
  const negative = allowNegative && /^-/.test(raw)
  raw = raw.replace(/[^\d.]/g, '')
  if (!raw) throw new Error('مبلغ نامعتبر است')
  const n = Number(raw)
  if (!Number.isFinite(n) || (!allowNegative && n < 0)) throw new Error('مبلغ نامعتبر است')
  const rials = unit === 'toman' ? Math.round(n * 10) : Math.round(n)
  return negative ? -rials : rials
}

export function txnEffect(amountRial: number, direction: 'in' | 'out'): number {
  return direction === 'in' ? amountRial : -amountRial
}

/** Opening UI: signed balance → storage amount + direction */
export function signedToOpening(signedRial: number): {
  amountRial: number
  direction: 'in' | 'out'
} {
  if (signedRial < 0) return { amountRial: Math.abs(signedRial), direction: 'out' }
  return { amountRial: signedRial, direction: 'in' }
}

export function openingToSigned(amountRial: number, direction: 'in' | 'out'): number {
  return direction === 'out' ? -Math.abs(amountRial) : Math.abs(amountRial)
}
