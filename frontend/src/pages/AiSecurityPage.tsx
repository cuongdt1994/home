import { useEffect, useState, useCallback } from 'react'
import { Brain, Shield, History, Zap, ShieldBan, Play, Loader2, AlertTriangle, CheckCircle, X } from 'lucide-react'
import { getAnalysisHistory, getBlockHistory, getRecentAlerts, analyzeAlert, blockFromAlert } from '../api/client'
import { cn, formatDate } from '../lib/utils'
import type { Analysis, BlockEvent, Alert } from '../types'

export default function AiSecurityPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [blocks, setBlocks] = useState<BlockEvent[]>([])
  const [recent, setRecent] = useState<Alert[]>([])
  const [selected, setSelected] = useState<Alert | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [result, setResult] = useState<any>(null)

  const load = useCallback(async () => {
    try {
      const [a, b, r] = await Promise.allSettled([
        getAnalysisHistory(50).catch(() => []), getBlockHistory(50).catch(() => []), getRecentAlerts(30).catch(() => []),
      ])
      if (a.status === 'fulfilled') { const v = a.value; setAnalyses(Array.isArray(v) ? v : v?.data || []) }
      if (b.status === 'fulfilled') { const v = b.value; setBlocks(Array.isArray(v) ? v : v?.data || []) }
      if (r.status === 'fulfilled') setRecent(Array.isArray(r.value) ? r.value : [])
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handle = async (type: 'analyze' | 'block') => {
    if (!selected) return
    setActing(true)
    try { setResult(type === 'analyze' ? await analyzeAlert(selected.id) : await blockFromAlert(selected.id)); await load() }
    catch { setResult({ error: 'Request failed' }) }
    setActing(false)
  }

  const sevColor = (s: number) => s <= 2 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200'

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold tracking-tight">AI Security</h2><p className="text-sm text-muted-foreground mt-1">DeepSeek threat analysis</p></div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-xl shadow-sm p-6">
            <h3 className="font-semibold mb-4">Recent Alerts</h3>
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {loading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-secondary rounded-lg animate-pulse" />) :
                recent.map(a => (
                  <div key={a.id} onClick={() => setSelected(a)}
                    className={cn('flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors border',
                      selected?.id === a.id ? 'bg-accent border-primary/20' : 'border-transparent hover:bg-secondary/50')}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{a.alert_signature || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.src_ip} → {a.dest_ip} · {a.proto}</p>
                    </div>
                    <span className={cn('shrink-0 ml-2 px-2 py-0.5 rounded text-[10px] font-bold border', sevColor(a.alert_severity))}>S{a.alert_severity}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* AI Panel */}
          <div className="bg-card border border-border rounded-xl shadow-sm p-6">
            <h3 className="font-semibold mb-4">AI Analysis</h3>
            {!selected ? (
              <div className="text-center py-8">
                <Brain className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Select an alert to analyze</p>
              </div>
            ) : (
              <>
                <div className="bg-secondary rounded-lg p-3 text-xs space-y-1 mb-4">
                  <p><span className="text-muted-foreground">Src:</span> <span className="font-mono font-medium">{selected.src_ip}:{selected.src_port}</span></p>
                  <p><span className="text-muted-foreground">Dst:</span> <span className="font-mono font-medium">{selected.dest_ip}:{selected.dest_port}</span></p>
                  <p className="truncate text-muted-foreground">{selected.alert_signature?.slice(0, 80)}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handle('analyze')} disabled={acting}
                    className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40">
                    {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Analyze
                  </button>
                  <button onClick={() => handle('block')} disabled={acting}
                    className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-40">
                    {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldBan className="w-4 h-4" />} Block
                  </button>
                </div>
                {result && (
                  <div className={cn('mt-4 rounded-lg p-3 text-sm border',
                    result.decision === 'block' ? 'bg-red-50 border-red-200' : result.decision === 'flag' ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200')}>
                    <p className="font-bold uppercase text-xs">{result.decision || 'Error'}{(result.confidence ?? 0) > 0 && ` (${Math.round((result.confidence || 0) * 100)}%)`}</p>
                    <p className="text-xs mt-1">{result.reasoning || result.error}</p>
                    {result.status === 'blocked' && <p className="text-xs font-bold mt-1 text-green-700">✅ Blocked — Rule #{result.rule_id}</p>}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Stats */}
          <div className="bg-card border border-border rounded-xl shadow-sm p-6">
            <h3 className="font-semibold mb-4">Overview</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-50 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-red-700">{blocks.filter(b => b.action === 'block').length}</p><p className="text-xs text-red-600 font-medium mt-1">Blocks</p></div>
              <div className="bg-violet-50 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-violet-700">{analyses.length}</p><p className="text-xs text-violet-600 font-medium mt-1">Analyses</p></div>
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-6">
        <h3 className="font-semibold mb-4">Analysis History ({analyses.length})</h3>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {analyses.map(a => (
            <div key={a.id} className="p-4 rounded-lg border border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold uppercase', a.decision === 'block' ? 'bg-red-100 text-red-700' : a.decision === 'flag' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700')}>{a.decision}</span>
                  <span className="text-xs text-muted-foreground">Alert #{a.alert_id}</span>
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(a.analyzed_at)}</span>
              </div>
              <p className="text-sm text-muted-foreground">{a.reasoning}</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', a.confidence >= 0.7 ? 'bg-green-500' : a.confidence >= 0.4 ? 'bg-yellow-500' : 'bg-red-500')}
                    style={{ width: `${Math.round(a.confidence * 100)}%` }} />
                </div>
                <span className="text-xs font-medium">{Math.round(a.confidence * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Block history */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-6">
        <h3 className="font-semibold mb-4">Block History ({blocks.length})</h3>
        {blocks.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No blocks yet</p> : (
          <div className="space-y-2">
            {blocks.map(b => (
              <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <ShieldBan className="w-4 h-4 text-red-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className="font-mono font-bold text-sm">{b.target_ip}</span><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700">{b.action}</span></div>
                  <p className="text-xs text-muted-foreground">{b.comment} · {b.triggered_by} · {formatDate(b.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
