import { describe, expect, it } from 'vitest'
import { admin1MatchesRegion } from './nigerGeocode'

describe('admin1MatchesRegion', () => {
  it('associe admin1 API et région sélectionnée (accents / casse)', () => {
    expect(admin1MatchesRegion('Zinder', 'Zinder')).toBe(true)
    expect(admin1MatchesRegion('Tillabéri', 'Tillabéri')).toBe(true)
    expect(admin1MatchesRegion('Tillaberi', 'Tillabéri')).toBe(true)
  })

  it('rejette une autre région', () => {
    expect(admin1MatchesRegion('Tahoua', 'Zinder')).toBe(false)
  })
})
