import type { Account, ScheduledItem } from '../lib/types'
import { compareISO } from '../lib/dates'
import { txnEffect } from '../lib/money'

export interface LiquidityBucket {
  dateISO: string
  inflow: number
  outflow: number
  net: number
}

export interface CashProjectionPoint {
  dateISO: string
  /** Cumulative projected liquid cash after applying pending up to this date */
  cash: number
  /** Net of pending items on this date (liquid accounts only) */
  dayNet: number
  inflow: number
  outflow: number
}

export type DateRange = { fromISO?: string; toISO?: string }

function inRange(dateISO: string, range?: DateRange): boolean {
  if (!range) return true
  if (range.fromISO && compareISO(dateISO, range.fromISO) < 0) return false
  if (range.toISO && compareISO(dateISO, range.toISO) > 0) return false
  return true
}

export function isLiquidAccount(a: Pick<Account, 'type'>): boolean {
  return a.type === 'cash' || a.type === 'bank'
}

export function buildLiquidityBuckets(
  pending: ScheduledItem[],
  range?: DateRange,
): LiquidityBucket[] {
  const map = new Map<string, { inflow: number; outflow: number }>()
  for (const s of pending) {
    if (s.status !== 'pending') continue
    if (!inRange(s.dueDateISO, range)) continue
    const cur = map.get(s.dueDateISO) ?? { inflow: 0, outflow: 0 }
    const effect = txnEffect(s.amountRial, s.direction)
    if (effect >= 0) cur.inflow += effect
    else cur.outflow += -effect
    map.set(s.dueDateISO, cur)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateISO, v]) => ({
      dateISO,
      inflow: v.inflow,
      outflow: v.outflow,
      net: v.inflow - v.outflow,
    }))
}

/**
 * Project liquid cash from startingCash by applying pending items that hit liquid accounts,
 * within [fromISO, toISO]. Always includes an anchor point at fromISO.
 */
export function buildCashProjection(input: {
  startingCash: number
  pending: ScheduledItem[]
  liquidAccountIds: ReadonlySet<string>
  fromISO: string
  toISO: string
}): CashProjectionPoint[] {
  const { startingCash, pending, liquidAccountIds, fromISO, toISO } = input
  if (compareISO(fromISO, toISO) > 0) return []

  const buckets = buildLiquidityBuckets(
    pending.filter((s) => liquidAccountIds.has(s.accountId)),
    { fromISO, toISO },
  )

  const points: CashProjectionPoint[] = []
  let cash = startingCash
  let bi = 0

  // Anchor at range start (before applying same-day pending — pending on fromISO applied below)
  const firstBucketIsFrom = buckets[0]?.dateISO === fromISO
  if (!firstBucketIsFrom) {
    points.push({ dateISO: fromISO, cash, dayNet: 0, inflow: 0, outflow: 0 })
  }

  while (bi < buckets.length) {
    const b = buckets[bi]!
    cash += b.net
    points.push({
      dateISO: b.dateISO,
      cash,
      dayNet: b.net,
      inflow: b.inflow,
      outflow: b.outflow,
    })
    bi += 1
  }

  const last = points[points.length - 1]
  if (!last || last.dateISO !== toISO) {
    points.push({
      dateISO: toISO,
      cash,
      dayNet: 0,
      inflow: 0,
      outflow: 0,
    })
  }

  return points
}
