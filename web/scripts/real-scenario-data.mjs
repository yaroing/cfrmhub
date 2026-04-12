/**
 * Données de la suite étendue de tests réels Supabase (> 60 cas).
 * Marqueurs : [CFRM-HUB-TEST:Rxxx] (général), [CFRM-HUB-TEST:Dxx] (doublons).
 */

const CHANNELS = ['web', 'sms_sim', 'whatsapp_sim', 'telegram_sim']

/** Échantillons GPS + libellé (France et international, latitudes extrêmes autorisées par CHECK) */
export const GEO_SAMPLES = [
  { lat: 48.8566, lng: 2.3522, location_label: 'Paris, France' },
  { lat: 45.764, lng: 4.8357, location_label: 'Lyon, France' },
  { lat: 43.2965, lng: 5.3698, location_label: 'Marseille, France' },
  { lat: 44.8378, lng: -0.5792, location_label: 'Bordeaux, France' },
  { lat: 50.6292, lng: 3.0573, location_label: 'Lille, France' },
  { lat: 48.5734, lng: 7.7521, location_label: 'Strasbourg, France' },
  { lat: 43.6047, lng: 1.4442, location_label: 'Toulouse, France' },
  { lat: 47.2184, lng: -1.5536, location_label: 'Nantes, France' },
  { lat: -4.0435, lng: 39.6682, location_label: 'Mombasa, Kenya' },
  { lat: -33.8688, lng: 151.2093, location_label: 'Sydney, Australie' },
  { lat: 64.8378, lng: -147.7164, location_label: 'Fairbanks, USA' },
  { lat: 0, lng: 0, location_label: 'Point 0N 0E (test)' },
  { lat: -34.6037, lng: -58.3816, location_label: 'Buenos Aires, Argentine' },
  { lat: 35.6762, lng: 139.6503, location_label: 'Tokyo, Japon' },
  { lat: 60.1699, lng: 24.9384, location_label: 'Helsinki, Finlande' },
]

/** Textes ≥ 10 caractères, vocabulaire orienté triggers (priorité / catégorie attendues) */
const CLASSIFIER_BLOCKS = [
  {
    feedback_type: 'alert',
    expected: { priority: 'critical', slug: 'securite' },
    bodies: [
      "URGENT : incendie près du site, besoin d'évacuation immédiate pour les familles présentes sur place.",
      'Situation critique : fumée importante au camp, risque pour les personnes à mobilité réduite, intervention urgente.',
      'Alerte sécurité immédiate : explosion entendue secteur tentes bleues, évacuation demandée par la population.',
    ],
  },
  {
    feedback_type: 'feedback',
    expected: { priority: 'high', slug: 'besoins_de_base' },
    bodies: [
      "Nous manquons d'eau potable depuis trois jours dans notre zone, les enfants sont très fatigués.",
      "Pénurie d'eau et de nourriture durable pour les familles du secteur est, files d'attente interminables signalées.",
      "Besoin urgent de kits d'hygiène et d'eau pour cinquante personnes hébergées provisoirement sous bâches.",
    ],
  },
  {
    feedback_type: 'complaint',
    expected: { priority: 'medium', slug: 'plainte' },
    bodies: [
      'Plainte : délais trop longs pour la distribution alimentaire, nous attendons depuis une semaine sans réponse claire.',
      'Je dépose une plainte formelle sur le manque de transparence dans les critères de priorité à la distribution.',
      'Plainte collective : favoritisme présumé lors des derniers passages au point de distribution central du site.',
    ],
  },
  {
    feedback_type: 'question',
    expected: { priority: 'medium', slug: 'information' },
    bodies: [
      "Demande d'information et clarification sur les critères d'éligibilité au programme d'aide humanitaire actuel.",
      'Pourriez-vous préciser les horaires exacts et les documents requis pour inscription au registre des ménages ?',
      "Question : existe-t-il un interlocuteur dédié pour les personnes sourdes dans ce dispositif d'information ?",
    ],
  },
  {
    feedback_type: 'feedback',
    expected: { priority: 'high', slug: 'protection' },
    bodies: [
      'Signalement de violence et harcèlement envers ma famille près du point de distribution, nous nous sentons en danger.',
      'Protection : agressions verbales répétées contre des mineurs près des sanitaires communs, besoin de médiation.',
      'Cas de harcèlement sexuel signalé par plusieurs femmes sur le trajet vers les douches, sécurisation demandée.',
    ],
  },
]

function pickChannel(i) {
  return CHANNELS[i % CHANNELS.length]
}

function pickGeo(i) {
  return GEO_SAMPLES[i % GEO_SAMPLES.length]
}

/** @returns {object[]} */
export function buildScenarios() {
  /** @type {any[]} */
  const scenarios = []
  let r = 0

  const rid = () => {
    r += 1
    return `R${String(r).padStart(3, '0')}`
  }

  // --- 15 scénarios : classification forte × 3 variantes × géolocalisation ---
  let idx = 0
  for (const block of CLASSIFIER_BLOCKS) {
    for (let v = 0; v < 3; v += 1) {
      const id = rid()
      const geo = pickGeo(idx)
      scenarios.push({
        id,
        channel: pickChannel(idx),
        feedback_type: block.feedback_type,
        description: `[CFRM-HUB-TEST:${id}] ${block.bodies[v]}`,
        location_label: geo.location_label,
        lat: geo.lat,
        lng: geo.lng,
        contact_name: v === 0 ? 'Contact Test Alpha' : null,
        contact_phone: v === 1 ? '+33123456789' : null,
        contact_email: v === 2 ? 'test.scenario+cfrm@example.org' : null,
        expected: block.expected,
        suite: 'classification_geo',
      })
      idx += 1
    }
  }

  // --- 12 scénarios : types suggestion / question / complaint / alert (sans doublon attendu) ---
  const extraBodies = [
    { feedback_type: 'suggestion', body: "Suggestion : installer un point d'écoute anonyme près de l'entrée du site pour les retours sensibles.", expected: null },
    { feedback_type: 'suggestion', body: "Proposition d'amélioration : afficher un planning hebdomadaire des distributions à l'entrée de chaque zone.", expected: null },
    { feedback_type: 'question', body: "Demande : quels sont les délais de réponse habituels après soumission d'un formulaire sur le portail web ?", expected: { priority: 'medium', slug: 'information' } },
    { feedback_type: 'complaint', body: 'Réclamation : files trop longues sans ombre ni eau, conditions difficiles pour personnes âgées hier après-midi.', expected: { priority: 'medium', slug: 'plainte' } },
    { feedback_type: 'alert', body: 'Alerte : odeur de gaz signalée près du bloc sanitaire nord, merci de faire vérifier par une équipe technique.', expected: { priority: 'critical', slug: 'securite' } },
    { feedback_type: 'feedback', body: "Retour positif partiel : l'équipe sur place a été à l'écoute malgré la forte affluence ce matin au stand A.", expected: null },
    { feedback_type: 'suggestion', body: 'Idée : créneaux réservés aux familles monoparentales le mercredi matin pour réduire la charge mentale.', expected: null },
    { feedback_type: 'question', body: "Question pratique : où déposer une plainte confidentielle sans passer par la file d'attente standard ?", expected: { priority: 'medium', slug: 'information' } },
    { feedback_type: 'complaint', body: 'Plainte : bruit excessif la nuit près du générateur, impossible de dormir pour les familles du lotissement C.', expected: { priority: 'medium', slug: 'plainte' } },
    { feedback_type: 'feedback', body: "Besoin signalé : couvertures supplémentaires pour la vague de froid annoncée, plusieurs tentes non isolées.", expected: { priority: 'high', slug: 'besoins_de_base' } },
    { feedback_type: 'question', body: "Demande d'information sur les procédures de rapatriement volontaire et les contacts sécurisés disponibles.", expected: { priority: 'medium', slug: 'information' } },
    { feedback_type: 'suggestion', body: 'Suggestion simple : numéro vert affiché en plusieurs langues sur les panneaux du point médical.', expected: null },
  ]

  for (const row of extraBodies) {
    const id = rid()
    const geo = pickGeo(idx)
    scenarios.push({
      id,
      channel: pickChannel(idx),
      feedback_type: row.feedback_type,
      description: `[CFRM-HUB-TEST:${id}] ${row.body}`,
      location_label: idx % 2 === 0 ? geo.location_label : null,
      lat: idx % 3 === 0 ? geo.lat : idx % 3 === 1 ? geo.lat : null,
      lng: idx % 3 === 0 ? geo.lng : idx % 3 === 1 ? null : geo.lng,
      submitter_age_group: ['0_17', '18_59', '60_plus', 'mixed', null][idx % 5],
      submitter_sex: ['female', 'male', 'prefer_not', null][idx % 4],
      submitter_diversity: idx % 4 === 0 ? ['lgbtq'] : null,
      submitter_language: idx % 3 === 0 ? 'fr' : idx % 3 === 1 ? 'ar' : null,
      expected: row.expected,
      suite: 'types_mixtes_demo',
    })
    idx += 1
  }

  // --- 8 scénarios : contact + coordonnées GPS précises (formulaire « complet ») ---
  for (let k = 0; k < 8; k += 1) {
    const id = rid()
    const geo = pickGeo(idx + k)
    scenarios.push({
      id,
      channel: pickChannel(idx + k),
      feedback_type: 'feedback',
      description: `[CFRM-HUB-TEST:${id}] Signalement géolocalisé : file d'attente au point B, merci d'envoyer une équipe pour fluidifier l'accès aux kits.`,
      location_label: geo.location_label,
      lat: geo.lat,
      lng: geo.lng,
      contact_name: `Testeur Geo ${k + 1}`,
      contact_phone: `+336${String(10000000 + k).slice(-8)}`,
      contact_email: `geo.case.${k + 1}.cfrm@example.org`,
      submitter_age_group: '18_59',
      submitter_sex: k % 2 === 0 ? 'female' : 'male',
      submitter_language: 'fr',
      expected: { priority: 'medium', slug: 'plainte' },
      suite: 'contact_geo',
    })
  }
  idx += 8

  // --- 10 scénarios : géolocalisation seule (priorité / catégorie laissées au moteur) ---
  for (let k = 0; k < 10; k += 1) {
    const id = rid()
    const geo = pickGeo(idx + k)
    scenarios.push({
      id,
      channel: pickChannel(idx + k),
      feedback_type: 'feedback',
      description: `[CFRM-HUB-TEST:${id}] Observation terrain : affluence modérée, besoin de signalétique plus visible vers les sanitaires ouest.`,
      location_label: geo.location_label,
      lat: geo.lat,
      lng: geo.lng,
      expected: null,
      verifyGeo: { lat: geo.lat, lng: geo.lng },
      suite: 'geo_only',
    })
  }
  idx += 10

  // --- 6 scénarios : canaux simulateurs avec texte neutre long ---
  const simBodies = [
    'Message simulé depuis canal mobile : la file avance lentement mais le personnel reste courtois avec les familles.',
    'Retour via messagerie : difficulté à lire les affiches petit format pour les personnes malvoyantes près du stand.',
    'Notification terrain : stock de couches bébé bas à la distribution de 14h, risque de tension en fin de journée.',
    'Texte long pour respecter la contrainte minimale : nous demandons une communication claire sur les prochaines dates de passage bus médical.',
    'Signalement modéré : déchets non collectés depuis deux jours derrière le hangar temporaire, odeurs gênantes.',
    'Demande de suivi : notre dossier famille semble bloqué depuis quinze jours sans nouvelle du service concerné.',
  ]
  for (let k = 0; k < 6; k += 1) {
    const id = rid()
    const geo = pickGeo(idx + k)
    scenarios.push({
      id,
      channel: CHANNELS[k % 4],
      feedback_type: k % 2 === 0 ? 'feedback' : 'suggestion',
      description: `[CFRM-HUB-TEST:${id}] ${simBodies[k]}`,
      location_label: k < 4 ? geo.location_label : null,
      lat: k < 5 ? geo.lat : null,
      lng: k < 5 ? geo.lng : null,
      expected: null,
      suite: 'channels_sim',
    })
  }
  idx += 6

  // --- 6 scénarios supplémentaires : volume, géoloc et alertes dispersées ---
  const boostBodies = [
    { feedback_type: 'alert', body: 'URGENCE médicale : personne évanouie près du poste de secours, besoin d’ambulance immédiatement.', expected: { priority: 'critical', slug: 'securite' } },
    { feedback_type: 'feedback', body: "Manque cruel de produits d'hygiène féminine depuis une semaine, situation humiliante pour beaucoup.", expected: { priority: 'high', slug: 'besoins_de_base' } },
    { feedback_type: 'complaint', body: 'Nous protestons contre le changement d’horaires non annoncé qui nous a fait rater la distribution.', expected: { priority: 'medium', slug: 'plainte' } },
    { feedback_type: 'question', body: "Où trouver le règlement intérieur traduit en langues nationales pour notre communauté ?", expected: { priority: 'medium', slug: 'information' } },
    { feedback_type: 'feedback', body: 'Violence domestique signalée dans le bloc F, la victime demande un accompagnement confidentiel.', expected: { priority: 'high', slug: 'protection' } },
    { feedback_type: 'suggestion', body: 'Pourrait-on organiser des ateliers parents-enfants pour apaiser les tensions entre voisins de tente ?', expected: null },
  ]
  for (let k = 0; k < boostBodies.length; k += 1) {
    const id = rid()
    const geo = pickGeo(idx + k)
    scenarios.push({
      id,
      channel: pickChannel(idx + k),
      feedback_type: boostBodies[k].feedback_type,
      description: `[CFRM-HUB-TEST:${id}] ${boostBodies[k].body}`,
      location_label: geo.location_label,
      lat: geo.lat,
      lng: geo.lng,
      expected: boostBodies[k].expected,
      suite: 'volume_boost',
    })
  }
  idx += boostBodies.length

  // --- 10 scénarios doublon : même texte deux fois le même jour (deux appels RPC) ---
  for (let d = 1; d <= 10; d += 1) {
    const id = `D${String(d).padStart(2, '0')}`
    const body = `Plainte répétée distribution zone série ${d} pour familles nombreuses attente excessive ce même jour signal collectif urgent et suivi demandé.`
    scenarios.push({
      id,
      channel: 'web',
      feedback_type: 'complaint',
      description: `[CFRM-HUB-TEST:${id}] ${body}`,
      location_label: 'Zone test doublon',
      lat: 46.2276,
      lng: 2.2137,
      duplicateSecond: true,
      expected: null,
      suite: 'duplicate_pair',
    })
  }

  return scenarios
}

/** Cas négatifs : la RPC doit échouer avec un message contenant expectSubstring */
export const NEGATIVE_SCENARIOS = [
  {
    id: 'N01',
    expectSubstring: 'description too short',
    p_channel: 'web',
    p_feedback_type: 'feedback',
    p_description: 'court',
  },
  {
    id: 'N02',
    expectSubstring: 'invalid channel',
    p_channel: 'not_a_valid_channel',
    p_feedback_type: 'feedback',
    p_description: "Description volontairement longue pour satisfaire la contrainte minimale de dix caractères requis par l'API.",
  },
  {
    id: 'N03',
    expectSubstring: 'invalid feedback type',
    p_channel: 'web',
    p_feedback_type: 'invalid_type_xyz',
    p_description: "Autre description suffisamment longue pour le test de type de retour invalide côté fonction PostgreSQL.",
  },
  {
    id: 'N04',
    expectSubstring: 'description too short',
    p_channel: 'web',
    p_feedback_type: 'feedback',
    p_description: '123456789',
  },
  {
    id: 'N05',
    expectSubstring: 'description too short',
    p_channel: 'web',
    p_feedback_type: 'feedback',
    p_description: '          ',
  },
]
