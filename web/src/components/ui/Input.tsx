import clsx from 'clsx'
import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }

export function Input({ label, error, className, id, ...props }: Props) {
  const lid = id ?? props.name
  return (
    <div className="w-full text-left">
      {label && (
        <label
          htmlFor={lid}
          className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]"
        >
          {label}
        </label>
      )}
      <input
        id={lid}
        className={clsx(
          'w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] shadow-sm placeholder:text-[var(--text-muted)] focus:border-[var(--app-purple)] focus:outline-none focus:ring-1 focus:ring-[var(--app-purple)]',
          error && 'border-red-500',
          className,
        )}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  )
}
