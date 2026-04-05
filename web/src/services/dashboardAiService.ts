import { supabase } from '../lib/supabaseClient'

const KEY = 'dashboard_ai'

export type DashboardAiConfig = {
  enabled?: boolean
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
