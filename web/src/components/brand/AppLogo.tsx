import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'

const BRAND_LOGO_LIGHT = `/brand/${encodeURIComponent('Logo Light.png')}`
const BRAND_LOGO_DARK = `/brand/${encodeURIComponent('Logo Dark.png')}`

type Props = {
  /** Lien (accueil public ou /app) */
  to: string
  /** Pleine largeur (header public) ou version compacte (sidebar) */
  variant?: 'full' | 'compact'
  className?: string
}

export function AppLogo({ to, variant = 'full', className }: Props) {
  const { theme } = useTheme()
  const src = theme === 'light' ? BRAND_LOGO_LIGHT : BRAND_LOGO_DARK

  if (variant === 'compact') {
    return (
      <Link
        to={to}
        className={clsx(
          'flex min-w-0 items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
          className,
        )}
      >
        <img
          src={src}
          alt="CFRM Hub"
          className="h-9 w-auto max-w-[min(100%,160px)] shrink-0 object-contain object-left"
          decoding="async"
        />
      </Link>
    )
  }

  return (
    <Link
      to={to}
      className={clsx(
        'inline-flex max-w-full items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
        className,
      )}
    >
      <img
        src={src}
        alt="CFRM Hub"
        className="h-9 w-auto max-w-[min(100%,240px)] object-contain object-left sm:h-11 sm:max-w-[280px]"
        decoding="async"
      />
    </Link>
  )
}
