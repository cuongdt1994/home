import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Play, ShieldBan, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Alert } from '../../types'

interface Props { alert: Alert | null; onAnalyze: (id: number) => Promise<any>; onBlock: (id: number) => Promise<any> }

export default function AiAnalysisPanel({ alert, onAnalyze, onBlock }: Props) {
  const [loading, setLoading] = useState<'analyze' | 'block' | null>(null)
  const [result, setResult] = useState<any>(null)

  if (!alert) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
          <Brain className="w-8 h-8 text-violet-400" />
        </div>
        <p className="text-sm font-medium text-slate-500">Select an alert to analyze with AI</p>
        <p className="text-xs text-slate-400 mt-1">DeepSeek will evaluate the threat</p>
      </div>
    )
  }

  const handle = async (type: 'analyze' | 'block') => {
    setLoading(type)
    try { setResult(type === 'analyze' ? await onAnalyze(alert.id) : await onBlock(alert.id)) } catch { setResult({ error: 'Failed' }) }
    setLoading(null)
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 rounded-xl bg-violet-50 text-violet-600"><Brain className="w-5 h-5" /></div>
        <div><h3 className="font-semibold text-slate-900">AI Analysis</h3><p className="text-xs text-slate-400">DeepSeek threat evaluation</p></div>
      </div>

      <div className="bg-slate-50 rounded-2xl p-4 mb-5 text-sm space-y-1.5">
        <p><span className="text-slate-400">Source:</span> <span className="font-mono font-semibold">{alert.src_ip}:{alert.src_port}</span></p>
        <p><span className="text-slate-400">Target:</span> <span className="font-mono font-semibold">{alert.dest_ip}:{alert.dest_port}</span></p>
        <p className="text-xs text-slate-500 truncate">{alert.alert_signature?.slice(0, 80)}</p>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => handle('analyze')} disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-violet-500 text-white rounded-2xl text-sm font-semibold hover:bg-violet-600 disabled:opacity-40 transition-all shadow-lg shadow-violet-500/20">
          {loading === 'analyze' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Analyze
        </button>
        <button onClick={() => handle('block')} disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-rose-500 text-white rounded-2xl text-sm font-semibold hover:bg-rose-600 disabled:opacity-40 transition-all shadow-lg shadow-rose-500/20">
          {loading === 'block' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldBan className="w-4 h-4" />} Block
        </button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className={cn('rounded-2xl p-4', result.decision === 'block' ? 'bg-rose-50 border border-rose-100' :
              result.decision === 'flag' ? 'bg-amber-50 border border-amber-100' :
              result.decision === 'allow' ? 'bg-emerald-50 border border-emerald-100' : 'bg-slate-50 border border-slate-100')}>
            <div className="flex items-center gap-2 mb-2">
              {result.decision === 'block' ? <ShieldBan className="w-5 h-5 text-rose-600" /> :
                result.decision === 'flag' ? <AlertTriangle className="w-5 h-5 text-amber-600" /> :
                <CheckCircle className="w-5 h-5 text-emerald-600" />}
              <span className="font-bold uppercase text-sm">{result.decision}</span>
              {result.confidence != null && <span className="text-xs font-medium">({Math.round(result.confidence * 100)}%)</span>}
            </div>
            <p className="text-xs text-slate-600">{result.reasoning || result.error}</p>
            {result.status === 'blocked' && <p className="mt-2 text-xs font-bold text-emerald-700">✅ Blocked — Rule #{result.rule_id}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
