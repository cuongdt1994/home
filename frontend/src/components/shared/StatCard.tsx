import { motion } from 'framer-motion'
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

const gradients = {
  brand: 'from-brand-400 to-brand-600',
  rose: 'from-rose-400 to-rose-600',
  emerald: 'from-emerald-400 to-emerald-600',
  amber: 'from-amber-400 to-amber-600',
  violet: 'from-violet-400 to-violet-600',
  cyan: 'from-cyan-400 to-cyan-600',
}

const iconBg = {
  brand: 'bg-brand-50 text-brand-600',
  rose: 'bg-rose-50 text-rose-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
  cyan: 'bg-cyan-50 text-cyan-600',
}

export default function StatCard({ icon: Icon, label, value, sub, color = 'brand', trend, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1, duration: 0.4 }}
      className="card-hover bg-white rounded-3xl border border-slate-100 p-5 shadow-sm"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2.5 rounded-2xl', iconBg[color])}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={cn(
            'flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full',
            trend === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
          )}>
            {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend === 'up' ? '+' : '-'}
          </span>
        )}
      </div>
      <p className="text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
      <p className="text-sm text-slate-500 font-medium mt-1">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </motion.div>
  )
}
