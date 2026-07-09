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
      <div className={cn('rounded-full animate-spin border-muted border-t-accent', sizes[size])} />
      {label && <p className="text-sm text-muted-foreground font-medium">{label}</p>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn(
      'animate-shimmer rounded-xl bg-gradient-to-r from-muted via-zinc-800 to-muted bg-[length:200%_100%]',
      className,
    )} />
  )
}

export function CardSkeleton() {
  return (
    <div className="glass rounded-xl p-5 space-y-3">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="h-7 w-20 rounded-lg" />
      <Skeleton className="h-4 w-28 rounded-lg" />
    </div>
  )
}
