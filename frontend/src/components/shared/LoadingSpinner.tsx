import { cn } from '../../lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}

const sizes = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-[3px]',
  lg: 'w-12 h-12 border-4',
}

export default function LoadingSpinner({ size = 'md', className, label }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 py-16', className)}>
      <div className={cn(
        'rounded-full animate-spin border-[#e8e8ed] border-t-apple-blue',
        sizes[size],
      )} />
      {label && (
        <p className="text-sm text-apple-text-secondary font-medium">{label}</p>
      )}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn(
      'animate-shimmer rounded-2xl',
      'bg-gradient-to-r from-[#f0f0f5] via-[#fafafa] to-[#f0f0f5] bg-[length:200%_100%]',
      className,
    )} />
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-apple-border-light p-5 space-y-3 shadow-sm">
      <Skeleton className="h-10 w-10 rounded-2xl" />
      <Skeleton className="h-7 w-20 rounded-lg" />
      <Skeleton className="h-4 w-28 rounded-lg" />
    </div>
  )
}
