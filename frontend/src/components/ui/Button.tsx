import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-foreground hover:bg-accent-600 active:bg-accent-700 shadow-md shadow-accent/20',
  secondary:
    'bg-secondary text-secondary-foreground hover:bg-zinc-700 active:bg-zinc-600',
  outline:
    'border border-border bg-transparent hover:bg-accent-subtle hover:border-zinc-600 text-foreground',
  ghost:
    'bg-transparent hover:bg-accent-subtle text-muted-foreground hover:text-foreground',
  destructive:
    'bg-destructive text-destructive-foreground hover:bg-red-600 active:bg-red-700 shadow-md shadow-red-500/20',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3.5 text-xs rounded-lg gap-1.5',
  md: 'h-10 px-5 text-sm rounded-lg gap-2',
  lg: 'h-12 px-7 text-base rounded-xl gap-2.5',
  icon: 'h-9 w-9 rounded-lg gap-0 p-0 justify-center',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium',
        'transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:opacity-40 disabled:pointer-events-none select-none',
        'active:scale-[0.97]',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
