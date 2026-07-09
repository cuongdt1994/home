import { cn } from '../../lib/utils'

interface WebSocketStatusProps {
  status: 'connected' | 'connecting' | 'disconnected'
  className?: string
}

const styles = {
  connected: {
    dot: 'bg-apple-green shadow-[0_0_8px_rgba(52,199,89,0.4)]',
    text: 'text-[#248a3d]',
    bg: 'bg-[#e8f8ee]',
    label: 'Live',
  },
  connecting: {
    dot: 'bg-apple-orange animate-pulse',
    text: 'text-[#c76f00]',
    bg: 'bg-[#fef3e6]',
    label: '...',
  },
  disconnected: {
    dot: 'bg-apple-red',
    text: 'text-[#cc1f1f]',
    bg: 'bg-[#fde8e8]',
    label: 'Off',
  },
}

export default function WebSocketStatus({ status, className }: WebSocketStatusProps) {
  const s = styles[status]
  return (
    <div className={cn(
      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-300',
      s.bg, s.text, className,
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
      {s.label}
    </div>
  )
}
