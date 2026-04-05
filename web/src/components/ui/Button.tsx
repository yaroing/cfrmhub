import clsx from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** violet — CTA type assignation / enregistrement principal */
  variant?: 'primary' | 'navy' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex items-center justify-center rounded-lg font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50',
        size === 'sm' && 'px-3 py-1.5 text-sm',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'px-6 py-3 text-base',
        variant === 'primary' &&
          'bg-[var(--app-purple)] text-white hover:bg-[var(--app-purple-hover)] focus-visible:outline-[var(--app-purple)]',
        variant === 'navy' &&
          'bg-[var(--app-navy)] text-white hover:bg-[var(--app-navy-hover)] focus-visible:outline-[var(--app-navy)]',
        variant === 'secondary' &&
          'border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-hover)]',
        variant === 'ghost' && 'text-[var(--text)] hover:bg-[var(--surface-hover)]',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-500',
        className,
      )}
      {...props}
    />
  )
}
