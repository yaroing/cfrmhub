import { supabase } from '../lib/supabaseClient'

const BUCKET = 'feedback-attachments'

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180)
}

export async function uploadAttachment(
  feedbackId: string,
  file: File,
): Promise<{ id: string; signedUrl: string; storage_path: string }> {
  const path = `${feedbackId}/${Date.now()}_${sanitizeName(file.name)}`
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (upErr) throw upErr

  const { data: row, error: insErr } = await supabase
    .from('feedback_attachments')
    .insert({
      feedback_id: feedbackId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || null,
    })
    .select('id')
    .single()
  if (insErr) throw insErr

  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600)
  if (signErr) throw signErr

  return {
    id: row.id as string,
    signedUrl: signed.signedUrl,
    storage_path: path,
  }
}

export async function fetchAttachments(feedbackId: string): Promise<
  { id: string; file_name: string; mime_type: string | null; storage_path: string; signedUrl: string }[]
> {
  const { data: rows, error } = await supabase
    .from('feedback_attachments')
    .select('id, file_name, mime_type, storage_path')
    .eq('feedback_id', feedbackId)
    .order('created_at', { ascending: true })
  if (error) throw error
  const list = rows ?? []
  const out: Awaited<ReturnType<typeof fetchAttachments>> = []
  for (const r of list) {
    const { data: signed, error: e } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(r.storage_path, 3600)
    if (e) continue
    out.push({
      id: r.id,
      file_name: r.file_name,
      mime_type: r.mime_type,
      storage_path: r.storage_path,
      signedUrl: signed.signedUrl,
    })
  }
  return out
}

export async function deleteAttachment(attachmentId: string, storagePath: string): Promise<void> {
  const { error: sErr } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (sErr) throw sErr
  const { error } = await supabase.from('feedback_attachments').delete().eq('id', attachmentId)
  if (error) throw error
}
