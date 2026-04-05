import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { FileUpload } from '../components/ui/FileUpload'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { TextArea } from '../components/ui/TextArea'
import { uploadAttachment } from '../services/attachmentService'
import { NigerVillageGeocodeFields } from '../components/location/NigerVillageGeocodeFields'
import { submitPublicFeedback } from '../services/feedbackService'
import type { NigerRegionValue } from '../constants/nigerRegions'
import type { DiversityTag, FeedbackChannel, FeedbackType, SubmitterAgeGroup, SubmitterSex } from '../types'
import { classifyFeedbackText } from '../utils/classification'

const CHANNEL_VALUES: FeedbackChannel[] = ['web', 'sms_sim', 'whatsapp_sim', 'telegram_sim']
const TYPE_VALUES: FeedbackType[] = ['feedback', 'alert', 'complaint', 'suggestion', 'question']
const AGE_KEYS: SubmitterAgeGroup[] = ['0_17', '18_59', '60_plus', 'mixed', 'prefer_not', 'unknown']
const SEX_KEYS: SubmitterSex[] = ['female', 'male', 'prefer_not', 'mixed', 'unknown']
const DIVERSITY_KEYS: DiversityTag[] = ['disability', 'ethnic_minority', 'pregnant_lactating', 'prefer_not']

export function PublicFeedbackPage() {
  const { t } = useTranslation()
  const [channel, setChannel] = useState<FeedbackChannel>('web')
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('feedback')
  const [description, setDescription] = useState('')
  const [village, setVillage] = useState('')
  const [nigerRegion, setNigerRegion] = useState<NigerRegionValue | ''>('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [age, setAge] = useState<SubmitterAgeGroup | ''>('')
  const [sex, setSex] = useState<SubmitterSex | ''>('')
  const [diversity, setDiversity] = useState<DiversityTag[]>([])
  const [language, setLanguage] = useState('')
  const [demoOpen, setDemoOpen] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<{ id: string; receipt: string } | null>(null)

  const preview = description.length >= 10 ? classifyFeedbackText(description) : null

  function toggleDiv(v: DiversityTag) {
    setDiversity((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v]))
  }

  function requestGeolocation() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6))
        setLng(pos.coords.longitude.toFixed(6))
      },
      (err) => console.warn('Geolocation:', err),
    )
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (description.trim().length < 10) e.description = t('public.errMinDesc')
    if (description.length > 8000) e.description = t('public.errMaxDesc')
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))
      e.contactEmail = t('public.errEmail')
    if (lat && Number.isNaN(Number(lat))) e.lat = t('public.errLat')
    if (lng && Number.isNaN(Number(lng))) e.lng = t('public.errLng')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setErrors({})
    try {
      const locationLabel =
        village.trim() && nigerRegion
          ? `${village.trim()}, ${nigerRegion}`
          : village.trim() || undefined
      const res = await submitPublicFeedback({
        channel,
        feedback_type: feedbackType,
        description: description.trim(),
        location_label: locationLabel,
        contact_name: contactName.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
        lat: lat ? Number(lat) : null,
        lng: lng ? Number(lng) : null,
        submitter_age_group: age || null,
        submitter_sex: sex || null,
        submitter_diversity: diversity.length ? diversity : null,
        submitter_language: language.trim() || null,
      })
      for (const f of files) {
        try {
          await uploadAttachment(res.id, f)
        } catch {
          /* continue autres fichiers */
        }
      }
      setDone({ id: res.id, receipt: res.receipt_message })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('public.errForm')
      setErrors({ form: msg })
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <Card className="mx-auto max-w-xl text-center" role="status" aria-live="polite">
        <div className="mb-4 text-4xl" aria-hidden>
          ✓
        </div>
        <h1 className="mb-2 text-2xl font-semibold text-[var(--text-heading)]">{t('public.successTitle')}</h1>
        <p className="mb-4 text-[var(--text-muted)]">{done.receipt}</p>
        <p className="mb-6 font-mono text-sm text-[var(--text-muted)]">
          {t('common.reference')} : {done.id}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/">
            <Button variant="secondary">{t('public.homeBtn')}</Button>
          </Link>
          <Button
            onClick={() => {
              setDone(null)
              setDescription('')
              setVillage('')
              setNigerRegion('')
              setContactName('')
              setContactPhone('')
              setContactEmail('')
              setLat('')
              setLng('')
              setAge('')
              setSex('')
              setDiversity([])
              setLanguage('')
              setFiles([])
            }}
          >
            {t('public.newMessage')}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[var(--text-heading)]">{t('public.title')}</h1>
        <p className="mt-2 text-[var(--text-muted)]">{t('public.intro')}</p>
      </div>

      <Card>
        <form onSubmit={onSubmit} className="space-y-5">
          {errors.form && (
            <p
              role="alert"
              className="rounded-lg bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300"
            >
              {errors.form}
            </p>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">{t('public.channel')}</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as FeedbackChannel)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            >
              {CHANNEL_VALUES.map((c) => (
                <option key={c} value={c}>
                  {t(`channel.${c}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">{t('public.messageType')}</label>
            <select
              value={feedbackType}
              onChange={(e) => setFeedbackType(e.target.value as FeedbackType)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            >
              {TYPE_VALUES.map((c) => (
                <option key={c} value={c}>
                  {t(`feedbackType.${c}`)}
                </option>
              ))}
            </select>
          </div>

          <TextArea
            label={t('public.description')}
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            error={errors.description}
            required
            placeholder={t('public.descriptionPh')}
          />

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
            latError={errors.lat}
            lngError={errors.lng}
            i18nScope="public"
          />
          <Button type="button" variant="secondary" size="sm" onClick={requestGeolocation}>
            {t('public.useLocation')}
          </Button>

          <Input label={t('public.contactName')} value={contactName} onChange={(e) => setContactName(e.target.value)} />
          <Input label={t('public.contactPhone')} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          <Input
            label={t('public.contactEmail')}
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            error={errors.contactEmail}
          />

          <div>
            <p className="mb-2 text-sm font-medium text-[var(--text-heading)]">{t('public.attachments')}</p>
            <FileUpload maxFiles={3} onChange={setFiles} />
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-3 text-left text-sm font-medium"
            onClick={() => setDemoOpen((o) => !o)}
          >
            {t('public.demoToggle')}
            <span>{demoOpen ? '▼' : '▶'}</span>
          </button>
          {demoOpen && (
            <div className="space-y-4 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 text-sm">
              <p className="text-[var(--text-muted)]">{t('public.demoHelp')}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-[var(--text-muted)]">{t('public.ageGroup')}</label>
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
                  <label className="mb-1 block text-xs text-[var(--text-muted)]">{t('public.sex')}</label>
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
                <p className="mb-2 text-xs text-[var(--text-muted)]">{t('public.diversityTitle')}</p>
                <div className="flex flex-wrap gap-2">
                  {DIVERSITY_KEYS.map((o) => (
                    <label key={o} className="flex items-center gap-1">
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
                label={t('public.prefLang')}
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              />
            </div>
          )}

          {preview && (
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 text-sm">
              <p className="font-medium text-[var(--text-heading)]">{t('public.previewTitle')}</p>
              <p className="text-[var(--text-muted)]">
                {t('public.previewCat', { slug: preview.suggestedCategorySlug })} —{' '}
                {t('public.previewPri', { priority: preview.priority })}
              </p>
            </div>
          )}

          <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
            {submitting ? t('common.sending') : t('public.submitBtn')}
          </Button>
        </form>
      </Card>
    </div>
  )
}
