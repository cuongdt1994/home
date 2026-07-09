import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'
import { formatBytes } from '../../lib/utils'
import type { TrafficStat } from '../../types'

interface Props {
  data: TrafficStat[]
  height?: number
}

export default function TrafficChart({ data, height = 200 }: Props) {
  const chartData = data.slice(-60).map(t => ({
    time: t.time?.slice(11, 16) || '',
    inbound: t.bytes_in,
    outbound: t.bytes_out,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="time" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatBytes} width={60} />
        <Tooltip formatter={(v: number) => formatBytes(v)} />
        <Area type="monotone" dataKey="inbound" stroke="#3b82f6" fill="url(#inGrad)" strokeWidth={2} name="In" />
        <Area type="monotone" dataKey="outbound" stroke="#10b981" fill="url(#outGrad)" strokeWidth={2} name="Out" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
