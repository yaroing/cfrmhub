import type { UserRole } from '../types'

export function canEditFeedback(role: UserRole | null): boolean {
  return role === 'admin' || role === 'validator'
}

export function canAdmin(role: UserRole | null): boolean {
  return role === 'admin'
}

export function canExport(role: UserRole | null): boolean {
  return role === 'admin' || role === 'validator'
}

export function canViewSensitive(role: UserRole | null): boolean {
  return role === 'admin' || role === 'validator' || role === 'focal_point'
}

export function canFlagSensitive(role: UserRole | null): boolean {
  return role === 'admin' || role === 'validator'
}

export function canSubmitFeedback(role: UserRole | null): boolean {
  return role === 'admin' || role === 'validator' || role === 'field_agent'
}

export function canViewAllFeedbacks(role: UserRole | null): boolean {
  return role === 'admin' || role === 'validator' || role === 'observer' || role === 'focal_point'
}

export function canViewAnalytics(role: UserRole | null): boolean {
  return role === 'admin' || role === 'validator' || role === 'observer' || role === 'focal_point'
}

export function canManageActions(role: UserRole | null): boolean {
  return role === 'admin' || role === 'validator'
}

export function canCommentInternal(role: UserRole | null): boolean {
  return role === 'admin' || role === 'validator'
}
