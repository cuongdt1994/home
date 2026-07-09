import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  sub?: string
  color?: 'blue' | 'red' | 'green' | 'orange' | 'purple' | 'teal'
  trend?: 'up' | 'down'
}

const iconStyles: Record<NonNullable<StatCardProps['color']>, string> = {
  blue:   'bg-[#e8f4fd] text-apple-blue',
  red:    'bg-[#fde8e8] text-apple-red',
  green:  'bg-[#e8f8ee] text-[#248a3d]',
  orange: 'bg-[#fef3e6] text-[#c76f00]',
  purple: 'bg-[#f3e8fa] text-[#8944ab]',
  teal:   'bg-[#e6f6fa] text-[#007c8c]',
}

const trendColors: Record<'up' | 'down', string> = {
  up:   'bg-[#e8f8ee] text-[#248a3d]',
  down: 'bg-[#fde8e8] text-apple-red',
}

export default function StatCard({ icon: Icon, label, value, sub, color = 'blue', trend }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-apple-border-light p-5 shadow-sm
      transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between mb-3.5">
        <div className={cn('p-2.5 rounded-2xl', iconStyles[color])}>
          <Icon className="w-[18px] h-[18px]" />
        </div>
        {trend && (
          <span className={cn(
            'flex items-center gap-0.5 text-[11px] font-semibold px-2 py-1 rounded-full',
            trendColors[trend],
          )}>
            {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          </span>
        )}
      </div>
      <p className="text-[28px] font-semibold text-apple-text tracking-tight leading-tight">{value}</p>
      <p className="text-[13px] text-apple-text-secondary font-medium mt-1">{label}</p>
      {sub && <p className="text-[12px] text-apple-text-tertiary mt-1">{sub}</p>}
    </div>
  )
}
