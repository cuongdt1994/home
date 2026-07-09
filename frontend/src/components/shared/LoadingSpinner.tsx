import { cn } from '../../lib/utils'

export default function LoadingSpinner({ className, label }: { size?: string; className?: string; label?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-12', className)}>
      <div className="w-10 h-10 border-3 border-slate-200 border-t-brand-500 rounded-full animate-spin" />
      {label && <p className="text-sm text-slate-400 font-medium">{label}</p>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-shimmer rounded-xl', className)} />
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-5 space-y-3">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-4 w-28" />
    </div>
  )
}
