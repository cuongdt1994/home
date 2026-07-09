import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  sub?: string
  color?: 'brand' | 'rose' | 'emerald' | 'amber' | 'violet' | 'cyan'
  trend?: 'up' | 'down'
  delay?: number
}

const iconBg: Record<NonNullable<StatCardProps['color']>, string> = {
  brand:   'bg-primary-50 text-primary-600',
  rose:    'bg-rose-50 text-rose-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber:   'bg-amber-50 text-amber-600',
  violet:  'bg-violet-50 text-violet-600',
  cyan:    'bg-cyan-50 text-cyan-600',
}

export default function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'brand',
  trend,
}: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-xs transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2.5 rounded-xl', iconBg[color])}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full',
              trend === 'up'
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-rose-50 text-rose-600',
            )}
          >
            {trend === 'up' ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
      <p className="text-sm text-muted-foreground font-medium mt-1">{label}</p>
      {sub && <p className="text-xs text-muted-foreground/70 mt-1">{sub}</p>}
    </div>
  )
}
