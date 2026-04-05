import { supabase } from '../lib/supabaseClient'
import type { WeeklyCountRow } from '../types'

export async function fetchWeeklyCounts(): Promise<WeeklyCountRow[]> {
  const { data, error } = await supabase
    .from('feedbacks_weekly_counts')
    .select('*')
    .limit(52)
  if (error) throw error
  return (data ?? []) as WeeklyCountRow[]
}

export type FeedbackAggRow = {
  feedback_type: string
  category_id: string | null
  location_label: string | null
  loop_closed_at: string | null
  created_at: string
  status: string
  priority: string
  priority_override: string | null
  first_touched_at: string | null
}

export async function fetchFeedbacksForAnalytics(sinceIso: string): Promise<FeedbackAggRow[]> {
  const { data, error } = await supabase
    .from('feedbacks')
    .select('feedback_type, category_id, location_label, loop_closed_at, created_at, status, priority, priority_override, first_touched_at')
    .gte('created_at', sinceIso)
  if (error) throw error
  return (data ?? []) as FeedbackAggRow[]
}
