import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Alert } from '../../types'
import { formatDate, severityColor, severityLabel } from '../../lib/utils'

interface Props {
  alerts: Alert[]
  onSelectAlert: (alert: Alert) => void
  loading?: boolean
}

type SortField = 'timestamp' | 'alert_severity' | 'src_ip' | 'alert_signature'

export default function AlertTable({ alerts, onSelectAlert, loading }: Props) {
  const [sortField, setSortField] = useState<SortField>('timestamp')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const sorted = [...alerts].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    const aVal = a[sortField] ?? ''
    const bVal = b[sortField] ?? ''
    if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * dir
    return String(aVal).localeCompare(String(bVal)) * dir
  })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
  }

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
          <tr className="bg-surface-50 text-left">
            {headers.map(h => (
              <th
                key={h.key}
                onClick={() => handleSort(h.key)}
                className="px-4 py-3 font-medium text-surface-500 cursor-pointer hover:text-surface-700 select-none"
              >
                <span className="flex items-center gap-1">
                  {h.label}
                  <SortIcon field={h.key} />
                </span>
              </th>
            ))}
            <th className="px-4 py-3 font-medium text-surface-500">Destination</th>
            <th className="px-4 py-3 font-medium text-surface-500">Proto</th>
          </tr>
        </thead>
        <tbody>
          {loading && alerts.length === 0 && (
            <tr><td colSpan={6} className="text-center py-8 text-surface-400">Loading...</td></tr>
          )}
          {!loading && alerts.length === 0 && (
            <tr><td colSpan={6} className="text-center py-8 text-surface-400">No alerts found</td></tr>
          )}
          {sorted.map((a) => (
            <tr
              key={a.id}
              onClick={() => onSelectAlert(a)}
              className="border-t border-surface-100 hover:bg-surface-50 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3 text-xs text-surface-500 whitespace-nowrap">{formatDate(a.timestamp)}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${severityColor(a.alert_severity)}`}>
                  {severityLabel(a.alert_severity)}
                </span>
              </td>
              <td className="px-4 py-3 text-surface-700 max-w-[300px] truncate">{a.alert_signature}</td>
              <td className="px-4 py-3 font-mono text-xs text-surface-600">{a.src_ip}:{a.src_port}</td>
              <td className="px-4 py-3 font-mono text-xs text-surface-600">{a.dest_ip}:{a.dest_port}</td>
              <td className="px-4 py-3 text-xs text-surface-500">{a.proto}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
