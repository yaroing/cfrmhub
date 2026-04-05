-- Données de démonstration (à exécuter dans l’éditeur SQL Supabase, rôle service)
-- Les triggers de classification et d’historique s’appliquent normalement.

INSERT INTO public.feedbacks (
  channel, feedback_type, description, location_label, lat, lng
) VALUES
  (
    'web',
    'alert',
    'URGENCE : incendie signalé près du site de distribution, besoin d''évacuation et d''eau.',
    'Site Nord, secteur distribution',
    12.35,
    -1.52
  ),
  (
    'sms_sim',
    'feedback',
    'File d''attente trop longue pour les kits NFI depuis ce matin, les familles attendent sous le soleil.',
    'Point EHS - matinée',
    NULL,
    NULL
  ),
  (
    'whatsapp_sim',
    'complaint',
    'Plainte : information contradictoire sur les horaires de distribution de nourriture.',
    'Camp B',
    NULL,
    NULL
  ),
  (
    'telegram_sim',
    'suggestion',
    'Suggestion : installer un point d''écoute fixe avec traduction pour les personnes âgées.',
    'Village riverain',
    11.02,
    -0.17
  );
