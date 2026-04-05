/**
 * Synthèse « Analyse IA » pour le tableau de bord via Google Gemini.
 *
 * Secrets : GEMINI_API_KEY (obligatoire pour ce flux)
 * Optionnel : GEMINI_MODEL (sinon essai gemini-1.5-flash puis gemini-2.0-flash si 404)
 * Auto : SUPABASE_URL, SUPABASE_ANON_KEY
 *
 * POST JSON : { filters, lang?: "fr" | "en" }
 * — agrégats calculés avec le JWT appelant (RLS).
 */
import { createClient } from 'npm:@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Indications selon les messages d’erreur courants de l’API Google (clé restreinte, quota, etc.). */
function hintForGeminiDetail(detail: string): string | undefined {
  const d = detail.toLowerCase()
  if (
    /referrer|application restrictions|api key not valid|invalid api key|permission denied|requests from this|blocked/i.test(
      d,
    )
  ) {
    return 'Clé Google : les restrictions « Applications » (sites web / HTTP referrer) bloquent les appels depuis Supabase Edge. Créez une clé avec restriction « Aucune » (réservée au backend) ou une clé dédiée serveur dans Google AI Studio / Cloud Console.'
  }
  if (/billing|has not been used|enable.*api|generative language|service disabled/i.test(d)) {
    return 'Vérifiez que l’API Generative Language est activée pour le projet Google et que la clé est autorisée pour cette API.'
  }
  if (/quota|resource_exhausted|rate limit|too many requests/i.test(d)) {
    return 'Quota ou limite de débit Google atteinte ; réessayez plus tard ou augmentez le plafond dans Google AI Studio.'
  }
  return undefined
}

type ListFilters = {
  q?: string
  status?: string
  channel?: string
  priority?: string
  location?: string
  dateFrom?: string
  dateTo?: string
  submitterSex?: string
  submitterAgeGroup?: string
  loopClosed?: string
  sensitiveOnly?: boolean
  assignedToUserId?: string
  unassignedOnly?: boolean
}

function applyListFilters(q: any, f: ListFilters) {
  let qb = q
  if (f.status) qb = qb.eq('status', f.status)
  if (f.channel) qb = qb.eq('channel', f.channel)
  if (f.priority) qb = qb.or(`priority.eq.${f.priority},priority_override.eq.${f.priority}`)
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

async function fetchKpis(supabase: ReturnType<typeof createClient>, filters: ListFilters) {
  const base = () => supabase.from('feedbacks').select('*', { count: 'exact', head: true })

  const run = async (extra?: (query: ReturnType<typeof base>) => ReturnType<typeof base>) => {
    let query = base()
    query = applyListFilters(query, filters)
    if (extra) query = extra(query)
    const { count, error } = await query
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

function buildPrompt(
  lang: string,
  kpis: Awaited<ReturnType<typeof fetchKpis>>,
  filters: ListFilters,
): string {
  const fr = lang.startsWith('fr')
  const filterNote = JSON.stringify(filters)
  const metrics = JSON.stringify(kpis)
  if (fr) {
    return `Tu es un analyste pour une plateforme de gestion des plaintes et retours (CFM) dans un contexte humanitaire (Niger / Afrique de l'Ouest).

Voici des indicateurs agrégés sur les fiches visibles pour l'utilisateur (filtres actifs, sans données personnelles) :
${metrics}

Résumé des critères de filtre (JSON, pour contexte) :
${filterNote}

Rédige 3 à 5 phrases en français : tendances, priorités apparentes, boucle de rétroaction et doublons si pertinent. Ton professionnel, concis, sans inventer de chiffres absents. Ne mentionne pas que tu es une IA.`
  }
  return `You support a complaints and feedback management platform (humanitarian context, Niger / West Africa).

Here are aggregate indicators for feedback records visible to this user (active filters, no personal data):
${metrics}

Filter criteria (JSON, for context):
${filterNote}

Write 3 to 5 sentences in English: trends, apparent priorities, feedback loop and duplicates if relevant. Professional, concise; do not invent figures. Do not mention being an AI.`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')?.trim()
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'missing_authorization' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const accessToken = authHeader.slice(7).trim()
  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'missing_authorization' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const url = Deno.env.get('SUPABASE_URL')?.trim()
  const anon = Deno.env.get('SUPABASE_ANON_KEY')?.trim()
  const geminiKey = Deno.env.get('GEMINI_API_KEY')?.trim()
  const modelEnv = Deno.env.get('GEMINI_MODEL')?.trim()

  if (!url || !anon) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!geminiKey) {
    return new Response(JSON.stringify({ error: 'gemini_not_configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: { filters?: ListFilters; lang?: string }
  try {
    body = (await req.json()) as { filters?: ListFilters; lang?: string }
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const filters = body.filters ?? {}
  const lang = typeof body.lang === 'string' ? body.lang : 'fr'

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  })

  // Important : passer le JWT explicitement (getUser() sans argument ne s’appuie pas toujours sur les headers globaux dans Deno Edge).
  const { data: userData, error: userErr } = await supabase.auth.getUser(accessToken)
  if (userErr || !userData.user) {
    console.error('dashboard-ai-insight auth:', userErr?.message ?? 'no user')
    return new Response(JSON.stringify({ error: 'unauthorized', detail: userErr?.message }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let kpis: Awaited<ReturnType<typeof fetchKpis>>
  try {
    kpis = await fetchKpis(supabase, filters)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'kpi_failed'
    console.error('dashboard-ai-insight kpis:', e)
    return new Response(JSON.stringify({ error: 'kpi_failed', detail: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const prompt = buildPrompt(lang, kpis, filters)

  const modelCandidates = [
    modelEnv,
    'gemini-1.5-flash',
    'gemini-2.0-flash',
  ].filter((m, i, arr) => Boolean(m) && arr.indexOf(m) === i) as string[]

  type GenJson = {
    error?: { message?: string; code?: number }
    promptFeedback?: { blockReason?: string }
    candidates?: {
      finishReason?: string
      content?: { parts?: { text?: string }[] }
    }[]
  }

  let lastDetail = ''
  let lastStatus = 0

  for (const model of modelCandidates) {
    const genUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`

    let genRes: Response
    try {
      genRes = await fetch(genUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.35, maxOutputTokens: 1024 },
        }),
      })
    } catch (e) {
      console.error('dashboard-ai-insight gemini fetch:', model, e)
      return new Response(JSON.stringify({ error: 'gemini_unreachable', detail: String(e) }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let genJson: GenJson
    try {
      genJson = (await genRes.json()) as GenJson
    } catch (e) {
      console.error('dashboard-ai-insight gemini json:', model, e)
      lastDetail = 'Réponse Gemini non JSON'
      lastStatus = genRes.status
      break
    }

    if (!genRes.ok) {
      lastDetail = genJson.error?.message ?? genRes.statusText
      lastStatus = genRes.status
      console.error('dashboard-ai-insight gemini api:', model, genRes.status, lastDetail)
      const retryable = genRes.status === 404 || /not found|does not exist|invalid model/i.test(lastDetail)
      if (retryable && model !== modelCandidates[modelCandidates.length - 1]) {
        continue
      }
      const hint = hintForGeminiDetail(lastDetail)
      return new Response(
        JSON.stringify({
          error: 'gemini_error',
          detail: lastDetail,
          model_tried: model,
          ...(hint ? { hint } : {}),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const text =
      genJson.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('')?.trim() ?? ''

    if (text) {
      return new Response(JSON.stringify({ text, kpis }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const block = genJson.promptFeedback?.blockReason ?? genJson.candidates?.[0]?.finishReason
    lastDetail = block
      ? `Bloqué ou vide (${block})`
      : `Réponse sans texte (modèle ${model})`
    console.error('dashboard-ai-insight gemini empty:', model, JSON.stringify(genJson).slice(0, 800))
  }

  const finalDetail = lastDetail || 'Aucune réponse exploitable'
  const hint = hintForGeminiDetail(finalDetail)
  return new Response(
    JSON.stringify({
      error: 'gemini_error',
      detail: finalDetail,
      last_http_status: lastStatus || undefined,
      ...(hint ? { hint } : {}),
    }),
    {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
})
