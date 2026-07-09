import { ShieldBan, ShieldCheck, User, Bot, Clock } from 'lucide-react'
import type { BlockEvent } from '../../types'
import { formatDate } from '../../lib/utils'

interface Props {
  blocks: BlockEvent[]
}

export default function BlockHistory({ blocks }: Props) {
  if (blocks.length === 0) {
    return (
      <div className="text-center py-8 text-surface-400">
        <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-surface-300" />
        <p className="text-sm">No blocks recorded yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {blocks.map((b) => (
        <div
          key={b.id}
          className="flex items-start gap-3 p-3 rounded-xl bg-surface-50 border border-surface-100 hover:bg-surface-100 transition-colors"
        >
          <div className={`p-2 rounded-lg ${
            b.action === 'block' ? 'bg-red-50' : 'bg-green-50'
          }`}>
            {b.action === 'block' ? (
              <ShieldBan className="w-4 h-4 text-red-500" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-green-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium text-surface-800">{b.target_ip}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                b.action === 'block' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
              }`}>
                {b.action}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-surface-400">
                {b.triggered_by === 'ai' ? <Bot className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
                {b.triggered_by}
              </span>
            </div>
            {b.comment && (
              <p className="text-xs text-surface-500 mt-0.5 truncate">{b.comment}</p>
            )}
            <p className="text-[10px] text-surface-400 mt-1 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {formatDate(b.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
