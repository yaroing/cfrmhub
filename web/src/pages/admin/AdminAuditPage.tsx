import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { Card } from '../../components/ui/Card'
import { fetchAuditLogs, fetchProfiles } from '../../services/adminService'
import type { AuditLogRow, Profile } from '../../types'
import { useDateFnsLocale } from '../../hooks/useDateFnsLocale'

export function AdminAuditPage() {
  const { t } = useTranslation()
  const dateLocale = useDateFnsLocale()
  const [rows, setRows] = useState<AuditLogRow[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [actorId, setActorId] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    void fetchProfiles()
      .then((data) => setProfiles((data as Profile[]) ?? []))
      .catch(() => setProfiles([]))
  }, [])

  const load = useCallback(async () => {
    try {
      const data = await fetchAuditLogs(400, actorId ? { userId: actorId } : undefined)
      setRows(data as AuditLogRow[])
      setErr('')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('adminAudit.loadError'))
    }
  }, [actorId, t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="flex-1 space-y-6 overflow-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--text-heading)]">{t('adminAudit.title')}</h1>
      {err && <p className="text-sm text-red-500">{err}</p>}
      <Card>
        <div className="mb-4 max-w-md">
          <label htmlFor="audit_actor" className="mb-1 block text-sm font-medium text-[var(--text-muted)]">
            {t('adminAudit.filterActor')}
          </label>
          <select
            id="audit_actor"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
          >
            <option value="">{t('adminAudit.allActors')}</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name?.trim() || p.email || p.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                <th className="pb-2">{t('adminAudit.colDate')}</th>
                <th className="pb-2">{t('adminAudit.colAction')}</th>
                <th className="pb-2">{t('adminAudit.colEntity')}</th>
                <th className="pb-2">{t('adminAudit.colId')}</th>
                <th className="pb-2">{t('adminAudit.colDetails')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border)]/60">
                  <td className="py-2 whitespace-nowrap text-[var(--text-muted)]">
                    {format(new Date(r.created_at), 'PPpp', { locale: dateLocale })}
                  </td>
                  <td className="py-2">{r.action}</td>
                  <td className="py-2">{r.entity_type}</td>
                  <td className="py-2 font-mono text-xs">{r.entity_id?.slice(0, 8)}…</td>
                  <td className="py-2 text-xs">{JSON.stringify(r.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
