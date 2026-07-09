import { AlertTriangle, Shield, TrendingUp } from 'lucide-react'
import type { Alert } from '../../types'
import { severityColor, formatRelativeTime } from '../../lib/utils'

interface Props {
  alerts: Alert[]
  maxHeight?: string
}

export default function AlertTimeline({ alerts, maxHeight = '300px' }: Props) {
  return (
    <div className="space-y-2 overflow-y-auto" style={{ maxHeight }}>
      {alerts.length === 0 && (
        <p className="text-sm text-surface-400 text-center py-4">No alerts yet</p>
      )}
      {alerts.slice(0, 20).map((alert) => (
        <div
          key={alert.id}
          className="flex items-start gap-2.5 p-2.5 rounded-xl bg-surface-50 hover:bg-surface-100 transition-colors cursor-pointer border border-surface-100"
        >
          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold border ${severityColor(alert.alert_severity)}`}>
            S{alert.alert_severity}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-surface-800 truncate">
              {alert.alert_signature || 'Unknown signature'}
            </p>
            <p className="text-[11px] text-surface-400 mt-0.5">
              {alert.src_ip} → {alert.dest_ip} · {formatRelativeTime(alert.timestamp)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
