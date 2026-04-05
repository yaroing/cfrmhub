-- Bloc « Analyse IA » du tableau de bord : texte configurable par les admins.
-- Lecture autorisée à tout utilisateur authentifié (affichage) ; écriture réservée aux admins (policy existante).

INSERT INTO public.channel_settings (key, value)
VALUES (
  'dashboard_ai',
  '{"enabled": true, "body_fr": "", "body_en": ""}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

CREATE POLICY channel_settings_dashboard_ai_select ON public.channel_settings
  FOR SELECT TO authenticated
  USING (key = 'dashboard_ai');
