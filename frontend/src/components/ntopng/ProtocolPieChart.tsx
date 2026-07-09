import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'

const DEFAULT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1']

interface ProtocolData {
  name: string
  value: number
}

interface Props {
  data?: ProtocolData[]
  height?: number
  colors?: string[]
}

export default function ProtocolPieChart({ data, height = 240, colors = DEFAULT_COLORS }: Props) {
  const chartData = data || [
    { name: 'TCP', value: 55 },
    { name: 'UDP', value: 25 },
    { name: 'ICMP', value: 5 },
    { name: 'DNS', value: 10 },
    { name: 'Other', value: 5 },
  ]

  return (
    <div>
      <h3 className="font-semibold text-surface-900 mb-2">Protocol Distribution</h3>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={85}
            innerRadius={50}
            paddingAngle={2}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} stroke="none" />
            ))}
          </Pie>
          <Tooltip formatter={(v: number, name: string) => [`${v}%`, name]} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value: string) => <span className="text-xs text-surface-600">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
