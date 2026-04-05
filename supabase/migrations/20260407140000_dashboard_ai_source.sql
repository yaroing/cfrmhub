-- Source d'affichage du bloc Analyse IA : manuel ou Gemini (clé JSON lue par l'app).
UPDATE public.channel_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object('source', 'manual')
WHERE key = 'dashboard_ai'
  AND (value ? 'source') IS NOT TRUE;
