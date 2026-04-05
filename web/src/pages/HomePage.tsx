import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

const CHANNEL_ICONS = ['🌐', '💬', '📱', '✈️'] as const

export function HomePage() {
  const { t } = useTranslation()
  const channels: { titleKey: string; descKey: string; simulated: boolean }[] = [
    { titleKey: 'home.chWebTitle', descKey: 'home.chWebDesc', simulated: false },
    { titleKey: 'home.chSmsTitle', descKey: 'home.chSmsDesc', simulated: false },
    { titleKey: 'home.chWaTitle', descKey: 'home.chWaDesc', simulated: true },
    { titleKey: 'home.chTgTitle', descKey: 'home.chTgDesc', simulated: false },
  ]

  const closingBullets = [
    'home.closingBullet1',
    'home.closingBullet2',
    'home.closingBullet3',
    'home.closingBullet4',
  ] as const

  return (
    <div className="space-y-16 text-left md:space-y-24">
      <section
        id="hero"
        className="relative scroll-mt-[8.25rem] overflow-hidden md:scroll-mt-24 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[var(--card-shadow)] md:p-14"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(135deg, transparent 45%, rgba(124, 58, 237, 0.08) 50%, transparent 55%),
              linear-gradient(45deg, rgba(15, 23, 42, 0.04) 25%, transparent 25%, transparent 75%, rgba(15, 23, 42, 0.04) 75%)
            `,
            backgroundSize: '24px 24px, 48px 48px',
          }}
          aria-hidden
        />
        <div className="relative z-10 max-w-3xl space-y-6">
          <Badge tone="purple" className="!normal-case !tracking-normal">
            {t('home.heroBadge')}
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--app-navy)] dark:text-[var(--text-heading)] md:text-4xl lg:text-[2.5rem] lg:leading-tight">
            {t('home.heroTitle')}
          </h1>
          <p className="text-lg leading-relaxed text-[var(--text-muted)]">{t('home.heroText')}</p>
          <div className="flex flex-wrap gap-3">
            <Link to="/feedback">
              <Button size="lg" variant="navy">
                {t('home.ctaSubmit')}
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="secondary">
                {t('home.ctaLogin')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card id="mechanism" className="flex scroll-mt-[8.25rem] flex-col gap-4 !p-6 md:scroll-mt-24 md:!p-8">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-2xl"
            aria-hidden
          >
            🏛️
          </div>
          <div className="min-w-0">
            <h2 className="mb-3 text-xl font-semibold text-[var(--text-heading)]">{t('home.roleTitle')}</h2>
            <p className="text-[var(--text-muted)]">{t('home.roleText')}</p>
            <Link
              to="/feedback"
              className="mt-4 inline-block text-sm font-semibold text-[var(--app-purple)] hover:underline"
            >
              {t('home.roleLink')}
            </Link>
          </div>
        </Card>

        <Card
          id="privacy"
          className="flex scroll-mt-[8.25rem] flex-col gap-4 !border-[var(--app-purple)] md:scroll-mt-24 !bg-[var(--app-purple)] !p-6 text-white shadow-[var(--card-shadow)] md:!p-8"
        >
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-2xl"
            aria-hidden
          >
            🔒
          </div>
          <div className="min-w-0">
            <h2 className="mb-3 text-xl font-semibold text-white">{t('home.privacyTitle')}</h2>
            <p className="text-sm leading-relaxed text-white/90">{t('home.privacyText')}</p>
          </div>
        </Card>
      </section>

      <section id="channels" className="scroll-mt-[8.25rem] md:scroll-mt-24">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--text-heading)]">{t('home.channelsTitle')}</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{t('home.channelsSubtitle')}</p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {t('home.channelsFilter')}
          </span>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {channels.map((ch, i) => (
            <Card key={ch.titleKey} className="flex flex-col items-center !p-5 text-center shadow-[var(--card-shadow)]">
              <div className="mb-3 flex w-full items-center justify-between gap-2">
                <span className="text-2xl" aria-hidden>
                  {CHANNEL_ICONS[i]}
                </span>
                <span
                  className={clsx(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                    ch.simulated ? 'bg-[var(--surface-hover)] text-[var(--text-muted)]' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
                  )}
                >
                  {ch.simulated ? t('home.chBadgeSimulated') : t('home.chBadgeActive')}
                </span>
              </div>
              <h3 className="font-semibold text-[var(--text-heading)]">{t(ch.titleKey)}</h3>
              <p className="mt-2 flex-1 text-sm text-[var(--text-muted)]">{t(ch.descKey)}</p>
              <div className="mt-4 w-full">
                {i === 0 ? (
                  <Link to="/feedback" className="block">
                    <Button type="button" variant="secondary" className="w-full" size="sm">
                      {t('home.chOpen')}
                    </Button>
                  </Link>
                ) : ch.simulated ? (
                  <Button type="button" variant="secondary" className="w-full" size="sm">
                    {t('home.chConfig')}
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" className="w-full" size="sm">
                    {t('home.chDetails')}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </ul>
      </section>

      <section id="accountability" className="scroll-mt-[8.25rem] md:scroll-mt-24">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-hover)]/90 p-8 shadow-[var(--card-shadow)] dark:border-[var(--border)] dark:bg-[var(--surface)]/80 md:p-10 lg:p-12">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--app-navy)] dark:text-[var(--text-heading)] md:text-[1.65rem]">
              {t('home.accountabilityHeading')}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-[var(--text)]">{t('home.closingText')}</p>
            <p className="mt-5 border-l-[3px] border-[var(--app-purple)]/50 pl-4 text-sm leading-relaxed text-[var(--text-muted)] dark:border-[var(--app-purple)]/40">
              {t('home.accountabilityTeamNote')}
            </p>
            <ul className="mt-10 grid gap-x-10 gap-y-5 sm:grid-cols-2">
              {closingBullets.map((key) => (
                <li key={key} className="flex gap-3 text-sm leading-snug text-[var(--text)]">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
