import { describe, expect, it } from 'vitest'
import { formatStaffOptionLabel } from './assignmentService'

describe('formatStaffOptionLabel', () => {
  it('privilégie le nom puis le courriel', () => {
    expect(formatStaffOptionLabel({ full_name: 'Ada Lovelace', email: 'ada@example.com' })).toBe('Ada Lovelace')
    expect(formatStaffOptionLabel({ full_name: null, email: 'b@example.com' })).toBe('b@example.com')
    expect(formatStaffOptionLabel({ full_name: '   ', email: null })).toBe('—')
  })

  it('ajoute la spécialité lorsqu’elle est renseignée', () => {
    expect(
      formatStaffOptionLabel({
        full_name: 'Jean Dupont',
        email: 'j@example.com',
        specialty: 'Eau',
      }),
    ).toBe('Jean Dupont — Eau')
  })
})
