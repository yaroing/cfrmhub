/**
 * Traite les lignes notification_logs en statut pending (canal loop_closure).
 *
 * Secrets : SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL (auto)
 * Optionnel : RESEND_API_KEY + RESEND_FROM_EMAIL (si notified_via = email)
 * Optionnel : LOOP_OUTBOUND_WEBHOOK_URL — POST JSON de chaque notification
 *
 * Appel : POST avec Authorization: Bearer <SERVICE_ROLE_KEY>
 * (planifier via cron Supabase ou outil externe).
 */
import { createClient } from 'npm:@supabase/supabase-js@2.49.1'

type NotifRow = {
  id: string
  feedback_id: string | null
  channel: string
  payload: Record<string, unknown>
  created_at: string
}

Deno.serve(async (req) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    const text =
      'CFRM Hub — traitement des notifications sortantes (loop_closure).\n' +
      'Utilisez POST avec Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>.\n'
    if (req.method === 'HEAD') {
      return new Response(null, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Length': String(new TextEncoder().encode(text).length),
        },
      })
    }
    return new Response(text, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const sr = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  const url = Deno.env.get('SUPABASE_URL')?.trim()
  const auth = req.headers.get('Authorization')?.trim()

  if (!sr || !url || auth !== `Bearer ${sr}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(url, sr)

  const { data: rows, error: fetchErr } = await supabase
    .from('notification_logs')
    .select('id, feedback_id, channel, payload, created_at')
    .eq('status', 'pending')
    .eq('channel', 'loop_closure')
    .order('created_at', { ascending: true })
    .limit(30)

  if (fetchErr) {
    console.error('process-outbound-notifications fetch:', fetchErr)
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const resendKey = Deno.env.get('RESEND_API_KEY')?.trim()
  const resendFrom = Deno.env.get('RESEND_FROM_EMAIL')?.trim()
  const webhookUrl = Deno.env.get('LOOP_OUTBOUND_WEBHOOK_URL')?.trim()

  const results: { id: string; status: string; detail?: string }[] = []

  for (const row of (rows ?? []) as NotifRow[]) {
    const p = { ...(row.payload ?? {}) }
    const notifiedVia = String(p.notified_via ?? '')
    let ok = false
    let errMsg = ''

    try {
      if (resendKey && resendFrom && notifiedVia === 'email' && p.contact_email) {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: resendFrom,
            to: [String(p.contact_email)],
            subject: 'Réponse à votre signalement',
            text: String(p.response_text ?? ''),
          }),
        })
        if (r.ok) {
          ok = true
        } else {
          errMsg = await r.text()
        }
      } else if (webhookUrl) {
        const r = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(row),
        })
        if (r.ok) {
          ok = true
        } else {
          errMsg = `webhook HTTP ${r.status}`
        }
      } else {
        errMsg =
          "Aucune configuration d'envoi : définir RESEND_API_KEY+RESEND_FROM_EMAIL (canal email) ou LOOP_OUTBOUND_WEBHOOK_URL"
      }
    } catch (e) {
      errMsg = e instanceof Error ? e.message : String(e)
    }

    const nextPayload = ok ? p : { ...p, last_error: errMsg }
    const { error: upErr } = await supabase
      .from('notification_logs')
      .update({
        status: ok ? 'sent' : 'failed',
        payload: nextPayload,
      })
      .eq('id', row.id)

    if (upErr) {
      console.error('process-outbound-notifications update', row.id, upErr)
      results.push({ id: row.id, status: 'update_error', detail: upErr.message })
    } else {
      results.push({ id: row.id, status: ok ? 'sent' : 'failed', detail: ok ? undefined : errMsg })
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
