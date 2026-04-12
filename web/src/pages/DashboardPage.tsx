import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { FeedbackMap } from '../components/map/FeedbackMap'
import type { MapPoint } from '../components/map/FeedbackMapInner'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useRole } from '../hooks/useAuth'
import { canExport } from '../utils/permissions'
import { useExportFeedbacksCsv } from '../hooks/useExportFeedbacksCsv'
import { supabase } from '../lib/supabaseClient'
import { fetchDashboardKpis, fetchMapPins } from '../services/feedbackService'

/** Vue d’ensemble : KPI + carte globaux (sans filtres — les filtres sont sur /app/feedbacks). */
const OVERVIEW_FILTERS = {}

export function DashboardPage() {
  const { t } = useTranslation()
  const role = useRole()
  const [mapPins, setMapPins] = useState<MapPoint[]>([])
  const [kpis, setKpis] = useState({
    total: 0,
    newCount: 0,
    inProgress: 0,
    closed: 0,
    critical: 0,
    duplicates: 0,
    loopClosed: 0,
    sensitiveOpen: 0,
  })
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const { exporting, exportCsv } = useExportFeedbacksCsv()

  const load = useCallback(async () => {
    setErr('')
    setLoading(true)
    try {
      const [k, pins] = await Promise.all([
        fetchDashboardKpis(OVERVIEW_FILTERS),
        fetchMapPins(OVERVIEW_FILTERS),
      ])
      setKpis(k)
      setMapPins(
        pins.map((p) => ({
          id: p.id,
          lat: p.lat as number,
          lng: p.lng as number,
          description: p.description,
          channel: p.channel,
        })),
      )
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('dashboard.loadFail'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const ch = supabase
      .channel('feedbacks-realtime-v2')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feedbacks' },
        () => void load(),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [load])

  async function onExport() {
    const msg = await exportCsv()
    if (msg) setErr(msg)
  }

  return (
    <div className="flex-1 space-y-6 overflow-auto p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-heading)]">{t('dashboard.title')}</h1>
          <p className="text-sm text-[var(--text-muted)]">{t('dashboard.subtitle')}</p>
        </div>
        {canExport(role) && (
          <Button
            variant="navy"
            className="md:hidden"
            disabled={exporting}
            onClick={() => void onExport()}
          >
            {exporting ? t('common.exporting') : t('dashboard.exportCsv')}
          </Button>
        )}
      </div>

      {err && <p className="text-sm text-red-500">{err}</p>}

      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm text-[var(--text-muted)]">{t('dashboard.manageFeedbacksHint')}</p>
        <Link to="/app/feedbacks" className="shrink-0">
          <Button type="button" variant="primary">
            {t('dashboard.manageFeedbacksCta')}
          </Button>
        </Link>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4">
        {loading ? (
          <p className="col-span-full text-[var(--text-muted)]">{t('common.loading')}</p>
        ) : (
          (
            [
              ['dashboard.kpiTotal', kpis.total],
              ['dashboard.kpiNew', kpis.newCount],
              ['dashboard.kpiInProgress', kpis.inProgress],
              ['dashboard.kpiClosed', kpis.closed],
              ['dashboard.kpiCritical', kpis.critical],
              ['dashboard.kpiDup', kpis.duplicates],
              ['dashboard.kpiLoop', kpis.loopClosed],
              ['dashboard.kpiSensitive', kpis.sensitiveOpen],
            ] as const
          ).map(([labelKey, n], idx) => {
            const valueClass =
              idx === 0 || idx === 3 || idx === 5
                ? 'text-[var(--text-heading)]'
                : idx === 1
                  ? 'text-[var(--app-purple)]'
                  : idx === 2
                    ? 'text-[var(--app-navy)] dark:text-indigo-200'
                    : idx === 4
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-[var(--text-muted)]'
            return (
              <Card key={labelKey} className="!p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {labelKey === 'dashboard.kpiDup' ? (
                    <abbr
                      title={t('dashboard.kpiDupHint')}
                      className="cursor-help border-b border-dotted border-[var(--text-muted)] no-underline"
                    >
                      {t(labelKey)}
                    </abbr>
                  ) : (
                    t(labelKey)
                  )}
                </p>
                <p className={clsx('text-2xl font-semibold tracking-tight md:text-3xl', valueClass)}>{n}</p>
              </Card>
            )
          })
        )}
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <h2 className="font-semibold text-[var(--text-heading)]">{t('dashboard.map')}</h2>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {t('dashboard.mapGeoCaption')}
          </span>
        </div>
        <FeedbackMap pins={mapPins} />
      </Card>
    </div>
  )
}
