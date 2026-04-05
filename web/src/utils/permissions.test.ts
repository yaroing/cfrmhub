import { describe, expect, it } from 'vitest'
import {
  canAdmin,
  canCommentInternal,
  canEditFeedback,
  canExport,
  canFlagSensitive,
  canManageActions,
  canSubmitFeedback,
  canViewAllFeedbacks,
  canViewAnalytics,
  canViewSensitive,
} from './permissions'

describe('permissions', () => {
  it('admin a tous les droits de gestion', () => {
    expect(canAdmin('admin')).toBe(true)
    expect(canEditFeedback('admin')).toBe(true)
    expect(canExport('admin')).toBe(true)
    expect(canViewSensitive('admin')).toBe(true)
    expect(canFlagSensitive('admin')).toBe(true)
    expect(canSubmitFeedback('admin')).toBe(true)
    expect(canViewAllFeedbacks('admin')).toBe(true)
    expect(canViewAnalytics('admin')).toBe(true)
    expect(canManageActions('admin')).toBe(true)
    expect(canCommentInternal('admin')).toBe(true)
  })

  it('validateur édite et exporte', () => {
    expect(canAdmin('validator')).toBe(false)
    expect(canEditFeedback('validator')).toBe(true)
    expect(canExport('validator')).toBe(true)
    expect(canViewSensitive('validator')).toBe(true)
    expect(canManageActions('validator')).toBe(true)
    expect(canCommentInternal('validator')).toBe(true)
  })

  it('observateur lecture seule sur édition', () => {
    expect(canEditFeedback('observer')).toBe(false)
    expect(canExport('observer')).toBe(false)
    expect(canViewSensitive('observer')).toBe(false)
    expect(canFlagSensitive('observer')).toBe(false)
    expect(canSubmitFeedback('observer')).toBe(false)
    expect(canViewAllFeedbacks('observer')).toBe(true)
    expect(canViewAnalytics('observer')).toBe(true)
    expect(canManageActions('observer')).toBe(false)
    expect(canCommentInternal('observer')).toBe(false)
  })

  it('agent terrain : saisie et ses dossiers', () => {
    expect(canSubmitFeedback('field_agent')).toBe(true)
    expect(canViewAllFeedbacks('field_agent')).toBe(false)
    expect(canViewAnalytics('field_agent')).toBe(false)
    expect(canManageActions('field_agent')).toBe(false)
  })

  it('point focal : sensible + lecture large', () => {
    expect(canViewSensitive('focal_point')).toBe(true)
    expect(canViewAllFeedbacks('focal_point')).toBe(true)
    expect(canViewAnalytics('focal_point')).toBe(true)
    expect(canFlagSensitive('focal_point')).toBe(false)
    expect(canManageActions('focal_point')).toBe(false)
  })

  it('null = pas de droits', () => {
    expect(canAdmin(null)).toBe(false)
    expect(canEditFeedback(null)).toBe(false)
    expect(canViewSensitive(null)).toBe(false)
  })
})
