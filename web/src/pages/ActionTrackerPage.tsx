import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { TextArea } from '../components/ui/TextArea'
import { createAction, fetchActions } from '../services/actionService'
import { fetchCategories } from '../services/feedbackService'
import { fetchAssignableStaff, formatStaffOptionLabel } from '../services/assignmentService'
import type { ActionItem, ActionStatus, Category } from '../types'
import { useDateFnsLocale } from '../hooks/useDateFnsLocale'
import { categoryLabel } from '../utils/categoryLabel'
import { format, subDays } from 'date-fns'

export function ActionTrackerPage() {
  const { t, i18n } = useTranslation()
  const dateLocale = useDateFnsLocale()
  const [rows, setRows] = useState<ActionItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [status, setStatus] = useState<ActionStatus | ''>('')
  const [ownerFilter, setOwnerFilter] = useState<string>('')
  const [staff, setStaff] = useState<Awaited<ReturnType<typeof fetchAssignableStaff>>>([])
  const [modal, setModal] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [catId, setCatId] = useState('')
  const [due, setDue] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const ownerArg =
      ownerFilter === ''
        ? undefined
        : ownerFilter === '__unassigned__'
          ? ('__unassigned__' as const)
          : ownerFilter
    const [a, c, s] = await Promise.all([
      fetchActions({ status: status || undefined, ownerId: ownerArg }),
      fetchCategories(),
      fetchAssignableStaff(),
    ])
    setRows(a)
    setCategories(c as Category[])
    setStaff(s)
  }, [status, ownerFilter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement liste au montage / filtre
    void load().catch((e: unknown) => setErr(e instanceof Error ? e.message : t('common.error')))
  }, [load, t])

  async function create() {
    if (title.trim().length < 5) return
    setErr('')
    try {
      await createAction({
        title: title.trim(),
        description: desc.trim() || null,
        category_id: catId || null,
        due_date: due || null,
        owner_id: ownerId || null,
      })
      setModal(false)
      setTitle('')
      setDesc('')
      setCatId('')
      setDue('')
      setOwnerId('')
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('common.error'))
    }
  }

  const doneSinceCutoff = useMemo(() => subDays(new Date(), 30), [])
  const open = rows.filter((r) => r.status === 'open').length
  const doneMonth = rows.filter(
    (r) => r.status === 'done' && new Date(r.updated_at) > doneSinceCutoff,
  ).length

  return (
    <div className="flex-1 space-y-6 overflow-auto p-4 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-heading)]">{t('actions.listTitle')}</h1>
        <Button onClick={() => setModal(true)}>{t('actions.newAction')}</Button>
      </div>
      {err && <p className="text-sm text-red-500">{err}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="!p-4">
          <p className="text-xs text-[var(--text-muted)]">{t('actions.kpiOpen')}</p>
          <p className="text-2xl font-semibold">{open}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-[var(--text-muted)]">{t('actions.kpiDone30')}</p>
          <p className="text-2xl font-semibold">{doneMonth}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-[var(--text-muted)]">{t('actions.kpiFilter')}</p>
          <select
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as ActionStatus | '')}
          >
            <option value="">{t('common.all')}</option>
            {(['open', 'in_progress', 'done', 'deferred'] as ActionStatus[]).map((s) => (
              <option key={s} value={s}>
                {t(`actionStatus.${s}`)}
              </option>
            ))}
          </select>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-[var(--text-muted)]">{t('actions.kpiOwnerFilter')}</p>
          <select
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
          >
            <option value="">{t('common.all')}</option>
            <option value="__unassigned__">{t('actions.ownerUnassigned')}</option>
            {staff.map((p) => (
              <option key={p.id} value={p.id}>
                {formatStaffOptionLabel(p)}
              </option>
            ))}
          </select>
        </Card>
      </div>

      <Card>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
              <th className="pb-2">{t('actions.colTitle')}</th>
              <th className="pb-2">{t('actions.colStatus')}</th>
              <th className="pb-2">{t('actions.colOwner')}</th>
              <th className="pb-2">{t('actions.colDue')}</th>
              <th className="pb-2">{t('actions.colUpdated')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.id}
                className={`border-b border-[var(--border)]/60 ${i % 2 === 1 ? 'bg-[#f9fafb] dark:bg-white/[0.04]' : ''}`}
              >
                <td className="py-2">
                  <Link to={`/app/actions/${r.id}`} className="text-blue-600 hover:underline dark:text-sky-400">
                    {r.title}
                  </Link>
                </td>
                <td className="py-2">
                  <Badge tone="neutral">{t(`actionStatus.${r.status}`)}</Badge>
                </td>
                <td className="py-2 text-[var(--text-muted)]">
                  {r.owner?.full_name?.trim() || r.owner?.email?.trim() || t('actions.ownerUnassigned')}
                </td>
                <td className="py-2">{r.due_date ?? t('common.none')}</td>
                <td className="py-2 text-[var(--text-muted)]">
                  {format(new Date(r.updated_at), 'dd MMM yyyy', { locale: dateLocale })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-auto">
            <h2 className="mb-4 font-semibold">{t('actions.newModalTitle')}</h2>
            <div className="space-y-3">
              <Input label={t('actions.titleField')} value={title} onChange={(e) => setTitle(e.target.value)} />
              <TextArea label={t('actions.description')} value={desc} onChange={(e) => setDesc(e.target.value)} />
              <div>
                <label className="mb-1 block text-xs text-[var(--text-muted)]">{t('actions.category')}</label>
                <select
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  value={catId}
                  onChange={(e) => setCatId(e.target.value)}
                >
                  <option value="">{t('common.none')}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {categoryLabel(c, i18n.language)}
                    </option>
                  ))}
                </select>
              </div>
              <Input type="date" label={t('actions.due')} value={due} onChange={(e) => setDue(e.target.value)} />
              <div>
                <label className="mb-1 block text-xs text-[var(--text-muted)]">{t('actions.ownerField')}</label>
                <select
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                >
                  <option value="">{t('actions.ownerUnassigned')}</option>
                  {staff.map((p) => (
                    <option key={p.id} value={p.id}>
                      {formatStaffOptionLabel(p)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" type="button" onClick={() => setModal(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="button" onClick={() => void create()}>
                {t('common.create')}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
