import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  sub?: string
  color?: 'accent' | 'success' | 'warning' | 'destructive' | 'info'
  trend?: 'up' | 'down'
}

const iconStyles: Record<NonNullable<StatCardProps['color']>, string> = {
  accent:      'bg-accent/15 text-accent-400',
  success:     'bg-green-500/15 text-green-400',
  warning:     'bg-yellow-500/15 text-yellow-400',
  destructive: 'bg-red-500/15 text-red-400',
  info:        'bg-sky-500/15 text-sky-400',
}

export default function StatCard({ icon: Icon, label, value, sub, color = 'accent', trend }: StatCardProps) {
  return (
    <div className="glass rounded-xl p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2.5 rounded-xl', iconStyles[color])}>
          <Icon className="w-[18px] h-[18px]" />
        </div>
        {trend && (
          <span className={cn(
            'flex items-center gap-0.5 text-[11px] font-semibold px-2 py-1 rounded-full',
            trend === 'up' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400',
          )}>
            {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          </span>
        )}
      </div>
      <p className="text-[26px] font-bold text-foreground tracking-tight">{value}</p>
      <p className="text-[13px] text-muted-foreground font-medium mt-1">{label}</p>
      {sub && <p className="text-[12px] text-zinc-500 mt-1">{sub}</p>}
    </div>
  )
}
