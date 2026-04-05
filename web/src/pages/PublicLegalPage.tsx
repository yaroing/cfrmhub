import { Link, Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const LEGAL_PAGES = ['privacy', 'terms', 'accessibility', 'help'] as const
type LegalPageKey = (typeof LEGAL_PAGES)[number]

function isLegalPage(s: string | undefined): s is LegalPageKey {
  return !!s && (LEGAL_PAGES as readonly string[]).includes(s)
}

export function PublicLegalPage() {
  const { page } = useParams<{ page: string }>()
  const { t } = useTranslation()

  if (!isLegalPage(page)) {
    return <Navigate to="/" replace />
  }

  const title = t(`legal.${page}Title`)
  const raw = t(`legal.${page}Body`, { returnObjects: true })
  const paragraphs = Array.isArray(raw) ? (raw as string[]) : [String(raw)]

  return (
    <article className="mx-auto max-w-3xl">
      <Link
        to="/"
        className="inline-block text-sm font-medium text-[var(--app-purple)] hover:underline dark:text-[var(--app-purple-hover)]"
      >
        {t('legal.backHome')}
      </Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-[var(--app-navy)] dark:text-[var(--text-heading)]">
        {title}
      </h1>
      <div className="mt-8 space-y-5 text-base leading-relaxed text-[var(--text)]">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-[var(--text-muted)]">
            {p}
          </p>
        ))}
      </div>
    </article>
  )
}
