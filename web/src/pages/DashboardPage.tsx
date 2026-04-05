import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { FeedbackMap } from '../components/map/FeedbackMap'
import type { MapPoint } from '../components/map/FeedbackMapInner'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { useAuth, useRole } from '../hooks/useAuth'
import { canExport, canSubmitFeedback, canViewAnalytics } from '../utils/permissions'
import { useExportFeedbacksCsv } from '../hooks/useExportFeedbacksCsv'
import { supabase } from '../lib/supabaseClient'
import {
  type FeedbackListFilters,
  type SortCol,
  fetchDashboardKpis,
  fetchFeedbacksPage,
  fetchMapPins,
  fetchSlaConfig,
  slaBreached,
} from '../services/feedbackService'
import { AssigneeAvatar } from '../components/ui/AssigneeAvatar'
import type { FeedbackChannel, FeedbackRow, FeedbackStatus, Priority, SubmitterAgeGroup, SubmitterSex } from '../types'
import { useDateFnsLocale } from '../hooks/useDateFnsLocale'
import { categoryLabel } from '../utils/categoryLabel'
import { effectivePriority } from '../utils/classification'
import { format } from 'date-fns'
import {
  fetchDashboardAiConfig,
  resolveDashboardAiBody,
  type DashboardAiConfig,
} from '../services/dashboardAiService'

const PAGE_SIZE = 25

const STATUS_KEYS: FeedbackStatus[] = [
  'new',
  'in_validation',
  'validated',
  'in_progress',
  'closed',
  'rejected',
]
const PRIORITY_KEYS: Priority[] = ['low', 'medium', 'high', 'critical']
const CHANNEL_KEYS: FeedbackChannel[] = [
  'web',
  'phone',
  'in_person',
  'sms_sim',
  'sms_twilio',
  'whatsapp_sim',
  'whatsapp_business',
  'telegram_sim',
  'telegram_bot',
]
const SEX_KEYS: SubmitterSex[] = ['female', 'male', 'prefer_not', 'mixed', 'unknown']
const AGE_KEYS: SubmitterAgeGroup[] = ['0_17', '18_59', '60_plus', 'mixed', 'prefer_not', 'unknown']

const SELECT_FIELD =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] shadow-sm focus:border-[var(--app-purple)] focus:outline-none focus:ring-1 focus:ring-[var(--app-purple)]'

const FILTER_LBL = 'mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]'

function statusTone(s: FeedbackStatus): 'neutral' | 'info' | 'purple' | 'warn' | 'danger' | 'ok' {
  switch (s) {
    case 'closed':
      return 'ok'
    case 'rejected':
      return 'danger'
    case 'in_progress':
    case 'in_validation':
      return 'purple'
    case 'validated':
      return 'info'
    default:
      return 'neutral'
  }
}

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const dateLocale = useDateFnsLocale()
  const lang = i18n.language
  const role = useRole()
  const { user } = useAuth()
  const [rows, setRows] = useState<FeedbackRow[]>([])
  const [mapPins, setMapPins] = useState<MapPoint[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [sortCol, setSortCol] = useState<SortCol>('created_at')
  const [sortAsc, setSortAsc] = useState(false)
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
  const [slaMap, setSlaMap] = useState<Record<Priority, number>>({
    low: 168,
    medium: 72,
    high: 24,
    critical: 4,
  })
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<FeedbackStatus | ''>('')
  const [priority, setPriority] = useState<Priority | ''>('')
  const [channel, setChannel] = useState<FeedbackChannel | ''>('')
  const [locationFilter, setLocationFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [submitterSex, setSubmitterSex] = useState<SubmitterSex | ''>('')
  const [submitterAgeGroup, setSubmitterAgeGroup] = useState<SubmitterAgeGroup | ''>('')
  const [loopClosed, setLoopClosed] = useState<'yes' | 'no' | ''>('')
  const [sensitiveOnly, setSensitiveOnly] = useState(false)
  const [assignedToMe, setAssignedToMe] = useState(false)
  const [unassignedOnly, setUnassignedOnly] = useState(false)
  const { exporting, exportCsv } = useExportFeedbacksCsv()
  const [aiConfig, setAiConfig] = useState<DashboardAiConfig>({ enabled: true })

  const filters: FeedbackListFilters = useMemo(
    () => ({
      q,
      status,
      priority,
      channel,
      location: locationFilter,
      dateFrom,
      dateTo,
      submitterSex,
      submitterAgeGroup,
      loopClosed,
      sensitiveOnly,
      assignedToUserId: assignedToMe && user?.id ? user.id : undefined,
      unassignedOnly: unassignedOnly || undefined,
    }),
    [
      q,
      status,
      priority,
      channel,
      locationFilter,
      dateFrom,
      dateTo,
      submitterSex,
      submitterAgeGroup,
      loopClosed,
      sensitiveOnly,
      assignedToMe,
      unassignedOnly,
      user?.id,
    ],
  )

  const resetFilters = useCallback(() => {
    setQ('')
    setStatus('')
    setPriority('')
    setChannel('')
    setLocationFilter('')
    setDateFrom('')
    setDateTo('')
    setSubmitterSex('')
    setSubmitterAgeGroup('')
    setLoopClosed('')
    setSensitiveOnly(false)
    setAssignedToMe(false)
    setUnassignedOnly(false)
    setPage(0)
  }, [])

  const load = useCallback(async () => {
    setErr('')
    setLoading(true)
    try {
      const [pageRes, k, pins, sla] = await Promise.all([
        fetchFeedbacksPage({
          page,
          pageSize: PAGE_SIZE,
          sortCol,
          sortAsc,
          filters,
        }),
        fetchDashboardKpis(filters),
        fetchMapPins(filters),
        fetchSlaConfig(),
      ])
      setRows(pageRes.rows)
      setTotal(pageRes.total)
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
      const m: Record<Priority, number> = { low: 168, medium: 72, high: 24, critical: 4 }
      for (const r of sla) m[r.priority as Priority] = r.target_hours
      setSlaMap(m)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('dashboard.loadFail'))
    } finally {
      setLoading(false)
    }
  }, [page, sortCol, sortAsc, filters]) // eslint-disable-line react-hooks/exhaustive-deps -- t omis : pas recharger au changement de langue

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void fetchDashboardAiConfig()
      .then(setAiConfig)
      .catch(() => setAiConfig({ enabled: true }))
  }, [])

  useEffect(() => {
    setPage(0)
  }, [
    q,
    status,
    priority,
    channel,
    locationFilter,
    dateFrom,
    dateTo,
    submitterSex,
    submitterAgeGroup,
    loopClosed,
    sensitiveOnly,
    assignedToMe,
    unassignedOnly,
  ])

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

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortAsc(!sortAsc)
    else {
      setSortCol(col)
      setSortAsc(col === 'created_at' || col === 'assigned_at' ? false : true)
    }
  }

  async function onExport() {
    const msg = await exportCsv()
    if (msg) setErr(msg)
  }

  const quickTab = useMemo(() => {
    const noExtra =
      !q &&
      !channel &&
      !locationFilter &&
      !dateFrom &&
      !dateTo &&
      !submitterSex &&
      !submitterAgeGroup &&
      !loopClosed &&
      !sensitiveOnly &&
      !assignedToMe &&
      !unassignedOnly
    if (!noExtra) return 'other' as const
    if (status === 'closed' && !priority) return 'done' as const
    if (status === 'new' && !priority) return 'pending' as const
    if (priority === 'critical' && !status) return 'urgent' as const
    if (!status && !priority) return 'all' as const
    return 'other' as const
  }, [
    q,
    channel,
    locationFilter,
    dateFrom,
    dateTo,
    submitterSex,
    submitterAgeGroup,
    loopClosed,
    sensitiveOnly,
    assignedToMe,
    unassignedOnly,
    status,
    priority,
  ])

  function applyQuickTab(tab: 'all' | 'urgent' | 'pending' | 'done') {
    setPage(0)
    if (tab === 'all') {
      setStatus('')
      setPriority('')
    } else if (tab === 'urgent') {
      setStatus('')
      setPriority('critical')
    } else if (tab === 'pending') {
      setStatus('new')
      setPriority('')
    } else {
      setStatus('closed')
      setPriority('')
    }
  }

  function priorityTone(p: Priority): 'neutral' | 'info' | 'warn' | 'danger' | 'ok' {
    if (p === 'critical') return 'danger'
    if (p === 'high') return 'warn'
    if (p === 'low') return 'ok'
    return 'info'
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const aiEnabled = aiConfig.enabled !== false
  const aiBodyDisplay = useMemo(
    () => resolveDashboardAiBody(aiConfig, lang, t('dashboard.aiBody')),
    [aiConfig, lang, t],
  )

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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4">
        {(
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
        })}
      </div>

      <div className={clsx('grid gap-4', aiEnabled ? 'lg:grid-cols-3' : 'grid-cols-1')}>
        <Card className={aiEnabled ? 'lg:col-span-2' : undefined}>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <h2 className="font-semibold text-[var(--text-heading)]">{t('dashboard.map')}</h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('dashboard.mapGeoCaption')}
            </span>
          </div>
          <FeedbackMap pins={mapPins} />
        </Card>
        {aiEnabled && (
          <Card className="flex flex-col !border-[var(--app-navy)] !bg-[var(--app-navy)] text-white shadow-[var(--card-shadow)]">
            <span className="text-lg" aria-hidden>
              ✨
            </span>
            <h3 className="mt-2 text-lg font-semibold text-white">{t('dashboard.aiTitle')}</h3>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-white/80">{aiBodyDisplay}</p>
            {canViewAnalytics(role) ? (
              <Link to="/app/analytics" className="mt-6 block">
                <Button type="button" variant="primary" className="w-full">
                  {t('dashboard.aiCta')}
                </Button>
              </Link>
            ) : (
              <p className="mt-6 text-xs text-white/50">{t('dashboard.aiCtaNoAccess')}</p>
            )}
          </Card>
        )}
      </div>

      <Card>
        <h2 className="text-xl font-bold tracking-tight text-[var(--text-heading)]">{t('dashboard.filters')}</h2>
        <p className="mt-1 text-sm italic text-[var(--text-muted)]">{t('dashboard.filterSubtitle')}</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_minmax(240px,280px)]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div>
              <label htmlFor="dash_q" className={FILTER_LBL}>
                {t('dashboard.searchPh')}
              </label>
              <input
                id="dash_q"
                className={SELECT_FIELD}
                placeholder={t('dashboard.searchPh')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div>
              <label className={FILTER_LBL}>{t('dashboard.filterStatus')}</label>
              <select
                className={SELECT_FIELD}
                value={status}
                onChange={(e) => setStatus(e.target.value as FeedbackStatus | '')}
              >
                <option value="">{t('common.all')}</option>
                {STATUS_KEYS.map((s) => (
                  <option key={s} value={s}>
                    {t(`feedbackStatus.${s}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={FILTER_LBL}>{t('dashboard.filterPriority')}</label>
              <select
                className={SELECT_FIELD}
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority | '')}
              >
                <option value="">{t('common.allFem')}</option>
                {PRIORITY_KEYS.map((p) => (
                  <option key={p} value={p}>
                    {t(`priority.${p}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={FILTER_LBL}>{t('dashboard.filterChannel')}</label>
              <select
                className={SELECT_FIELD}
                value={channel}
                onChange={(e) => setChannel(e.target.value as FeedbackChannel | '')}
              >
                <option value="">{t('common.all')}</option>
                {CHANNEL_KEYS.map((c) => (
                  <option key={c} value={c}>
                    {t(`channel.${c}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="dash_loc" className={FILTER_LBL}>
                {t('dashboard.locPh')}
              </label>
              <input
                id="dash_loc"
                className={SELECT_FIELD}
                placeholder={t('dashboard.locPh')}
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              />
            </div>
            <Input type="date" label={t('dashboard.dateFrom')} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input type="date" label={t('dashboard.dateTo')} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            <div>
              <label className={FILTER_LBL}>{t('dashboard.filterSex')}</label>
              <select
                className={SELECT_FIELD}
                value={submitterSex}
                onChange={(e) => setSubmitterSex(e.target.value as SubmitterSex | '')}
              >
                <option value="">{t('common.all')}</option>
                {SEX_KEYS.map((s) => (
                  <option key={s} value={s}>
                    {t(`sex.${s}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={FILTER_LBL}>{t('dashboard.filterAge')}</label>
              <select
                className={SELECT_FIELD}
                value={submitterAgeGroup}
                onChange={(e) => setSubmitterAgeGroup(e.target.value as SubmitterAgeGroup | '')}
              >
                <option value="">{t('common.allFem')}</option>
                {AGE_KEYS.map((a) => (
                  <option key={a} value={a}>
                    {t(`ageGroup.${a}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={FILTER_LBL}>{t('dashboard.filterLoop')}</label>
              <select
                className={SELECT_FIELD}
                value={loopClosed}
                onChange={(e) => setLoopClosed(e.target.value as 'yes' | 'no' | '')}
              >
                <option value="">{t('common.all')}</option>
                <option value="yes">{t('dashboard.loopYes')}</option>
                <option value="no">{t('dashboard.loopNo')}</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col rounded-xl bg-[var(--app-navy)] p-5 text-white shadow-[var(--card-shadow)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/90">{t('dashboard.quickOptionsTitle')}</h3>
            <div className="mt-4 flex flex-col gap-3">
              <label className="flex cursor-pointer items-center gap-3 text-sm text-white/95">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-white/30 bg-white/10 accent-violet-400"
                  checked={sensitiveOnly}
                  onChange={(e) => setSensitiveOnly(e.target.checked)}
                />
                {t('dashboard.sensitiveOnly')}
              </label>
              {role !== 'field_agent' && user && (
                <label className="flex cursor-pointer items-center gap-3 text-sm text-white/95">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-white/30 bg-white/10 accent-violet-400"
                    checked={assignedToMe}
                    onChange={(e) => {
                      setAssignedToMe(e.target.checked)
                      if (e.target.checked) setUnassignedOnly(false)
                    }}
                  />
                  {t('dashboard.filterAssignedToMe')}
                </label>
              )}
              {role !== 'field_agent' && (
                <label className="flex cursor-pointer items-center gap-3 text-sm text-white/95">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-white/30 bg-white/10 accent-violet-400"
                    checked={unassignedOnly}
                    onChange={(e) => {
                      setUnassignedOnly(e.target.checked)
                      if (e.target.checked) setAssignedToMe(false)
                    }}
                  />
                  {t('dashboard.filterUnassigned')}
                </label>
              )}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={resetFilters}>
            {t('dashboard.resetFilters')}
          </Button>
          <Button type="button" variant="navy" onClick={() => setPage(0)}>
            🔍 {t('dashboard.applyFilters')}
          </Button>
        </div>
      </Card>

      <Card className="relative">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold tracking-tight text-[var(--text-heading)]">
              {t('dashboard.listSectionTitle')}
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              {t('dashboard.listTitle', { page: page + 1, totalPages, total })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  ['all', t('dashboard.tabAll')] as const,
                  ['urgent', t('dashboard.tabUrgent')] as const,
                  ['pending', t('dashboard.tabPending')] as const,
                  ['done', t('dashboard.tabDone')] as const,
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyQuickTab(key)}
                  className={clsx(
                    'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                    quickTab === key
                      ? 'bg-[var(--app-purple)] text-white'
                      : 'bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text)]',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {loading ? (
          <p className="text-[var(--text-muted)]">{t('common.loading')}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-[var(--border)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    <th className="pb-3 pr-2">
                      <button
                        type="button"
                        className="hover:text-[var(--app-purple)]"
                        onClick={() => toggleSort('created_at')}
                      >
                        {t('dashboard.colDate')} {sortCol === 'created_at' ? (sortAsc ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="pb-3 pr-2">
                      <button
                        type="button"
                        className="hover:text-[var(--app-purple)]"
                        onClick={() => toggleSort('channel')}
                      >
                        {t('dashboard.colChannel')} {sortCol === 'channel' ? (sortAsc ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="pb-3 pr-2">
                      <button
                        type="button"
                        className="hover:text-[var(--app-purple)]"
                        onClick={() => toggleSort('status')}
                      >
                        {t('dashboard.colStatus')} {sortCol === 'status' ? (sortAsc ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="pb-3 pr-2">
                      <button
                        type="button"
                        className="hover:text-[var(--app-purple)]"
                        onClick={() => toggleSort('priority')}
                      >
                        {t('dashboard.colPriority')} {sortCol === 'priority' ? (sortAsc ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="pb-3 pr-2">{t('dashboard.colCategory')}</th>
                    <th className="pb-3 pr-2">
                      <button
                        type="button"
                        className="hover:text-[var(--app-purple)]"
                        onClick={() => toggleSort('assigned_at')}
                      >
                        {t('dashboard.colAssignee')} {sortCol === 'assigned_at' ? (sortAsc ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="pb-3">{t('dashboard.colExcerpt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((f) => {
                    const ep = effectivePriority(f.priority, f.priority_override)
                    const cat = f.category
                    const late = slaBreached(f, slaMap)
                    return (
                      <tr
                        key={f.id}
                        className="border-b border-[var(--border)]/50 transition-colors hover:bg-[var(--surface-hover)]/80"
                      >
                        <td className="py-3 pr-2 align-top text-sm whitespace-nowrap text-[var(--text-muted)]">
                          {format(new Date(f.created_at), 'dd MMM yyyy', { locale: dateLocale })}
                          <span className="block text-xs opacity-80">
                            {format(new Date(f.created_at), 'HH:mm', { locale: dateLocale })}
                          </span>
                        </td>
                        <td className="py-3 pr-2 align-top text-sm">{t(`channel.${f.channel}`)}</td>
                        <td className="py-3 pr-2 align-top">
                          <Badge tone={statusTone(f.status)}>{t(`feedbackStatus.${f.status}`)}</Badge>
                          {late && (
                            <Badge tone="warn" className="ml-1 !normal-case !tracking-normal">
                              {t('dashboard.slaLate')}
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 pr-2 align-top">
                          <Badge tone={priorityTone(ep)} className="!normal-case !tracking-normal">
                            {t(`priority.${ep}`)}
                          </Badge>
                        </td>
                        <td className="py-3 pr-2 align-top text-sm">{categoryLabel(cat, lang)}</td>
                        <td className="py-3 pr-2 align-top">
                          {f.assignee ? (
                            <div className="flex items-center gap-2">
                              <AssigneeAvatar
                                name={f.assignee.full_name}
                                email={f.assignee.email}
                              />
                              <span className="text-sm font-medium text-[var(--text-heading)]">
                                {f.assignee.full_name?.trim() || f.assignee.email || '—'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm italic text-[var(--text-muted)]">
                              {t('dashboard.unassignedDash')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 align-top">
                          <Link
                            to={`/app/feedback/${f.id}`}
                            className="line-clamp-2 text-sm font-medium text-[var(--app-purple)] hover:underline dark:text-[var(--app-purple-hover)]"
                          >
                            {f.description}
                          </Link>
                          {f.is_sensitive && (
                            <Badge tone="danger" className="ml-2">
                              {t('dashboard.badgeSensitive')}
                            </Badge>
                          )}
                          {f.needs_duplicate_review && (
                            <Badge tone="warn" className="ml-2">
                              {t('dashboard.badgeDup')}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                {t('dashboard.prev')}
              </Button>
              <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded-md bg-[var(--app-navy)] px-3 py-1.5 text-sm font-semibold text-white">
                {page + 1}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('dashboard.next')}
              </Button>
            </div>
          </>
        )}
        {canSubmitFeedback(role) && (
          <Link
            to="/app/intake"
            className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--app-purple)] text-2xl font-light text-white shadow-lg transition-transform hover:scale-105 hover:bg-[var(--app-purple-hover)] md:right-8"
            aria-label={t('nav.intake')}
          >
            +
          </Link>
        )}
      </Card>
    </div>
  )
}
