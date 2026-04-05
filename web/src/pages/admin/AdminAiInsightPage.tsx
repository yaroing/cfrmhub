import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { upsertChannelSetting } from '../../services/adminService'
import {
  fetchDashboardAiConfig,
  type DashboardAiConfig,
  type DashboardAiSource,
} from '../../services/dashboardAiService'

const TEXTAREA_CLASS =
  'min-h-[120px] w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] shadow-sm focus:border-[var(--app-purple)] focus:outline-none focus:ring-1 focus:ring-[var(--app-purple)]'

export function AdminAiInsightPage() {
  const { t } = useTranslation()
  const [cfg, setCfg] = useState<DashboardAiConfig>({
    enabled: true,
    source: 'manual',
    body_fr: '',
    body_en: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)

  const load = useCallback(async () => {
    setErr('')
    setLoading(true)
    try {
      const c = await fetchDashboardAiConfig()
      setCfg({
        enabled: c.enabled !== false,
        source: c.source === 'gemini' ? 'gemini' : 'manual',
        body_fr: c.body_fr ?? '',
        body_en: c.body_en ?? '',
      })
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    setErr('')
    setOk(false)
    setSaving(true)
    try {
      await upsertChannelSetting('dashboard_ai', {
        enabled: cfg.enabled !== false,
        source: cfg.source === 'gemini' ? 'gemini' : 'manual',
        body_fr: cfg.body_fr?.trim() ?? '',
        body_en: cfg.body_en?.trim() ?? '',
      })
      setOk(true)
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex-1 space-y-6 overflow-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--text-heading)]">{t('adminAiInsight.title')}</h1>
      <p className="max-w-2xl text-sm text-[var(--text-muted)]">{t('adminAiInsight.intro')}</p>
      {err && <p className="text-sm text-red-500">{err}</p>}
      {ok && <p className="text-sm text-emerald-600 dark:text-emerald-400">{t('adminAiInsight.saved')}</p>}

      <Card className="!p-6">
        {loading ? (
          <p className="text-[var(--text-muted)]">{t('common.loading')}</p>
        ) : (
          <div className="space-y-6">
            <label className="flex cursor-pointer items-center gap-3 text-sm text-[var(--text)]">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[var(--border)] accent-[var(--app-purple)]"
                checked={cfg.enabled !== false}
                onChange={(e) => setCfg((c) => ({ ...c, enabled: e.target.checked }))}
              />
              {t('adminAiInsight.showBlock')}
            </label>

            <div>
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t('adminAiInsight.sourceLabel')}
              </span>
              <div className="flex flex-wrap gap-4 text-sm text-[var(--text)]">
                {(['manual', 'gemini'] as const).map((s) => (
                  <label key={s} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="dashboard_ai_source"
                      className="h-4 w-4 border-[var(--border)] accent-[var(--app-purple)]"
                      checked={(cfg.source ?? 'manual') === s}
                      onChange={() => setCfg((c) => ({ ...c, source: s as DashboardAiSource }))}
                    />
                    {t(`adminAiInsight.source.${s}`)}
                  </label>
                ))}
              </div>
            </div>

            {cfg.source === 'gemini' && (
              <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/80 p-3 text-xs text-[var(--text-muted)] leading-relaxed">
                {t('adminAiInsight.geminiHint')}
              </p>
            )}

            <div className={cfg.source === 'gemini' ? 'opacity-60' : ''}>
              <label htmlFor="ai_body_fr" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t('adminAiInsight.bodyFr')}
              </label>
              <textarea
                id="ai_body_fr"
                className={TEXTAREA_CLASS}
                disabled={cfg.source === 'gemini'}
                value={cfg.body_fr ?? ''}
                onChange={(e) => setCfg((c) => ({ ...c, body_fr: e.target.value }))}
                placeholder={t('adminAiInsight.placeholderFr')}
                rows={5}
              />
            </div>

            <div className={cfg.source === 'gemini' ? 'opacity-60' : ''}>
              <label htmlFor="ai_body_en" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t('adminAiInsight.bodyEn')}
              </label>
              <textarea
                id="ai_body_en"
                className={TEXTAREA_CLASS}
                disabled={cfg.source === 'gemini'}
                value={cfg.body_en ?? ''}
                onChange={(e) => setCfg((c) => ({ ...c, body_en: e.target.value }))}
                placeholder={t('adminAiInsight.placeholderEn')}
                rows={5}
              />
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              {cfg.source === 'gemini' ? t('adminAiInsight.fallbackHintGemini') : t('adminAiInsight.fallbackHint')}
            </p>

            <Button type="button" variant="primary" disabled={saving} onClick={() => void save()}>
              {saving ? t('adminAiInsight.saving') : t('adminAiInsight.save')}
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
