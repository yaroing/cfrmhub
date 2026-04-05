export type UserRole = 'admin' | 'validator' | 'observer' | 'field_agent' | 'focal_point'

export type FeedbackChannel =
  | 'web'
  | 'sms_sim'
  | 'sms_twilio'
  | 'whatsapp_sim'
  | 'whatsapp_business'
  | 'telegram_sim'
  | 'telegram_bot'
  | 'phone'
  | 'in_person'

export type FeedbackType = 'feedback' | 'alert' | 'complaint' | 'suggestion' | 'question'

export type Priority = 'low' | 'medium' | 'high' | 'critical'

export type FeedbackStatus =
  | 'new'
  | 'in_validation'
  | 'validated'
  | 'in_progress'
  | 'closed'
  | 'rejected'

export type NotificationChannel =
  | 'email'
  | 'sms'
  | 'whatsapp'
  | 'telegram'
  | 'phone_call'
  | 'visit'
  | 'other'

export type SensitiveType =
  | 'sgbv'
  | 'child_protection'
  | 'sea'
  | 'misconduct'
  | 'security'
  | 'other_sensitive'

export type SubmitterAgeGroup = '0_17' | '18_59' | '60_plus' | 'mixed' | 'prefer_not' | 'unknown'

export type SubmitterSex = 'female' | 'male' | 'prefer_not' | 'mixed' | 'unknown'

export type DiversityTag = 'disability' | 'ethnic_minority' | 'pregnant_lactating' | 'prefer_not'

export type ActionStatus = 'open' | 'in_progress' | 'done' | 'deferred'

export type Profile = {
  id: string
  email: string | null
  full_name: string | null
  role: UserRole
  agent_code: string | null
  /** Thème / expertise affiché à l’assignation (ex. SGBV, protection enfant). */
  specialty?: string | null
  created_at: string
}

export type Category = {
  id: string
  slug: string
  label_fr: string
  label_en: string | null
  sort_order: number
  is_active: boolean
}

export type FeedbackRow = {
  id: string
  created_at: string
  updated_at: string
  channel: FeedbackChannel
  feedback_type: FeedbackType
  description: string
  category_suggested_id: string | null
  category_id: string | null
  priority: Priority
  priority_override: Priority | null
  status: FeedbackStatus
  location_label: string | null
  lat: number | null
  lng: number | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  receipt_message: string | null
  created_by: string | null
  duplicate_of_id: string | null
  needs_duplicate_review: boolean
  validation_ready: boolean
  metadata: Record<string, unknown>
  submitter_age_group: SubmitterAgeGroup | null
  submitter_sex: SubmitterSex | null
  submitter_diversity: string[] | null
  submitter_language: string | null
  loop_closed_at: string | null
  loop_closed_by: string | null
  community_response_text: string | null
  community_notified_via: NotificationChannel | null
  is_sensitive: boolean
  sensitive_type: SensitiveType | null
  sensitive_flagged_by: string | null
  sensitive_flagged_at: string | null
  first_touched_at: string | null
  assigned_to?: string | null
  assigned_at?: string | null
  assigned_by?: string | null
  category?: Category | null
  suggested_category?: Category | null
  assignee?: ProfileAssigneeSnippet | null
}

/** Profil léger joint sur `feedbacks.assigned_to`. */
export type ProfileAssigneeSnippet = {
  id: string
  full_name: string | null
  email: string | null
  role: UserRole
  specialty?: string | null
}

export type FeedbackAssignmentHistoryRow = {
  id: string
  feedback_id: string
  previous_assignee_id: string | null
  new_assignee_id: string | null
  assigned_by: string | null
  created_at: string
  assigner?: { full_name: string | null; email: string | null } | null
  new_assignee?: ProfileAssigneeSnippet | null
  previous_assignee?: { full_name: string | null; email: string | null } | null
}

export type FeedbackComment = {
  id: string
  feedback_id: string
  user_id: string
  body: string
  created_at: string
}

export type AuditLogRow = {
  id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  details: Record<string, unknown>
  created_at: string
}

export type FocalPoint = {
  id: string
  name: string
  role_title: string | null
  contact_email: string | null
  contact_phone: string | null
  sensitivity_type: SensitiveType
  organisation: string | null
  is_internal: boolean
  notes: string | null
  created_at: string
}

export type ActionOwnerSnippet = {
  id: string
  full_name: string | null
  email: string | null
}

export type ActionItem = {
  id: string
  title: string
  description: string | null
  status: ActionStatus
  owner_id: string | null
  category_id: string | null
  due_date: string | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  category?: Category | null
  owner?: ActionOwnerSnippet | null
  linked_feedbacks_count?: number
}

export type SlaConfigRow = {
  priority: Priority
  target_hours: number
  updated_at: string
}

export type WeeklyCountRow = {
  week_start: string
  total: number
  complaints: number
  alerts: number
  high_priority: number
}

export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: 'Nouveau',
  in_validation: 'En validation',
  validated: 'Validé',
  in_progress: 'En cours de traitement',
  closed: 'Clos',
  rejected: 'Rejeté / faux signalement',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Faible',
  medium: 'Moyenne',
  high: 'Élevée',
  critical: 'Critique',
}

export const CHANNEL_LABELS: Record<FeedbackChannel, string> = {
  web: 'Formulaire web',
  sms_sim: 'SMS (simulé)',
  sms_twilio: 'SMS (Twilio)',
  whatsapp_sim: 'WhatsApp (simulé)',
  whatsapp_business: 'WhatsApp Business (Meta)',
  telegram_sim: 'Telegram (simulé)',
  telegram_bot: 'Telegram (bot)',
  phone: 'Téléphone (usager)',
  in_person: 'En présence (face à face)',
}

export const NOTIF_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: 'E-mail',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  phone_call: 'Appel téléphonique',
  visit: 'Visite terrain',
  other: 'Autre',
}

export const SENSITIVE_TYPE_LABELS: Record<SensitiveType, string> = {
  sgbv: 'Violence sexuelle et basée sur le genre (SGBV)',
  child_protection: "Protection de l'enfant",
  sea: 'Abus sexuels par le personnel (SEA)',
  misconduct: 'Inconduite / abus de pouvoir',
  security: 'Incident sécuritaire',
  other_sensitive: 'Autre (sensible)',
}

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  done: 'Terminé',
  deferred: 'Reporté',
}

export const AGE_GROUP_LABELS: Record<SubmitterAgeGroup, string> = {
  '0_17': '0–17 ans',
  '18_59': '18–59 ans',
  '60_plus': '60 ans et plus',
  mixed: 'Groupe mixte',
  prefer_not: 'Préfère ne pas indiquer',
  unknown: 'Inconnu',
}

export const SEX_LABELS: Record<SubmitterSex, string> = {
  female: 'Femme',
  male: 'Homme',
  prefer_not: 'Préfère ne pas indiquer',
  mixed: 'Groupe mixte',
  unknown: 'Inconnu',
}

export const DIVERSITY_OPTIONS: { value: DiversityTag; label: string }[] = [
  { value: 'disability', label: 'Situation de handicap' },
  { value: 'ethnic_minority', label: 'Minorité ethnique ou religieuse' },
  { value: 'pregnant_lactating', label: 'Femme enceinte ou allaitante' },
  { value: 'prefer_not', label: 'Préfère ne pas indiquer' },
]
