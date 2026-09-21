import { useMemo } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CashProjectionPoint } from '../../domain/liquidity'
import { toJalaliDisplay } from '../../lib/dates'
import { formatTomanAxis } from '../../lib/money'
import type { DisplayUnit } from '../../lib/types'

type Props = {
  points: CashProjectionPoint[]
  unit: DisplayUnit
}

/** Charts always plot تومان (ریال ÷ ۱۰). */
export function CashProjectionChart({ points }: Props) {
  const data = useMemo(
    () =>
      points.map((p) => ({
        name: toJalaliDisplay(p.dateISO),
        cash: p.cash / 10,
      })),
    [points],
  )

  if (data.length === 0) return null

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis
            tickFormatter={formatTomanAxis}
            domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]}
            width={72}
          />
          <ReferenceLine
            y={0}
            stroke="#5b6b62"
            strokeWidth={2}
            label={{ value: 'صفر', position: 'insideTopRight', fill: '#5b6b62', fontSize: 12 }}
          />
          <Tooltip
            formatter={(value) => [
              `${formatTomanAxis(typeof value === 'number' ? value : Number(value))} تومان`,
              undefined,
            ]}
          />
          <Legend />
          <Line
            type="stepAfter"
            dataKey="cash"
            name="موجودی نقدی (با pending)"
            stroke="#1f6f5b"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
