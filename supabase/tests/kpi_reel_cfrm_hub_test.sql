-- =============================================================================
-- KPI réels — lot marqué [CFRM-HUB-TEST:…] dans feedbacks.description
--   Ancien jeu : T1–T7  |  Suite étendue : R001…, D01… (voir web/scripts/real-scenario-data.mjs)
-- =============================================================================
-- Prérequis : exécuter depuis le dossier web/ :
--   npm run test:supabase:scenarios
-- Puis coller ce script dans Supabase → SQL Editor (rôle postgres : contournement RLS).
--
-- Nettoyage (optionnel, à décommenter pour supprimer les données de test) :
-- Ordre : références duplicate_of_id → logs → feedbacks (CASCADE : pièces jointes, commentaires, historiques statut, liens action, assignation).
-- UPDATE public.feedbacks f SET duplicate_of_id = NULL
-- WHERE f.duplicate_of_id IN (SELECT id FROM public.feedbacks WHERE description LIKE '%[CFRM-HUB-TEST:%');
-- DELETE FROM public.notification_logs
--   WHERE feedback_id IN (SELECT id FROM public.feedbacks WHERE description LIKE '%[CFRM-HUB-TEST:%');
-- DELETE FROM public.audit_logs
--   WHERE entity_type = 'feedback'
--     AND entity_id IN (SELECT id FROM public.feedbacks WHERE description LIKE '%[CFRM-HUB-TEST:%');
-- DELETE FROM public.feedbacks WHERE description LIKE '%[CFRM-HUB-TEST:%';

-- -----------------------------------------------------------------------------
-- 1) Volume et taux de réception (lignes présentes = soumissions RPC réussies)
-- -----------------------------------------------------------------------------
SELECT
  count(*)::bigint AS nb_feedbacks_test,
  count(*) FILTER (WHERE priority = 'critical')::bigint AS nb_critical,
  count(*) FILTER (WHERE priority = 'high')::bigint AS nb_high,
  count(*) FILTER (WHERE priority = 'medium')::bigint AS nb_medium,
  count(*) FILTER (WHERE priority = 'low')::bigint AS nb_low,
  count(*) FILTER (WHERE needs_duplicate_review = true)::bigint AS nb_flag_doublon
FROM public.feedbacks
WHERE description LIKE '%[CFRM-HUB-TEST:%';

-- -----------------------------------------------------------------------------
-- 2) Répartition par catégorie suggérée (slug)
-- -----------------------------------------------------------------------------
SELECT c.slug, count(*)::bigint AS nb
FROM public.feedbacks f
JOIN public.categories c ON c.id = f.category_suggested_id
WHERE f.description LIKE '%[CFRM-HUB-TEST:%'
GROUP BY c.slug
ORDER BY nb DESC;

-- -----------------------------------------------------------------------------
-- 3) Précision de pré-classification vs attentes (jeu T1–T5, T7)
--     — une ligne par tag d’essai ; T7 peut apparaître deux fois (doublon).
-- -----------------------------------------------------------------------------
WITH expected AS (
  SELECT * FROM (VALUES
    ('T1', 'critical', 'securite'),
    ('T2', 'high', 'besoins_de_base'),
    ('T3', 'medium', 'plainte'),
    ('T4', 'medium', 'information'),
    ('T5', 'high', 'protection'),
    ('T7', 'medium', 'plainte')
  ) AS t(tag, exp_priority, exp_slug)
),
tagged AS (
  SELECT
    f.id,
    (substring(f.description FROM '\[CFRM-HUB-TEST:(T[0-9]+)\]')) AS tag,
    f.priority,
    f.needs_duplicate_review,
    c.slug AS sugg_slug
  FROM public.feedbacks f
  LEFT JOIN public.categories c ON c.id = f.category_suggested_id
  WHERE f.description ~ '\[CFRM-HUB-TEST:T[0-9]+\]'
)
SELECT
  tg.tag,
  tg.id AS feedback_id,
  e.exp_priority,
  e.exp_slug,
  tg.priority AS obs_priority,
  tg.sugg_slug AS obs_slug,
  (e.exp_priority = tg.priority AND e.exp_slug = tg.sugg_slug) AS classification_ok,
  tg.needs_duplicate_review
FROM tagged tg
JOIN expected e ON e.tag = tg.tag
ORDER BY tg.tag, tg.id;

-- -----------------------------------------------------------------------------
-- 4) Synthèse précision (sur les lignes jointes à expected)
-- -----------------------------------------------------------------------------
WITH expected AS (
  SELECT * FROM (VALUES
    ('T1', 'critical', 'securite'),
    ('T2', 'high', 'besoins_de_base'),
    ('T3', 'medium', 'plainte'),
    ('T4', 'medium', 'information'),
    ('T5', 'high', 'protection'),
    ('T7', 'medium', 'plainte')
  ) AS t(tag, exp_priority, exp_slug)
),
tagged AS (
  SELECT
    f.id,
    (substring(f.description FROM '\[CFRM-HUB-TEST:(T[0-9]+)\]')) AS tag,
    f.priority,
    c.slug AS sugg_slug
  FROM public.feedbacks f
  LEFT JOIN public.categories c ON c.id = f.category_suggested_id
  WHERE f.description ~ '\[CFRM-HUB-TEST:T[0-9]+\]'
),
joined AS (
  SELECT
    (e.exp_priority = tg.priority AND e.exp_slug = tg.sugg_slug) AS ok
  FROM tagged tg
  JOIN expected e ON e.tag = tg.tag
)
SELECT
  count(*)::bigint AS lignes_evaluees,
  count(*) FILTER (WHERE ok)::bigint AS classifications_correctes,
  round(100.0 * count(*) FILTER (WHERE ok) / nullif(count(*), 0), 2) AS precision_pct
FROM joined;

-- -----------------------------------------------------------------------------
-- 5) Notification simulée (priorité critique) liée au scénario T1
-- -----------------------------------------------------------------------------
SELECT nl.id, nl.feedback_id, nl.channel, nl.status, nl.created_at
FROM public.notification_logs nl
JOIN public.feedbacks f ON f.id = nl.feedback_id
WHERE f.description LIKE '%[CFRM-HUB-TEST:T1]%'
ORDER BY nl.created_at DESC;

-- -----------------------------------------------------------------------------
-- 6) Délai avant première transition de statut (si historique renseigné)
--     Souvent NULL tant qu’aucun validateur n’a changé le statut.
-- -----------------------------------------------------------------------------
WITH test_ids AS (
  SELECT id, created_at FROM public.feedbacks WHERE description LIKE '%[CFRM-HUB-TEST:%'
),
first_hist AS (
  SELECT h.feedback_id, min(h.created_at) AS first_change_at
  FROM public.feedback_status_history h
  WHERE h.feedback_id IN (SELECT id FROM test_ids)
  GROUP BY h.feedback_id
)
SELECT
  percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (fh.first_change_at - t.created_at)) / 60.0) AS delai_mediane_minutes_premiere_transition
FROM test_ids t
JOIN first_hist fh ON fh.feedback_id = t.id;

-- -----------------------------------------------------------------------------
-- 7) Export CSV (depuis l’UI Table Editor) : table feedbacks, filtre
--     description contains [CFRM-HUB-TEST
--    ou : COPY (SELECT id, created_at, channel, priority, description, category_suggested_id
--               FROM public.feedbacks WHERE description LIKE '%[CFRM-HUB-TEST:%') TO STDOUT WITH CSV HEADER;

-- -----------------------------------------------------------------------------
-- 8) Géolocalisation (suite étendue) — présence lat/lng sur le lot de test
-- -----------------------------------------------------------------------------
SELECT
  count(*)::bigint AS avec_les_deux_coords,
  count(*) FILTER (WHERE lat IS NOT NULL AND lng IS NULL)::bigint AS lat_sans_lng,
  count(*) FILTER (WHERE lat IS NULL AND lng IS NOT NULL)::bigint AS lng_sans_lat,
  count(*) FILTER (WHERE lat IS NULL AND lng IS NULL)::bigint AS sans_coords,
  count(*) FILTER (WHERE location_label IS NOT NULL AND btrim(location_label) <> '')::bigint AS avec_libelle_lieu
FROM public.feedbacks
WHERE description LIKE '%[CFRM-HUB-TEST:%';

-- -----------------------------------------------------------------------------
-- 9) Répartition par canal (web + simulateurs)
-- -----------------------------------------------------------------------------
SELECT channel, count(*)::bigint AS nb
FROM public.feedbacks
WHERE description LIKE '%[CFRM-HUB-TEST:%'
GROUP BY channel
ORDER BY nb DESC;

-- -----------------------------------------------------------------------------
-- 10) Marqueurs Rxxx / Dxx (extrait du texte) — volumes par préfixe de scénario
-- -----------------------------------------------------------------------------
SELECT
  (substring(description FROM '\[CFRM-HUB-TEST:([RD][^]]+)\]')) AS marqueur,
  count(*)::bigint AS nb
FROM public.feedbacks
WHERE description ~ '\[CFRM-HUB-TEST:[RD]'
GROUP BY 1
ORDER BY nb DESC;
