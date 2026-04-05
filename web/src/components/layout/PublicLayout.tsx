import { Link, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { AppLogo } from '../brand/AppLogo'
import { useTheme } from '../../hooks/useTheme'
import { Button } from '../ui/Button'

function hashActive(loc: ReturnType<typeof useLocation>, section: string) {
  if (loc.pathname !== '/') return false
  const h = loc.hash
  if (section === 'hero') return !h || h === '#hero'
  return h === `#${section}`
}

export function PublicLayout() {
  const { t, i18n } = useTranslation()
  const { theme, toggle } = useTheme()
  const loc = useLocation()
  const fr = i18n.language.startsWith('fr')

  const nav = [
    { section: 'hero' as const, labelKey: 'publicNav.mechanism' as const },
    { section: 'privacy' as const, labelKey: 'publicNav.privacy' as const },
    { section: 'channels' as const, labelKey: 'publicNav.channels' as const },
    { section: 'accountability' as const, labelKey: 'publicNav.accountability' as const },
  ]

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-[var(--bg)] text-[var(--text)]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-4 px-4 py-4 md:grid-cols-[auto_1fr_auto] md:gap-6">
          <div className="flex items-center justify-between gap-4 md:justify-start">
            <AppLogo to="/" variant="full" />
            <div className="flex items-center gap-2 md:hidden">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-lg text-[var(--text-muted)]"
                onClick={() => void i18n.changeLanguage(fr ? 'en' : 'fr')}
                aria-label={t('layout.toggleLang')}
              >
                🌐
              </button>
              <Button type="button" variant="ghost" size="sm" onClick={toggle} aria-label={t('common.theme')}>
                {theme === 'light' ? '🌙' : '☀️'}
              </Button>
            </div>
          </div>

          <nav
            className="hidden flex-wrap items-center justify-center gap-6 md:flex"
            aria-label={t('nav.mainNav')}
          >
            {nav.map(({ section, labelKey }) => (
              <Link
                key={section}
                to={{ pathname: '/', hash: section }}
                className={clsx(
                  'border-b-2 border-transparent pb-0.5 text-sm font-medium transition-colors',
                  hashActive(loc, section)
                    ? 'border-[var(--app-purple)] text-[var(--text-heading)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]',
                )}
              >
                {t(labelKey)}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center justify-end gap-2 md:flex">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)]"
              onClick={() => void i18n.changeLanguage(fr ? 'en' : 'fr')}
              aria-label={t('layout.toggleLang')}
            >
              🌐
            </button>
            <a
              href="mailto:contact@cfrm.local"
              className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-heading)]"
            >
              {t('publicNav.contact')}
            </a>
            <Link to="/login">
              <Button type="button" variant="navy" size="sm">
                {t('auth.submit')}
              </Button>
            </Link>
            <Button type="button" variant="ghost" size="sm" onClick={toggle} aria-label={t('common.theme')}>
              {theme === 'light' ? '🌙' : '☀️'}
            </Button>
          </div>
        </div>

        <nav
          className="flex flex-wrap justify-center gap-3 border-t border-[var(--border)]/60 px-4 py-2 md:hidden"
          aria-label={t('nav.mainNav')}
        >
          {nav.map(({ section, labelKey }) => (
            <Link
              key={section}
              to={{ pathname: '/', hash: section }}
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-medium',
                hashActive(loc, section)
                  ? 'bg-[var(--app-purple-soft)] text-[var(--app-purple)]'
                  : 'text-[var(--text-muted)]',
              )}
            >
              {t(labelKey)}
            </Link>
          ))}
          <Link to="/login" className="rounded-full px-3 py-1 text-xs font-semibold text-[var(--app-navy)]">
            {t('auth.submit')}
          </Link>
        </nav>
      </header>

      <main
        className="mx-auto w-full max-w-6xl flex-1 px-4 pb-12 pt-[8.25rem] md:pt-24"
        style={{ minHeight: 0 }}
      >
        <Outlet />
      </main>

      <footer className="border-t border-[var(--border)] bg-[var(--surface-hover)]/50 py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 md:flex-row md:items-start md:justify-between">
          <div>
            <AppLogo to="/" variant="compact" />
            <p className="mt-3 max-w-sm text-sm text-[var(--text-muted)]">{t('layout.footer')}</p>
          </div>
          <nav
            className="flex flex-col gap-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] sm:flex-row sm:flex-wrap sm:gap-x-8"
            aria-label={t('home.footerNavLabel')}
          >
            <Link to="/legal/privacy" className="hover:text-[var(--app-purple)]">
              {t('home.footerPrivacy')}
            </Link>
            <Link to="/legal/terms" className="hover:text-[var(--app-purple)]">
              {t('home.footerTerms')}
            </Link>
            <Link to="/legal/accessibility" className="hover:text-[var(--app-purple)]">
              {t('home.footerAccessibility')}
            </Link>
            <Link to="/legal/help" className="hover:text-[var(--app-purple)]">
              {t('home.footerHelp')}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
