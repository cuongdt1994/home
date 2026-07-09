import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  sub?: string
  color?: 'blue' | 'red' | 'green' | 'yellow' | 'slate'
  trend?: 'up' | 'down'
}

const colors = {
  blue: 'bg-blue-50 text-blue-600 border-blue-100',
  red: 'bg-red-50 text-red-600 border-red-100',
  green: 'bg-green-50 text-green-600 border-green-100',
  yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100',
  slate: 'bg-slate-50 text-slate-600 border-slate-100',
}

export default function StatCard({ icon: Icon, label, value, sub, color = 'blue', trend }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-surface-200 p-5 hover:shadow-md transition-shadow duration-300"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-surface-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-surface-900 mt-1">{value}</p>
          {sub && (
            <p className="text-xs text-surface-400 mt-1">{sub}</p>
          )}
        </div>
        <div className={cn('p-3 rounded-xl border', colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  )
}
