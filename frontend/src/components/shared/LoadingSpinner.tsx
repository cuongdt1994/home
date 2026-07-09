import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}

const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }

export default function LoadingSpinner({ size = 'md', className, label }: Props) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-8', className)}>
      <Loader2 className={cn(sizes[size], 'animate-spin text-primary-500')} />
      {label && <p className="text-sm text-surface-400">{label}</p>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse bg-surface-200 rounded-lg', className)} />
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-surface-200 p-5 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}
