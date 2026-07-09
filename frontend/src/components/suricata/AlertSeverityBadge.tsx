interface Props {
  severity: number
  label?: string
}

export function severityLabel(severity: number): string {
  switch (severity) {
    case 1: return 'Critical'
    case 2: return 'High'
    case 3: return 'Medium'
    default: return 'Low'
  }
}

export function severityColor(severity: number): string {
  switch (severity) {
    case 1: return 'bg-red-50 text-red-700 border-red-200'
    case 2: return 'bg-orange-50 text-orange-700 border-orange-200'
    case 3: return 'bg-yellow-50 text-yellow-700 border-yellow-200'
    default: return 'bg-slate-50 text-slate-600 border-slate-200'
  }
}

export default function AlertSeverityBadge({ severity, label }: Props) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${severityColor(severity)}`}>
      {label || severityLabel(severity)}
    </span>
  )
}
