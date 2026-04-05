import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NIGER_REGION_VALUES, nigerRegionI18nKey, type NigerRegionValue } from '../../constants/nigerRegions'
import { geocodeNigerVillage } from '../../utils/nigerGeocode'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

type Props = {
  village: string
  onVillageChange: (v: string) => void
  region: NigerRegionValue | ''
  onRegionChange: (r: NigerRegionValue | '') => void
  lat: string
  lng: string
  onLatLngChange: (lat: string, lng: string) => void
  latError?: string
  lngError?: string
  /** Préfixe des clés i18n : "public" | "field" (utilise locationNiger.*) */
  i18nScope?: 'public' | 'field'
}

export function NigerVillageGeocodeFields({
  village,
  onVillageChange,
  region,
  onRegionChange,
  lat,
  lng,
  onLatLngChange,
  latError,
  lngError,
  i18nScope = 'public',
}: Props) {
  const { t } = useTranslation()
  const p = `locationNiger` as const
  const [geoPending, setGeoPending] = useState(false)
  const [geoMsg, setGeoMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const ns = i18nScope === 'field' ? 'field' : 'public'

  async function runGeocode() {
    setGeoMsg(null)
    if (!village.trim() || !region) {
      setGeoMsg({ ok: false, text: t(`${ns}.${p}.needVillageAndRegion`) })
      return
    }
    setGeoPending(true)
    try {
      const hit = await geocodeNigerVillage(village.trim(), region as NigerRegionValue)
      if (!hit) {
        setGeoMsg({ ok: false, text: t(`${ns}.${p}.geocodeFail`) })
        return
      }
      onLatLngChange(hit.lat.toFixed(6), hit.lng.toFixed(6))
      setGeoMsg({ ok: true, text: t(`${ns}.${p}.geocodeOk`, { place: hit.label }) })
    } catch {
      setGeoMsg({ ok: false, text: t(`${ns}.${p}.geocodeFail`) })
    } finally {
      setGeoPending(false)
    }
  }

  return (
    <div className="space-y-3">
      <Input
        label={t(`${ns}.${p}.village`)}
        name="niger_village"
        value={village}
        onChange={(e) => onVillageChange(e.target.value)}
        autoComplete="address-level3"
      />
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">{t(`${ns}.${p}.region`)}</label>
        <select
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          value={region}
          onChange={(e) => onRegionChange((e.target.value || '') as NigerRegionValue | '')}
        >
          <option value="">{t('common.none')}</option>
          {NIGER_REGION_VALUES.map((r) => (
            <option key={r} value={r}>
              {t(nigerRegionI18nKey(r))}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={geoPending} onClick={() => void runGeocode()}>
          {geoPending ? t(`${ns}.${p}.geocoding`) : t(`${ns}.${p}.geocodeBtn`)}
        </Button>
        <p className="text-xs text-[var(--text-muted)]">{t(`${ns}.${p}.geocodeHint`)}</p>
      </div>
      {geoMsg && (
        <p
          className={geoMsg.ok ? 'text-sm text-emerald-700 dark:text-emerald-300' : 'text-sm text-amber-700 dark:text-amber-200'}
          role="status"
        >
          {geoMsg.text}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t(`${ns}.${p}.lat`)}
          name="lat"
          value={lat}
          onChange={(e) => onLatLngChange(e.target.value, lng)}
          error={latError}
        />
        <Input
          label={t(`${ns}.${p}.lng`)}
          name="lng"
          value={lng}
          onChange={(e) => onLatLngChange(lat, e.target.value)}
          error={lngError}
        />
      </div>
    </div>
  )
}
