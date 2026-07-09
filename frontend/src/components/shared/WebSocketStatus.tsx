import { cn } from '../../lib/utils'

interface WebSocketStatusProps {
  status: 'connected' | 'connecting' | 'disconnected'
  className?: string
}

const styles = {
  connected: {
    dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
    label: 'Live',
  },
  connecting: {
    dot: 'bg-amber-500 animate-pulse',
    text: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
    label: '...',
  },
  disconnected: {
    dot: 'bg-rose-500',
    text: 'text-rose-700',
    bg: 'bg-rose-50 border-rose-200',
    label: 'Off',
  },
}

export default function WebSocketStatus({
  status,
  className,
}: WebSocketStatusProps) {
  const s = styles[status]
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
        s.bg,
        s.text,
        className,
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
      {s.label}
    </div>
  )
}
