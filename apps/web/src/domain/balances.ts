import type { ScheduledItem, Transaction } from '../lib/types'
import { compareISO } from '../lib/dates'
import { txnEffect } from '../lib/money'

export function settledBalancesAsOf(
  dateISO: string,
  txns: Transaction[],
): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of txns) {
    if (compareISO(t.dateISO, dateISO) > 0) continue
    map.set(t.accountId, (map.get(t.accountId) ?? 0) + txnEffect(t.amountRial, t.direction))
  }
  return map
}

export function forecastAsOf(
  reportDateISO: string,
  todayISO: string,
  txns: Transaction[],
  pending: ScheduledItem[],
): {
  mode: 'settled' | 'forecast'
  settled: Map<string, number>
  pendingEffect: Map<string, number>
} {
  if (compareISO(reportDateISO, todayISO) <= 0) {
    return {
      mode: 'settled',
      settled: settledBalancesAsOf(reportDateISO, txns),
      pendingEffect: new Map(),
    }
  }

  const settled = settledBalancesAsOf(todayISO, txns)
  const pendingEffect = new Map<string, number>()
  for (const s of pending) {
    if (s.status !== 'pending') continue
    if (compareISO(s.dueDateISO, reportDateISO) > 0) continue
    pendingEffect.set(
      s.accountId,
      (pendingEffect.get(s.accountId) ?? 0) + txnEffect(s.amountRial, s.direction),
    )
  }
  return { mode: 'forecast', settled, pendingEffect }
}
