import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
  hint?: string
  label?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  wrapperClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, hint, label, leftIcon, rightIcon, wrapperClassName, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-foreground">
            {label}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            className={cn(
              'flex h-10 w-full rounded-lg border bg-card px-3.5 py-2 text-sm text-foreground',
              'placeholder:text-zinc-500',
              'transition-all duration-200',
              'hover:border-zinc-600',
              'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
              'disabled:opacity-40 disabled:pointer-events-none',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error
                ? 'border-destructive focus:border-destructive focus:ring-destructive/20'
                : 'border-border',
              className,
            )}
            {...props}
          />

          {rightIcon && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              {rightIcon}
            </span>
          )}
        </div>

        {error && <p className="text-xs text-destructive font-medium animate-fade-in">{error}</p>}
        {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    )
  },
)
Input.displayName = 'Input'
