import { useEffect, useState, useCallback } from 'react'
import { Search, RefreshCw, Shield } from 'lucide-react'
import AlertTable from '../components/suricata/AlertTable'
import AlertDetail from '../components/suricata/AlertDetail'
import AlertStats from '../components/suricata/AlertStats'
import AlertSeverityBadge from '../components/suricata/AlertSeverityBadge'
import { getAlerts, getAlertStats, getAlertDetail } from '../api/client'
import { useAlertStore } from '../stores/alertStore'
import { cn } from '../lib/utils'
import type { Alert } from '../types'

export default function SuricataPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [filter, setFilter] = useState({ severity: '', search: '' })
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [alertDetail, setAlertDetail] = useState<any>(null)
  const recentAlerts = useAlertStore((s) => s.recentAlerts)

  const loadAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '50', offset: String(page * 50) }
      if (filter.severity) params.severity = filter.severity
      if (filter.search) params.search = filter.search
      const [data, st] = await Promise.all([
        getAlerts(params),
        getAlertStats().catch(() => null),
      ])
      setAlerts(data.data || [])
      setTotal(data.total || 0)
      if (st) setStats(st)
    } catch {} finally {
      setLoading(false)
    }
  }, [page, filter])

  useEffect(() => { loadAlerts() }, [loadAlerts])

  const openDetail = async (alert: Alert) => {
    setSelectedAlert(alert)
    try {
      const detail = await getAlertDetail(alert.id)
      setAlertDetail(detail)
    } catch {
      setAlertDetail(alert)
    }
  }

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-surface-900">
            <Shield className="w-6 h-6 inline mr-2 text-primary-500" />
            Suricata IDS/IPS
          </h2>
          <p className="text-surface-500">{total.toLocaleString()} alerts recorded</p>
        </div>
        <button
          onClick={loadAlerts}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <AlertStats stats={stats} />

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search by signature or category..."
            value={filter.search}
            onChange={(e) => { setFilter(f => ({ ...f, search: e.target.value })); setPage(0) }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300"
          />
        </div>
        <select
          value={filter.severity}
          onChange={(e) => { setFilter(f => ({ ...f, severity: e.target.value })); setPage(0) }}
          className="px-4 py-2.5 rounded-xl border border-surface-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          <option value="">All Severities</option>
          <option value="1">Critical</option>
          <option value="2">High</option>
          <option value="3">Medium</option>
          <option value="4">Low</option>
        </select>
      </div>

      {/* Live alert ticker */}
      <div className="bg-white rounded-2xl border border-surface-200 p-3 overflow-hidden">
        <div className="flex items-center gap-2 text-sm text-surface-500 mb-2">
          <div className="w-2 h-2 rounded-full bg-green-500 pulse-live" />
          Live Alerts ({recentAlerts.length})
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {recentAlerts.slice(0, 10).map((a) => (
            <div
              key={`live-${a.id}`}
              className="shrink-0 text-xs bg-surface-50 rounded-lg px-3 py-1.5 border border-surface-200 cursor-pointer hover:bg-surface-100 transition-colors"
              onClick={() => openDetail(a)}
            >
              <span className={cn('font-medium', a.alert_severity <= 2 ? 'text-red-600' : 'text-surface-600')}>
                {a.src_ip} → {a.dest_ip}
              </span>
            </div>
          ))}
          {recentAlerts.length === 0 && (
            <span className="text-surface-400 text-xs">Waiting for alerts...</span>
          )}
        </div>
      </div>

      {/* Alert table */}
      <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
        <AlertTable alerts={alerts} onSelectAlert={openDetail} loading={loading} />

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-surface-100">
          <span className="text-sm text-surface-500">
            Page {page + 1} of {Math.ceil(total / 50) || 1} ({total} total)
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="px-4 py-1.5 rounded-lg border border-surface-200 text-sm disabled:opacity-30 hover:bg-surface-50 transition-colors"
            >
              ← Previous
            </button>
            <button
              disabled={(page + 1) * 50 >= total}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-1.5 rounded-lg border border-surface-200 text-sm disabled:opacity-30 hover:bg-surface-50 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Alert detail modal */}
      {selectedAlert && (
        <AlertDetail
          alert={selectedAlert}
          rawJson={alertDetail?.raw_json}
          onClose={() => { setSelectedAlert(null); setAlertDetail(null) }}
        />
      )}
    </div>
  )
}
