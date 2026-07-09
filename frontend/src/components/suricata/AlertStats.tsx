import { AlertTriangle, ShieldOff, ShieldAlert, BarChart3 } from 'lucide-react'

interface Props {
  stats: {
    total_alerts: number
    critical: number
    high: number
    medium: number
    today: number
  } | null
}

export default function AlertStats({ stats }: Props) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-surface-200 p-4 animate-pulse">
            <div className="h-4 bg-surface-100 rounded w-16 mb-2" />
            <div className="h-8 bg-surface-100 rounded w-12" />
          </div>
        ))}
      </div>
    )
  }

  const items = [
    { label: 'Total Alerts', value: stats.total_alerts, icon: BarChart3, color: 'text-blue-600 bg-blue-50' },
    { label: 'Critical', value: stats.critical, icon: ShieldOff, color: 'text-red-600 bg-red-50' },
    { label: 'High', value: stats.high, icon: ShieldAlert, color: 'text-orange-600 bg-orange-50' },
    { label: 'Today', value: stats.today, icon: AlertTriangle, color: 'text-yellow-600 bg-yellow-50' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((item) => (
        <div key={item.label} className="bg-white rounded-2xl border border-surface-200 p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-2 text-surface-500 mb-1">
            <div className={`p-1.5 rounded-lg ${item.color}`}>
              <item.icon className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium">{item.label}</span>
          </div>
          <p className="text-2xl font-bold text-surface-900">{item.value.toLocaleString()}</p>
        </div>
      ))}
    </div>
  )
}
