import { cn } from '../../lib/utils'

type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'destructive' | 'info'
type BadgeSize = 'sm' | 'md'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
}

const variantStyles: Record<BadgeVariant, string> = {
  default:     'bg-muted text-muted-foreground',
  accent:      'bg-accent/15 text-accent-400',
  success:     'bg-green-500/15 text-green-400',
  warning:     'bg-yellow-500/15 text-yellow-400',
  destructive: 'bg-red-500/15 text-red-400',
  info:        'bg-sky-500/15 text-sky-400',
}

const dotColors: Record<BadgeVariant, string> = {
  default:     'bg-zinc-500',
  accent:      'bg-accent',
  success:     'bg-green-500',
  warning:     'bg-yellow-500',
  destructive: 'bg-red-500',
  info:        'bg-sky-500',
}

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-px text-[11px] font-medium gap-1',
  md: 'px-2.5 py-0.5 text-xs font-medium gap-1.5',
}

export function Badge({
  className, variant = 'default', size = 'md', dot, children, ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full whitespace-nowrap',
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
