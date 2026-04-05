/**
 * Webhook Twilio (SMS entrant) → crée un feedback `sms_twilio`.
 *
 * Secrets : TWILIO_AUTH_TOKEN, SUPABASE_SERVICE_ROLE_KEY
 * Optionnel : SUPABASE_URL, TWILIO_WEBHOOK_URL
 *
 * Import npm officiel (évite les 500 intermittents avec esm.sh).
 */
import { createClient } from 'npm:@supabase/supabase-js@2.49.1'

function formBodyToRecord(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of new URLSearchParams(text)) {
    out[k] = v
  }
  return out
}

function resolveSupabaseUrl(req: Request): string | undefined {
  const fromEnv = Deno.env.get('SUPABASE_URL')?.trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ?? req.headers.get('host')?.trim()
  if (host && /\.supabase\.co$/i.test(host)) {
    return `https://${host}`
  }
  try {
    const u = new URL(req.url)
    if (u.host && /\.supabase\.co$/i.test(u.host)) {
      return `https://${u.host}`
    }
  } catch {
    /* ignore */
  }
  return undefined
}

async function twilioExpectedSignatureBase64(
  authToken: string,
  fullUrl: string,
  params: Record<string, string>,
): Promise<string> {
  const sortedKeys = Object.keys(params).sort()
  let data = ''
  for (const k of sortedKeys) {
    data += k + params[k]
  }
  const payload = fullUrl + data
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  const bytes = new Uint8Array(sig)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin)
}

function b64ToBytes(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64.trim())
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

function timingSafeEqualB64(a: string, b: string): boolean {
  const da = b64ToBytes(a)
  const db = b64ToBytes(b)
  if (!da || !db || da.length !== db.length) return false
  let x = 0
  for (let i = 0; i < da.length; i++) x |= da[i]! ^ db[i]!
  return x === 0
}

function webhookUrlCandidates(req: Request, envUrl: string | undefined, supabaseUrl: string | undefined): string[] {
  const seen = new Set<string>()
  const add = (u: string | undefined) => {
    const s = u?.trim()
    if (!s) return
    seen.add(s.replace(/\/+$/, ''))
    if (!s.endsWith('/')) seen.add(s + '/')
  }
  add(envUrl)
  if (supabaseUrl) {
    const base = supabaseUrl.replace(/\/+$/, '')
    add(`${base}/functions/v1/twilio-sms-inbound`)
  }
  try {
    const u = new URL(req.url)
    if (u.protocol === 'https:' || u.protocol === 'http:') {
      const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ?? u.host
      const protoRaw = req.headers.get('x-forwarded-proto') ?? u.protocol.replace(':', '')
      const proto = protoRaw.split(',')[0]?.trim()
      const p = proto === 'http' || proto === 'https' ? proto : 'https'
      if (host && u.pathname) {
        add(`${p}://${host}${u.pathname}`)
      }
    }
  } catch {
    /* ignore */
  }
  return [...seen]
}

async function twilioSignatureValidForAnyUrl(
  authToken: string,
  twilioSignature: string,
  params: Record<string, string>,
  candidates: string[],
): Promise<boolean> {
  if (!twilioSignature || candidates.length === 0) return false
  for (const url of candidates) {
    const expected = await twilioExpectedSignatureBase64(authToken, url, params)
    if (timingSafeEqualB64(expected, twilioSignature)) return true
  }
  return false
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function twimlMessage(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(body)}</Message></Response>`
}

function twimlResponse(body: string): Response {
  return new Response(twimlMessage(body), {
    status: 200,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  })
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'GET' || req.method === 'HEAD') {
      const text =
        'CFRM Hub — webhook SMS Twilio (entrant).\n' +
        'Cette URL doit être configurée en HTTP POST dans la console Twilio (Messaging).\n' +
        'Une ouverture dans le navigateur envoie GET : aucun SMS n’est traité ici.\n'
      if (req.method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Length': String(new TextEncoder().encode(text).length),
          },
        })
      }
      return new Response(text, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    const rawBody = await req.text()
    const params = formBodyToRecord(rawBody)
    const sig = req.headers.get('X-Twilio-Signature') ?? ''

    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')?.trim()
    if (!authToken) {
      console.error('twilio-sms-inbound: TWILIO_AUTH_TOKEN manquant (secret Edge Function)')
      return twimlResponse(
        'Service SMS non configuré (token Twilio). L’administrateur doit ajouter le secret TWILIO_AUTH_TOKEN.',
      )
    }

    const supabaseUrl = resolveSupabaseUrl(req)
    const webhookUrl = Deno.env.get('TWILIO_WEBHOOK_URL')?.trim()
    const urlCandidates = webhookUrlCandidates(req, webhookUrl, supabaseUrl)

    if (!(await twilioSignatureValidForAnyUrl(authToken, sig, params, urlCandidates))) {
      console.error('twilio-sms-inbound: signature Twilio invalide', {
        candidateCount: urlCandidates.length,
        hosts: urlCandidates.map((u) => {
          try {
            const p = new URL(u)
            return `${p.host}${p.pathname}`
          } catch {
            return '?'
          }
        }),
      })
      return new Response('Forbidden', { status: 403 })
    }

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
    if (!serviceKey) {
      console.error(
        'twilio-sms-inbound: SUPABASE_SERVICE_ROLE_KEY manquant — Dashboard → Project Settings → Edge Functions → Secrets',
      )
      return twimlResponse(
        'Enregistrement impossible : clé serveur manquante. Ajoutez SUPABASE_SERVICE_ROLE_KEY dans les secrets Supabase (service_role).',
      )
    }
    if (!supabaseUrl) {
      console.error('twilio-sms-inbound: SUPABASE_URL introuvable')
      return twimlResponse(
        'Enregistrement impossible : URL projet manquante. Ajoutez le secret SUPABASE_URL ou utilisez le domaine *.supabase.co.',
      )
    }

    const from = (params.From ?? '').trim()
    const smsBody = (params.Body ?? '').trim()
    const messageSid = (params.MessageSid ?? '').trim()
    const accountSid = (params.AccountSid ?? '').trim()
    const to = (params.To ?? '').trim()

    if (smsBody.length < 10) {
      return twimlResponse(
        'Votre message est trop court (minimum 10 caractères). Merci de reformuler et renvoyer.',
      )
    }

    if (smsBody.length > 8000) {
      return twimlResponse('Message trop long. Merci de raccourcir et renvoyer.')
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    if (messageSid) {
      const { data: existing } = await supabase
        .from('feedbacks')
        .select('id, receipt_message')
        .eq('channel', 'sms_twilio')
        .contains('metadata', { twilio_message_sid: messageSid })
        .maybeSingle()

      if (existing?.id) {
        const msg =
          (existing as { receipt_message?: string }).receipt_message?.slice(0, 300) ??
          'Merci, votre message est déjà enregistré.'
        return twimlResponse(msg)
      }
    }

    const { data: inserted, error } = await supabase
      .from('feedbacks')
      .insert({
        channel: 'sms_twilio',
        feedback_type: 'feedback',
        description: smsBody,
        contact_phone: from || null,
        metadata: {
          ...(messageSid ? { twilio_message_sid: messageSid } : {}),
          ...(accountSid ? { twilio_account_sid: accountSid } : {}),
          ...(to ? { twilio_to: to } : {}),
          source: 'twilio_inbound',
        },
      })
      .select('id, receipt_message')
      .single()

    if (error) {
      if (error.code === '23505') {
        return twimlResponse('Merci, votre message est déjà enregistré.')
      }
      console.error('twilio-sms-inbound insert:', error.code, error.message, error.details)
      return twimlResponse(
        `Enregistrement refusé par la base (${error.code ?? 'erreur'}). Vérifiez la migration sms_twilio et les logs.`,
      )
    }

    if (!inserted?.id) {
      console.error('twilio-sms-inbound: insert sans ligne retournée')
      return twimlResponse('Erreur technique après enregistrement. Réessayez plus tard.')
    }

    const receipt =
      (inserted as { receipt_message?: string }).receipt_message?.slice(0, 300) ??
      'Merci, votre message a bien été reçu.'

    const { error: auditErr } = await supabase.from('audit_logs').insert({
      user_id: null,
      action: 'twilio_sms_inbound',
      entity_type: 'feedback',
      entity_id: inserted.id,
      details: {
        twilio_message_sid: messageSid || null,
        from: from || null,
      },
    })
    if (auditErr) {
      console.error('twilio-sms-inbound audit_logs (non bloquant):', auditErr)
    }

    return twimlResponse(receipt)
  } catch (e) {
    console.error('twilio-sms-inbound exception:', e)
    return twimlResponse('Erreur technique. Réessayez plus tard.')
  }
})
