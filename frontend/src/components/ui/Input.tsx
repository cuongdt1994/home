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

/**
 * Apple-style input: rounded-xl, clean border, focus ring xanh,
 * label phía trên, error state với animation mượt.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, hint, label, leftIcon, rightIcon, wrapperClassName, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-apple-text">
            {label}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-apple-text-tertiary pointer-events-none">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            className={cn(
              'flex h-11 w-full rounded-xl border bg-white px-4 py-2.5 text-[15px] text-apple-text',
              'placeholder:text-apple-text-tertiary',
              'transition-all duration-200 ease-out',
              'hover:border-apple-border',
              'focus:outline-none focus:border-apple-blue focus:shadow-[0_0_0_4px_rgba(0,113,227,0.1)]',
              'disabled:opacity-35 disabled:pointer-events-none disabled:bg-[#f5f5f7]',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error
                ? 'border-apple-red hover:border-apple-red focus:border-apple-red focus:shadow-[0_0_0_4px_rgba(255,59,48,0.12)]'
                : 'border-apple-border-light',
              className,
            )}
            {...props}
          />

          {rightIcon && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-apple-text-tertiary pointer-events-none">
              {rightIcon}
            </span>
          )}
        </div>

        {error && (
          <p className="text-xs text-apple-red font-medium animate-slide-down">{error}</p>
        )}
        {hint && !error && (
          <p className="text-xs text-apple-text-secondary">{hint}</p>
        )}
      </div>
    )
  },
)
Input.displayName = 'Input'
