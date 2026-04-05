import { supabase } from '../lib/supabaseClient'
import type { FeedbackAssignmentHistoryRow, ProfileAssigneeSnippet } from '../types'

/** Personnel auquel un validateur / admin peut assigner un feedback. */
export async function fetchAssignableStaff(): Promise<ProfileAssigneeSnippet[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, specialty')
    .in('role', ['admin', 'validator', 'observer', 'focal_point'])
    .order('full_name', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as ProfileAssigneeSnippet[]
}

const HISTORY_SELECT = `
  id,
  feedback_id,
  previous_assignee_id,
  new_assignee_id,
  assigned_by,
  created_at,
  assigner:profiles!feedback_assignment_history_assigned_by_fkey ( full_name, email ),
  new_assignee:profiles!feedback_assignment_history_new_assignee_id_fkey ( id, full_name, email, role, specialty ),
  previous_assignee:profiles!feedback_assignment_history_previous_assignee_id_fkey ( full_name, email )
`

export async function fetchAssignmentHistory(feedbackId: string): Promise<FeedbackAssignmentHistoryRow[]> {
  const { data, error } = await supabase
    .from('feedback_assignment_history')
    .select(HISTORY_SELECT)
    .eq('feedback_id', feedbackId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as FeedbackAssignmentHistoryRow[]
}

export function formatStaffOptionLabel(p: {
  full_name: string | null
  email: string | null
  specialty?: string | null
}): string {
  const name = p.full_name?.trim() || p.email || '—'
  const spec = p.specialty?.trim()
  return spec ? `${name} — ${spec}` : name
}
