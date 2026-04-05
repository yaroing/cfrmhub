import clsx from 'clsx'

function initialsFromLabel(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

type Props = {
  name?: string | null
  email?: string | null
  className?: string
}

export function AssigneeAvatar({ name, email, className }: Props) {
  const label = name?.trim() || email?.trim() || ''
  const initials = initialsFromLabel(label)
  return (
    <span
      className={clsx(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-200',
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  )
}
