import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { TextArea } from '../components/ui/TextArea'
import { useAuth, useRole } from '../hooks/useAuth'
import { NigerVillageGeocodeFields } from '../components/location/NigerVillageGeocodeFields'
import { insertAuthenticatedFeedback } from '../services/feedbackService'
import type { NigerRegionValue } from '../constants/nigerRegions'
import type { FeedbackChannel, FeedbackType, SubmitterAgeGroup, SubmitterSex } from '../types'

const CHANNEL_ASSISTED: FeedbackChannel[] = ['phone', 'in_person']
const CHANNEL_OTHER: FeedbackChannel[] = [
  'web',
  'sms_sim',
  'whatsapp_sim',
  'whatsapp_business',
  'telegram_sim',
]
const TYPE_VALUES: FeedbackType[] = ['feedback', 'alert', 'complaint', 'suggestion', 'question']
const AGE_KEYS: SubmitterAgeGroup[] = ['0_17', '18_59', '60_plus', 'mixed', 'prefer_not', 'unknown']
const SEX_KEYS: SubmitterSex[] = ['female', 'male', 'prefer_not', 'mixed', 'unknown']
const DIVERSITY_KEYS = ['disability', 'ethnic_minority', 'pregnant_lactating', 'prefer_not'] as const

export function FieldSubmitPage() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const role = useRole()
  const [channel, setChannel] = useState<FeedbackChannel>('phone')
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('feedback')
  const [description, setDescription] = useState('')
  const [village, setVillage] = useState('')
  const [nigerRegion, setNigerRegion] = useState<NigerRegionValue | ''>('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [age, setAge] = useState<SubmitterAgeGroup | ''>('')
  const [sex, setSex] = useState<SubmitterSex | ''>('')
  const [diversity, setDiversity] = useState<string[]>([])
  const [language, setLanguage] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, setPending] = useState(false)

  function toggleDiv(v: string) {
    setDiversity((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v]))
  }

  function validate(): string | null {
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      return t('public.errEmail')
    }
    const la = lat.trim() ? Number(lat.replace(',', '.')) : NaN
    const lo = lng.trim() ? Number(lng.replace(',', '.')) : NaN
    if (lat.trim() && Number.isNaN(la)) return t('public.errLat')
    if (lng.trim() && Number.isNaN(lo)) return t('public.errLng')
    return null
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (description.trim().length < 10) {
      setMsg({ ok: false, text: t('field.shortDesc') })
      return
    }
    const v = validate()
    if (v) {
      setMsg({ ok: false, text: v })
      return
    }
    setPending(true)
    setMsg(null)
    try {
      const locationLabel =
        village.trim() && nigerRegion
          ? `${village.trim()}, ${nigerRegion}`
          : village.trim() || null
      const id = await insertAuthenticatedFeedback({
        channel,
        feedback_type: feedbackType,
        description: description.trim(),
        location_label: locationLabel,
        contact_name: contactName.trim() || null,
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        lat: lat.trim() ? Number(lat.replace(',', '.')) : null,
        lng: lng.trim() ? Number(lng.replace(',', '.')) : null,
        submitter_age_group: age || null,
        submitter_sex: sex || null,
        submitter_diversity: diversity.length ? diversity : null,
        submitter_language: language.trim() || null,
      })
      setMsg({ ok: true, text: t('field.saved', { id }) })
      setDescription('')
      setVillage('')
      setNigerRegion('')
      setLat('')
      setLng('')
      setContactName('')
      setContactPhone('')
      setContactEmail('')
      setAge('')
      setSex('')
      setDiversity([])
      setLanguage('')
    } catch (err: unknown) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : t('common.error') })
    } finally {
      setPending(false)
    }
  }

  const backLabel = role === 'field_agent' ? t('field.back') : t('intake.backStaff')

  return (
    <div className="flex-1 space-y-6 overflow-auto p-4 md:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/app" className="text-sm text-blue-600 hover:underline dark:text-sky-400">
          {backLabel}
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-[var(--text-heading)]">{t('intake.title')}</h1>
      {role === 'field_agent' ? (
        <p className="text-sm text-[var(--text-muted)]">
          {t('field.agentIntro')}{' '}
          <strong>{profile?.agent_code || t('field.agentUnset')}</strong> {t('field.agentRest')}
        </p>
      ) : (
        <p className="text-sm text-[var(--text-muted)]">{t('intake.introStaff')}</p>
      )}

      <Card>
        <form onSubmit={submit} className="max-w-2xl space-y-4">
          {msg && (
            <p
              role={msg.ok ? 'status' : 'alert'}
              aria-live="polite"
              className={
                msg.ok
                  ? 'rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200'
                  : 'rounded-lg bg-red-500/10 p-3 text-sm text-red-600'
              }
            >
              {msg.text}
            </p>
          )}
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">{t('field.channel')}</label>
            <select
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              value={channel}
              onChange={(e) => setChannel(e.target.value as FeedbackChannel)}
            >
              <optgroup label={t('intake.channelGroupReal')}>
                {CHANNEL_ASSISTED.map((c) => (
                  <option key={c} value={c}>
                    {t(`channel.${c}`)}
                  </option>
                ))}
              </optgroup>
              <optgroup label={t('intake.channelGroupOther')}>
                {CHANNEL_OTHER.map((c) => (
                  <option key={c} value={c}>
                    {t(`channel.${c}`)}
                  </option>
                ))}
              </optgroup>
            </select>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{t('intake.channelHint')}</p>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">{t('field.type')}</label>
            <select
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              value={feedbackType}
              onChange={(e) => setFeedbackType(e.target.value as FeedbackType)}
            >
              {TYPE_VALUES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(`feedbackType.${ty}`)}
                </option>
              ))}
            </select>
          </div>
          <TextArea
            label={t('field.description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
          <p className="text-sm font-medium text-[var(--text-heading)]">{t('intake.contactSection')}</p>
          <Input
            label={t('intake.contactName')}
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            autoComplete="name"
          />
          <Input
            label={t('intake.contactPhone')}
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            autoComplete="tel"
          />
          <Input
            label={t('intake.contactEmail')}
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            autoComplete="email"
          />
          <p className="text-sm font-medium text-[var(--text-heading)]">{t('field.location')}</p>
          <NigerVillageGeocodeFields
            village={village}
            onVillageChange={setVillage}
            region={nigerRegion}
            onRegionChange={setNigerRegion}
            lat={lat}
            lng={lng}
            onLatLngChange={(la, lo) => {
              setLat(la)
              setLng(lo)
            }}
            i18nScope="field"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">{t('field.age')}</label>
              <select
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                value={age}
                onChange={(e) => setAge(e.target.value as SubmitterAgeGroup | '')}
              >
                <option value="">{t('common.none')}</option>
                {AGE_KEYS.map((a) => (
                  <option key={a} value={a}>
                    {t(`ageGroup.${a}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">{t('field.sex')}</label>
              <select
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                value={sex}
                onChange={(e) => setSex(e.target.value as SubmitterSex | '')}
              >
                <option value="">{t('common.none')}</option>
                {SEX_KEYS.map((s) => (
                  <option key={s} value={s}>
                    {t(`sex.${s}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm text-[var(--text-muted)]">{t('field.diversity')}</p>
            <div className="flex flex-wrap gap-2">
              {DIVERSITY_KEYS.map((o) => (
                <label key={o} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={diversity.includes(o)}
                    onChange={() => toggleDiv(o)}
                  />
                  {t(`diversity.${o}`)}
                </label>
              ))}
            </div>
          </div>
          <Input
            label={t('field.prefLang')}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          />
          <Button type="submit" disabled={pending}>
            {pending ? t('common.sending') : t('field.submit')}
          </Button>
        </form>
      </Card>
    </div>
  )
}
