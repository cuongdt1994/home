import { forwardRef } from 'react'
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
    'bg-primary text-primary-foreground hover:bg-primary-700 active:bg-primary-800 shadow-xs',
  secondary:
    'bg-secondary text-secondary-foreground hover:bg-slate-200 active:bg-slate-300',
  outline:
    'border border-border bg-transparent hover:bg-accent active:bg-slate-100 text-foreground',
  ghost:
    'bg-transparent hover:bg-accent active:bg-slate-100 text-muted-foreground hover:text-foreground',
  destructive:
    'bg-destructive text-destructive-foreground hover:bg-red-700 active:bg-red-800 shadow-xs',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs rounded-md gap-1.5',
  md: 'h-10 px-4 text-sm rounded-lg gap-2',
  lg: 'h-12 px-6 text-base rounded-lg gap-2.5',
  icon: 'h-9 w-9 rounded-lg gap-0 p-0 justify-center',
}

/**
 * Standard button with variants and sizes.
 * Pass `loading` to show a spinner and disable interaction.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:opacity-40 disabled:pointer-events-none select-none',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
