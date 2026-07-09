import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { formatBytes } from '../../lib/utils'

interface Talker {
  ip?: string
  address?: string
  name?: string
  hostname?: string
  bytes_sent?: number
  sent?: number
  bytes_rcvd?: number
  rcvd?: number
  num_flows?: number
  flows?: number
}

interface Props {
  talkers: Talker[]
  limit?: number
}

export default function TopTalkers({ talkers, limit = 10 }: Props) {
  const display = talkers.slice(0, limit)

  return (
    <div className="space-y-2">
      {display.length === 0 && (
        <p className="text-sm text-surface-400 text-center py-4">No data available</p>
      )}
      {display.map((t, i) => {
        const sent = t.bytes_sent || t.sent || 0
        const rcvd = t.bytes_rcvd || t.rcvd || 0
        const total = sent + rcvd
        const maxTotal = Math.max(...display.map(x => (x.bytes_sent || x.sent || 0) + (x.bytes_rcvd || x.rcvd || 0)), 1)
        const width = (total / maxTotal) * 100

        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-surface-400 w-5">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-sm font-medium text-surface-700 font-mono">
                  {t.ip || t.address || t.name || t.hostname || 'Unknown'}
                </span>
                <span className="text-xs text-surface-500">{formatBytes(total)}</span>
              </div>
              <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(width, 2)}%` }}
                />
              </div>
              <div className="flex gap-3 mt-0.5 text-[10px] text-surface-400">
                <span className="flex items-center gap-0.5"><ArrowUpRight className="w-2.5 h-2.5" />{formatBytes(sent)}</span>
                <span className="flex items-center gap-0.5"><ArrowDownRight className="w-2.5 h-2.5" />{formatBytes(rcvd)}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
