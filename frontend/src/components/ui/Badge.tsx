import { cn } from '../../lib/utils'

type BadgeVariant = 'default' | 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'teal'
type BadgeSize = 'sm' | 'md'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[#f0f0f5] text-apple-text-secondary',
  blue:    'bg-[#e8f4fd] text-[#0071e3]',
  green:   'bg-[#e8f8ee] text-[#248a3d]',
  orange:  'bg-[#fef3e6] text-[#c76f00]',
  red:     'bg-[#fde8e8] text-[#cc1f1f]',
  purple:  'bg-[#f3e8fa] text-[#8944ab]',
  teal:    'bg-[#e6f6fa] text-[#007c8c]',
}

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-apple-text-tertiary',
  blue:    'bg-apple-blue',
  green:   'bg-apple-green',
  orange:  'bg-apple-orange',
  red:     'bg-apple-red',
  purple:  'bg-apple-purple',
  teal:    'bg-apple-teal',
}

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px] font-medium gap-1',
  md: 'px-2.5 py-1 text-xs font-medium gap-1.5',
}

/**
 * Apple-style badge: nền màu nhẹ, chữ đậm vừa, bo tròn nhiều.
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
        'inline-flex items-center rounded-full whitespace-nowrap tracking-tight',
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
