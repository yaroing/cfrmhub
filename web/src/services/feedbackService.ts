import { supabase } from '../lib/supabaseClient'
import type {
  FeedbackChannel,
  FeedbackRow,
  FeedbackStatus,
  FeedbackType,
  NotificationChannel,
  Priority,
  SensitiveType,
  SubmitterAgeGroup,
  SubmitterSex,
  SlaConfigRow,
} from '../types'
import { effectivePriority } from '../utils/classification'

const SELECT_FULL = `*,
  category:categories!feedbacks_category_id_fkey ( id, slug, label_fr, label_en, sort_order, is_active ),
  suggested_category:categories!feedbacks_category_suggested_id_fkey ( id, slug, label_fr, label_en, sort_order, is_active ),
  assignee:profiles!feedbacks_assigned_to_fkey ( id, full_name, email, role, specialty )`

export type FeedbackListFilters = {
  q?: string
  status?: FeedbackStatus | ''
  priority?: Priority | '' /** filtre approximatif (priorité ou override) */
  channel?: FeedbackChannel | ''
  location?: string
  dateFrom?: string
  dateTo?: string
  submitterSex?: SubmitterSex | ''
  submitterAgeGroup?: SubmitterAgeGroup | ''
  loopClosed?: 'yes' | 'no' | ''
  sensitiveOnly?: boolean
  /** Filtrer les fiches assignées à cet utilisateur (profil). */
  assignedToUserId?: string
  /** Fiches sans assignation */
  unassignedOnly?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- builder Supabase dynamique
function applyListFilters(q: any, f: FeedbackListFilters) {
  let qb = q
  if (f.status) qb = qb.eq('status', f.status)
  if (f.channel) qb = qb.eq('channel', f.channel)
  if (f.priority)
    qb = qb.or(`priority.eq.${f.priority},priority_override.eq.${f.priority}`)
  if (f.location?.trim()) qb = qb.ilike('location_label', `%${f.location.trim()}%`)
  if (f.dateFrom) qb = qb.gte('created_at', `${f.dateFrom}T00:00:00`)
  if (f.dateTo) qb = qb.lte('created_at', `${f.dateTo}T23:59:59`)
  if (f.submitterSex) qb = qb.eq('submitter_sex', f.submitterSex)
  if (f.submitterAgeGroup) qb = qb.eq('submitter_age_group', f.submitterAgeGroup)
  if (f.loopClosed === 'yes') qb = qb.not('loop_closed_at', 'is', null)
  if (f.loopClosed === 'no') qb = qb.is('loop_closed_at', null)
  if (f.sensitiveOnly) qb = qb.eq('is_sensitive', true)
  if (f.assignedToUserId) qb = qb.eq('assigned_to', f.assignedToUserId)
  if (f.unassignedOnly) qb = qb.is('assigned_to', null)
  if (f.q?.trim()) {
    const qq = f.q.trim()
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRe.test(qq)) qb = qb.or(`id.eq.${qq},description.ilike.%${qq}%`)
    else qb = qb.ilike('description', `%${qq}%`)
  }
  return qb
}

export async function submitPublicFeedback(params: {
  channel: FeedbackChannel
  feedback_type: FeedbackType
  description: string
  location_label?: string
  contact_name?: string
  contact_phone?: string
  contact_email?: string
  lat?: number | null
  lng?: number | null
  submitter_age_group?: SubmitterAgeGroup | null
  submitter_sex?: SubmitterSex | null
  submitter_diversity?: string[] | null
  submitter_language?: string | null
}): Promise<{ id: string; receipt_message: string }> {
  const { data, error } = await supabase.rpc('submit_public_feedback', {
    p_channel: params.channel,
    p_feedback_type: params.feedback_type,
    p_description: params.description,
    p_location_label: params.location_label ?? null,
    p_contact_name: params.contact_name ?? null,
    p_contact_phone: params.contact_phone ?? null,
    p_contact_email: params.contact_email ?? null,
    p_lat: params.lat ?? null,
    p_lng: params.lng ?? null,
    p_submitter_age_group: params.submitter_age_group ?? null,
    p_submitter_sex: params.submitter_sex ?? null,
    p_submitter_diversity: params.submitter_diversity ?? null,
    p_submitter_language: params.submitter_language ?? null,
  })
  if (error) throw error
  const row = data as { id?: string; receipt_message?: string }
  if (!row?.id) throw new Error('Réponse RPC invalide')
  return { id: row.id, receipt_message: row.receipt_message ?? '' }
}

export async function insertAuthenticatedFeedback(params: {
  channel: FeedbackChannel
  feedback_type: FeedbackType
  description: string
  location_label?: string | null
  contact_name?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  lat?: number | null
  lng?: number | null
  submitter_age_group?: SubmitterAgeGroup | null
  submitter_sex?: SubmitterSex | null
  submitter_diversity?: string[] | null
  submitter_language?: string | null
}): Promise<string> {
  const { data: session } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('feedbacks')
    .insert({
      channel: params.channel,
      feedback_type: params.feedback_type,
      description: params.description,
      location_label: params.location_label,
      contact_name: params.contact_name,
      contact_phone: params.contact_phone,
      contact_email: params.contact_email,
      lat: params.lat,
      lng: params.lng,
      created_by: session.user?.id ?? null,
      submitter_age_group: params.submitter_age_group,
      submitter_sex: params.submitter_sex,
      submitter_diversity: params.submitter_diversity,
      submitter_language: params.submitter_language,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export type SortCol = 'created_at' | 'status' | 'priority' | 'channel' | 'assigned_at'

export async function fetchFeedbacksPage(params: {
  page: number
  pageSize: number
  sortCol: SortCol
  sortAsc: boolean
  filters: FeedbackListFilters
}): Promise<{ rows: FeedbackRow[]; total: number }> {
  const from = params.page * params.pageSize
  const to = from + params.pageSize - 1
  let q = supabase.from('feedbacks').select(SELECT_FULL, { count: 'exact' })
  q = applyListFilters(q, params.filters)
  if (params.sortCol === 'priority') {
    q = q.order('priority', { ascending: params.sortAsc }).order('created_at', { ascending: false })
  } else if (params.sortCol === 'assigned_at') {
    q = q
      .order('assigned_at', { ascending: params.sortAsc, nullsFirst: false })
      .order('created_at', { ascending: false })
  } else {
    q = q.order(params.sortCol, { ascending: params.sortAsc })
  }
  const { data, error, count } = await q.range(from, to)
  if (error) throw error
  return { rows: (data ?? []) as FeedbackRow[], total: count ?? 0 }
}

/** Points carte (léger) — mêmes filtres, plafonné */
export async function fetchMapPins(
  filters: FeedbackListFilters,
  limit = 400,
): Promise<
  Pick<FeedbackRow, 'id' | 'lat' | 'lng' | 'description' | 'channel' | 'is_sensitive'>[]
> {
  let q = supabase
    .from('feedbacks')
    .select('id, lat, lng, description, channel, is_sensitive')
    .not('lat', 'is', null)
    .not('lng', 'is', null)
  q = applyListFilters(q, filters)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return (data ?? []) as Pick<FeedbackRow, 'id' | 'lat' | 'lng' | 'description' | 'channel' | 'is_sensitive'>[]
}

export type DashboardKpis = {
  total: number
  newCount: number
  inProgress: number
  closed: number
  critical: number
  duplicates: number
  loopClosed: number
  sensitiveOpen: number
}

export async function fetchDashboardKpis(filters: FeedbackListFilters): Promise<DashboardKpis> {
  const base = () => supabase.from('feedbacks').select('*', { count: 'exact', head: true })

  const run = async (extra?: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
    let q = base()
    q = applyListFilters(q, filters)
    if (extra) q = extra(q)
    const { count, error } = await q
    if (error) throw error
    return count ?? 0
  }

  const [total, newCount, inProgress, closed, critical, duplicates, loopClosed, sensitiveOpen] =
    await Promise.all([
      run(),
      run((q) => q.eq('status', 'new')),
      run((q) => q.eq('status', 'in_progress')),
      run((q) => q.eq('status', 'closed')),
      run((q) => q.or('priority.eq.critical,priority_override.eq.critical')),
      run((q) => q.eq('needs_duplicate_review', true)),
      run((q) => q.not('loop_closed_at', 'is', null)),
      run((q) => q.eq('is_sensitive', true).neq('status', 'closed')),
    ])

  return {
    total,
    newCount,
    inProgress,
    closed,
    critical,
    duplicates,
    loopClosed,
    sensitiveOpen,
  }
}

export async function fetchFeedbacksWithCategories(): Promise<FeedbackRow[]> {
  const { data, error } = await supabase
    .from('feedbacks')
    .select(SELECT_FULL)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as FeedbackRow[]
}

export async function fetchFeedbackById(id: string): Promise<FeedbackRow | null> {
  const { data, error } = await supabase
    .from('feedbacks')
    .select(SELECT_FULL)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as FeedbackRow | null
}

export async function updateFeedback(
  id: string,
  patch: Partial<{
    status: FeedbackStatus
    category_id: string | null
    priority_override: Priority | null
    duplicate_of_id: string | null
    needs_duplicate_review: boolean
    is_sensitive: boolean
    sensitive_type: SensitiveType | null
    sensitive_flagged_by: string | null
    sensitive_flagged_at: string | null
    assigned_to: string | null
    lat: number | null
    lng: number | null
    location_label: string | null
  }>,
): Promise<void> {
  const { error } = await supabase.from('feedbacks').update(patch).eq('id', id)
  if (error) throw error
}

export async function closeLoop(
  feedbackId: string,
  params: { community_response_text: string; community_notified_via: NotificationChannel },
): Promise<void> {
  const { error } = await supabase.rpc('close_feedback_loop', {
    p_feedback_id: feedbackId,
    p_response_text: params.community_response_text,
    p_channel: params.community_notified_via,
  })
  if (error) throw error
}

export async function appAuditLog(
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase.rpc('app_audit_log', {
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_details: details as never,
  })
  if (error) throw error
}

export async function searchFeedbacksForMerge(
  query: string,
  excludeId: string,
  limit = 15,
): Promise<Pick<FeedbackRow, 'id' | 'description' | 'created_at' | 'location_label'>[]> {
  const t = `%${query.trim()}%`
  const { data, error } = await supabase
    .from('feedbacks')
    .select('id, description, created_at, location_label')
    .neq('id', excludeId)
    .or(`description.ilike.${t},id.eq.${query.trim()}`)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as Pick<FeedbackRow, 'id' | 'description' | 'created_at' | 'location_label'>[]
}

export async function fetchSlaConfig(): Promise<SlaConfigRow[]> {
  const { data, error } = await supabase.from('sla_config').select('*')
  if (error) throw error
  return (data ?? []) as SlaConfigRow[]
}

export function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3600000
}

export function slaBreached(
  row: Pick<FeedbackRow, 'created_at' | 'status' | 'priority' | 'priority_override'>,
  slaMap: Record<Priority, number>,
): boolean {
  if (row.status !== 'new') return false
  const p = effectivePriority(row.priority, row.priority_override)
  const target = slaMap[p] ?? 72
  return hoursSince(row.created_at) > target
}

export async function fetchComments(feedbackId: string) {
  const { data, error } = await supabase
    .from('feedback_comments')
    .select('*')
    .eq('feedback_id', feedbackId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function addComment(feedbackId: string, body: string) {
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) throw new Error('Non authentifié')
  const { error } = await supabase.from('feedback_comments').insert({
    feedback_id: feedbackId,
    user_id: u.user.id,
    body,
  })
  if (error) throw error
}

export async function fetchCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function fetchStatusHistory(feedbackId: string) {
  const { data, error } = await supabase
    .from('feedback_status_history')
    .select('*')
    .eq('feedback_id', feedbackId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}
