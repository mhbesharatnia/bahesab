import type { InstallmentSeries, ScheduledItem, Transaction } from '../lib/types'

export type TxnOriginKind = 'opening' | 'manual' | 'commitment' | 'series'

export interface TxnOrigin {
  kind: TxnOriginKind
  /** Short badge text */
  badge: string
  /** Extra detail under the row */
  detail: string | null
}

export function resolveTxnOrigin(
  txn: Transaction,
  scheduledById: Map<string, ScheduledItem>,
  seriesById: Map<string, InstallmentSeries>,
): TxnOrigin {
  if (txn.kind === 'opening') {
    return { kind: 'opening', badge: 'افتتاحیه', detail: null }
  }
  if (txn.kind === 'normal' || !txn.scheduledItemId) {
    return { kind: 'manual', badge: 'دستی', detail: null }
  }

  const item = scheduledById.get(txn.scheduledItemId)
  if (!item) {
    return { kind: 'commitment', badge: 'از تعهد', detail: 'قلم سررسید حذف شده' }
  }

  if (item.seriesId) {
    const series = seriesById.get(item.seriesId)
    const name = series?.name ?? 'سری'
    const idx =
      item.seriesIndex != null && series
        ? `قسط ${item.seriesIndex} از ${series.count}`
        : item.seriesIndex != null
          ? `قسط ${item.seriesIndex}`
          : null
    return {
      kind: 'series',
      badge: 'از سری',
      detail: idx ? `«${name}» — ${idx}` : `«${name}»`,
    }
  }

  return {
    kind: 'commitment',
    badge: 'از تعهد',
    detail: item.note,
  }
}
