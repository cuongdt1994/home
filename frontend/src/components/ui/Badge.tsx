import { cn } from '../../lib/utils'

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'info'
type BadgeSize = 'sm' | 'md'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-muted text-muted-foreground border-slate-200',
  primary: 'bg-primary-50 text-primary-700 border-primary-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  destructive: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
}

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-slate-400',
  primary: 'bg-primary-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  destructive: 'bg-red-500',
  info: 'bg-sky-500',
}

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0 text-[10px]',
  md: 'px-2.5 py-0.5 text-xs',
}

/**
 * Compact badge/pill for statuses, tags, counts.
 * Set `dot` to prefix a small colored circle.
 */
export function Badge({
  className,
  variant = 'default',
  size = 'md',
  dot,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColors[variant])} />}
      {children}
    </span>
  )
}
