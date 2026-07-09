import { useEffect, useState, useCallback } from 'react'
import { Search, RefreshCw, ChevronDown, ChevronUp, X } from 'lucide-react'
import { getAlerts, getAlertStats, getAlertDetail } from '../api/client'
import { cn, formatDate, formatRelativeTime } from '../lib/utils'
import type { Alert } from '../types'

const sevLabel: Record<number, string> = { 1: 'Critical', 2: 'High', 3: 'Medium', 4: 'Low' }
const sevColor: Record<number, string> = {
  1: 'bg-red-50 text-red-700 border-red-200', 2: 'bg-orange-50 text-orange-700 border-orange-200',
  3: 'bg-yellow-50 text-yellow-700 border-yellow-200', 4: 'bg-slate-50 text-slate-600 border-slate-200',
}

export default function SuricataPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [stats, setStats] = useState<any>(null)
  const [filter, setFilter] = useState({ severity: '', search: '' })
  const [selected, setSelected] = useState<Alert | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState<string>('timestamp')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '100', offset: String(page * 100) }
      if (filter.severity) params.severity = filter.severity
      if (filter.search) params.search = filter.search
      const [d, s] = await Promise.all([getAlerts(params), getAlertStats().catch(() => null)])
      setAlerts(d.data || [])
      setTotal(d.total || 0)
      if (s) setStats(s)
    } catch {} finally { setLoading(false) }
  }, [page, filter])

  useEffect(() => { load() }, [load])

  const openDetail = async (a: Alert) => { setSelected(a); try { setDetail(await getAlertDetail(a.id)) } catch { setDetail(a) } }

  const sorted = [...alerts].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    const av = (a as any)[sortField] ?? ''; const bv = (b as any)[sortField] ?? ''
    return typeof av === 'number' ? (av - bv) * dir : String(av).localeCompare(String(bv)) * dir
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight">Suricata IDS</h2><p className="text-sm text-muted-foreground mt-1">{total.toLocaleString()} alerts</p></div>
        <button onClick={load} className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { l: 'Total', v: stats.total_alerts, c: 'bg-slate-50 text-slate-700' },
            { l: 'Critical', v: stats.critical, c: 'bg-red-50 text-red-700' },
            { l: 'High', v: stats.high, c: 'bg-orange-50 text-orange-700' },
            { l: 'Today', v: stats.today, c: 'bg-blue-50 text-blue-700' },
          ].map((s, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{s.v.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input placeholder="Search alerts..." value={filter.search}
            onChange={e => { setFilter(f => ({ ...f, search: e.target.value })); setPage(0) }}
            className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-transparent text-sm outline-none focus:ring-2 focus:ring-ring focus:border-primary" />
        </div>
        <select value={filter.severity}
          onChange={e => { setFilter(f => ({ ...f, severity: e.target.value })); setPage(0) }}
          className="h-9 px-3 rounded-lg border border-input bg-transparent text-sm outline-none">
          <option value="">All Severities</option>
          <option value="1">Critical</option><option value="2">High</option><option value="3">Medium</option><option value="4">Low</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-secondary/50">
              {['timestamp', 'alert_severity', 'alert_signature', 'src_ip'].map(f => (
                <th key={f} onClick={() => { sortField === f ? setSortDir(d => d === 'asc' ? 'desc' : 'asc') : setSortField(f) }}
                  className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none">
                  <span className="flex items-center gap-1">{f === 'alert_severity' ? 'Sev' : f === 'alert_signature' ? 'Signature' : f === 'src_ip' ? 'Source' : 'Time'}
                    {sortField === f && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dest</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Proto</th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Loading...</td></tr>}
              {!loading && sorted.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No alerts found</td></tr>}
              {sorted.map(a => (
                <tr key={a.id} onClick={() => openDetail(a)} className="border-b border-border hover:bg-secondary/30 cursor-pointer transition-colors">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(a.timestamp)}</td>
                  <td className="px-4 py-2.5"><span className={cn('px-2 py-0.5 rounded text-[10px] font-bold border', sevColor[a.alert_severity])}>{sevLabel[a.alert_severity]}</span></td>
                  <td className="px-4 py-2.5 font-medium max-w-[300px] truncate">{a.alert_signature}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{a.src_ip}:{a.src_port}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{a.dest_ip}:{a.dest_port}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{a.proto}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <span className="text-sm text-muted-foreground">Page {page + 1} of {Math.ceil(total / 100) || 1} ({total} total)</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="h-8 px-3 rounded-md border border-input text-sm disabled:opacity-30 hover:bg-accent">Prev</button>
            <button disabled={(page + 1) * 100 >= total} onClick={() => setPage(p => p + 1)} className="h-8 px-3 rounded-md border border-input text-sm disabled:opacity-30 hover:bg-accent">Next</button>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => { setSelected(null); setDetail(null) }}>
          <div onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-xl shadow-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold">Alert Detail</h3>
              <button onClick={() => { setSelected(null); setDetail(null) }} className="p-1 rounded-md hover:bg-secondary"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Time:</span> <span className="font-medium">{formatDate(selected.timestamp)}</span></div>
                <div><span className="text-muted-foreground">Severity:</span> <span className={cn('px-2 py-0.5 rounded text-xs font-bold border', sevColor[selected.alert_severity])}>{sevLabel[selected.alert_severity]}</span></div>
                <div><span className="text-muted-foreground">Source:</span> <span className="font-mono font-medium">{selected.src_ip}:{selected.src_port}</span></div>
                <div><span className="text-muted-foreground">Dest:</span> <span className="font-mono font-medium">{selected.dest_ip}:{selected.dest_port}</span></div>
                <div><span className="text-muted-foreground">Proto:</span> {selected.proto}</div>
                <div><span className="text-muted-foreground">Category:</span> {selected.alert_category}</div>
              </div>
              <div><span className="text-muted-foreground">Signature:</span> <p className="font-medium mt-1">{selected.alert_signature}</p></div>
              {detail?.raw_json && (
                <details><summary className="text-sm text-primary cursor-pointer font-medium">Raw JSON</summary>
                  <pre className="bg-secondary rounded-lg p-3 text-xs mt-2 overflow-x-auto">{JSON.stringify(detail.raw_json, null, 2)}</pre>
                </details>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
