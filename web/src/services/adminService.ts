import { getEphemeralAuthClient, supabase } from '../lib/supabaseClient'
import type { UserRole } from '../types'

export async function fetchAllCategories() {
  const { data, error } = await supabase.from('categories').select('*').order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function fetchProfiles() {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at')
  if (error) throw error
  return data ?? []
}

export async function updateProfileRole(userId: string, role: UserRole) {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
  if (error) throw error
}

export async function updateProfile(
  userId: string,
  fields: {
    full_name?: string | null
    role?: UserRole
    agent_code?: string | null
    specialty?: string | null
  },
) {
  const payload: Record<string, unknown> = {}
  if (fields.full_name !== undefined) payload.full_name = fields.full_name?.trim() || null
  if (fields.role !== undefined) payload.role = fields.role
  if (fields.agent_code !== undefined) payload.agent_code = fields.agent_code?.trim() || null
  if (fields.specialty !== undefined) payload.specialty = fields.specialty?.trim() || null
  if (Object.keys(payload).length === 0) return
  const { error } = await supabase.from('profiles').update(payload).eq('id', userId)
  if (error) throw error
}

export const ADMIN_USER_MIN_PASSWORD_LEN = 8

/** Codes d’erreur pour i18n côté UI (adminCreateUser). */
export const AdminCreateUserError = {
  INVALID_EMAIL: 'ADMIN_CREATE_INVALID_EMAIL',
  PASSWORD_TOO_SHORT: 'ADMIN_CREATE_PASSWORD_TOO_SHORT',
  SIGNUP_FAILED: 'ADMIN_CREATE_SIGNUP_FAILED',
  PROFILE_UPDATE_FAILED: 'ADMIN_CREATE_PROFILE_UPDATE_FAILED',
} as const

/**
 * Crée un compte Auth + ligne profil (trigger), puis applique le rôle et le nom affiché.
 * N’utilise pas le client global pour ne pas déconnecter l’administrateur.
 */
export async function adminCreateUser(params: {
  email: string
  password: string
  fullName: string
  role: UserRole
}): Promise<{ userId: string; needsEmailConfirmation: boolean }> {
  const email = params.email.trim().toLowerCase()
  const password = params.password
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(AdminCreateUserError.INVALID_EMAIL)
  }
  if (password.length < ADMIN_USER_MIN_PASSWORD_LEN) {
    throw new Error(AdminCreateUserError.PASSWORD_TOO_SHORT)
  }
  const ephemeral = getEphemeralAuthClient()
  const { data, error } = await ephemeral.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: params.fullName.trim() || undefined },
    },
  })
  if (error) throw error
  if (!data.user?.id) throw new Error(AdminCreateUserError.SIGNUP_FAILED)

  const userId = data.user.id
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({
      full_name: params.fullName.trim() || null,
      role: params.role,
      email,
    })
    .eq('id', userId)
  if (profileErr) throw new Error(AdminCreateUserError.PROFILE_UPDATE_FAILED, { cause: profileErr })

  return {
    userId,
    needsEmailConfirmation: !data.session,
  }
}

export async function fetchAuditLogs(limit = 200, filters?: { userId?: string }) {
  let q = supabase.from('audit_logs').select('*').order('created_at', { ascending: false })
  if (filters?.userId) q = q.eq('user_id', filters.userId)
  const { data, error } = await q.limit(limit)
  if (error) throw error
  return data ?? []
}

export async function fetchChannelSettings() {
  const { data, error } = await supabase.from('channel_settings').select('*')
  if (error) throw error
  return data ?? []
}

export async function upsertChannelSetting(key: string, value: object) {
  const { error } = await supabase.from('channel_settings').upsert({
    key,
    value: value as never,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function adminUpsertCategory(row: {
  id?: string
  slug: string
  label_fr: string
  sort_order: number
  is_active: boolean
}) {
  if (row.id) {
    const { error } = await supabase
      .from('categories')
      .update({
        slug: row.slug,
        label_fr: row.label_fr,
        sort_order: row.sort_order,
        is_active: row.is_active,
      })
      .eq('id', row.id)
    if (error) throw error
    return
  }
  const { error } = await supabase.from('categories').insert({
    slug: row.slug,
    label_fr: row.label_fr,
    sort_order: row.sort_order,
    is_active: row.is_active,
  })
  if (error) throw error
}

export async function exportFeedbacksCsv(): Promise<string> {
  const { data, error } = await supabase
    .from('feedbacks')
    .select(
      'id, created_at, channel, feedback_type, description, status, priority, priority_override, location_label, contact_email, needs_duplicate_review, assigned_to, assigned_at',
    )
    .order('created_at', { ascending: false })
  if (error) throw error
  const rows = data ?? []
  const header = Object.keys(rows[0] ?? {}).join(';')
  const lines = rows.map((r) =>
    Object.values(r)
      .map((v) => {
        const s = v === null || v === undefined ? '' : String(v)
        return `"${s.replace(/"/g, '""')}"`
      })
      .join(';'),
  )
  return [header, ...lines].join('\n')
}
