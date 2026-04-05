/**
 * Webhook Telegram Bot API → feedbacks canal `telegram_bot`.
 *
 * Secrets : TELEGRAM_BOT_TOKEN, SUPABASE_SERVICE_ROLE_KEY
 * Recommandé : TELEGRAM_WEBHOOK_SECRET (même valeur que setWebhook secret_token)
 * Optionnel : SUPABASE_URL
 */
import { createClient } from 'npm:@supabase/supabase-js@2.49.1'

type TgUser = { id: number; username?: string; first_name?: string; last_name?: string }
type TgChat = { id: number; type: string }
type TgMessage = {
  message_id: number
  from?: TgUser
  chat: TgChat
  text?: string
}

type TelegramUpdate = {
  update_id: number
  message?: TgMessage
  edited_message?: TgMessage
}

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

function extractMessage(update: TelegramUpdate): { msg: TgMessage; updateId: number } | null {
  const u = update.update_id
  if (update.message) return { msg: update.message, updateId: u }
  if (update.edited_message) return { msg: update.edited_message, updateId: u }
  return null
}

function displayName(from?: TgUser): string | null {
  if (!from) return null
  if (from.username) return `@${from.username}`
  const parts = [from.first_name, from.last_name].filter(Boolean)
  return parts.length ? parts.join(' ') : String(from.id)
}

async function telegramApi(botToken: string, method: string, body: Record<string, unknown>): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/${method}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text()
    console.error(`telegram-bot-webhook: Telegram API ${method} ${res.status}`, t.slice(0, 500))
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'GET' || req.method === 'HEAD') {
      const text =
        'CFRM Hub — webhook bot Telegram.\n' +
        'Configurer cette URL avec setWebhook (HTTPS) et un secret_token.\n' +
        'Telegram envoie des POST JSON (getUpdates via webhook).\n'
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

    const secret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')?.trim()
    if (secret) {
      const hdr = req.headers.get('X-Telegram-Bot-Api-Secret-Token')?.trim()
      if (hdr !== secret) {
        console.error('telegram-bot-webhook: secret_token invalide ou absent')
        return new Response('Forbidden', { status: 403 })
      }
    }

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')?.trim()
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
    const supabaseUrl = resolveSupabaseUrl(req)

    let update: TelegramUpdate
    try {
      update = (await req.json()) as TelegramUpdate
    } catch {
      return new Response('Bad Request', { status: 400 })
    }

    const extracted = extractMessage(update)
    if (!extracted) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { msg, updateId } = extracted
    const chatId = msg.chat.id
    const textRaw = (msg.text ?? '').trim()

    async function replyUser(message: string): Promise<Response> {
      if (botToken) {
        await telegramApi(botToken, 'sendMessage', {
          chat_id: chatId,
          text: message.slice(0, 4096),
          disable_web_page_preview: true,
        })
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!botToken) {
      console.error('telegram-bot-webhook: TELEGRAM_BOT_TOKEN manquant')
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (textRaw.startsWith('/start') || textRaw.startsWith('/help')) {
      await telegramApi(botToken, 'sendMessage', {
        chat_id: chatId,
        text:
          'CFRM Hub — feedback communautaire.\n\n' +
          'Envoyez un message texte (minimum 10 caractères) pour enregistrer un feedback. ' +
          'Vous recevrez un accusé de réception.\n\n' +
          'Commandes : /start, /help',
        disable_web_page_preview: true,
      })
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!textRaw) {
      await replyUser('Merci d’envoyer un message texte (minimum 10 caractères).')
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (textRaw.length < 10) {
      await replyUser('Message trop court : minimum 10 caractères. Reformulez et renvoyez.')
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (textRaw.length > 8000) {
      await replyUser('Message trop long (max. 8000 caractères). Raccourcissez et renvoyez.')
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!serviceKey || !supabaseUrl) {
      console.error('telegram-bot-webhook: SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_URL manquant')
      await replyUser('Service indisponible : configuration serveur incomplète.')
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const updateIdStr = String(updateId)
    const { data: existing } = await supabase
      .from('feedbacks')
      .select('id, receipt_message')
      .eq('channel', 'telegram_bot')
      .contains('metadata', { telegram_update_id: updateIdStr })
      .maybeSingle()

    if (existing?.id) {
      const r =
        (existing as { receipt_message?: string }).receipt_message?.slice(0, 500) ??
        'Votre message est déjà enregistré.'
      await replyUser(r)
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const from = msg.from
    const contactName = displayName(from)

    const { data: inserted, error } = await supabase
      .from('feedbacks')
      .insert({
        channel: 'telegram_bot',
        feedback_type: 'feedback',
        description: textRaw,
        contact_name: contactName,
        metadata: {
          telegram_update_id: updateIdStr,
          telegram_chat_id: String(chatId),
          telegram_message_id: String(msg.message_id),
          ...(from ? { telegram_user_id: String(from.id) } : {}),
          source: 'telegram_bot',
        },
      })
      .select('id, receipt_message')
      .single()

    if (error) {
      if (error.code === '23505') {
        await replyUser('Votre message est déjà enregistré.')
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      console.error('telegram-bot-webhook insert:', error.code, error.message)
      await replyUser('Enregistrement impossible. Réessayez plus tard ou contactez le support.')
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!inserted?.id) {
      await replyUser('Erreur technique après enregistrement.')
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const receipt =
      (inserted as { receipt_message?: string }).receipt_message?.slice(0, 3500) ??
      'Merci, votre message a bien été reçu.'

    const { error: auditErr } = await supabase.from('audit_logs').insert({
      user_id: null,
      action: 'telegram_bot_inbound',
      entity_type: 'feedback',
      entity_id: inserted.id,
      details: {
        telegram_update_id: updateId,
        chat_id: chatId,
      },
    })
    if (auditErr) console.error('telegram-bot-webhook audit_logs:', auditErr)

    await replyUser(receipt)
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('telegram-bot-webhook exception:', e)
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
