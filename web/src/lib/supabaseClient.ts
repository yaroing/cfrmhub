import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '../config/env'

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

function supabaseProjectRef(url: string): string {
  try {
    return new URL(url).hostname.split('.')[0] || 'local'
  } catch {
    return 'local'
  }
}

/**
 * Clé Auth distincte du client principal : évite l’avertissement GoTrue
 * « Multiple GoTrueClient instances … same storage key ».
 */
const ephemeralAuthStorageKey = `sb-${supabaseProjectRef(env.supabaseUrl)}-auth-token-cfrm-admin-signup`

let ephemeralAuthClient: SupabaseClient | null = null

/**
 * Client unique, sans persistance — pour `signUp` depuis l’admin sans remplacer la session courante.
 * Instance réutilisée (pas un nouveau `createClient` à chaque appel).
 */
export function getEphemeralAuthClient(): SupabaseClient {
  if (!ephemeralAuthClient) {
    ephemeralAuthClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storageKey: ephemeralAuthStorageKey,
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        },
      },
    })
  }
  return ephemeralAuthClient
}
