import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

/* ── Table ────────────────────────────── */

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  glass?: boolean
}

export const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ className, glass, ...props }, ref) => (
    <div className={cn('w-full overflow-auto rounded-xl', glass && 'glass', !glass && 'border border-border')}>
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  ),
)
Table.displayName = 'Table'

/* ── TableHeader ──────────────────────── */

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn('[&_tr]:border-b [&_tr]:border-border', className)} {...props} />
  )
}

/* ── TableHead ────────────────────────── */

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'h-11 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider align-middle',
        className,
      )}
      {...props}
    />
  )
}

/* ── TableBody ────────────────────────── */

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
}

/* ── TableRow ─────────────────────────── */

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-accent-subtle',
        className,
      )}
      {...props}
    />
  )
}

/* ── TableCell ────────────────────────── */

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('px-4 py-3 align-middle [&:has([role=checkbox])]:pr-0', className)} {...props} />
  )
}
