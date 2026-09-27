import type { Category } from '../../lib/types'

export type CategoryMultiFilterState = Set<string>

/** Empty set = همه دسته‌ها. Special key `__none__` = بدون دسته. */
export const CATEGORY_NONE = '__none__'

export function matchesCategoryMultiFilter(
  categoryId: string | null | undefined,
  selected: CategoryMultiFilterState,
): boolean {
  if (selected.size === 0) return true
  if (!categoryId) return selected.has(CATEGORY_NONE)
  return selected.has(categoryId)
}

export function toggleCategoryFilter(
  selected: CategoryMultiFilterState,
  key: string,
): CategoryMultiFilterState {
  const next = new Set(selected)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

export type CategoryFilterOption = {
  key: string
  label: string
  /** Settled (registered) total in rials for this category in current filters */
  settledRial?: number
  /** Pending total in rials */
  pendingRial?: number
}

type Props = {
  options: CategoryFilterOption[]
  selected: CategoryMultiFilterState
  onChange: (next: CategoryMultiFilterState) => void
  label?: string
  unitLabel?: (rial: number) => string
}

export function CategoryMultiFilter({
  options,
  selected,
  onChange,
  label = 'فیلتر دسته (چندتایی)',
  unitLabel,
}: Props) {
  const allActive = selected.size === 0
  const fmt = unitLabel ?? ((n: number) => String(n))

  return (
    <div className="card-form category-multi-filter">
      <h3>{label}</h3>
      <div className="row" style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
        <button
          type="button"
          className={allActive ? undefined : 'ghost'}
          onClick={() => onChange(new Set())}
        >
          همه
        </button>
        {options.map((o) => {
          const on = selected.has(o.key)
          const settled = o.settledRial ?? 0
          const pending = o.pendingRial ?? 0
          const hasTotals = o.settledRial !== undefined || o.pendingRial !== undefined
          return (
            <button
              key={o.key}
              type="button"
              className={on ? undefined : 'ghost'}
              aria-pressed={on}
              onClick={() => onChange(toggleCategoryFilter(selected, o.key))}
              title={
                hasTotals
                  ? `ثبت‌شده ${fmt(settled)} · در انتظار ${fmt(pending)}`
                  : undefined
              }
            >
              {o.label}
              {hasTotals && (
                <span className="cat-filter-totals">
                  {' '}
                  · ثبت {fmt(settled)}
                  {' / '}
                  پندینگ {fmt(pending)}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {!allActive && (
        <small className="muted">{selected.size} دسته انتخاب شده</small>
      )}
    </div>
  )
}

export function categoryOptionsFromIds(
  ids: string[],
  categoryById: Map<string, Category>,
  hasNone: boolean,
): CategoryFilterOption[] {
  const opts: CategoryFilterOption[] = []
  if (hasNone) opts.push({ key: CATEGORY_NONE, label: 'بدون دسته' })
  for (const id of ids) {
    const c = categoryById.get(id)
    opts.push({
      key: id,
      label: c?.name || (c?.systemKey === 'opening' ? 'افتتاحیه' : id),
    })
  }
  return opts
}
