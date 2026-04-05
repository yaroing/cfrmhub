import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import {
  ADMIN_USER_MIN_PASSWORD_LEN,
  AdminCreateUserError,
  adminCreateUser,
  fetchProfiles,
  updateProfile,
} from '../../services/adminService'
import type { UserRole } from '../../types'

const ALL_ROLES: UserRole[] = [
  'admin',
  'validator',
  'observer',
  'field_agent',
  'focal_point',
]

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  role: UserRole
  agent_code?: string | null
  specialty?: string | null
}

function roleLabelKey(role: UserRole): `adminUsers.roles.${UserRole}` {
  return `adminUsers.roles.${role}`
}

export function AdminUsersPage() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<ProfileRow[]>([])
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createFullName, setCreateFullName] = useState('')
  const [createRole, setCreateRole] = useState<UserRole>('observer')
  const [creating, setCreating] = useState(false)

  const [editRow, setEditRow] = useState<ProfileRow | null>(null)
  const [editFullName, setEditFullName] = useState('')
  const [editRole, setEditRole] = useState<UserRole>('observer')
  const [editAgentCode, setEditAgentCode] = useState('')
  const [editSpecialty, setEditSpecialty] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await fetchProfiles()
      setRows(data as ProfileRow[])
      setErr('')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('adminUsers.loadError'))
    }
  }, [t])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement liste au montage
    void load()
  }, [load])

  function clearFlash() {
    setErr('')
    setOk('')
  }

  function openEdit(r: ProfileRow) {
    clearFlash()
    setEditRow(r)
    setEditFullName(r.full_name ?? '')
    setEditRole(r.role)
    setEditAgentCode(r.agent_code ?? '')
    setEditSpecialty(r.specialty ?? '')
  }

  function closeEdit() {
    setEditRow(null)
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    clearFlash()
    setCreating(true)
    try {
      const { needsEmailConfirmation } = await adminCreateUser({
        email: createEmail,
        password: createPassword,
        fullName: createFullName,
        role: createRole,
      })
      setCreateEmail('')
      setCreatePassword('')
      setCreateFullName('')
      setCreateRole('observer')
      setOk(
        needsEmailConfirmation
          ? `${t('adminUsers.createSuccess')} ${t('adminUsers.createSuccessConfirm')}`
          : t('adminUsers.createSuccess'),
      )
      await load()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === AdminCreateUserError.INVALID_EMAIL) {
        setErr(t('adminUsers.err.invalidEmail'))
      } else if (msg === AdminCreateUserError.PASSWORD_TOO_SHORT) {
        setErr(t('adminUsers.err.passwordTooShort', { n: ADMIN_USER_MIN_PASSWORD_LEN }))
      } else if (msg === AdminCreateUserError.SIGNUP_FAILED) {
        setErr(t('adminUsers.err.signupFailed'))
      } else if (msg === AdminCreateUserError.PROFILE_UPDATE_FAILED) {
        setErr(t('adminUsers.err.profileUpdateFailed'))
      } else if (e instanceof Error && e.message) {
        setErr(e.message)
      } else {
        setErr(t('adminUsers.err.genericCreate'))
      }
    } finally {
      setCreating(false)
    }
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editRow) return
    clearFlash()
    setSavingEdit(true)
    try {
      await updateProfile(editRow.id, {
        full_name: editFullName,
        role: editRole,
        agent_code: editAgentCode.trim() || null,
        specialty: editSpecialty.trim() || null,
      })
      setOk(t('adminUsers.saveSuccess'))
      closeEdit()
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('adminUsers.updateError'))
    } finally {
      setSavingEdit(false)
    }
  }

  const selectClass =
    'w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <div className="flex-1 space-y-6 overflow-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--text-heading)]">{t('adminUsers.title')}</h1>
      {err && <p className="text-sm text-red-500">{err}</p>}
      {ok && <p className="text-sm text-green-600">{ok}</p>}

      <Card>
        <h2 className="mb-4 font-semibold text-[var(--text-heading)]">{t('adminUsers.addSection')}</h2>
        <form className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" onSubmit={submitCreate}>
          <Input
            label={t('adminUsers.email')}
            name="new_email"
            type="email"
            autoComplete="off"
            value={createEmail}
            onChange={(e) => setCreateEmail(e.target.value)}
            required
          />
          <Input
            label={t('adminUsers.password')}
            name="new_password"
            type="password"
            autoComplete="new-password"
            value={createPassword}
            onChange={(e) => setCreatePassword(e.target.value)}
            required
          />
          <Input
            label={t('adminUsers.fullName')}
            name="new_full_name"
            value={createFullName}
            onChange={(e) => setCreateFullName(e.target.value)}
          />
          <div>
            <label htmlFor="admin_new_role" className="mb-1 block text-sm font-medium text-[var(--text-muted)]">
              {t('adminUsers.role')}
            </label>
            <select
              id="admin_new_role"
              className={selectClass}
              value={createRole}
              onChange={(e) => setCreateRole(e.target.value as UserRole)}
            >
              {ALL_ROLES.map((role) => (
                <option key={role} value={role}>
                  {t(roleLabelKey(role))}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col justify-end md:col-span-2 lg:col-span-1">
            <p className="mb-2 text-xs text-[var(--text-muted)]">
              {t('adminUsers.passwordHelp', { n: ADMIN_USER_MIN_PASSWORD_LEN })}
            </p>
            <Button type="submit" disabled={creating}>
              {creating ? t('adminUsers.creating') : t('adminUsers.create')}
            </Button>
          </div>
        </form>
      </Card>

      {editRow && (
        <Card>
          <h2 className="mb-2 font-semibold text-[var(--text-heading)]">{t('adminUsers.editSection')}</h2>
          <p className="mb-4 text-xs text-[var(--text-muted)]">{t('adminUsers.editHint')}</p>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={submitEdit}>
            <div>
              <span className="mb-1 block text-sm font-medium text-[var(--text-muted)]">{t('adminUsers.email')}</span>
              <p className="rounded-xl border border-[var(--border)]/60 bg-[var(--surface)]/80 px-3 py-2 text-sm">
                {editRow.email ?? '—'}
              </p>
            </div>
            <Input
              label={t('adminUsers.fullName')}
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
            />
            <div>
              <label htmlFor="admin_edit_role" className="mb-1 block text-sm font-medium text-[var(--text-muted)]">
                {t('adminUsers.role')}
              </label>
              <select
                id="admin_edit_role"
                className={selectClass}
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
              >
                {ALL_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {t(roleLabelKey(role))}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label={t('adminUsers.agentCode')}
              value={editAgentCode}
              onChange={(e) => setEditAgentCode(e.target.value)}
              placeholder="—"
            />
            <div className="md:col-span-2">
              <Input
                label={t('adminUsers.specialty')}
                value={editSpecialty}
                onChange={(e) => setEditSpecialty(e.target.value)}
                placeholder="—"
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">{t('adminUsers.specialtyHelp')}</p>
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? t('common.loading') : t('adminUsers.saveChanges')}
              </Button>
              <Button type="button" variant="ghost" onClick={closeEdit}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
              <th className="pb-2">{t('adminUsers.colEmail')}</th>
              <th className="pb-2">{t('adminUsers.colName')}</th>
              <th className="pb-2">{t('adminUsers.colRole')}</th>
              <th className="pb-2">{t('adminUsers.colAgentCode')}</th>
              <th className="pb-2">{t('adminUsers.specialty')}</th>
              <th className="pb-2">{t('adminUsers.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--border)]/60">
                <td className="py-2 pr-2">{r.email}</td>
                <td className="py-2 pr-2">{r.full_name}</td>
                <td className="py-2 pr-2">{t(roleLabelKey(r.role))}</td>
                <td className="py-2 pr-2 font-mono text-xs">{r.agent_code ?? '—'}</td>
                <td className="py-2 pr-2 text-xs text-[var(--text-muted)]">{r.specialty?.trim() || '—'}</td>
                <td className="py-2">
                  <Button size="sm" type="button" variant="ghost" onClick={() => openEdit(r)}>
                    {t('adminUsers.modify')}
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
