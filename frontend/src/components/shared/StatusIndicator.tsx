import { cn } from '../../lib/utils'

interface StatusProps {
  status: 'online' | 'offline' | 'unknown'
  label: string
}

export default function StatusIndicator({ status, label }: StatusProps) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'w-2 h-2 rounded-full',
          status === 'online' && 'bg-green-500',
          status === 'offline' && 'bg-red-500',
          status === 'unknown' && 'bg-gray-300'
        )}
      />
      <span className="text-sm text-surface-600">{label}</span>
    </div>
  )
}
