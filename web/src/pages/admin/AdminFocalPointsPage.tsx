import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { TextArea } from '../../components/ui/TextArea'
import {
  deleteFocalPoint,
  fetchFocalPoints,
  insertFocalPoint,
  updateFocalPoint,
} from '../../services/focalPointService'
import type { FocalPoint, SensitiveType } from '../../types'
import { SENSITIVE_TYPE_LABELS } from '../../types'

export function AdminFocalPointsPage() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<FocalPoint[]>([])
  const [err, setErr] = useState('')
  const [name, setName] = useState('')
  const [stype, setStype] = useState<SensitiveType>('sgbv')
  const [org, setOrg] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [internal, setInternal] = useState(true)
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    const data = await fetchFocalPoints()
    setRows(data)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement liste au montage
    void load().catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Erreur'))
  }, [load])

  async function add() {
    if (!name.trim()) return
    setErr('')
    try {
      await insertFocalPoint({
        name: name.trim(),
        role_title: null,
        contact_email: email.trim() || null,
        contact_phone: phone.trim() || null,
        sensitivity_type: stype,
        organisation: org.trim() || null,
        is_internal: internal,
        notes: notes.trim() || null,
      })
      setName('')
      setOrg('')
      setEmail('')
      setPhone('')
      setNotes('')
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur')
    }
  }

  async function toggleInternal(fp: FocalPoint) {
    await updateFocalPoint(fp.id, { is_internal: !fp.is_internal })
    await load()
  }

  async function remove(id: string) {
    if (!confirm('Supprimer ce point focal ?')) return
    await deleteFocalPoint(id)
    await load()
  }

  return (
    <div className="flex-1 space-y-6 overflow-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--text-heading)]">{t('nav.adminFocal')}</h1>
      {err && <p className="text-sm text-red-500">{err}</p>}

      <Card>
        <h2 className="mb-4 font-semibold">Ajouter</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Input placeholder="Nom *" value={name} onChange={(e) => setName(e.target.value)} />
          <div>
            <label className="mb-1 block text-xs text-[var(--text-muted)]">Type sensibilité</label>
            <select
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              value={stype}
              onChange={(e) => setStype(e.target.value as SensitiveType)}
            >
              {(Object.keys(SENSITIVE_TYPE_LABELS) as SensitiveType[]).map((t) => (
                <option key={t} value={t}>
                  {SENSITIVE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <Input placeholder="Organisation" value={org} onChange={(e) => setOrg(e.target.value)} />
          <Input placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
            Interne à l’organisation
          </label>
          <TextArea className="md:col-span-2" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button className="mt-3" type="button" onClick={() => void add()}>
          Ajouter
        </Button>
      </Card>

      <Card>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="pb-2">Nom</th>
              <th className="pb-2">Type</th>
              <th className="pb-2">Org.</th>
              <th className="pb-2">Interne</th>
              <th className="pb-2">Contact</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((fp) => (
              <tr key={fp.id} className="border-b border-[var(--border)]/50">
                <td className="py-2">{fp.name}</td>
                <td className="py-2">{SENSITIVE_TYPE_LABELS[fp.sensitivity_type]}</td>
                <td className="py-2">{fp.organisation ?? '—'}</td>
                <td className="py-2">{fp.is_internal ? 'Oui' : 'Non'}</td>
                <td className="py-2 text-xs">
                  {fp.contact_email ?? '—'} / {fp.contact_phone ?? '—'}
                </td>
                <td className="py-2">
                  <Button size="sm" variant="secondary" type="button" onClick={() => void toggleInternal(fp)}>
                    Basculer int./ext.
                  </Button>
                  <Button size="sm" variant="danger" type="button" className="ml-2" onClick={() => void remove(fp.id)}>
                    Suppr.
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
