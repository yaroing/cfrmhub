import type { NigerRegionValue } from '../constants/nigerRegions'

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'

export type GeocodeHit = {
  latitude: number
  longitude: number
  name: string
  admin1?: string
  country_code?: string
}

type OpenMeteoResponse = { results?: GeocodeHit[] }

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

/** Correspondance souple entre la région choisie et le champ admin1 (API). */
export function admin1MatchesRegion(admin1: string | undefined, region: NigerRegionValue): boolean {
  if (!admin1) return false
  const a = fold(admin1)
  const r = fold(region)
  return a === r || a.includes(r) || r.includes(a)
}

async function fetchGeocodeHits(name: string): Promise<GeocodeHit[]> {
  const params = new URLSearchParams({
    name,
    countryCode: 'NE',
    count: '20',
    language: 'fr',
    format: 'json',
  })
  const res = await fetch(`${GEOCODE_URL}?${params}`)
  if (!res.ok) return []
  const data = (await res.json()) as OpenMeteoResponse
  return (data.results ?? []).filter((x) => x.country_code === 'NE')
}

/**
 * Géocode un village/localité au Niger (Open-Meteo / OSM).
 * Important : l’API ne renvoie souvent rien pour une requête du type « Village, Région, Niger » ;
 * on interroge donc par **nom du lieu** + `countryCode=NE`, puis on filtre / note selon la **région** (admin1).
 */
export async function geocodeNigerVillage(
  village: string,
  region: NigerRegionValue,
): Promise<{ lat: number; lng: number; label: string } | null> {
  const v = village.trim()
  if (v.length < 2) return null

  let inNiger = await fetchGeocodeHits(v)
  if (inNiger.length === 0) {
    inNiger = await fetchGeocodeHits(`${v} ${region}`)
  }
  if (inNiger.length === 0) return null

  const regionHits = inNiger.filter((x) => admin1MatchesRegion(x.admin1, region))
  const pool = regionHits.length > 0 ? regionHits : inNiger

  const vFold = fold(v)
  const nameScored = pool.map((x) => {
    const n = fold(x.name)
    let score = 0
    if (n === vFold) score += 20
    else if (n.startsWith(vFold) || vFold.startsWith(n)) score += 12
    else if (n.includes(vFold) || vFold.includes(n)) score += 8
    if (admin1MatchesRegion(x.admin1, region)) score += 15
    return { x, score }
  })

  nameScored.sort((a, b) => b.score - a.score)
  const best = nameScored[0]?.x
  if (!best) return null

  const label = best.admin1 ? `${best.name}, ${best.admin1}` : `${best.name}, ${region}`
  return {
    lat: best.latitude,
    lng: best.longitude,
    label,
  }
}
