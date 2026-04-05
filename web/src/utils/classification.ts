/**
 * Pré-classification mots-clés (miroir logique SQL côté client pour tests / prévisualisation).
 */
export type ClassificationResult = {
  suggestedCategorySlug: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  receipt: string
}

const RECEIPT =
  'Votre message a bien été reçu. Il sera examiné par notre équipe. Merci pour votre confiance.'

export function classifyFeedbackText(description: string): ClassificationResult {
  const d = description.toLowerCase()
  let suggestedCategorySlug = 'autre'
  let priority: ClassificationResult['priority'] = 'medium'

  if (
    /urgence|urgent|décès|mort|bless|attaque|fusillade|incendie|inondation|effondrement/.test(d)
  ) {
    priority = 'critical'
    suggestedCategorySlug = 'securite'
  } else if (/faim|nourriture|eau potable|eau\b|ration|denrée/.test(d)) {
    priority = 'high'
    suggestedCategorySlug = 'besoins_de_base'
  } else if (/abus|violence|exploitation|harcèlement|protection|enfant/.test(d)) {
    priority = 'high'
    suggestedCategorySlug = 'protection'
  } else if (/santé|médic|hôpital|maladie|vaccin/.test(d)) {
    priority = 'high'
    suggestedCategorySlug = 'sante'
  } else if (/logement|abri|tente|toit/.test(d)) {
    suggestedCategorySlug = 'abri'
    priority = 'medium'
  } else if (/information|rumeur|clarification/.test(d)) {
    suggestedCategorySlug = 'information'
    priority = 'medium'
  } else if (/plainte|mécontent|insatisf/.test(d)) {
    suggestedCategorySlug = 'plainte'
    priority = 'medium'
  }

  return { suggestedCategorySlug, priority, receipt: RECEIPT }
}

export function effectivePriority(
  priority: string,
  override: string | null | undefined,
): ClassificationResult['priority'] {
  const o = override as ClassificationResult['priority'] | null | undefined
  if (o === 'low' || o === 'medium' || o === 'high' || o === 'critical') return o
  const p = priority as ClassificationResult['priority']
  if (p === 'low' || p === 'medium' || p === 'high' || p === 'critical') return p
  return 'medium'
}
