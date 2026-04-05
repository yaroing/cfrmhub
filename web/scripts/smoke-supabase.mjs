/**
 * Smoke test : appelle la RPC submit_public_feedback avec la clé anon.
 * Prérequis : Node 20+ (option --env-file), migrations init + v2_features appliquées.
 *
 * Usage (depuis web/) : npm run smoke:supabase
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Variables manquantes : VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY')
  console.error('Lancez depuis le dossier web/ : npm run smoke:supabase')
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const desc =
  process.env.SMOKE_DESCRIPTION?.trim() ||
  'CFRM Hub smoke test — vérification RPC submit_public_feedback (10+ caractères).'

const { data, error } = await supabase.rpc('submit_public_feedback', {
  p_channel: 'web',
  p_feedback_type: 'feedback',
  p_description: desc,
})

if (error) {
  console.error('Échec RPC submit_public_feedback :', error.message)
  console.error(
    'Vérifiez : migrations dans l’ordre (init → v2_features → v2_rls_storage), Realtime optionnel pour ce test.',
  )
  process.exit(1)
}

const id = data?.id
const receipt = data?.receipt_message
console.log('OK — soumission publique acceptée.')
console.log('  id               :', id)
console.log('  receipt_message:', receipt ?? '(vide)')
console.log('Note : une ligne a été créée dans public.feedbacks (donnée de test).')
await supabase.removeAllChannels()
// Laisser les handles HTTP/WebSocket se fermer (évite un crash libuv sur Windows à process.exit).
await new Promise((r) => setTimeout(r, 300))
process.exit(0)
