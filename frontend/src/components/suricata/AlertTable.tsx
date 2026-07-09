import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Alert } from '../../types'
import { formatDate, severityColor, severityLabel } from '../../lib/utils'

interface Props { alerts: Alert[]; onSelectAlert: (alert: Alert) => void; loading?: boolean }
type SortField = 'timestamp' | 'alert_severity' | 'src_ip' | 'alert_signature'

export default function AlertTable({ alerts, onSelectAlert, loading }: Props) {
  const [sortField, setSortField] = useState<SortField>('timestamp')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const sorted = [...alerts].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    const aVal = a[sortField] ?? ''
    const bVal = b[sortField] ?? ''
    if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * dir
    return String(aVal).localeCompare(String(bVal)) * dir
  })

  const headers: { key: SortField; label: string }[] = [
    { key: 'timestamp', label: 'Time' },
    { key: 'alert_severity', label: 'Severity' },
    { key: 'alert_signature', label: 'Signature' },
    { key: 'src_ip', label: 'Source' },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50/50 text-left">
            {headers.map(h => (
              <th key={h.key} onClick={() => { sortField === h.key ? setSortDir(d => d === 'asc' ? 'desc' : 'asc') : setSortField(h.key); setSortDir('desc') }}
                className="px-6 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none">
                <span className="flex items-center gap-1.5">{h.label}
                  {sortField === h.key && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                </span>
              </th>
            ))}
            <th className="px-6 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Destination</th>
            <th className="px-6 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Proto</th>
          </tr>
        </thead>
        <tbody>
          {loading && alerts.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-slate-400">Loading...</td></tr>}
          {!loading && alerts.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-slate-400">No alerts found</td></tr>}
          {sorted.map((a) => (
            <tr key={a.id} onClick={() => onSelectAlert(a)}
              className="border-t border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors">
              <td className="px-6 py-3.5 text-xs text-slate-500 whitespace-nowrap font-medium">{formatDate(a.timestamp)}</td>
              <td className="px-6 py-3.5">
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${severityColor(a.alert_severity)}`}>
                  {severityLabel(a.alert_severity)}
                </span>
              </td>
              <td className="px-6 py-3.5 text-slate-700 max-w-[300px] truncate font-medium">{a.alert_signature}</td>
              <td className="px-6 py-3.5 font-mono text-xs text-slate-600">{a.src_ip}:{a.src_port}</td>
              <td className="px-6 py-3.5 font-mono text-xs text-slate-600">{a.dest_ip}:{a.dest_port}</td>
              <td className="px-6 py-3.5 text-xs text-slate-500 font-medium">{a.proto}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
