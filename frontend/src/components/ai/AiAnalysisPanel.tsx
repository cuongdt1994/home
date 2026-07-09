import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Play, ShieldBan, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Alert } from '../../types'

interface Props {
  alert: Alert | null
  onAnalyze: (alertId: number) => Promise<any>
  onBlock: (alertId: number) => Promise<any>
}

export default function AiAnalysisPanel({ alert, onAnalyze, onBlock }: Props) {
  const [loading, setLoading] = useState<'analyze' | 'block' | null>(null)
  const [result, setResult] = useState<any>(null)

  if (!alert) {
    return (
      <div className="bg-white rounded-2xl border border-surface-200 p-6 text-center">
        <Brain className="w-10 h-10 text-surface-300 mx-auto mb-3" />
        <p className="text-sm text-surface-500">Select an alert to analyze with AI</p>
      </div>
    )
  }

  const handleAnalyze = async () => {
    setLoading('analyze')
    try {
      const res = await onAnalyze(alert.id)
      setResult(res)
    } catch { setResult({ error: 'Analysis failed' }) }
    setLoading(null)
  }

  const handleBlock = async () => {
    setLoading('block')
    try {
      const res = await onBlock(alert.id)
      setResult(res)
    } catch { setResult({ error: 'Block failed' }) }
    setLoading(null)
  }

  const decisionIcon = result?.decision === 'block'
    ? <ShieldBan className="w-5 h-5 text-red-500" />
    : result?.decision === 'flag'
    ? <AlertTriangle className="w-5 h-5 text-yellow-500" />
    : result?.decision === 'allow'
    ? <CheckCircle className="w-5 h-5 text-green-500" />
    : <XCircle className="w-5 h-5 text-surface-400" />

  return (
    <div className="bg-white rounded-2xl border border-surface-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-5 h-5 text-purple-500" />
        <h3 className="font-semibold text-surface-900">AI Analysis</h3>
      </div>

      {/* Alert summary */}
      <div className="bg-surface-50 rounded-xl p-3 mb-4 text-xs space-y-1">
        <p><span className="text-surface-400">Source:</span> <span className="font-mono">{alert.src_ip}:{alert.src_port}</span></p>
        <p><span className="text-surface-400">Dest:</span> <span className="font-mono">{alert.dest_ip}:{alert.dest_port}</span></p>
        <p><span className="text-surface-400">Signature:</span> <span className="font-medium">{alert.alert_signature?.slice(0, 80)}...</span></p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={handleAnalyze}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors"
        >
          {loading === 'analyze' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Analyze
        </button>
        <button
          onClick={handleBlock}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
        >
          {loading === 'block' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldBan className="w-4 h-4" />}
          Block
        </button>
      </div>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="overflow-hidden"
          >
            <div className={cn(
              'rounded-xl p-4 text-sm',
              result.decision === 'block' ? 'bg-red-50 border border-red-200' :
              result.decision === 'flag' ? 'bg-yellow-50 border border-yellow-200' :
              result.decision === 'allow' ? 'bg-green-50 border border-green-200' :
              'bg-surface-50 border border-surface-200'
            )}>
              <div className="flex items-center gap-2 mb-2">
                {decisionIcon}
                <span className="font-bold uppercase text-sm">{result.decision || 'Error'}</span>
                {result.confidence !== undefined && (
                  <span className="text-xs">({(result.confidence * 100).toFixed(0)}%)</span>
                )}
              </div>
              <p className="text-xs text-surface-600">{result.reasoning || result.error}</p>
              {result.status === 'blocked' && (
                <p className="mt-2 text-xs font-bold text-green-700">✅ IP Blocked — Rule #{result.rule_id}</p>
              )}
              {result.status === 'block_failed' && (
                <p className="mt-2 text-xs font-bold text-red-700">❌ Block failed: {result.error}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
