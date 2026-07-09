import { useEffect, useState, useCallback } from 'react'
import { Brain, Shield, History, Zap, ShieldBan, ShieldCheck, Play } from 'lucide-react'
import AiAnalysisPanel from '../components/ai/AiAnalysisPanel'
import BlockHistory from '../components/ai/BlockHistory'
import { getAnalysisHistory, getBlockHistory, getRecentAlerts, analyzeAlert, blockFromAlert } from '../api/client'
import { cn, formatDate } from '../lib/utils'
import type { Analysis, BlockEvent, Alert } from '../types'

export default function AiSecurityPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [blocks, setBlocks] = useState<BlockEvent[]>([])
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([])
  const [selected, setSelected] = useState<Alert | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [a, b, r] = await Promise.allSettled([
        getAnalysisHistory(50).catch(() => []), getBlockHistory(50).catch(() => []), getRecentAlerts(30).catch(() => []),
      ])
      if (a.status === 'fulfilled') { const v = a.value; setAnalyses(Array.isArray(v) ? v : v?.data || []) }
      if (b.status === 'fulfilled') { const v = b.value; setBlocks(Array.isArray(v) ? v : v?.data || []) }
      if (r.status === 'fulfilled') setRecentAlerts(Array.isArray(r.value) ? r.value : [])
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  return (
    <div className="space-y-8 pb-20 lg:pb-0">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">AI Security</h2>
        <p className="text-slate-500 text-sm mt-1">DeepSeek-powered threat analysis</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600"><Shield className="w-5 h-5" /></div>
              <div><h3 className="font-semibold text-slate-900">Recent Alerts</h3><p className="text-xs text-slate-400">Select to analyze with AI</p></div>
            </div>
            <div className="space-y-2 max-h-[450px] overflow-y-auto">
              {loading ? [...Array(5)].map((_, i) => <div key={i} className="h-16 animate-shimmer rounded-2xl" />) :
                recentAlerts.length === 0 ? <p className="text-slate-400 text-center py-8">No alerts</p> :
                recentAlerts.map((a) => (
                  <div key={a.id} onClick={() => setSelected(a)}
                    className={cn('flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border',
                      selected?.id === a.id ? 'bg-brand-50 border-brand-200 shadow-sm' : 'bg-slate-50 border-transparent hover:bg-slate-100')}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{a.alert_signature || 'Unknown'}</p>
                      <p className="text-xs text-slate-400 mt-1">{a.src_ip}:{a.src_port} → {a.dest_ip}:{a.dest_port} · {a.proto}</p>
                    </div>
                    <span className={cn('shrink-0 ml-3 px-2.5 py-1 rounded-full text-[11px] font-bold border',
                      a.alert_severity <= 2 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-600 border-slate-200')}>
                      S{a.alert_severity}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <AiAnalysisPanel alert={selected} onAnalyze={async (id) => { const r = await analyzeAlert(id); await loadData(); return r }}
            onBlock={async (id) => { const r = await blockFromAlert(id); await loadData(); return r }} />
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-violet-50 text-violet-600"><Zap className="w-5 h-5" /></div>
              <h3 className="font-semibold text-slate-900">Overview</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-rose-50 rounded-2xl p-4 text-center"><p className="text-3xl font-bold text-rose-700">{blocks.filter(b => b.action === 'block').length}</p><p className="text-xs font-semibold text-rose-600 mt-1">Blocks</p></div>
              <div className="bg-violet-50 rounded-2xl p-4 text-center"><p className="text-3xl font-bold text-violet-700">{analyses.length}</p><p className="text-xs font-semibold text-violet-600 mt-1">Analyses</p></div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-slate-100 text-slate-600"><History className="w-5 h-5" /></div>
          <div><h3 className="font-semibold text-slate-900">Analysis History</h3><p className="text-xs text-slate-400">{analyses.length} records</p></div>
        </div>
        {loading ? <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-shimmer rounded-2xl" />)}</div> :
          analyses.length === 0 ? <p className="text-slate-400 text-center py-8">No analyses yet</p> :
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {analyses.map((a) => (
              <div key={a.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={cn('px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide',
                      a.decision === 'block' ? 'bg-rose-100 text-rose-700' : a.decision === 'flag' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}>
                      {a.decision}
                    </span>
                    <span className="text-xs text-slate-500">Alert #{a.alert_id}</span>
                  </div>
                  <span className="text-xs text-slate-400">{formatDate(a.analyzed_at)}</span>
                </div>
                <p className="text-sm text-slate-600 mb-3">{a.reasoning}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                    <div className={cn('h-1.5 rounded-full', a.confidence >= 0.7 ? 'bg-emerald-500' : a.confidence >= 0.4 ? 'bg-amber-500' : 'bg-rose-500')}
                      style={{ width: `${Math.round(a.confidence * 100)}%` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-600">{Math.round(a.confidence * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        }
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-rose-50 text-rose-600"><ShieldBan className="w-5 h-5" /></div>
          <div><h3 className="font-semibold text-slate-900">Block History</h3><p className="text-xs text-slate-400">{blocks.length} events</p></div>
        </div>
        <BlockHistory blocks={blocks} />
      </div>
    </div>
  )
}
