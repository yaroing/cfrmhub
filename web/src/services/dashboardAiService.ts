import { supabase } from '../lib/supabaseClient'
import type { FeedbackListFilters } from './feedbackService'

const KEY = 'dashboard_ai'

/** `manual` : textes édités ci-dessous. `gemini` : synthèse via Edge Function + Google Gemini. */
export type DashboardAiSource = 'manual' | 'gemini'

export type DashboardAiConfig = {
  enabled?: boolean
  source?: DashboardAiSource
  body_fr?: string
  body_en?: string
}

export async function fetchDashboardAiConfig(): Promise<DashboardAiConfig> {
  const { data, error } = await supabase.from('channel_settings').select('value').eq('key', KEY).maybeSingle()
  if (error) throw error
  return (data?.value as DashboardAiConfig) ?? { enabled: true }
}

/** Texte affiché : personnalisé si renseigné, sinon clé i18n `dashboard.aiBody`. */
export function resolveDashboardAiBody(
  config: DashboardAiConfig,
  lang: string,
  fallback: string,
): string {
  const fr = lang.startsWith('fr')
  const custom = (fr ? config.body_fr : config.body_en)?.trim()
  return custom || fallback
}

/** Utilise la source Gemini (secret GEMINI_API_KEY côté Supabase). */
export async function invokeDashboardGeminiInsight(
  filters: FeedbackListFilters,
  lang: string,
): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) {
    throw new Error('session_required')
  }

  const { data, error } = await supabase.functions.invoke('dashboard-ai-insight', {
    body: { filters, lang },
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (error) throw new Error(error.message)
  const payload = data as { error?: string; detail?: string; text?: string } | null
  if (payload && typeof payload === 'object' && payload.error) {
    const hint = typeof (payload as { hint?: string }).hint === 'string' ? (payload as { hint: string }).hint : ''
    const base = payload.detail ?? payload.error
    throw new Error(hint ? `${base} — ${hint}` : base)
  }
  const text = payload?.text?.trim()
  if (!text) throw new Error('empty_insight')
  return text
}
