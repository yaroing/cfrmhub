export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
}

export function assertEnv(): void {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    console.warn(
      'CFRM Hub: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquant — configurez web/.env',
    )
  }
}
