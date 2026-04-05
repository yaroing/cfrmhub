import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card } from '../components/ui/Card'
import { fetchCategories } from '../services/feedbackService'
import { fetchFeedbacksForAnalytics, fetchWeeklyCounts } from '../services/analyticsService'
import type { Category, FeedbackType, WeeklyCountRow } from '../types'
import { useDateFnsLocale } from '../hooks/useDateFnsLocale'
import { categoryLabel } from '../utils/categoryLabel'
import { format, subDays } from 'date-fns'

const COLORS = ['#7c3aed', '#0f172a', '#a78bfa', '#334155', '#6d28d9', '#1e293b', '#94a3b8']
const BAR_PURPLE = '#7c3aed'
const BAR_NAVY = '#0f172a'
const ALERT_RED = '#dc2626'

type Period = '7' | '30' | '90' | 'custom'

export function AnalyticsPage() {
  const { t, i18n } = useTranslation()
  const dateLocale = useDateFnsLocale()
  const [period, setPeriod] = useState<Period>('30')
  const [customFrom, setCustomFrom] = useState('')
  const [weekly, setWeekly] = useState<WeeklyCountRow[]>([])
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchFeedbacksForAnalytics>>>([])
  const [cats, setCats] = useState<Category[]>([])
  const [err, setErr] = useState('')

  const sinceIso = useMemo(() => {
    if (period === 'custom' && customFrom) return `${customFrom}T00:00:00.000Z`
    const d = period === '7' ? 7 : period === '30' ? 30 : period === '90' ? 90 : 30
    return subDays(new Date(), d).toISOString()
  }, [period, customFrom])

  const load = useCallback(async () => {
    setErr('')
    try {
      const [w, r, c] = await Promise.all([
        fetchWeeklyCounts(),
        fetchFeedbacksForAnalytics(sinceIso),
        fetchCategories(),
      ])
      setWeekly(w)
      setRows(r)
      setCats(c as Category[])
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('common.error'))
    }
  }, [sinceIso, t])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement analytique au montage / période
    void load()
  }, [load])

  const lineData = useMemo(() => {
    return [...weekly]
      .reverse()
      .slice(-12)
      .map((x) => ({
        week: format(new Date(x.week_start), 'd MMM', { locale: dateLocale }),
        total: Number(x.total),
        alerts: Number(x.alerts),
      }))
  }, [weekly, dateLocale])

  const typePie = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of rows) {
      m[r.feedback_type] = (m[r.feedback_type] ?? 0) + 1
    }
    return Object.entries(m).map(([key, value]) => ({
      name: t(`feedbackType.${key as FeedbackType}`),
      typeKey: key,
      value,
    }))
  }, [rows, t])

  const catBar = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of rows) {
      const k = r.category_id ?? 'none'
      m[k] = (m[k] ?? 0) + 1
    }
    return Object.entries(m).map(([id, count]) => {
      const cat = cats.find((c) => c.id === id)
      return {
        name: cat ? categoryLabel(cat, i18n.language) : t('common.noneCategory'),
        count,
      }
    })
  }, [rows, cats, i18n.language, t])

  const loopRate = useMemo(() => {
    if (rows.length === 0) return 0
    const closed = rows.filter((r) => r.loop_closed_at).length
    return Math.round((closed / rows.length) * 100)
  }, [rows])

  const avgTouchH = useMemo(() => {
    const touched = rows.filter((r) => r.first_touched_at)
    if (touched.length === 0) return null
    let sum = 0
    for (const r of touched) {
      sum += (new Date(r.first_touched_at as string).getTime() - new Date(r.created_at).getTime()) / 3600000
    }
    return sum / touched.length
  }, [rows])

  const critFast = useMemo(() => {
    const crit = rows.filter(
      (r) =>
        (r.priority === 'critical' || r.priority_override === 'critical') &&
        r.first_touched_at,
    )
    if (crit.length === 0) return null
    let ok = 0
    for (const r of crit) {
      const h =
        (new Date(r.first_touched_at as string).getTime() - new Date(r.created_at).getTime()) / 3600000
      if (h <= 4) ok++
    }
    return Math.round((ok / crit.length) * 100)
  }, [rows])

  const hasWeeklyChartData = useMemo(
    () => lineData.some((d) => d.total > 0 || d.alerts > 0),
    [lineData],
  )

  const hasPieData = useMemo(() => typePie.some((d) => d.value > 0), [typePie])

  const hasBarData = useMemo(() => catBar.some((d) => d.count > 0), [catBar])

  const zones = useMemo(() => {
    const unknown = t('analytics.zoneUnknown')
    const m: Record<string, number> = {}
    for (const r of rows) {
      const z = (r.location_label?.trim() ? r.location_label : unknown).slice(0, 40)
      m[z] = (m[z] ?? 0) + 1
    }
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  }, [rows, t])

  return (
    <div className="flex-1 space-y-6 overflow-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--text-heading)]">{t('analytics.title')}</h1>
      {err && <p className="text-sm text-red-500">{err}</p>}

      <Card>
        <h2 className="mb-4 font-semibold">{t('analytics.periodTitle')}</h2>
        <div className="flex flex-wrap gap-2">
          {(['7', '30', '90'] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-[var(--app-purple)] text-white'
                  : 'bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
              onClick={() => setPeriod(p)}
            >
              {t('analytics.periodDays', { n: p })}
            </button>
          ))}
          <button
            type="button"
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              period === 'custom'
                ? 'bg-[var(--app-purple)] text-white'
                : 'bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
            onClick={() => setPeriod('custom')}
          >
            📅 {t('analytics.periodCustom')}
          </button>
          {period === 'custom' && (
            <input
              type="date"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          )}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="!p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {t('analytics.kpiCatPerformance')}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-heading)]">{loopRate}%</p>
          <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{t('analytics.kpiTrendPerformance')}</p>
        </Card>
        <Card className="!p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {t('analytics.kpiCatEfficiency')}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-heading)]">
            {avgTouchH != null ? `${avgTouchH.toFixed(1)}h` : '—'}
          </p>
          <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{t('analytics.kpiTrendEfficiency')}</p>
        </Card>
        <Card className="!p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {t('analytics.kpiCatUrgency')}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-heading)]">
            {critFast != null ? `${critFast}%` : '—'}
          </p>
          <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{t('analytics.kpiTrendUrgency')}</p>
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 font-semibold">{t('analytics.weeklyVolume')}</h2>
        <div className="relative h-72 w-full">
          {hasWeeklyChartData ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lineData} barGap={2} barCategoryGap="12%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name={t('analytics.legendTotal')} fill={BAR_PURPLE} radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="alerts" name={t('analytics.legendAlerts')} fill={ALERT_RED} radius={[2, 2, 0, 0]} maxBarSize={8} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-hover)]/40 px-6 text-center text-sm text-[var(--text-muted)]">
              {t('analytics.chartEmpty')}
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">{t('analytics.typesTitle')}</h2>
          <div className="relative h-64">
            {hasPieData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={typePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {typePie.map((d, i) => (
                      <Cell key={d.typeKey} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-hover)]/40 px-4 text-center text-sm text-[var(--text-muted)]">
                {t('analytics.chartEmpty')}
              </div>
            )}
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">{t('analytics.byCategory')}</h2>
          <div className="relative h-64">
            {hasBarData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={catBar} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {catBar.map((_, i) => (
                      <Cell key={catBar[i]!.name} fill={i % 2 === 0 ? BAR_PURPLE : BAR_NAVY} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-hover)]/40 px-4 text-center text-sm text-[var(--text-muted)]">
                {t('analytics.chartEmpty')}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 font-semibold">{t('analytics.zonesTitle')}</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
              <th className="pb-2">{t('analytics.colZone')}</th>
              <th className="pb-2">{t('analytics.colVolume')}</th>
            </tr>
          </thead>
          <tbody>
            {zones.map(([z, n]) => (
              <tr key={z} className="border-b border-[var(--border)]/50">
                <td className="py-2">{z}</td>
                <td className="py-2">{n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
