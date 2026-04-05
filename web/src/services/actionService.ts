import { supabase } from '../lib/supabaseClient'
import type { ActionItem, ActionStatus } from '../types'
import { appAuditLog } from './feedbackService'

const SELECT_ACTION = `*,
  category:categories!action_items_category_id_fkey ( id, slug, label_fr, label_en, sort_order, is_active ),
  owner:profiles!action_items_owner_id_profiles_fkey ( id, full_name, email )`

export async function fetchActions(filters?: {
  status?: ActionStatus | ''
  categoryId?: string
  ownerId?: string | '__unassigned__'
}): Promise<ActionItem[]> {
  let q = supabase.from('action_items').select(SELECT_ACTION).order('updated_at', { ascending: false })
  if (filters?.status) q = q.eq('status', filters.status)
  if (filters?.categoryId) q = q.eq('category_id', filters.categoryId)
  if (filters?.ownerId === '__unassigned__') q = q.is('owner_id', null)
  else if (filters?.ownerId) q = q.eq('owner_id', filters.ownerId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as ActionItem[]
}

export async function fetchActionById(id: string): Promise<ActionItem | null> {
  const { data, error } = await supabase.from('action_items').select(SELECT_ACTION).eq('id', id).maybeSingle()
  if (error) throw error
  return data as ActionItem | null
}

export async function createAction(params: {
  title: string
  description?: string | null
  category_id?: string | null
  due_date?: string | null
  owner_id?: string | null
}): Promise<string> {
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) throw new Error('Non authentifié')
  const { data, error } = await supabase
    .from('action_items')
    .insert({
      title: params.title,
      description: params.description ?? null,
      category_id: params.category_id ?? null,
      due_date: params.due_date ?? null,
      owner_id: params.owner_id ?? null,
      created_by: u.user.id,
    })
    .select('id')
    .single()
  if (error) throw error
  const id = data.id as string
  try {
    await appAuditLog('action_created', 'action_item', id, { title: params.title })
  } catch {
    /* audit réservé admin/validateur — ne bloque pas la création */
  }
  return id
}

export async function updateAction(
  id: string,
  patch: Partial<{
    title: string
    description: string | null
    status: ActionStatus
    category_id: string | null
    due_date: string | null
    owner_id: string | null
    notes: string | null
  }>,
): Promise<void> {
  const { error } = await supabase.from('action_items').update(patch).eq('id', id)
  if (error) throw error
  const fields = Object.keys(patch)
  if (fields.length === 0) return
  try {
    await appAuditLog('action_updated', 'action_item', id, { fields })
  } catch {
    /* idem */
  }
}

export async function linkFeedbackToAction(feedbackId: string, actionId: string): Promise<void> {
  const { error } = await supabase.from('feedback_action_links').insert({ feedback_id: feedbackId, action_id: actionId })
  if (error) throw error
}

export async function unlinkFeedbackFromAction(feedbackId: string, actionId: string): Promise<void> {
  const { error } = await supabase
    .from('feedback_action_links')
    .delete()
    .eq('feedback_id', feedbackId)
    .eq('action_id', actionId)
  if (error) throw error
}

export async function fetchLinkedActionsForFeedback(feedbackId: string): Promise<ActionItem[]> {
  const { data: links, error: e1 } = await supabase
    .from('feedback_action_links')
    .select('action_id')
    .eq('feedback_id', feedbackId)
  if (e1) throw e1
  const ids = (links ?? []).map((l) => l.action_id as string)
  if (ids.length === 0) return []
  const { data, error } = await supabase.from('action_items').select(SELECT_ACTION).in('id', ids)
  if (error) throw error
  return (data ?? []) as ActionItem[]
}

export async function fetchLinkedFeedbacksForAction(actionId: string) {
  const { data: links, error: e1 } = await supabase
    .from('feedback_action_links')
    .select('feedback_id')
    .eq('action_id', actionId)
  if (e1) throw e1
  const ids = (links ?? []).map((l) => l.feedback_id as string)
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('feedbacks')
    .select('id, description, created_at, status, channel')
    .in('id', ids)
  if (error) throw error
  return data ?? []
}
