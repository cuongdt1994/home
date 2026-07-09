import { cn } from '../../lib/utils'

interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'unknown'
  label: string
  size?: 'sm' | 'md'
}

const dots = {
  online:  'bg-apple-green shadow-[0_0_8px_rgba(52,199,89,0.35)]',
  offline: 'bg-apple-red',
  unknown: 'bg-apple-border',
}

const sizes = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
}

export default function StatusIndicator({ status, label, size = 'sm' }: StatusIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('rounded-full shrink-0 transition-colors duration-300', dots[status], sizes[size])} />
      <span className="text-[13px] text-apple-text-secondary font-medium">{label}</span>
    </div>
  )
}
