import { Wifi, WifiOff, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

interface Props {
  status: 'connected' | 'connecting' | 'disconnected'
  className?: string
}

const config = {
  connected: {
    icon: Wifi,
    label: 'Live',
    className: 'bg-green-50 text-green-700 border-green-200',
    dotClass: 'bg-green-500 pulse-live',
  },
  connecting: {
    icon: Loader2,
    label: 'Connecting...',
    className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    dotClass: 'bg-yellow-500 animate-pulse',
  },
  disconnected: {
    icon: WifiOff,
    label: 'Offline',
    className: 'bg-red-50 text-red-700 border-red-200',
    dotClass: 'bg-red-500',
  },
}

export default function WebSocketStatus({ status, className }: Props) {
  const c = config[status]
  const Icon = c.icon

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
        c.className,
        className
      )}
      title={`WebSocket: ${c.label}`}
    >
      <div className={cn('w-1.5 h-1.5 rounded-full', c.dotClass)} />
      <Icon className={cn('w-3 h-3', status === 'connecting' && 'animate-spin')} />
      <span className="hidden sm:inline">{c.label}</span>
    </div>
  )
}
