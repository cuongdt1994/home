import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
}

const paddings = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6 sm:p-8',
}

/**
 * Standard card container — white bg, subtle border, rounded corners.
 * Use `hover` for interactive cards (e.g. clickable rows).
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding = 'md', hover, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-card text-card-foreground border border-border rounded-xl shadow-xs',
        paddings[padding],
        hover && 'transition-shadow duration-200 hover:shadow-md cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
)
Card.displayName = 'Card'

/* ── Card Header ───────────────────────────── */

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col gap-1.5 mb-4', className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-base font-semibold tracking-tight', className)} {...props}>
      {children}
    </h3>
  )
}

export function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)} {...props}>
      {children}
    </p>
  )
}

export function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center gap-3 mt-4 pt-4 border-t border-border', className)} {...props}>
      {children}
    </div>
  )
}
