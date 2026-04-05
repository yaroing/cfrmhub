import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { TextArea } from '../components/ui/TextArea'
import { deleteAttachment, fetchAttachments, uploadAttachment } from '../services/attachmentService'
import {
  createAction,
  fetchActions,
  fetchLinkedActionsForFeedback,
  linkFeedbackToAction,
  unlinkFeedbackFromAction,
} from '../services/actionService'
import {
  fetchAssignmentHistory,
  fetchAssignableStaff,
  formatStaffOptionLabel,
} from '../services/assignmentService'
import { fetchFocalPointsByType } from '../services/focalPointService'
import {
  addComment,
  appAuditLog,
  closeLoop,
  fetchCategories,
  fetchComments,
  fetchFeedbackById,
  fetchSlaConfig,
  fetchStatusHistory,
  hoursSince,
  searchFeedbacksForMerge,
  slaBreached,
  updateFeedback,
} from '../services/feedbackService'
import { useAuth, useRole } from '../hooks/useAuth'
import {
  canAdmin,
  canCommentInternal,
  canEditFeedback,
  canFlagSensitive,
  canManageActions,
  canViewSensitive,
} from '../utils/permissions'
import type {
  Category,
  FeedbackAssignmentHistoryRow,
  FeedbackRow,
  FeedbackStatus,
  NotificationChannel,
  Priority,
  ProfileAssigneeSnippet,
  SensitiveType,
} from '../types'
import { NigerVillageGeocodeFields } from '../components/location/NigerVillageGeocodeFields'
import type { NigerRegionValue } from '../constants/nigerRegions'
import { useDateFnsLocale } from '../hooks/useDateFnsLocale'
import { effectivePriority } from '../utils/classification'
import { categoryLabel } from '../utils/categoryLabel'
import { format } from 'date-fns'

const STATUS_KEYS: FeedbackStatus[] = [
  'new',
  'in_validation',
  'validated',
  'in_progress',
  'closed',
  'rejected',
]
const PRIORITY_KEYS: Priority[] = ['low', 'medium', 'high', 'critical']
const NOTIF_KEYS: NotificationChannel[] = [
  'email',
  'sms',
  'whatsapp',
  'telegram',
  'phone_call',
  'visit',
  'other',
]
const SENSITIVE_KEYS: SensitiveType[] = [
  'sgbv',
  'child_protection',
  'sea',
  'misconduct',
  'security',
  'other_sensitive',
]

export function FeedbackDetailPage() {
  const { t, i18n } = useTranslation()
  const dateLocale = useDateFnsLocale()
  const { id } = useParams<{ id: string }>()
  const role = useRole()
  const { user } = useAuth()
  const [row, setRow] = useState<FeedbackRow | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [comments, setComments] = useState<{ id: string; body: string; created_at: string; user_id: string }[]>(
    [],
  )
  const [history, setHistory] = useState<
    { id: string; previous_status: string | null; new_status: string; created_at: string }[]
  >([])
  const [commentText, setCommentText] = useState('')
  const [status, setStatus] = useState<FeedbackStatus>('new')
  const [categoryId, setCategoryId] = useState<string>('')
  const [priorityOverride, setPriorityOverride] = useState<Priority | ''>('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const [loopText, setLoopText] = useState('')
  const [loopVia, setLoopVia] = useState<NotificationChannel>('email')
  const [sensModal, setSensModal] = useState(false)
  const [sensType, setSensType] = useState<SensitiveType>('sgbv')
  const [dupQuery, setDupQuery] = useState('')
  const [dupHits, setDupHits] = useState<Pick<FeedbackRow, 'id' | 'description' | 'created_at'>[]>([])
  const [attachList, setAttachList] = useState<
    { id: string; file_name: string; mime_type: string | null; signedUrl: string; storage_path: string }[]
  >([])
  const [linkedActions, setLinkedActions] = useState<{ id: string; title: string; status: string }[]>([])
  const [actionPick, setActionPick] = useState('')
  const [allActions, setAllActions] = useState<{ id: string; title: string }[]>([])
  const [focal, setFocal] = useState<{ id: string; name: string; contact_email: string | null }[]>([])
  const [assignStaff, setAssignStaff] = useState<ProfileAssigneeSnippet[]>([])
  const [assignPick, setAssignPick] = useState('')
  const [assignHistory, setAssignHistory] = useState<FeedbackAssignmentHistoryRow[]>([])
  const [savingAssign, setSavingAssign] = useState(false)
  const [slaMap, setSlaMap] = useState<Record<Priority, number>>({
    low: 168,
    medium: 72,
    high: 24,
    critical: 4,
  })
  const [geoVillage, setGeoVillage] = useState('')
  const [geoRegion, setGeoRegion] = useState<NigerRegionValue | ''>('')
  const [geoLat, setGeoLat] = useState('')
  const [geoLng, setGeoLng] = useState('')
  const [geoNotice, setGeoNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [geoSaving, setGeoSaving] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setErr('')
    try {
      const [f, cats, com, hist, ah, sla, att, acts] = await Promise.all([
        fetchFeedbackById(id),
        fetchCategories(),
        fetchComments(id),
        fetchStatusHistory(id),
        fetchAssignmentHistory(id).catch(() => []),
        fetchSlaConfig(),
        fetchAttachments(id).catch(() => []),
        fetchLinkedActionsForFeedback(id).catch(() => []),
      ])
      setRow(f)
      setCategories(cats as Category[])
      setComments(com as typeof comments)
      setHistory(hist as typeof history)
      setAssignHistory(ah as FeedbackAssignmentHistoryRow[])
      setAttachList(att)
      setLinkedActions(acts.map((a) => ({ id: a.id, title: a.title, status: a.status })))
      const m: Record<Priority, number> = { low: 168, medium: 72, high: 24, critical: 4 }
      for (const r of sla) m[r.priority as Priority] = r.target_hours
      setSlaMap(m)
      if (f) {
        setStatus(f.status)
        setCategoryId(f.category_id ?? '')
        setPriorityOverride((f.priority_override as Priority | null) ?? '')
        setAssignPick(f.assigned_to ?? '')
        setGeoLat(f.lat != null && !Number.isNaN(Number(f.lat)) ? Number(f.lat).toFixed(6) : '')
        setGeoLng(f.lng != null && !Number.isNaN(Number(f.lng)) ? Number(f.lng).toFixed(6) : '')
        setGeoVillage('')
        setGeoRegion('')
        setGeoNotice(null)
        if (f.is_sensitive && f.sensitive_type && canViewSensitive(role)) {
          const fp = await fetchFocalPointsByType(f.sensitive_type)
          setFocal(fp.map((x) => ({ id: x.id, name: x.name, contact_email: x.contact_email })))
        } else setFocal([])
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('common.error'))
    }
  }, [id, role, t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!canEditFeedback(role)) {
      setAssignStaff([])
      return
    }
    void fetchAssignableStaff()
      .then(setAssignStaff)
      .catch(() => setAssignStaff([]))
  }, [role])

  useEffect(() => {
    if (canManageActions(role)) {
      void fetchActions().then((a) =>
        setAllActions(a.map((x) => ({ id: x.id, title: x.title }))),
      )
    }
  }, [role])

  function personSnippetLabel(
    p: { full_name: string | null; email: string | null } | null | undefined,
  ): string {
    if (!p) return t('feedbackDetail.assignmentUnassigned')
    return p.full_name?.trim() || p.email || '—'
  }

  async function saveAssignment() {
    if (!id || !canEditFeedback(role)) return
    setSavingAssign(true)
    setErr('')
    try {
      await updateFeedback(id, { assigned_to: assignPick.trim() || null })
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('feedbackDetail.assignmentSaveFail'))
    } finally {
      setSavingAssign(false)
    }
  }

  async function saveMeta() {
    if (!id || !canEditFeedback(role)) return
    setSaving(true)
    setErr('')
    try {
      await updateFeedback(id, {
        status,
        category_id: categoryId || null,
        priority_override: priorityOverride === '' ? null : priorityOverride,
      })
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('feedbackDetail.saveFail'))
    } finally {
      setSaving(false)
    }
  }

  async function sendComment() {
    if (!id || !commentText.trim() || !canCommentInternal(role)) return
    setErr('')
    try {
      await addComment(id, commentText.trim())
      setCommentText('')
      const com = await fetchComments(id)
      setComments(com as typeof comments)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('feedbackDetail.commentFail'))
    }
  }

  async function saveGeoPosition() {
    if (!id || !row) return
    setGeoNotice(null)
    if (!geoLat.trim() || !geoLng.trim()) {
      setGeoNotice({ ok: false, text: t('feedbackDetail.geoEmptyCoords') })
      return
    }
    const la = parseFloat(geoLat.replace(',', '.'))
    const lo = parseFloat(geoLng.replace(',', '.'))
    if (
      Number.isNaN(la) ||
      Number.isNaN(lo) ||
      la < -90 ||
      la > 90 ||
      lo < -180 ||
      lo > 180
    ) {
      setGeoNotice({ ok: false, text: t('feedbackDetail.geoInvalidCoords') })
      return
    }
    setGeoSaving(true)
    try {
      let label: string | null = row.location_label
      if (geoVillage.trim() && geoRegion) {
        label = `${geoVillage.trim()}, ${geoRegion}`
      }
      await updateFeedback(id, { lat: la, lng: lo, location_label: label })
      await load()
      setGeoNotice({ ok: true, text: t('feedbackDetail.geoSaved') })
    } catch (e: unknown) {
      setGeoNotice({ ok: false, text: e instanceof Error ? e.message : t('common.error') })
    } finally {
      setGeoSaving(false)
    }
  }

  async function doCloseLoop() {
    if (!id || !loopText.trim()) return
    setErr('')
    try {
      await closeLoop(id, { community_response_text: loopText.trim(), community_notified_via: loopVia })
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('feedbackDetail.closeLoopFail'))
    }
  }

  async function flagSensitive() {
    if (!id || !user) return
    setErr('')
    try {
      await updateFeedback(id, {
        is_sensitive: true,
        sensitive_type: sensType,
        sensitive_flagged_by: user.id,
        sensitive_flagged_at: new Date().toISOString(),
      })
      await appAuditLog('sensitive_flagged', 'feedback', id, { sensitive_type: sensType })
      setSensModal(false)
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('common.error'))
    }
  }

  async function searchDup() {
    if (!id || !dupQuery.trim()) return
    const hits = await searchFeedbacksForMerge(dupQuery, id)
    setDupHits(hits)
  }

  async function markDup(ofId: string) {
    if (!id) return
    await updateFeedback(id, { duplicate_of_id: ofId, needs_duplicate_review: false })
    await appAuditLog('duplicate_linked', 'feedback', id, { duplicate_of_id: ofId })
    await load()
  }

  async function markDistinct() {
    if (!id) return
    await updateFeedback(id, { needs_duplicate_review: false })
    await appAuditLog('duplicate_distinct', 'feedback', id, {})
    await load()
  }

  async function linkAction() {
    if (!id || !actionPick) return
    await linkFeedbackToAction(id, actionPick)
    await load()
  }

  async function newActionAndLink() {
    if (!id) return
    const title = window.prompt(t('feedbackDetail.newActionPrompt'))?.trim()
    if (!title || title.length < 5) return
    const aid = await createAction({ title })
    await linkFeedbackToAction(id, aid)
    await load()
  }

  async function onUploadFile(f: File) {
    if (!id) return
    await uploadAttachment(id, f)
    const att = await fetchAttachments(id)
    setAttachList(att)
  }

  if (!id) return null
  if (!row && !err) {
    return <div className="p-8 text-[var(--text-muted)]">{t('common.loading')}</div>
  }
  if (!row) {
    return (
      <div className="p-8">
        <p className="text-red-500">{err || t('feedbackDetail.notFound')}</p>
        <Link to="/app" className="text-blue-600">
          {t('feedbackDetail.back')}
        </Link>
      </div>
    )
  }

  const ep = effectivePriority(row.priority, row.priority_override)
  const cat = row.category
  const sug = row.suggested_category
  const masked = row.is_sensitive && !canViewSensitive(role)
  const h = hoursSince(row.created_at)
  const breached = slaBreached(row, slaMap)
  const targetH = slaMap[ep] ?? 72
  const slaColor =
    row.status !== 'new' ? 'text-emerald-600' : breached ? 'text-red-600' : h > targetH * 0.7 ? 'text-amber-600' : 'text-emerald-600'

  const fieldSelectClass =
    'w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] shadow-sm focus:border-[var(--app-purple)] focus:outline-none focus:ring-1 focus:ring-[var(--app-purple)]'

  return (
    <div className="flex-1 space-y-6 overflow-auto p-4 md:p-8">
      <nav
        className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]"
        aria-label="Breadcrumb"
      >
        <Link to="/app" className="transition-colors hover:text-[var(--app-purple)]">
          {t('feedbackDetail.crumbList')}
        </Link>
        <span aria-hidden className="text-[var(--border)]">
          /
        </span>
        <span className="text-[var(--text-heading)]">{t('feedbackDetail.crumbDetail')}</span>
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral" className="!normal-case !tracking-normal">
          {t(`channel.${row.channel}`)}
        </Badge>
        <Badge tone={row.status === 'closed' ? 'ok' : row.status === 'rejected' ? 'danger' : 'purple'}>
          {t(`feedbackStatus.${row.status}`)}
        </Badge>
        {row.is_sensitive && (
          <Badge tone="danger" className="!normal-case !tracking-normal">
            {t('dashboard.badgeSensitive')}
          </Badge>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-heading)] md:text-3xl">
          {t('feedbackDetail.title')}
        </h1>
        <p className="mt-1 inline-block rounded-full bg-[var(--surface-hover)] px-3 py-1 font-mono text-xs text-[var(--text-muted)]">
          {row.id}
        </p>
        <p className="text-sm text-[var(--text-muted)]">
          {t('feedbackDetail.receivedOn')} {format(new Date(row.created_at), 'PPpp', { locale: dateLocale })}
        </p>
      </div>

      {err && <p className="text-sm text-red-500">{err}</p>}

      <Card>
        <h2 className="mb-2 font-semibold text-[var(--text-heading)]">{t('feedbackDetail.sla')}</h2>
        <p className={slaColor}>
          {t('feedbackDetail.hoursSince')} <strong>
            {h.toFixed(1)} {t('feedbackDetail.hoursUnit')}
          </strong>
          {row.status === 'new' && (
            <>
              {' '}
              {t('feedbackDetail.slaTarget', { priority: t(`priority.${ep}`), hours: targetH })}
              {breached && ` ${t('feedbackDetail.slaBreached')}`}
            </>
          )}
        </p>
        {row.first_touched_at && (
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {t('feedbackDetail.firstTouched')}{' '}
            {format(new Date(row.first_touched_at), 'PPpp', { locale: dateLocale })}
          </p>
        )}
      </Card>

      {role !== 'field_agent' && (
        <Card>
          <h2 className="text-lg font-bold text-[var(--text-heading)]">{t('feedbackDetail.assignmentTitle')}</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{t('feedbackDetail.assignmentHint')}</p>
          {canEditFeedback(role) ? (
            <div className="mt-4 flex flex-col gap-4">
              <div>
                <label
                  htmlFor="assign_pick"
                  className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]"
                >
                  {t('feedbackDetail.assignmentSelect')}
                </label>
                <select
                  id="assign_pick"
                  className={fieldSelectClass}
                  value={assignPick}
                  onChange={(e) => setAssignPick(e.target.value)}
                >
                  <option value="">{t('feedbackDetail.assignmentUnassigned')}</option>
                  {assignStaff.map((p) => (
                    <option key={p.id} value={p.id}>
                      {formatStaffOptionLabel(p)} ({t(`roles.${p.role}`)})
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="primary"
                className="w-full sm:max-w-md"
                disabled={savingAssign}
                onClick={() => void saveAssignment()}
              >
                {savingAssign ? t('feedbackDetail.savingAssignment') : t('feedbackDetail.saveAssignment')}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-[var(--text)]">
              {row.assignee ? (
                <>
                  <strong>{personSnippetLabel(row.assignee)}</strong>
                  {row.assignee.specialty?.trim() && (
                    <span className="text-[var(--text-muted)]"> — {row.assignee.specialty}</span>
                  )}
                  <span className="ml-1 text-xs text-[var(--text-muted)]">
                    ({t(`roles.${row.assignee.role}`)})
                  </span>
                </>
              ) : (
                t('feedbackDetail.assignmentUnassigned')
              )}
            </p>
          )}
          {row.assigned_at && (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {t('feedbackDetail.assignmentUpdated')}{' '}
              {format(new Date(row.assigned_at), 'PPpp', { locale: dateLocale })}
            </p>
          )}
        </Card>
      )}

      {role !== 'field_agent' && (
        <Card>
          <h2 className="mb-4 font-semibold text-[var(--text-heading)]">
            {t('feedbackDetail.assignmentHistoryTitle')}
          </h2>
          <ul className="space-y-2 text-sm">
            {assignHistory.length === 0 && (
              <li className="text-[var(--text-muted)]">{t('feedbackDetail.noAssignmentHistory')}</li>
            )}
            {assignHistory.map((h) => (
              <li key={h.id} className="border-b border-[var(--border)]/50 pb-2">
                <span className="text-[var(--text-muted)]">
                  {format(new Date(h.created_at), 'PPpp', { locale: dateLocale })}
                </span>
                {' — '}
                {personSnippetLabel(h.previous_assignee)} → {personSnippetLabel(h.new_assignee)}
                {h.assigner && (
                  <span className="text-[var(--text-muted)]">
                    {' '}
                    ({t('feedbackDetail.assignmentBy', { name: personSnippetLabel(h.assigner) })})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="mb-2 font-semibold text-[var(--text-heading)]">{t('feedbackDetail.description')}</h2>
        {masked ? (
          <p className="text-[var(--text-muted)]">{t('feedbackDetail.maskedBody')}</p>
        ) : (
          <p className="whitespace-pre-wrap text-[var(--text)]">{row.description}</p>
        )}
        {!masked &&
          (row.submitter_age_group ||
            row.submitter_sex ||
            (row.submitter_diversity && row.submitter_diversity.length) ||
            row.submitter_language) && (
            <div className="mt-4 rounded-lg border border-[var(--border)] p-3 text-sm">
              <p className="font-medium text-[var(--text-heading)]">{t('feedbackDetail.demo')}</p>
              {row.submitter_age_group && (
                <p>
                  {t('feedbackDetail.ageLabel')} {t(`ageGroup.${row.submitter_age_group}`)}
                </p>
              )}
              {row.submitter_sex && (
                <p>
                  {t('feedbackDetail.sexLabel')} {t(`sex.${row.submitter_sex}`)}
                </p>
              )}
              {row.submitter_diversity && row.submitter_diversity.length > 0 && (
                <p>
                  {t('feedbackDetail.diversityLabel')}{' '}
                  {row.submitter_diversity.map((d) => t(`diversity.${d}`)).join(', ')}
                </p>
              )}
              {row.submitter_language && (
                <p>
                  {t('feedbackDetail.langLabel')} {row.submitter_language}
                </p>
              )}
            </div>
          )}
        {row.location_label && (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            {t('feedbackDetail.placeLabel')} {row.location_label}
          </p>
        )}
        {!masked && (row.contact_email || row.contact_phone || row.contact_name) && (
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {t('feedbackDetail.contactLabel')}{' '}
            {[row.contact_name, row.contact_phone, row.contact_email].filter(Boolean).join(' · ')}
          </p>
        )}
        {masked && (row.contact_email || row.contact_phone || row.contact_name) && (
          <p className="mt-2 text-sm text-[var(--text-muted)]">{t('feedbackDetail.contactsMasked')}</p>
        )}
        {row.receipt_message && (
          <div className="mt-4 rounded-lg border border-emerald-500/25 border-l-4 border-l-emerald-600 bg-emerald-500/5 p-4 text-sm shadow-sm dark:border-l-emerald-400">
            <strong className="text-emerald-900 dark:text-emerald-100">{t('feedbackDetail.receipt')}</strong>{' '}
            {row.receipt_message}
          </div>
        )}
      </Card>

      {canEditFeedback(role) && (
        <Card>
          <h2 className="mb-4 font-semibold text-[var(--text-heading)]">{t('feedbackDetail.geoTitle')}</h2>
          <NigerVillageGeocodeFields
            village={geoVillage}
            onVillageChange={setGeoVillage}
            region={geoRegion}
            onRegionChange={setGeoRegion}
            lat={geoLat}
            lng={geoLng}
            onLatLngChange={(la, lo) => {
              setGeoLat(la)
              setGeoLng(lo)
            }}
            i18nScope="public"
          />
          {geoNotice && (
            <p
              className={
                geoNotice.ok
                  ? 'mt-2 text-sm text-emerald-700 dark:text-emerald-300'
                  : 'mt-2 text-sm text-amber-700 dark:text-amber-200'
              }
              role="status"
            >
              {geoNotice.text}
            </p>
          )}
          <Button className="mt-4" disabled={geoSaving} onClick={() => void saveGeoPosition()}>
            {geoSaving ? t('feedbackDetail.geoSaving') : t('feedbackDetail.geoSave')}
          </Button>
        </Card>
      )}

      {row.loop_closed_at ? (
        <Card className="border-emerald-500/40 bg-emerald-500/10">
          <p className="font-medium text-emerald-800 dark:text-emerald-200">
            {t('feedbackDetail.loopClosedLine', {
              date: format(new Date(row.loop_closed_at!), 'PPpp', { locale: dateLocale }),
              via: row.community_notified_via
                ? t(`notifChannel.${row.community_notified_via}`)
                : t('common.none'),
            })}
          </p>
          {row.community_response_text && (
            <p className="mt-2 text-sm">{row.community_response_text}</p>
          )}
        </Card>
      ) : (
        canEditFeedback(role) && (
          <Card>
            <h2 className="mb-4 font-semibold text-[var(--text-heading)]">{t('feedbackDetail.loop')}</h2>
            <TextArea
              label={t('feedbackDetail.loopResponse')}
              value={loopText}
              onChange={(e) => setLoopText(e.target.value)}
            />
            <div className="mt-3">
              <label className="mb-1 block text-xs text-[var(--text-muted)]">{t('feedbackDetail.notifChannel')}</label>
              <select
                className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                value={loopVia}
                onChange={(e) => setLoopVia(e.target.value as NotificationChannel)}
              >
                {NOTIF_KEYS.map((c) => (
                  <option key={c} value={c}>
                    {t(`notifChannel.${c}`)}
                  </option>
                ))}
              </select>
            </div>
            <Button className="mt-3" onClick={() => void doCloseLoop()}>
              {t('feedbackDetail.closeLoopBtn')}
            </Button>
          </Card>
        )
      )}

      {canFlagSensitive(role) && !row.is_sensitive && (
        <>
          <Button variant="secondary" type="button" onClick={() => setSensModal(true)}>
            {t('feedbackDetail.flagSensitive')}
          </Button>
          {sensModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <Card className="w-full max-w-md">
                <h3 className="mb-3 font-semibold">{t('feedbackDetail.sensitiveTypeHeading')}</h3>
                <select
                  className="mb-4 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  value={sensType}
                  onChange={(e) => setSensType(e.target.value as SensitiveType)}
                >
                  {SENSITIVE_KEYS.map((st) => (
                    <option key={st} value={st}>
                      {t(`sensitiveType.${st}`)}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <Button variant="secondary" type="button" onClick={() => setSensModal(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="button" onClick={() => void flagSensitive()}>
                    {t('feedbackDetail.confirm')}
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {row.is_sensitive && canViewSensitive(role) && focal.length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold">{t('feedbackDetail.focal')}</h2>
          <ul className="space-y-2 text-sm">
            {focal.map((fp) => (
              <li key={fp.id}>
                <strong>{fp.name}</strong> {fp.contact_email && <span>— {fp.contact_email}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {canEditFeedback(role) && row.needs_duplicate_review && !row.duplicate_of_id && (
        <Card>
          <h2 className="mb-3 font-semibold text-[var(--text-heading)]">{t('feedbackDetail.dup')}</h2>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder={t('feedbackDetail.dupSearchPh')}
              value={dupQuery}
              onChange={(e) => setDupQuery(e.target.value)}
            />
            <Button type="button" variant="secondary" onClick={() => void searchDup()}>
              {t('feedbackDetail.dupSearch')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => void markDistinct()}>
              {t('feedbackDetail.markDistinct')}
            </Button>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {dupHits.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2 border-b border-[var(--border)]/50 py-2">
                <span className="font-mono text-xs">{h.id.slice(0, 8)}…</span>
                <span className="line-clamp-1 flex-1">{h.description}</span>
                <Button size="sm" type="button" onClick={() => void markDup(h.id)}>
                  {t('feedbackDetail.dupOf')}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 font-semibold text-[var(--text-heading)]">{t('feedbackDetail.attachments')}</h2>
        {!masked && (
          <>
            <div className="mb-3">
              <input
                type="file"
                accept="image/*,application/pdf,audio/*"
                className="text-sm"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void onUploadFile(f)
                  e.target.value = ''
                }}
              />
            </div>
            <ul className="space-y-2">
              {attachList.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <a href={a.signedUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                    {a.file_name}
                  </a>
                  {a.mime_type?.startsWith('image/') && (
                    <img src={a.signedUrl} alt="" className="h-16 w-16 rounded object-cover" />
                  )}
                  {canAdmin(role) && (
                    <Button
                      size="sm"
                      variant="danger"
                      type="button"
                      onClick={() =>
                        void (async () => {
                          await deleteAttachment(a.id, a.storage_path)
                          setAttachList(await fetchAttachments(id!))
                        })()
                      }
                    >
                      {t('feedbackDetail.deleteFile')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        {masked && <p className="text-[var(--text-muted)]">{t('feedbackDetail.attachmentsMasked')}</p>}
      </Card>

      {role !== 'field_agent' && (linkedActions.length > 0 || canManageActions(role)) && (
        <Card>
          <h2 className="mb-4 font-semibold">{t('feedbackDetail.linkedActions')}</h2>
          <ul className="mb-3 space-y-2">
            {linkedActions.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <Link to={`/app/actions/${a.id}`} className="text-blue-600 hover:underline">
                  {a.title}
                </Link>
                {canManageActions(role) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() =>
                      void (async () => {
                        await unlinkFeedbackFromAction(id!, a.id)
                        await load()
                      })()
                    }
                  >
                    {t('feedbackDetail.unlink')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {canManageActions(role) && (
            <div className="flex flex-wrap gap-2">
              <select
                className="max-w-xs flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                value={actionPick}
                onChange={(e) => setActionPick(e.target.value)}
              >
                <option value="">{t('feedbackDetail.linkToAction')}</option>
                {allActions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
              <Button type="button" variant="secondary" onClick={() => void linkAction()}>
                {t('feedbackDetail.link')}
              </Button>
              <Button type="button" onClick={() => void newActionAndLink()}>
                {t('feedbackDetail.createAndLink')}
              </Button>
            </div>
          )}
        </Card>
      )}

      <Card>
        <h2 className="mb-4 font-semibold text-[var(--text-heading)]">{t('feedbackDetail.workflow')}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs text-[var(--text-muted)]">{t('feedbackDetail.suggestedCat')}</p>
            <p>{sug ? categoryLabel(sug, i18n.language) : t('common.none')}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">{t('feedbackDetail.currentCat')}</p>
            <p>{cat ? categoryLabel(cat, i18n.language) : t('common.none')}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">{t('feedbackDetail.effectivePriority')}</p>
            <p className="font-medium">{t(`priority.${ep}`)}</p>
          </div>
        </div>

        {canEditFeedback(role) && (
            <div className="mt-6 space-y-4 border-t border-[var(--border)] pt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {t('feedbackDetail.status')}
                </label>
                <select
                  className={fieldSelectClass}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as FeedbackStatus)}
                >
                  {STATUS_KEYS.map((s) => (
                    <option key={s} value={s}>
                      {t(`feedbackStatus.${s}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {t('feedbackDetail.categoryValidation')}
                </label>
                <select
                  className={fieldSelectClass}
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">{t('common.none')}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {categoryLabel(c, i18n.language)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {t('feedbackDetail.priorityOverride')}
                </label>
                <select
                  className={fieldSelectClass}
                  value={priorityOverride}
                  onChange={(e) => setPriorityOverride((e.target.value || '') as Priority | '')}
                >
                  <option value="">{t('feedbackDetail.noOverride')}</option>
                  {PRIORITY_KEYS.map((p) => (
                    <option key={p} value={p}>
                      {t(`priority.${p}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button variant="navy" onClick={() => void saveMeta()} disabled={saving}>
              {saving ? t('feedbackDetail.saving') : t('feedbackDetail.saveChanges')}
            </Button>
          </div>
        )}

        {role === 'observer' && (
          <p className="mt-4 text-sm text-[var(--text-muted)]">{t('feedbackDetail.observerReadonly')}</p>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 font-semibold text-[var(--text-heading)]">{t('feedbackDetail.history')}</h2>
        <ul className="space-y-2 text-sm">
          {history.length === 0 && <li className="text-[var(--text-muted)]">{t('feedbackDetail.noHistory')}</li>}
          {history.map((h) => (
            <li key={h.id} className="border-b border-[var(--border)]/50 pb-2">
              {format(new Date(h.created_at), 'PPpp', { locale: dateLocale })} :{' '}
              {h.previous_status ? t(`feedbackStatus.${h.previous_status as FeedbackStatus}`) : t('common.none')} →{' '}
              {t(`feedbackStatus.${h.new_status as FeedbackStatus}`)}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-4 font-semibold text-[var(--text-heading)]">{t('feedbackDetail.comments')}</h2>
        <ul className="mb-4 space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg bg-[var(--surface-hover)] p-3 text-sm">
              <p className="text-xs text-[var(--text-muted)]">
                {format(new Date(c.created_at), 'PPpp', { locale: dateLocale })} — {c.user_id.slice(0, 8)}…
              </p>
              <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
        {canCommentInternal(role) && user && (
          <div className="space-y-2">
            <TextArea
              placeholder={t('feedbackDetail.commentPlaceholder')}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <Button onClick={() => void sendComment()}>{t('feedbackDetail.addComment')}</Button>
          </div>
        )}
      </Card>
    </div>
  )
}
