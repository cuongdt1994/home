import { cn } from '../../lib/utils'

export function severityLabel(severity: number): string {
  const labels: Record<number, string> = { 1: 'Critical', 2: 'High', 3: 'Medium', 4: 'Low' }
  return labels[severity] || 'Unknown'
}

export function severityColor(severity: number): string {
  const colors: Record<number, string> = {
    1: 'bg-rose-50 text-rose-700 border-rose-200',
    2: 'bg-orange-50 text-orange-700 border-orange-200',
    3: 'bg-amber-50 text-amber-700 border-amber-200',
    4: 'bg-slate-50 text-slate-600 border-slate-200',
  }
  return colors[severity] || 'bg-slate-50 text-slate-600 border-slate-200'
}

interface Props { severity: number; label?: string; className?: string }

export default function AlertSeverityBadge({ severity, label }: Props) {
  return (
    <span className={cn('px-2.5 py-1 rounded-full text-[11px] font-bold border', severityColor(severity))}>
      {label || severityLabel(severity)}
    </span>
  )
}
