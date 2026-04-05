/**
 * Webhook Meta WhatsApp Cloud API → feedbacks canal `whatsapp_business`.
 *
 * Secrets Supabase (Edge Functions) :
 *   WHATSAPP_VERIFY_TOKEN   — jeton de vérification du webhook (Meta Developer Console)
 *   WHATSAPP_APP_SECRET     — secret d’application (signatures X-Hub-Signature-256)
 *   WHATSAPP_ACCESS_TOKEN   — token d’accès système utilisateur (longue durée) pour répondre
 *   WHATSAPP_PHONE_NUMBER_ID — ID du numéro WhatsApp Business (Graph API)
 *   SUPABASE_SERVICE_ROLE_KEY
 * Optionnel : SUPABASE_URL
 */
import { createClient } from 'npm:@supabase/supabase-js@2.49.1'

function resolveSupabaseUrl(req: Request): string | undefined {
  const fromEnv = Deno.env.get('SUPABASE_URL')?.trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ?? req.headers.get('host')?.trim()
  if (host && /\.supabase\.co$/i.test(host)) return `https://${host}`
  try {
    const u = new URL(req.url)
    if (u.host && /\.supabase\.co$/i.test(u.host)) return `https://${u.host}`
  } catch {
    /* ignore */
  }
  return undefined
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let x = 0
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return x === 0
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  const bytes = new Uint8Array(sig)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): Promise<boolean> {
  if (!header?.startsWith('sha256=')) return false
  const expected = await hmacSha256Hex(appSecret, rawBody)
  const received = header.slice(7)
  return timingSafeEqualHex(expected, received)
}

type WaTextMessage = {
  from: string
  id: string
  timestamp?: string
  type: string
  text?: { body: string }
}

type WaValue = {
  messaging_product?: string
  metadata?: { display_phone_number?: string; phone_number_id?: string }
  messages?: WaTextMessage[]
}

type WaChange = { value?: WaValue; field?: string }

type WaEntry = { id?: string; changes?: WaChange[] }

type WaWebhookBody = { object?: string; entry?: WaEntry[] }

async function sendWhatsAppText(
  accessToken: string,
  phoneNumberId: string,
  to: string,
  body: string,
): Promise<void> {
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { preview_url: false, body: body.slice(0, 4096) },
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    console.error('whatsapp-business-webhook: Graph API send', res.status, t.slice(0, 500))
  }
}

Deno.serve(async (req) => {
  try {
    const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN')?.trim()
    const appSecret = Deno.env.get('WHATSAPP_APP_SECRET')?.trim()
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')?.trim()
    const defaultPhoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')?.trim()
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
    const supabaseUrl = resolveSupabaseUrl(req)

    if (req.method === 'GET' || req.method === 'HEAD') {
      const u = new URL(req.url)
      const mode = u.searchParams.get('hub.mode')
      const token = u.searchParams.get('hub.verify_token')
      const challenge = u.searchParams.get('hub.challenge')
      if (mode === 'subscribe' && token && challenge && verifyToken && token === verifyToken) {
        if (req.method === 'HEAD') {
          return new Response(null, { status: 200 })
        }
        return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
      }
      const text =
        'CFRM Hub — webhook WhatsApp Business (Meta Cloud API).\n' +
        'Configurer cette URL dans Meta Developer → WhatsApp → Configuration.\n' +
        'GET avec hub.mode=subscribe pour la vérification.\n'
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

    const rawBody = await req.text()

    if (appSecret) {
      const sig = req.headers.get('X-Hub-Signature-256')
      const ok = await verifyMetaSignature(rawBody, sig, appSecret)
      if (!ok) {
        console.error('whatsapp-business-webhook: signature X-Hub-Signature-256 invalide')
        return new Response('Forbidden', { status: 403 })
      }
    }

    let body: WaWebhookBody
    try {
      body = JSON.parse(rawBody) as WaWebhookBody
    } catch {
      return new Response('Bad Request', { status: 400 })
    }

    if (body.object !== 'whatsapp_business_account') {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!serviceKey || !supabaseUrl) {
      console.error('whatsapp-business-webhook: SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_URL manquant')
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: setting } = await supabase
      .from('channel_settings')
      .select('value')
      .eq('key', 'whatsapp_business')
      .maybeSingle()

    const enabled = (setting?.value as { enabled?: boolean } | null)?.enabled === true
    if (!enabled) {
      return new Response(JSON.stringify({ success: true, skipped: 'disabled' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value
        if (!value?.messages?.length) continue

        const phoneNumberId = value.metadata?.phone_number_id ?? defaultPhoneNumberId
        const displayNumber = value.metadata?.display_phone_number ?? null

        for (const msg of value.messages) {
          if (msg.type !== 'text' || !msg.text?.body) continue

          const textRaw = msg.text.body.trim()
          const waId = msg.id
          const from = msg.from?.replace(/\D/g, '') ?? ''

          async function replyUser(message: string): Promise<void> {
            if (accessToken && phoneNumberId && from) {
              await sendWhatsAppText(accessToken, phoneNumberId, from, message)
            }
          }

          if (textRaw.length < 10) {
            await replyUser('Message trop court : minimum 10 caractères. Merci de reformuler.')
            continue
          }

          if (textRaw.length > 8000) {
            await replyUser('Message trop long (max. 8000 caractères). Merci de raccourcir.')
            continue
          }

          const { data: existing } = await supabase
            .from('feedbacks')
            .select('id, receipt_message')
            .eq('channel', 'whatsapp_business')
            .contains('metadata', { wa_message_id: waId })
            .maybeSingle()

          if (existing?.id) {
            const r =
              (existing as { receipt_message?: string }).receipt_message?.slice(0, 500) ??
              'Votre message est déjà enregistré.'
            await replyUser(r)
            continue
          }

          const { data: inserted, error } = await supabase
            .from('feedbacks')
            .insert({
              channel: 'whatsapp_business',
              feedback_type: 'feedback',
              description: textRaw,
              contact_phone: from || null,
              metadata: {
                wa_message_id: waId,
                wa_from: from,
                wa_timestamp: msg.timestamp ?? null,
                wa_phone_number_id: phoneNumberId ?? null,
                wa_display_phone_number: displayNumber,
                source: 'whatsapp_business',
              },
            })
            .select('id, receipt_message')
            .single()

          if (error) {
            console.error('whatsapp-business-webhook: insert', error.message)
            if (error.code === '23505') {
              await replyUser('Votre message est déjà enregistré.')
            } else {
              await replyUser('Service temporairement indisponible. Réessayez plus tard.')
            }
            continue
          }

          const receipt =
            (inserted as { receipt_message?: string })?.receipt_message?.slice(0, 500) ??
            'Merci, votre message a été reçu.'
          await replyUser(receipt)
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('whatsapp-business-webhook', e)
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
