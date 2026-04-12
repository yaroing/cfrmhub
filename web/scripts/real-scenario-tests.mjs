/**
 * Suite étendue (> 60 cas) — RPC submit_public_feedback (clé anon).
 * Inclut géolocalisation, canaux simulateurs, démographie, doublons, tests négatifs.
 *
 * Usage (depuis web/) : npm run test:supabase:scenarios
 * Données : ./real-scenario-data.mjs
 *
 * Export : ../../Rapport Tests/exports/kpi_run_<timestamp>.json
 */
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { buildScenarios, NEGATIVE_SCENARIOS } from './real-scenario-data.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..', '..')
const exportDir = join(repoRoot, 'Rapport Tests', 'exports')

const url = process.env.VITE_SUPABASE_URL?.trim()
const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim()
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!url || !anonKey) {
  console.error('Variables manquantes : VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans web/.env')
  process.exit(1)
}

const scenarios = buildScenarios()
const scenarioById = new Map(scenarios.map((s) => [s.id, s]))

const anonClient = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const results = {
  meta: {
    generated_at: new Date().toISOString(),
    supabase_url_host: (() => {
      try {
        return new URL(url).host
      } catch {
        return null
      }
    })(),
    service_role_verification: Boolean(serviceKey),
    suite: {
      scenario_definitions: scenarios.length,
      negative_scenarios: NEGATIVE_SCENARIOS.length,
      description: 'Marqueurs [CFRM-HUB-TEST:Rxxx] et [CFRM-HUB-TEST:Dxx] ; doublons = deux appels RPC identiques.',
    },
  },
  rpc_submissions: [],
  negative_tests: [],
  verification: [],
  geo_verification: [],
  kpi: null,
}

/**
 * @param {object} s
 */
function rpcPayloadFromScenario(s) {
  return {
    p_channel: s.channel ?? 'web',
    p_feedback_type: s.feedback_type ?? 'feedback',
    p_description: s.description,
    p_location_label: s.location_label ?? null,
    p_contact_name: s.contact_name ?? null,
    p_contact_phone: s.contact_phone ?? null,
    p_contact_email: s.contact_email ?? null,
    p_lat: s.lat ?? null,
    p_lng: s.lng ?? null,
    p_submitter_age_group: s.submitter_age_group ?? null,
    p_submitter_sex: s.submitter_sex ?? null,
    p_submitter_diversity: s.submitter_diversity ?? null,
    p_submitter_language: s.submitter_language ?? null,
  }
}

async function submitScenario(s) {
  const { data, error } = await anonClient.rpc('submit_public_feedback', rpcPayloadFromScenario(s))
  return { data, error }
}

function pushRow(s, attempt, first) {
  const row = {
    scenario_id: s.id,
    suite: s.suite ?? null,
    attempt,
    ok: !first.error,
    error: first.error?.message ?? null,
    feedback_id: first.data?.id ?? null,
    channel: s.channel ?? 'web',
    lat: s.lat ?? null,
    lng: s.lng ?? null,
    location_label: s.location_label ?? null,
  }
  results.rpc_submissions.push(row)
  return row
}

console.log(
  `CFRM Hub — tests réels Supabase (${scenarios.length} scénarios, ${NEGATIVE_SCENARIOS.length} négatifs)\n`,
)

for (const s of scenarios) {
  const first = await submitScenario(s)
  pushRow(s, 1, first)
  if (first.error) {
    console.error(`  ${s.id} (1) ÉCHEC :`, first.error.message)
  } else {
    console.log(`  ${s.id} (1) OK — id ${first.data?.id}`)
  }

  if (s.duplicateSecond && !first.error) {
    const second = await submitScenario(s)
    pushRow(s, 2, second)
    if (second.error) {
      console.error(`  ${s.id} (2) ÉCHEC :`, second.error.message)
    } else {
      console.log(`  ${s.id} (2) OK — id ${second.data?.id} (doublon)`)
    }
  }
}

for (const n of NEGATIVE_SCENARIOS) {
  const { data, error } = await anonClient.rpc('submit_public_feedback', {
    p_channel: n.p_channel,
    p_feedback_type: n.p_feedback_type,
    p_description: n.p_description,
  })
  const ok = Boolean(error) && (error.message?.includes(n.expectSubstring) ?? false)
  results.negative_tests.push({
    scenario_id: n.id,
    ok,
    expectSubstring: n.expectSubstring,
    error: error?.message ?? null,
    unexpected_data: !error ? data : null,
  })
  if (ok) {
    console.log(`  ${n.id} (négatif) OK — ${error.message}`)
  } else {
    console.error(`  ${n.id} (négatif) ÉCHEC — attendu contenant "${n.expectSubstring}", obtenu :`, error?.message ?? data)
  }
}

const okSubmissions = results.rpc_submissions.filter((r) => r.ok).length
const totalAttempts = results.rpc_submissions.length

function nearlySameCoord(a, b, eps = 1e-5) {
  if (a == null || b == null) return a === b
  return Math.abs(a - b) <= eps
}

if (serviceKey) {
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  for (const s of scenarios) {
    const subs = results.rpc_submissions.filter((r) => r.scenario_id === s.id && r.ok && r.feedback_id)
    for (const sub of subs) {
      const { data: fb, error: e1 } = await admin
        .from('feedbacks')
        .select(
          'id, priority, needs_duplicate_review, category_suggested_id, lat, lng, location_label, channel, submitter_age_group, submitter_sex',
        )
        .eq('id', sub.feedback_id)
        .maybeSingle()
      if (e1 || !fb) {
        results.verification.push({
          scenario_id: s.id,
          attempt: sub.attempt ?? 1,
          feedback_id: sub.feedback_id,
          error: e1?.message ?? 'no row',
        })
        continue
      }
      const { data: cat } = await admin.from('categories').select('slug').eq('id', fb.category_suggested_id).maybeSingle()
      const slug = cat?.slug ?? null
      let classification_match = null
      if (s.expected) {
        classification_match = fb.priority === s.expected.priority && slug === s.expected.slug
        results.verification.push({
          scenario_id: s.id,
          attempt: sub.attempt ?? 1,
          feedback_id: fb.id,
          observed_priority: fb.priority,
          observed_slug: slug,
          expected_priority: s.expected.priority,
          expected_slug: s.expected.slug,
          classification_match,
          needs_duplicate_review: fb.needs_duplicate_review,
        })
      }

      if (s.verifyGeo) {
        const latOk = nearlySameCoord(fb.lat, s.verifyGeo.lat)
        const lngOk = nearlySameCoord(fb.lng, s.verifyGeo.lng)
        results.geo_verification.push({
          scenario_id: s.id,
          feedback_id: fb.id,
          expected_lat: s.verifyGeo.lat,
          expected_lng: s.verifyGeo.lng,
          observed_lat: fb.lat,
          observed_lng: fb.lng,
          coords_match: latOk && lngOk,
        })
      }
    }
  }

  const firstCriticalSub = results.rpc_submissions.find((r) => {
    if (!r.ok || !r.feedback_id) return false
    const sc = scenarioById.get(r.scenario_id)
    return sc?.expected?.priority === 'critical'
  })
  let notifForFirstCritical = 0
  if (firstCriticalSub?.feedback_id) {
    const { count } = await admin
      .from('notification_logs')
      .select('id', { count: 'exact', head: true })
      .eq('feedback_id', firstCriticalSub.feedback_id)
    notifForFirstCritical = count ?? 0
  }

  const classifOk = results.verification.filter((v) => v.classification_match === true).length
  const classifTotal = results.verification.filter((v) => typeof v.classification_match === 'boolean').length
  const geoOk = results.geo_verification.filter((g) => g.coords_match === true).length
  const geoTotal = results.geo_verification.length

  const dupScenarios = scenarios.filter((s) => s.duplicateSecond)
  let duplicatePairsOk = 0
  for (const ds of dupScenarios) {
    const ids = results.rpc_submissions
      .filter((r) => r.scenario_id === ds.id && r.ok && r.feedback_id)
      .map((r) => r.feedback_id)
    if (ids.length < 2) continue
    const { data: dupRows } = await admin.from('feedbacks').select('needs_duplicate_review').in('id', ids)
    if (dupRows?.some((row) => row.needs_duplicate_review === true)) duplicatePairsOk += 1
  }

  results.kpi = {
    reception_rate_rpc: totalAttempts ? okSubmissions / totalAttempts : null,
    rpc_attempts: totalAttempts,
    rpc_success: okSubmissions,
    negative_tests_passed: results.negative_tests.filter((t) => t.ok).length,
    negative_tests_total: results.negative_tests.length,
    classification_precision_sample: classifTotal ? classifOk / classifTotal : null,
    classification_matches: classifOk,
    classification_checked: classifTotal,
    geo_coords_match_rate: geoTotal ? geoOk / geoTotal : null,
    geo_checked: geoTotal,
    geo_matches: geoOk,
    notification_internal_sim_for_first_critical: notifForFirstCritical,
    duplicate_pairs_with_flag: duplicatePairsOk,
    duplicate_pairs_total: dupScenarios.length,
    note: 'Précision classification = lignes avec expected où priorité et slug = attendu. Géoloc = scénarios verifyGeo uniquement.',
  }

  console.log('\n--- KPI (service role) ---')
  console.log(JSON.stringify(results.kpi, null, 2))
} else {
  console.log(
    '\n(Sans SUPABASE_SERVICE_ROLE_KEY : pas de vérification auto. Exécutez supabase/tests/kpi_reel_cfrm_hub_test.sql dans le SQL Editor.)',
  )
  results.kpi = {
    reception_rate_rpc: totalAttempts ? okSubmissions / totalAttempts : null,
    rpc_attempts: totalAttempts,
    rpc_success: okSubmissions,
    negative_tests_passed: results.negative_tests.filter((t) => t.ok).length,
    negative_tests_total: results.negative_tests.length,
    note: 'Définissez SUPABASE_SERVICE_ROLE_KEY dans web/.env pour vérification classification, géoloc, notifications et doublons.',
  }
}

mkdirSync(exportDir, { recursive: true })
const outFile = join(exportDir, `kpi_run_${Date.now()}.json`)
writeFileSync(outFile, JSON.stringify(results, null, 2), 'utf8')
console.log(`\nExport écrit : ${outFile}`)

await anonClient.removeAllChannels()
if (serviceKey) {
  const adm = createClient(url, serviceKey, { auth: { persistSession: false } })
  await adm.removeAllChannels()
}
await new Promise((r) => setTimeout(r, 300))

const failedRpc = results.rpc_submissions.some((r) => !r.ok)
const negFail = results.negative_tests.some((t) => !t.ok)
if (failedRpc || negFail) process.exit(1)
process.exit(0)
