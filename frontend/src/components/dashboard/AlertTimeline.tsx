import { AlertTriangle, ArrowRight } from 'lucide-react'
import type { Alert } from '../../types'
import { formatRelativeTime, severityColor } from '../../lib/utils'

interface Props { alerts: Alert[]; maxHeight?: string }

export default function AlertTimeline({ alerts, maxHeight = '300px' }: Props) {
  return (
    <div className="space-y-2 overflow-y-auto" style={{ maxHeight }}>
      {alerts.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Waiting for alerts...</p>}
      {alerts.slice(0, 15).map((alert, i) => (
        <div key={alert.id || i}
          className="group flex items-start gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-all cursor-pointer border border-transparent hover:border-slate-100">
          <div className={`shrink-0 w-2 h-2 rounded-full mt-2 ${alert.alert_severity <= 2 ? 'bg-rose-500 animate-pulse-glow' : 'bg-amber-400'}`} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800 truncate">{alert.alert_signature || 'Unknown'}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] font-mono text-slate-500">{alert.src_ip}</span>
              <ArrowRight className="w-3 h-3 text-slate-300" />
              <span className="text-[11px] font-mono text-slate-500">{alert.dest_ip}</span>
              <span className="text-[10px] text-slate-400 ml-auto">{formatRelativeTime(alert.timestamp)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
