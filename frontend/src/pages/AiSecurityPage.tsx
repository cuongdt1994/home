import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Brain, Shield, History, Zap } from 'lucide-react'
import AiAnalysisPanel from '../components/ai/AiAnalysisPanel'
import BlockHistory from '../components/ai/BlockHistory'
import { CardSkeleton } from '../components/shared/LoadingSpinner'
import { getAnalysisHistory, getBlockHistory, getRecentAlerts, analyzeAlert, blockFromAlert } from '../api/client'
import { cn, severityColor, formatDate } from '../lib/utils'
import type { Analysis, BlockEvent, Alert } from '../types'

export default function AiSecurityPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [blocks, setBlocks] = useState<BlockEvent[]>([])
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([])
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [a, b, r] = await Promise.allSettled([
        getAnalysisHistory(50).catch(() => []),
        getBlockHistory(50).catch(() => []),
        getRecentAlerts(30).catch(() => []),
      ])
      if (a.status === 'fulfilled') {
        const val = a.value
        setAnalyses(Array.isArray(val) ? val : val?.data || [])
      }
      if (b.status === 'fulfilled') {
        const val = b.value
        setBlocks(Array.isArray(val) ? val : val?.data || [])
      }
      if (r.status === 'fulfilled') {
        setRecentAlerts(Array.isArray(r.value) ? r.value : [])
      }
    } catch {} finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleAnalyze = async (alertId: number) => {
    const res = await analyzeAlert(alertId)
    await loadData()
    return res
  }

  const handleBlock = async (alertId: number) => {
    const res = await blockFromAlert(alertId)
    await loadData()
    return res
  }

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <div>
        <h2 className="text-2xl font-bold text-surface-900">
          <Brain className="w-6 h-6 inline mr-2 text-purple-500" />
          AI Security
        </h2>
        <p className="text-surface-500">DeepSeek-powered threat analysis & automatic blocking</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Alert list + analysis panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-surface-200 p-5">
            <h3 className="font-semibold text-surface-900 mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-yellow-500" />
              Recent Alerts for Analysis
            </h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 bg-surface-100 rounded-xl animate-pulse" />
                ))
              ) : recentAlerts.length === 0 ? (
                <p className="text-sm text-surface-400 text-center py-8">No alerts available</p>
              ) : (
                recentAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => setSelectedAlert(alert)}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border',
                      selectedAlert?.id === alert.id
                        ? 'bg-primary-50 border-primary-200 shadow-sm'
                        : 'bg-surface-50 border-surface-100 hover:bg-surface-100'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-surface-800 truncate">
                        {alert.alert_signature || 'Unknown signature'}
                      </p>
                      <p className="text-xs text-surface-400 mt-0.5">
                        {alert.src_ip}:{alert.src_port} → {alert.dest_ip}:{alert.dest_port} · {alert.proto}
                      </p>
                    </div>
                    <span className={`shrink-0 ml-2 px-2 py-0.5 rounded text-[10px] font-bold border ${severityColor(alert.alert_severity)}`}>
                      S{alert.alert_severity}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: AI analysis panel */}
        <div className="space-y-4">
          <AiAnalysisPanel
            alert={selectedAlert}
            onAnalyze={handleAnalyze}
            onBlock={handleBlock}
          />

          {/* Stats */}
          <div className="bg-white rounded-2xl border border-surface-200 p-5">
            <h3 className="font-semibold text-surface-900 mb-3 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Overview
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{blocks.filter(b => b.action === 'block').length}</p>
                <p className="text-xs text-red-600 font-medium">Blocks</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-purple-700">{analyses.length}</p>
                <p className="text-xs text-purple-600 font-medium">Analyses</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis history */}
      <div className="bg-white rounded-2xl border border-surface-200 p-5">
        <h3 className="font-semibold text-surface-900 mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-surface-500" />
          Analysis History
        </h3>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-surface-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : analyses.length === 0 ? (
          <p className="text-sm text-surface-400 text-center py-8">No analyses yet. Select an alert to analyze.</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {analyses.map((a) => (
              <div key={a.id} className="p-4 rounded-xl bg-surface-50 border border-surface-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                      a.decision === 'block' ? 'bg-red-100 text-red-700' :
                      a.decision === 'flag' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    )}>
                      {a.decision}
                    </span>
                    <span className="text-xs text-surface-500">Alert #{a.alert_id}</span>
                  </div>
                  <span className="text-xs text-surface-400">{formatDate(a.analyzed_at)}</span>
                </div>
                <p className="text-sm text-surface-700">{a.reasoning}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 bg-surface-200 rounded-full h-1.5">
                    <div
                      className={cn(
                        'h-1.5 rounded-full transition-all duration-700',
                        a.confidence >= 0.7 ? 'bg-green-500' : a.confidence >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                      )}
                      style={{ width: `${Math.round(a.confidence * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-surface-600">{Math.round(a.confidence * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Block history */}
      <div className="bg-white rounded-2xl border border-surface-200 p-5">
        <h3 className="font-semibold text-surface-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-500" />
          Block History
        </h3>
        <BlockHistory blocks={blocks} />
      </div>
    </div>
  )
}
