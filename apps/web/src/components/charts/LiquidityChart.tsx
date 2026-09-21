import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { LiquidityBucket } from '../../domain/liquidity'
import { toJalaliDisplay } from '../../lib/dates'
import { formatTomanAxis } from '../../lib/money'
import type { DisplayUnit } from '../../lib/types'

type Props = {
  buckets: LiquidityBucket[]
  unit: DisplayUnit
}

/** Charts always plot تومان (ریال ÷ ۱۰). */
export function LiquidityChart({ buckets }: Props) {
  const data = useMemo(
    () =>
      buckets.map((b) => ({
        name: toJalaliDisplay(b.dateISO),
        inflow: b.inflow / 10,
        outflow: b.outflow / 10,
      })),
    [buckets],
  )

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data}>
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
          <Bar dataKey="inflow" name="ورودی" fill="#2a9d8f" />
          <Bar dataKey="outflow" name="خروجی" fill="#e76f51" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
