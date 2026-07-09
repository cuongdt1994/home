import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg'
  glass?: boolean
  hover?: boolean
}

const paddings: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6 sm:p-7',
}

/**
 * Standard card with glassmorphism support.
 * Set `glass` for the frosted-glass look.
 * Set `hover` for a subtle lift on hover.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding = 'md', glass, hover, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border shadow-sm',
        'transition-all duration-300',
        glass
          ? 'glass'
          : 'bg-card border-border',
        paddings[padding],
        hover && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
)
Card.displayName = 'Card'

/* ── Sub-components ───────────────────── */

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 mb-4', className)} {...props}>{children}</div>
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base font-semibold tracking-tight text-foreground', className)} {...props}>{children}</h3>
}

export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props}>{children}</p>
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('', className)} {...props}>{children}</div>
}

export function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center gap-3 mt-4 pt-4 border-t border-border', className)} {...props}>
      {children}
    </div>
  )
}
