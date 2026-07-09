import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { Alert } from '../../types'
import { formatDate, severityColor, severityLabel } from '../../lib/utils'

interface Props {
  alert: Alert
  rawJson?: Record<string, any>
  onClose: () => void
}

export default function AlertDetail({ alert, rawJson, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-6 pb-4 border-b border-surface-100">
          <h3 className="text-lg font-bold text-surface-900">Alert Detail</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-100">
            <X className="w-4 h-4 text-surface-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-surface-400 block text-xs mb-0.5">Timestamp</span>
              <span className="font-medium text-surface-800">{formatDate(alert.timestamp)}</span>
            </div>
            <div>
              <span className="text-surface-400 block text-xs mb-0.5">Severity</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${severityColor(alert.alert_severity)}`}>
                {severityLabel(alert.alert_severity)}
              </span>
            </div>
            <div>
              <span className="text-surface-400 block text-xs mb-0.5">Source</span>
              <span className="font-mono font-medium">{alert.src_ip}:{alert.src_port}</span>
            </div>
            <div>
              <span className="text-surface-400 block text-xs mb-0.5">Destination</span>
              <span className="font-mono font-medium">{alert.dest_ip}:{alert.dest_port}</span>
            </div>
            <div>
              <span className="text-surface-400 block text-xs mb-0.5">Protocol</span>
              <span className="font-medium">{alert.proto}</span>
            </div>
            <div>
              <span className="text-surface-400 block text-xs mb-0.5">Category</span>
              <span className="font-medium">{alert.alert_category || 'Unknown'}</span>
            </div>
          </div>
          <div>
            <span className="text-surface-400 block text-xs mb-1">Signature</span>
            <p className="font-medium text-surface-800 bg-surface-50 rounded-xl p-3 text-sm">
              {alert.alert_signature}
            </p>
          </div>
          {rawJson && (
            <details className="group">
              <summary className="text-sm text-primary-500 cursor-pointer hover:text-primary-600 font-medium">
                Raw JSON
              </summary>
              <pre className="bg-surface-50 rounded-xl p-3 text-xs mt-2 overflow-x-auto max-h-60">
                {JSON.stringify(rawJson, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </motion.div>
    </div>
  )
}
