/** Valeurs alignées sur le champ `admin1` de l’API Open-Meteo (données OSM) pour le Niger. */
export const NIGER_REGION_VALUES = [
  'Agadez',
  'Diffa',
  'Dosso',
  'Maradi',
  'Niamey',
  'Tahoua',
  'Tillabéri',
  'Zinder',
] as const

export type NigerRegionValue = (typeof NIGER_REGION_VALUES)[number]

/** Clé i18n : nigerRegion.<slug> */
export function nigerRegionI18nKey(region: NigerRegionValue): string {
  const slug = region
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '_')
    .toLowerCase()
  return `nigerRegion.${slug}`
}
