import clsx from 'clsx'
import type { HTMLAttributes } from 'react'

type Tone = 'neutral' | 'info' | 'purple' | 'warn' | 'danger' | 'ok'

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
        tone === 'neutral' && 'bg-[var(--surface-hover)] text-[var(--text-muted)] normal-case tracking-normal',
        tone === 'info' && 'bg-violet-500/15 text-violet-800 dark:text-violet-200',
        tone === 'purple' && 'bg-[var(--app-purple-soft)] text-[var(--app-purple)] dark:text-[var(--app-purple-hover)]',
        tone === 'warn' && 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
        tone === 'danger' && 'bg-red-500/15 text-red-700 dark:text-red-300',
        tone === 'ok' && 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
        className,
      )}
      {...props}
    />
  )
}
