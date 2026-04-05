import clsx from 'clsx'
import type { TextareaHTMLAttributes } from 'react'

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }

export function TextArea({ label, error, className, id, ...props }: Props) {
  const lid = id ?? props.name
  return (
    <div className="w-full text-left">
      {label && (
        <label htmlFor={lid} className="mb-1 block text-sm font-medium text-[var(--text-muted)]">
          {label}
        </label>
      )}
      <textarea
        id={lid}
        className={clsx(
          'min-h-[120px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
          error && 'border-red-500',
          className,
        )}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
