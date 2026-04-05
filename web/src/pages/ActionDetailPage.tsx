import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { TextArea } from '../components/ui/TextArea'
import {
  fetchActionById,
  fetchLinkedFeedbacksForAction,
  updateAction,
} from '../services/actionService'
import { fetchCategories } from '../services/feedbackService'
import { fetchAssignableStaff, formatStaffOptionLabel } from '../services/assignmentService'
import type { ActionItem, ActionStatus, Category, FeedbackChannel } from '../types'
import { useDateFnsLocale } from '../hooks/useDateFnsLocale'
import { categoryLabel } from '../utils/categoryLabel'
import { format } from 'date-fns'

export function ActionDetailPage() {
  const { t, i18n } = useTranslation()
  const dateLocale = useDateFnsLocale()
  const { id } = useParams<{ id: string }>()
  const [row, setRow] = useState<ActionItem | null>(null)
  const [linked, setLinked] = useState<{ id: string; description: string; created_at: string; status: string; channel: string }[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<ActionStatus>('open')
  const [ownerId, setOwnerId] = useState('')
  const [staff, setStaff] = useState<Awaited<ReturnType<typeof fetchAssignableStaff>>>([])
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    const [a, fb, cats, s] = await Promise.all([
      fetchActionById(id),
      fetchLinkedFeedbacksForAction(id),
      fetchCategories(),
      fetchAssignableStaff(),
    ])
    setRow(a)
    setLinked(fb as typeof linked)
    setCategories(cats as Category[])
    setStaff(s)
    if (a) {
      setNotes(a.notes ?? '')
      setStatus(a.status)
      setDescription(a.description ?? '')
      setCategoryId(a.category_id ?? '')
      setDueDate(a.due_date ? a.due_date.slice(0, 10) : '')
      setOwnerId(a.owner_id ?? '')
    }
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement détail au montage / id
    void load().catch((e: unknown) => setErr(e instanceof Error ? e.message : t('common.error')))
  }, [load, t])

  async function save() {
    if (!id) return
    setErr('')
    try {
      await updateAction(id, {
        notes,
        status,
        description: description.trim() || null,
        category_id: categoryId || null,
        due_date: dueDate || null,
        owner_id: ownerId || null,
      })
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('common.error'))
    }
  }

  if (!id) return null
  if (!row) {
    return (
      <div className="p-8">
        {err && <p className="text-red-500">{err}</p>}
        <p className="text-[var(--text-muted)]">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 overflow-auto p-4 md:p-8">
      <Link to="/app/actions" className="text-sm text-blue-600 hover:underline dark:text-sky-400">
        {t('actions.backList')}
      </Link>
      <h1 className="text-2xl font-bold text-[var(--text-heading)]">{row.title}</h1>
      <Badge tone="neutral">{t(`actionStatus.${row.status}`)}</Badge>

      {err && <p className="text-sm text-red-500">{err}</p>}

      <Card>
        <h2 className="mb-4 font-semibold">{t('actions.editTitle')}</h2>
        <p className="mb-4 text-xs text-[var(--text-muted)]">
          {t('actions.createdAt')} {format(new Date(row.created_at), 'PPpp', { locale: dateLocale })}
        </p>
        <div className="space-y-4">
          <TextArea label={t('actions.description')} value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
          <div>
            <label className="mb-1 block text-xs text-[var(--text-muted)]">{t('actions.category')}</label>
            <select
              className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">{t('common.noneCategory')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryLabel(c, i18n.language)}
                </option>
              ))}
            </select>
          </div>
          <Input type="date" label={t('actions.due')} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <div>
            <label className="mb-1 block text-xs text-[var(--text-muted)]">{t('actions.ownerField')}</label>
            <select
              className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
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
          <div>
            <label className="mb-1 block text-xs text-[var(--text-muted)]">{t('actions.status')}</label>
            <select
              className="w-full max-w-xs rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              value={status}
              onChange={(e) => setStatus(e.target.value as ActionStatus)}
            >
              {(['open', 'in_progress', 'done', 'deferred'] as ActionStatus[]).map((s) => (
                <option key={s} value={s}>
                  {t(`actionStatus.${s}`)}
                </option>
              ))}
            </select>
          </div>
          <TextArea label={t('actions.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button className="mt-4" onClick={() => void save()}>
          {t('common.save')}
        </Button>
      </Card>

      <Card>
        <h2 className="mb-4 font-semibold">{t('actions.linkedTitle')}</h2>
        <ul className="space-y-2 text-sm">
          {linked.length === 0 && <li className="text-[var(--text-muted)]">{t('actions.noLinks')}</li>}
          {linked.map((f) => (
            <li key={f.id} className="border-b border-[var(--border)]/50 pb-2">
              <Link to={`/app/feedback/${f.id}`} className="font-medium text-blue-600 dark:text-sky-400">
                {t(`channel.${f.channel as FeedbackChannel}`)} — {f.id.slice(0, 8)}…
              </Link>
              <p className="line-clamp-2 text-[var(--text-muted)]">{f.description}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
