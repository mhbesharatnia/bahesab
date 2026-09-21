import dayjs from 'dayjs'
import jalaliday from 'jalaliday'

dayjs.extend(jalaliday)

type JalaliDayjs = ReturnType<typeof dayjs> & {
  calendar: (c: 'jalali' | 'gregory') => JalaliDayjs
}

function j(d?: string | Date): JalaliDayjs {
  return dayjs(d) as unknown as JalaliDayjs
}

export function todayISO(now: Date = new Date()): string {
  return dayjs(now).format('YYYY-MM-DD')
}

export function compareISO(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

export function toJalaliDisplay(dateISO: string): string {
  return j(dateISO).calendar('jalali').format('YYYY/MM/DD')
}

export function fromJalaliInput(jy: number, jm: number, jd: number): string {
  const raw = `${jy}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}`
  const parsed = (dayjs as unknown as (s: string, o: { jalali: boolean }) => JalaliDayjs)(raw, {
    jalali: true,
  })
  return parsed.calendar('gregory').format('YYYY-MM-DD')
}

export function parseJalaliDisplay(text: string): string {
  const cleaned = text
    .trim()
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/-/g, '/')
  const m = cleaned.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (!m) throw new Error('تاریخ شمسی نامعتبر است')
  return fromJalaliInput(Number(m[1]), Number(m[2]), Number(m[3]))
}

export function addJalaliMonths(dateISO: string, months: number): string {
  return j(dateISO).calendar('jalali').add(months, 'month').calendar('gregory').format('YYYY-MM-DD')
}

export function jalaliTodayDisplay(now: Date = new Date()): string {
  return toJalaliDisplay(todayISO(now))
}

/** Inclusive count of monthly steps from startISO through end of that Jalali year. */
export function countMonthsThroughJalaliYearEnd(startISO: string): number {
  const start = j(startISO).calendar('jalali')
  const startMonth = start.month() + 1 // 1-12
  const count = 12 - startMonth + 1
  return Math.min(120, Math.max(1, count))
}

/** Last day of the Jalali month containing dateISO. */
export function endOfJalaliMonthISO(dateISO: string): string {
  return j(dateISO).calendar('jalali').endOf('month').calendar('gregory').format('YYYY-MM-DD')
}

/**
 * End of the Jalali month that is `monthsAhead` months after the month of dateISO.
 * monthsAhead=0 → پایان این ماه؛ 1 → پایان ماه بعد؛ 3 → پایان سه ماه بعد.
 */
export function endOfJalaliMonthAheadISO(dateISO: string, monthsAhead: number): string {
  return j(dateISO)
    .calendar('jalali')
    .add(monthsAhead, 'month')
    .endOf('month')
    .calendar('gregory')
    .format('YYYY-MM-DD')
}

/** Last day of Jalali year containing dateISO (Esfand 29/30). */
export function endOfJalaliYearISO(dateISO: string): string {
  return j(dateISO).calendar('jalali').endOf('year').calendar('gregory').format('YYYY-MM-DD')
}

/** Add Gregorian calendar days to an ISO date. */
export function addDaysISO(dateISO: string, days: number): string {
  return dayjs(dateISO).add(days, 'day').format('YYYY-MM-DD')
}

export const JALALI_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const

/** Parts of a Gregorian ISO date in Jalali calendar. */
export function toJalaliParts(dateISO: string): { year: number; month: number; day: number } {
  const dj = j(dateISO).calendar('jalali')
  return { year: dj.year(), month: dj.month() + 1, day: dj.date() }
}

/** Weekday index with Saturday=0 … Friday=6 (Iran week). */
export function jalaliWeekdayIndex(dateISO: string): number {
  // dayjs: 0=Sun … 6=Sat → map Sat→0
  const dow = dayjs(dateISO).day()
  return (dow + 1) % 7
}

export type JalaliMonthCell = {
  dateISO: string
  day: number
  inMonth: boolean
}

/** 6×7 grid for a Jalali month (Saturday-first). */
export function buildJalaliMonthGrid(jy: number, jm: number): JalaliMonthCell[] {
  const firstISO = fromJalaliInput(jy, jm, 1)
  const daysInMonth = j(firstISO).calendar('jalali').daysInMonth()
  const startPad = jalaliWeekdayIndex(firstISO)
  const cells: JalaliMonthCell[] = []

  // leading days from previous month
  for (let i = 0; i < startPad; i++) {
    const iso = dayjs(firstISO)
      .subtract(startPad - i, 'day')
      .format('YYYY-MM-DD')
    const parts = toJalaliParts(iso)
    cells.push({ dateISO: iso, day: parts.day, inMonth: false })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ dateISO: fromJalaliInput(jy, jm, d), day: d, inMonth: true })
  }

  // trailing to fill 6 weeks
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const last = cells[cells.length - 1]!
    const iso = dayjs(last.dateISO).add(1, 'day').format('YYYY-MM-DD')
    const parts = toJalaliParts(iso)
    cells.push({ dateISO: iso, day: parts.day, inMonth: false })
    if (cells.length >= 42) break
  }

  return cells
}
