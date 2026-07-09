import { cn } from '../../lib/utils'

interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'unknown'
  label: string
  size?: 'sm' | 'md'
}

const dotStyles = {
  online: 'bg-emerald-500',
  offline: 'bg-red-500',
  unknown: 'bg-slate-300',
}

const sizeStyles = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2.5 h-2.5',
}

export default function StatusIndicator({
  status,
  label,
  size = 'sm',
}: StatusIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'rounded-full shrink-0',
          dotStyles[status],
          sizeStyles[size],
          status === 'online' && 'shadow-[0_0_6px_rgba(16,185,129,0.4)]',
        )}
      />
      <span className="text-sm text-muted-foreground font-medium">{label}</span>
    </div>
  )
}
