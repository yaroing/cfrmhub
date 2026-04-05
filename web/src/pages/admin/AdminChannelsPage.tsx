import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { fetchChannelSettings, upsertChannelSetting } from '../../services/adminService'

type Row = { key: string; value: Record<string, unknown> }

function buildWebhookUrl(base: string | undefined): string | null {
  if (!base?.trim()) return null
  return `${base.replace(/\/+$/, '')}/functions/v1/whatsapp-business-webhook`
}

export function AdminChannelsPage() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<Row[]>([])
  const [err, setErr] = useState('')

  const webhookUrl = useMemo(
    () => buildWebhookUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined),
    [],
  )

  const load = useCallback(async () => {
    try {
      const data = await fetchChannelSettings()
      setRows(data as Row[])
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur')
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement liste au montage
    void load()
  }, [load])

  async function toggle(key: string, enabled: boolean) {
    const row = rows.find((r) => r.key === key)
    const next = { ...(row?.value ?? {}), enabled }
    try {
      await upsertChannelSetting(key, next)
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur')
    }
  }

  const waRow = rows.find((r) => r.key === 'whatsapp_business')
  const otherRows = rows.filter((r) => r.key !== 'whatsapp_business')

  return (
    <div className="flex-1 space-y-6 overflow-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--text-heading)]">{t('adminChannels.title')}</h1>
      <p className="max-w-3xl text-sm text-[var(--text-muted)]">{t('adminChannels.intro')}</p>
      {err && <p className="text-sm text-red-500">{err}</p>}

      {waRow && (
        <Card className="border-2 border-[var(--app-purple)]/25 !p-6">
          <h2 className="text-lg font-semibold text-[var(--text-heading)]">{t('adminChannels.waTitle')}</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{t('adminChannels.waIntro')}</p>

          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('adminChannels.waWebhookLabel')}
            </p>
            {webhookUrl ? (
              <code className="mt-1 block break-all rounded-lg bg-[var(--surface-hover)] p-3 text-xs text-[var(--text)]">
                {webhookUrl}
              </code>
            ) : (
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">{t('adminChannels.waWebhookMissing')}</p>
            )}
          </div>

          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('adminChannels.waSecretsTitle')}
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--text-muted)]">
              <li>{t('adminChannels.waSecretVerify')}</li>
              <li>{t('adminChannels.waSecretApp')}</li>
              <li>{t('adminChannels.waSecretToken')}</li>
              <li>{t('adminChannels.waSecretPhoneId')}</li>
              <li>{t('adminChannels.waSecretService')}</li>
            </ul>
          </div>

          <p className="mt-4 text-xs text-[var(--text-muted)]">{t('adminChannels.waDeployNote')}</p>
          <p className="mt-1 text-xs font-medium text-[var(--app-purple)]">{t('adminChannels.waDocLink')}</p>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-5">
            <span className="text-sm font-medium text-[var(--text)]">{t('adminChannels.waIngestLabel')}</span>
            <Button
              type="button"
              variant={waRow.value.enabled === true ? 'secondary' : 'primary'}
              onClick={() => void toggle('whatsapp_business', !(waRow.value.enabled === true))}
            >
              {waRow.value.enabled === true ? t('adminChannels.waDisableIngest') : t('adminChannels.waEnableIngest')}
            </Button>
          </div>
          {waRow.value.enabled !== true ? (
            <p className="mt-2 text-xs text-[var(--text-muted)]">{t('adminChannels.waIngestHint')}</p>
          ) : null}
        </Card>
      )}

      <h2 className="text-sm font-semibold text-[var(--text-heading)]">{t('adminChannels.simulatedTitle')}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {otherRows.map((r) => {
          const en = r.value.enabled !== false
          return (
            <Card key={r.key}>
              <h3 className="font-semibold capitalize">{r.key.replace(/_/g, ' ')}</h3>
              <pre className="mt-2 max-h-32 overflow-auto rounded bg-[var(--surface-hover)] p-2 text-xs">
                {JSON.stringify(r.value, null, 2)}
              </pre>
              <Button className="mt-3" variant="secondary" type="button" onClick={() => void toggle(r.key, !en)}>
                {en ? t('adminChannels.toggleOn') : t('adminChannels.toggleOff')}
              </Button>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
