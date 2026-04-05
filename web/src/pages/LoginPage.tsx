import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { AppLogo } from '../components/brand/AppLogo'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../types'

export function LoginPage() {
  const { t } = useTranslation()
  const { user, profile, loading, signIn } = useAuth()
  const loc = useLocation() as { state?: { from?: { pathname: string } } }
  const from = loc.state?.from?.pathname ?? '/app'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  if (!loading && user) {
    if (!profile) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center text-[var(--text-muted)]">
          {t('auth.syncProfile')}
        </div>
      )
    }
    const role = profile.role as UserRole
    const dest =
      role === 'field_agent' ? '/app/intake' : from && from !== '/login' ? from : '/app'
    return <Navigate to={dest} replace />
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setPending(true)
    try {
      await signIn(email, password)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.fail'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-6 flex justify-center">
        <AppLogo to="/" variant="full" />
      </div>
      <Card>
        <h1 className="mb-2 text-2xl font-semibold text-[var(--text-heading)]">{t('auth.title')}</h1>
        <p className="mb-6 text-sm text-[var(--text-muted)]">{t('auth.subtitle')}</p>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-500" role="alert" aria-live="polite">
              {error}
            </p>
          )}
          <Input
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label={t('auth.password')}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? t('common.loggingIn') : t('auth.submit')}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
          <Link to="/" className="text-blue-600 hover:underline dark:text-sky-400">
            {t('auth.backPublic')}
          </Link>
        </p>
      </Card>
    </div>
  )
}
