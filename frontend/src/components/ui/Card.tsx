import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  hover?: boolean
  glass?: boolean
}

const paddings: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
  xl: 'p-10 sm:p-12',
}

/**
 * Apple-style card: white bg, large rounded corners, subtle layered shadow.
 * Set `hover` để thêm hiệu ứng nâng lên khi hover.
 * Set `glass` để dùng hiệu ứng glass morphism.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding = 'md', hover, glass, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl border border-apple-border-light',
        'transition-all duration-400 ease-out',
        glass
          ? 'glass shadow-sm'
          : 'bg-apple-card shadow-sm',
        paddings[padding],
        hover && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
)
Card.displayName = 'Card'

/* ── Card sub-components ───────────────── */

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col gap-1 mb-5', className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-lg font-semibold tracking-tight text-apple-text', className)}
      {...props}
    >
      {children}
    </h3>
  )
}

export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-apple-text-secondary', className)} {...props}>
      {children}
    </p>
  )
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('', className)} {...props}>{children}</div>
}

export function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 mt-5 pt-5 border-t border-apple-divider',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
