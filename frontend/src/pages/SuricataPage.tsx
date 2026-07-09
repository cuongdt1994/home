import { useEffect, useState, useCallback } from 'react'
import { Search, RefreshCw, Filter } from 'lucide-react'
import AlertTable from '../components/suricata/AlertTable'
import AlertDetail from '../components/suricata/AlertDetail'
import AlertStats from '../components/suricata/AlertStats'
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
    } catch {} finally { setLoading(false) }
  }, [page, filter])

  useEffect(() => { loadAlerts() }, [loadAlerts])

  const openDetail = async (alert: Alert) => {
    setSelectedAlert(alert)
    try { const d = await getAlertDetail(alert.id); setAlertDetail(d) } catch { setAlertDetail(alert) }
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Suricata IDS</h2>
          <p className="text-slate-500 text-sm mt-1">{total.toLocaleString()} alerts · Real-time monitoring</p>
        </div>
        <button onClick={loadAlerts}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-2xl text-sm font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <AlertStats stats={stats} />

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search signatures..." value={filter.search}
            onChange={(e) => { setFilter(f => ({ ...f, search: e.target.value })); setPage(0) }}
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-300 transition-all" />
        </div>
        <select value={filter.severity}
          onChange={(e) => { setFilter(f => ({ ...f, severity: e.target.value })); setPage(0) }}
          className="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20">
          <option value="">All Severities</option>
          <option value="1">🔴 Critical</option>
          <option value="2">🟠 High</option>
          <option value="3">🟡 Medium</option>
          <option value="4">🔵 Low</option>
        </select>
      </div>

      {/* Live ticker */}
      <div className="bg-white rounded-3xl border border-slate-100 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-glow" />
          <span className="text-sm font-semibold text-slate-700">Live Feed</span>
          <span className="text-xs text-slate-400">({recentAlerts.length})</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {recentAlerts.slice(0, 12).map((a) => (
            <div key={`live-${a.id}`}
              onClick={() => openDetail(a)}
              className="shrink-0 text-xs bg-slate-50 hover:bg-slate-100 rounded-xl px-3 py-1.5 border border-slate-100 cursor-pointer transition-all font-medium">
              <span className={cn(a.alert_severity <= 2 ? 'text-rose-600' : 'text-slate-600')}>
                {a.src_ip} → {a.dest_ip}
              </span>
            </div>
          ))}
          {recentAlerts.length === 0 && <span className="text-slate-400 text-xs">No alerts yet...</span>}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <AlertTable alerts={alerts} onSelectAlert={openDetail} loading={loading} />
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-50">
          <span className="text-sm text-slate-500">Page {page + 1} of {Math.ceil(total / 50) || 1} · {total} total</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium disabled:opacity-30 hover:bg-slate-50 transition-all">← Prev</button>
            <button disabled={(page + 1) * 50 >= total} onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium disabled:opacity-30 hover:bg-slate-50 transition-all">Next →</button>
          </div>
        </div>
      </div>

      {selectedAlert && <AlertDetail alert={selectedAlert} rawJson={alertDetail?.raw_json}
        onClose={() => { setSelectedAlert(null); setAlertDetail(null) }} />}
    </div>
  )
}
