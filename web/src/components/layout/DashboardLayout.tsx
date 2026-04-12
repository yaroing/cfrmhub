import { useState } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { AppLogo } from '../brand/AppLogo'
import { useAuth, useRole } from '../../hooks/useAuth'
import { canAdmin, canExport } from '../../utils/permissions'
import { useTheme } from '../../hooks/useTheme'
import { useExportFeedbacksCsv } from '../../hooks/useExportFeedbacksCsv'
import { Button } from '../ui/Button'
import { AssigneeAvatar } from '../ui/AssigneeAvatar'

type NavItem = { to: string; label: string; icon: string }

function NavRow({
  to,
  label,
  icon,
  active,
}: {
  to: string
  label: string
  icon: string
  active: boolean
}) {
  return (
    <Link
      to={to}
      className={clsx(
        'relative flex items-center gap-2 rounded-lg py-2 pl-3 pr-3 text-sm transition-colors',
        active
          ? 'bg-[var(--app-purple-soft)] font-semibold text-[var(--app-purple)]'
          : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]',
      )}
    >
      {active && (
        <span
          className="absolute right-0 top-1/2 hidden h-8 w-1 -translate-y-1/2 rounded-l-sm bg-[var(--sidebar-active-bar)] md:block"
          aria-hidden
        />
      )}
      <span className="text-base opacity-90" aria-hidden>
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  )
}

function DashboardTopBar() {
  const { t, i18n } = useTranslation()
  const loc = useLocation()
  const role = useRole()
  const { profile, user } = useAuth()
  const { exporting, exportCsv } = useExportFeedbacksCsv()
  const [exportErr, setExportErr] = useState('')
  const fr = i18n.language.startsWith('fr')
  const showHeaderExport = loc.pathname === '/app' || loc.pathname === '/app/feedbacks'

  async function onHeaderExport() {
    setExportErr('')
    const msg = await exportCsv()
    if (msg) setExportErr(msg)
  }

  return (
    <header className="hidden shrink-0 flex-col border-b border-[var(--border)] bg-[var(--surface)] shadow-[var(--card-shadow)] md:flex">
      <div className="flex items-center gap-3 px-4 py-3 md:px-6">
        <div className="min-w-0 flex-1" />
        <div
          className="mx-auto flex w-full max-w-xl flex-1 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-2.5 text-sm text-[var(--text-muted)]"
          role="search"
          aria-label={t('dashboard.topBarSearchFeedback')}
        >
          <span className="shrink-0 opacity-70" aria-hidden>
            🔍
          </span>
          <span className="truncate">{t('dashboard.topBarSearchFeedback')}</span>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)]"
            onClick={() => void i18n.changeLanguage(fr ? 'en' : 'fr')}
            aria-label={t('layout.toggleLang')}
          >
            🌐
          </button>
          <span
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-lg text-[var(--text-muted)]"
            title={t('dashboard.notificationsPlaceholder')}
          >
            🔔
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[var(--surface)]" />
          </span>
          {showHeaderExport && canExport(role) && (
            <Button type="button" variant="secondary" size="sm" disabled={exporting} onClick={() => void onHeaderExport()}>
              {exporting ? t('common.exporting') : t('dashboard.exportCsv')}
            </Button>
          )}
          <AssigneeAvatar
            name={profile?.full_name}
            email={profile?.email ?? user?.email}
            className="!h-9 !w-9 !rounded-full !bg-[var(--app-navy)] !text-xs !font-semibold !text-white dark:!bg-slate-700"
          />
        </div>
      </div>
      {exportErr ? <p className="px-6 pb-2 text-right text-xs text-red-500">{exportErr}</p> : null}
    </header>
  )
}

export function DashboardLayout() {
  const { t, i18n } = useTranslation()
  const { user, loading, signOut } = useAuth()
  const role = useRole()
  const { theme, toggle } = useTheme()
  const loc = useLocation()
  const isField = role === 'field_agent'
  const fr = i18n.language.startsWith('fr')
  const en = i18n.language.startsWith('en')

  const staffNav: NavItem[] = [
    { to: '/app', label: t('nav.dashboard'), icon: '📊' },
    { to: '/app/feedbacks', label: t('nav.feedbackManagement'), icon: '📋' },
    { to: '/app/intake', label: t('nav.intake'), icon: '📝' },
    { to: '/app/actions', label: t('nav.actions'), icon: '🎯' },
    { to: '/app/analytics', label: t('nav.analytics'), icon: '📈' },
  ]

  const fieldNav: NavItem[] = [
    { to: '/app/feedbacks', label: t('nav.mySubmissions'), icon: '📥' },
    { to: '/app', label: t('nav.overview'), icon: '📊' },
    { to: '/app/intake', label: t('nav.intake'), icon: '📝' },
  ]

  const nav = isField ? fieldNav : staffNav

  const adminNav: NavItem[] = [
    { to: '/app/admin/users', label: t('nav.adminUsers'), icon: '👥' },
    { to: '/app/admin/categories', label: t('nav.adminCategories'), icon: '🏷️' },
    { to: '/app/admin/focal-points', label: t('nav.adminFocal'), icon: '📌' },
    { to: '/app/admin/channels', label: t('nav.adminChannels'), icon: '📡' },
    { to: '/app/admin/audit', label: t('nav.adminAudit'), icon: '📋' },
  ]

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--text)]">
        {t('common.loading')}
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />

  return (
    <div className="flex min-h-[100dvh] w-full flex-1 flex-col bg-[var(--bg)] text-[var(--text)] md:h-[100dvh] md:max-h-[100dvh] md:min-h-0 md:flex-row md:overflow-hidden">
      <aside className="flex w-full shrink-0 flex-col border-b border-[var(--border)] bg-[var(--sidebar-bg)] md:h-full md:w-60 md:overflow-y-auto md:border-b-0 md:border-r md:border-[var(--border)]">
        <div className="flex items-start justify-between gap-2 border-b border-[var(--border)]/50 p-4">
          <div className="min-w-0 flex-1">
            <AppLogo to="/app" variant="compact" />
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              {t('layout.brandTagline')}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={toggle} aria-label={t('common.theme')}>
            {theme === 'light' ? '🌙' : '☀️'}
          </Button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3" aria-label={t('nav.mainNav')}>
          {nav.map((n) => (
            <NavRow key={n.to} {...n} active={loc.pathname === n.to} />
          ))}
          {canAdmin(role) && (
            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t('nav.adminSection')}
              </p>
              <div className="flex flex-col gap-0.5">
                {adminNav.map((n) => (
                  <NavRow key={n.to} {...n} active={loc.pathname.startsWith(n.to)} />
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className="mt-auto space-y-3 border-t border-[var(--border)] p-4">
          <div>
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('nav.lang')}
            </span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={fr ? 'primary' : 'ghost'}
                type="button"
                className={clsx(fr && 'font-bold')}
                onClick={() => void i18n.changeLanguage('fr')}
                aria-pressed={fr}
              >
                FR
              </Button>
              <Button
                size="sm"
                variant={en ? 'primary' : 'ghost'}
                type="button"
                className={clsx(en && 'font-bold')}
                onClick={() => void i18n.changeLanguage('en')}
                aria-pressed={en}
              >
                EN
              </Button>
            </div>
          </div>
          <p className="truncate text-xs text-[var(--text-muted)]">{user.email}</p>
          <p className="text-xs capitalize text-[var(--text-muted)]">
            {t('layout.role')} : {role ? t(`roles.${role}`) : '—'}
          </p>
          <Link
            to="/"
            className="block text-sm font-medium text-[var(--app-purple)] hover:underline dark:text-[var(--app-purple-hover)]"
          >
            {t('nav.publicSite')}
          </Link>
          <button
            type="button"
            className="w-full text-left text-sm font-semibold text-red-600 hover:underline dark:text-red-400"
            onClick={() => void signOut()}
          >
            {t('nav.signOut')}
          </button>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:overflow-hidden">
        <DashboardTopBar />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
