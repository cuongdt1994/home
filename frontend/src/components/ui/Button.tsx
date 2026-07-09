import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-apple-blue text-white shadow-button hover:bg-apple-blue-hover active:bg-apple-blue-active active:scale-[0.98]',
  secondary:
    'bg-[#e8e8ed] text-apple-text hover:bg-[#dcdce2] active:bg-[#d0d0d8] active:scale-[0.98]',
  outline:
    'border border-apple-border bg-transparent text-apple-text hover:bg-apple-bg active:bg-[#e8e8ed] active:scale-[0.98]',
  ghost:
    'bg-transparent text-apple-blue hover:bg-apple-blue-light active:bg-[#dae9f9]',
  destructive:
    'bg-apple-red text-white shadow-button hover:bg-[#e0352b] active:bg-[#c93026] active:scale-[0.98]',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-4 text-xs rounded-full gap-1.5',
  md: 'h-10 px-5 text-sm rounded-full gap-2',
  lg: 'h-12 px-7 text-[15px] rounded-full gap-2.5',
}

/**
 * Apple-style button: pill shape, smooth transitions, scale-on-press.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium',
        'transition-all duration-200 ease-out',
        'focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_rgba(0,113,227,0.15)]',
        'disabled:opacity-40 disabled:pointer-events-none select-none',
        'active:scale-[0.98]',
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
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3.5" />
          <path
            className="opacity-80"
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
