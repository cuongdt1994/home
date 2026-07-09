import { useState } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'
import { formatBytes, formatDate } from '../../lib/utils'
import type { TrafficStat } from '../../types'
import { cn } from '../../lib/utils'

interface Props {
  data: TrafficStat[]
  height?: number
}

type TimeRange = '5m' | '15m' | '1h' | '6h' | '24h'

export default function BandwidthChart({ data, height = 260 }: Props) {
  const [range, setRange] = useState<TimeRange>('15m')

  const rangeToSamples: Record<TimeRange, number> = {
    '5m': 10, '15m': 30, '1h': 120, '6h': 720, '24h': 2880,
  }

  const chartData = data.slice(-rangeToSamples[range]).map(t => ({
    time: t.time?.slice(11, 16) || '',
    fullTime: formatDate(t.time),
    in: t.bytes_in,
    out: t.bytes_out,
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-surface-900">Bandwidth Usage</h3>
        <div className="flex gap-1 bg-surface-100 rounded-lg p-0.5">
          {(['5m', '15m', '1h', '6h', '24h'] as TimeRange[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                range === r ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="inGrad2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="outGrad2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatBytes} width={60} />
          <Tooltip
            labelFormatter={(l, payload) => payload?.[0]?.payload?.fullTime || l}
            formatter={(v: number) => formatBytes(v)}
          />
          <Area type="monotone" dataKey="in" stroke="#3b82f6" fill="url(#inGrad2)" strokeWidth={2} name="Inbound" />
          <Area type="monotone" dataKey="out" stroke="#10b981" fill="url(#outGrad2)" strokeWidth={2} name="Outbound" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
