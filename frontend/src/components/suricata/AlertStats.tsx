import { BarChart3, ShieldOff, ShieldAlert, AlertTriangle } from 'lucide-react'

interface Props { stats: { total_alerts: number; critical: number; high: number; medium: number; today: number } | null }

export default function AlertStats({ stats }: Props) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-3xl border border-slate-100 p-5 animate-shimmer h-[100px]" />
        ))}
      </div>
    )
  }

  const items = [
    { label: 'Total Alerts', value: stats.total_alerts, icon: BarChart3, color: 'bg-brand-50 text-brand-600' },
    { label: 'Critical', value: stats.critical, icon: ShieldOff, color: 'bg-rose-50 text-rose-600' },
    { label: 'High', value: stats.high, icon: ShieldAlert, color: 'bg-orange-50 text-orange-600' },
    { label: 'Today', value: stats.today, icon: AlertTriangle, color: 'bg-amber-50 text-amber-600' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item) => (
        <div key={item.label} className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm card-hover">
          <div className={`p-2.5 rounded-2xl w-fit mb-3 ${item.color}`}><item.icon className="w-4 h-4" /></div>
          <p className="text-2xl font-bold text-slate-900 tracking-tight">{item.value.toLocaleString()}</p>
          <p className="text-sm text-slate-500 font-medium mt-0.5">{item.label}</p>
        </div>
      ))}
    </div>
  )
}
