import { ShieldBan, ShieldCheck, User, Bot, Clock } from 'lucide-react'
import type { BlockEvent } from '../../types'
import { formatDate } from '../../lib/utils'

interface Props { blocks: BlockEvent[] }

export default function BlockHistory({ blocks }: Props) {
  if (blocks.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-8 h-8 text-emerald-400" />
        </div>
        <p className="text-sm font-medium text-slate-500">No blocks recorded</p>
        <p className="text-xs text-slate-400 mt-1">All traffic is currently passing</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {blocks.map((b) => (
        <div key={b.id} className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-all">
          <div className={`p-2.5 rounded-xl ${b.action === 'block' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {b.action === 'block' ? <ShieldBan className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-slate-800">{b.target_ip}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${b.action === 'block' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {b.action}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                {b.triggered_by === 'ai' ? <Bot className="w-2.5 h-2.5 text-violet-500" /> : <User className="w-2.5 h-2.5" />}
                {b.triggered_by}
              </span>
            </div>
            {b.comment && <p className="text-xs text-slate-500 mt-1 truncate">{b.comment}</p>}
            <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{formatDate(b.created_at)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
