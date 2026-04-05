/* eslint-disable react-refresh/only-export-components -- hooks + provider */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Profile, UserRole } from '../types'

type AuthState = {
  user: import('@supabase/supabase-js').User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<import('@supabase/supabase-js').User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (uid: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    if (error) {
      console.error(error)
      setProfile(null)
      return
    }
    setProfile(data as Profile)
  }, [])

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getUser()
    if (data.user) await loadProfile(data.user.id)
    else setProfile(null)
  }, [loadProfile])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return
      setUser(session?.user ?? null)
      if (session?.user) await loadProfile(session.user.id)
      else setProfile(null)
      if (!cancelled) setLoading(false)
    })()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        setUser(session?.user ?? null)
        if (session?.user) await loadProfile(session.user.id)
        else setProfile(null)
      })()
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const value = useMemo(
    () => ({ user, profile, loading, signIn, signOut, refreshProfile }),
    [user, profile, loading, signIn, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth hors AuthProvider')
  return ctx
}

export function useRole(): UserRole | null {
  return useAuth().profile?.role ?? null
}
