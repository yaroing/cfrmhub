import { describe, expect, it } from 'vitest'
import { classifyFeedbackText, effectivePriority } from './classification'

describe('classifyFeedbackText', () => {
  it('détecte urgence critique', () => {
    const r = classifyFeedbackText('URGENCE incendie dans le camp, besoin immédiat')
    expect(r.priority).toBe('critical')
    expect(r.suggestedCategorySlug).toBe('securite')
  })

  it('détecte besoins de base', () => {
    const r = classifyFeedbackText('Plus de nourriture ni eau potable depuis deux jours')
    expect(r.priority).toBe('high')
    expect(r.suggestedCategorySlug).toBe('besoins_de_base')
  })

  it('défaut autre / medium', () => {
    const r = classifyFeedbackText('message générique sans mot clé fort assez long pour le test')
    expect(r.priority).toBe('medium')
    expect(r.suggestedCategorySlug).toBe('autre')
  })
})

describe('effectivePriority', () => {
  it('utilise override si présent', () => {
    expect(effectivePriority('low', 'critical')).toBe('critical')
  })

  it('sinon priorité de base', () => {
    expect(effectivePriority('high', null)).toBe('high')
  })
})
