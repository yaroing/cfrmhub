import clsx from 'clsx'
import type { HTMLAttributes } from 'react'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]',
        className,
      )}
      {...props}
    />
  )
}
