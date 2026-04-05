import { supabase } from '../lib/supabaseClient'
import type { FocalPoint, SensitiveType } from '../types'

export async function fetchFocalPoints(): Promise<FocalPoint[]> {
  const { data, error } = await supabase.from('focal_points').select('*').order('name')
  if (error) throw error
  return (data ?? []) as FocalPoint[]
}

export async function fetchFocalPointsByType(sensitivityType: SensitiveType): Promise<FocalPoint[]> {
  const { data, error } = await supabase
    .from('focal_points')
    .select('*')
    .eq('sensitivity_type', sensitivityType)
    .order('name')
  if (error) throw error
  return (data ?? []) as FocalPoint[]
}

export async function insertFocalPoint(row: {
  name: string
  role_title?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  sensitivity_type: SensitiveType
  organisation?: string | null
  is_internal: boolean
  notes?: string | null
}): Promise<void> {
  const { error } = await supabase.from('focal_points').insert({
    name: row.name,
    role_title: row.role_title ?? null,
    contact_email: row.contact_email ?? null,
    contact_phone: row.contact_phone ?? null,
    sensitivity_type: row.sensitivity_type,
    organisation: row.organisation ?? null,
    is_internal: row.is_internal,
    notes: row.notes ?? null,
  })
  if (error) throw error
}

export async function updateFocalPoint(
  id: string,
  row: Partial<{
    name: string
    role_title: string | null
    contact_email: string | null
    contact_phone: string | null
    sensitivity_type: SensitiveType
    organisation: string | null
    is_internal: boolean
    notes: string | null
  }>,
): Promise<void> {
  const { error } = await supabase.from('focal_points').update(row).eq('id', id)
  if (error) throw error
}

export async function deleteFocalPoint(id: string): Promise<void> {
  const { error } = await supabase.from('focal_points').delete().eq('id', id)
  if (error) throw error
}
