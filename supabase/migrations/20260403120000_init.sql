-- CFRM Hub — schéma initial (PostgreSQL / Supabase)
-- Rôles applicatifs : admin, validator, observer

-- ---------------------------------------------------------------------------
-- Types énumérés (texte + contraintes)
-- ---------------------------------------------------------------------------

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label_fr text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text,
  full_name text,
  role text NOT NULL DEFAULT 'observer' CHECK (role IN ('admin', 'validator', 'observer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  channel text NOT NULL CHECK (channel IN ('web', 'sms_sim', 'whatsapp_sim', 'telegram_sim')),
  feedback_type text NOT NULL CHECK (feedback_type IN ('feedback', 'alert', 'complaint', 'suggestion', 'question')),
  description text NOT NULL CHECK (char_length(description) >= 10 AND char_length(description) <= 8000),
  normalized_desc text NOT NULL DEFAULT '',
  category_suggested_id uuid REFERENCES public.categories (id),
  category_id uuid REFERENCES public.categories (id),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  priority_override text CHECK (priority_override IS NULL OR priority_override IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_validation', 'validated', 'in_progress', 'closed', 'rejected')),
  location_label text,
  lat double precision CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
  lng double precision CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180)),
  contact_name text,
  contact_phone text,
  contact_email text,
  receipt_message text,
  created_by uuid REFERENCES auth.users (id),
  duplicate_of_id uuid REFERENCES public.feedbacks (id),
  needs_duplicate_review boolean NOT NULL DEFAULT false,
  validation_ready boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_feedbacks_created_at ON public.feedbacks (created_at DESC);
CREATE INDEX idx_feedbacks_status ON public.feedbacks (status);
CREATE INDEX idx_feedbacks_channel ON public.feedbacks (channel);
CREATE INDEX idx_feedbacks_category ON public.feedbacks (category_id);
CREATE INDEX idx_feedbacks_priority ON public.feedbacks (priority);
CREATE INDEX idx_feedbacks_location_label ON public.feedbacks (location_label);
CREATE INDEX idx_feedbacks_normalized ON public.feedbacks (left(normalized_desc, 80));

CREATE TABLE public.feedback_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.feedbacks (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.feedback_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.feedbacks (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.feedback_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.feedbacks (id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES auth.users (id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_created ON public.audit_logs (created_at DESC);

CREATE TABLE public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid REFERENCES public.feedbacks (id) ON DELETE SET NULL,
  channel text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'simulated' CHECK (status IN ('simulated', 'pending', 'sent', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.channel_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Fonctions métier
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_feedbacks_updated
  BEFORE UPDATE ON public.feedbacks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'observer'
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.profile_role(uid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = uid;
$$;

CREATE OR REPLACE FUNCTION public.feedback_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.normalized_desc := lower(trim(NEW.description));
  IF auth.uid() IS NULL THEN
    NEW.status := 'new';
    NEW.category_id := NULL;
    NEW.priority_override := NULL;
    NEW.created_by := NULL;
    IF NEW.channel IS NULL OR NEW.channel NOT IN ('web', 'sms_sim', 'whatsapp_sim', 'telegram_sim') THEN
      NEW.channel := 'web';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_feedback_before_insert
  BEFORE INSERT ON public.feedbacks
  FOR EACH ROW EXECUTE FUNCTION public.feedback_before_insert();

CREATE OR REPLACE FUNCTION public.classify_feedback_row(
  p_description text,
  p_location text,
  OUT suggested_category_slug text,
  OUT prio text,
  OUT receipt text
)
LANGUAGE plpgsql AS $$
DECLARE
  d text := lower(coalesce(p_description, ''));
BEGIN
  suggested_category_slug := 'autre';
  prio := 'medium';
  receipt := 'Votre message a bien été reçu. Il sera examiné par notre équipe. Merci pour votre confiance.';

  IF d ~ '(urgence|urgent|décès|mort|bless|attaque|fusillade|incendie|inondation|effondrement)' THEN
    prio := 'critical';
    suggested_category_slug := 'securite';
  ELSIF d ~ '(faim|nourriture|eau potable|eau\b|ration|denrée)' THEN
    prio := 'high';
    suggested_category_slug := 'besoins_de_base';
  ELSIF d ~ '(abus|violence|exploitation|harcèlement|protection|enfant)' THEN
    prio := 'high';
    suggested_category_slug := 'protection';
  ELSIF d ~ '(santé|médic|hôpital|maladie|vaccin)' THEN
    prio := 'high';
    suggested_category_slug := 'sante';
  ELSIF d ~ '(logement|abri|tente|toit)' THEN
    suggested_category_slug := 'abri';
    prio := 'medium';
  ELSIF d ~ '(information|rumeur|clarification)' THEN
    suggested_category_slug := 'information';
    prio := 'medium';
  ELSIF d ~ '(plainte|mécontent|insatisf)' THEN
    suggested_category_slug := 'plainte';
    prio := 'medium';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.feedback_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_slug text;
  v_prio text;
  v_receipt text;
  cat_id uuid;
  use_prio text;
BEGIN
  SELECT suggested_category_slug, prio, receipt
  INTO v_slug, v_prio, v_receipt
  FROM public.classify_feedback_row(NEW.description, NEW.location_label);

  SELECT id INTO cat_id FROM public.categories WHERE slug = v_slug LIMIT 1;
  IF cat_id IS NULL THEN
    SELECT id INTO cat_id FROM public.categories WHERE slug = 'autre' LIMIT 1;
  END IF;

  use_prio := COALESCE(NEW.priority_override, v_prio);

  UPDATE public.feedbacks
  SET
    category_suggested_id = cat_id,
    category_id = COALESCE(NEW.category_id, cat_id),
    priority = use_prio,
    receipt_message = v_receipt,
    validation_ready = true
  WHERE id = NEW.id;

  IF v_prio = 'critical' THEN
    INSERT INTO public.notification_logs (feedback_id, channel, payload, status)
    VALUES (
      NEW.id,
      'internal_sim',
      jsonb_build_object('message', 'Priorité critique — revue immédiate recommandée.', 'priority', v_prio),
      'simulated'
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.feedbacks o
    WHERE o.id <> NEW.id
      AND o.created_at::date = NEW.created_at::date
      AND left(o.normalized_desc, 50) = left(NEW.normalized_desc, 50)
      AND char_length(NEW.normalized_desc) >= 20
  ) THEN
    UPDATE public.feedbacks SET needs_duplicate_review = true WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_feedback_after_insert
  AFTER INSERT ON public.feedbacks
  FOR EACH ROW EXECUTE FUNCTION public.feedback_after_insert();

CREATE OR REPLACE FUNCTION public.feedback_status_history_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.feedback_status_history (feedback_id, previous_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_feedback_status_history
  AFTER UPDATE ON public.feedbacks
  FOR EACH ROW EXECUTE FUNCTION public.feedback_status_history_fn();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_settings ENABLE ROW LEVEL SECURITY;

-- Catégories : lecture publique (formulaire)
CREATE POLICY categories_select_all ON public.categories FOR SELECT USING (true);

CREATE POLICY categories_admin_mutate ON public.categories FOR ALL TO authenticated
  USING (public.profile_role(auth.uid()) = 'admin')
  WITH CHECK (public.profile_role(auth.uid()) = 'admin');

-- Profils
CREATE POLICY profiles_self_read ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_admin_all ON public.profiles FOR ALL USING (public.profile_role(auth.uid()) = 'admin');

-- Feedbacks — pas d’INSERT direct pour anon (soumission via RPC sécurisée)

CREATE POLICY feedbacks_auth_select ON public.feedbacks FOR SELECT TO authenticated
  USING (
    public.profile_role(auth.uid()) IN ('admin', 'validator', 'observer')
  );

CREATE POLICY feedbacks_admin_update ON public.feedbacks FOR UPDATE TO authenticated
  USING (public.profile_role(auth.uid()) = 'admin')
  WITH CHECK (public.profile_role(auth.uid()) = 'admin');

CREATE POLICY feedbacks_validator_update ON public.feedbacks FOR UPDATE TO authenticated
  USING (public.profile_role(auth.uid()) = 'validator')
  WITH CHECK (public.profile_role(auth.uid()) = 'validator');

CREATE POLICY feedbacks_admin_delete ON public.feedbacks FOR DELETE TO authenticated
  USING (public.profile_role(auth.uid()) = 'admin');

-- Insert authentifié (simulateurs)
CREATE POLICY feedbacks_auth_insert ON public.feedbacks FOR INSERT TO authenticated
  WITH CHECK (public.profile_role(auth.uid()) IN ('admin', 'validator'));

-- Pièces jointes (soumission publique : via compte / simulateurs ; pas d’INSERT anon direct)
CREATE POLICY att_auth_all ON public.feedback_attachments FOR ALL TO authenticated
  USING (public.profile_role(auth.uid()) IN ('admin', 'validator', 'observer'))
  WITH CHECK (public.profile_role(auth.uid()) IN ('admin', 'validator'));

-- Commentaires internes
CREATE POLICY comments_select ON public.feedback_comments FOR SELECT TO authenticated
  USING (public.profile_role(auth.uid()) IN ('admin', 'validator', 'observer'));

CREATE POLICY comments_insert_mod ON public.feedback_comments FOR INSERT TO authenticated
  WITH CHECK (public.profile_role(auth.uid()) IN ('admin', 'validator'));

-- Historique statuts
CREATE POLICY history_select ON public.feedback_status_history FOR SELECT TO authenticated
  USING (public.profile_role(auth.uid()) IN ('admin', 'validator', 'observer'));

-- Audit : admin seulement
CREATE POLICY audit_admin ON public.audit_logs FOR ALL TO authenticated
  USING (public.profile_role(auth.uid()) = 'admin')
  WITH CHECK (public.profile_role(auth.uid()) = 'admin');

-- Notifications internes
CREATE POLICY notif_select ON public.notification_logs FOR SELECT TO authenticated
  USING (public.profile_role(auth.uid()) IN ('admin', 'validator'));

CREATE POLICY notif_admin_ins ON public.notification_logs FOR INSERT TO authenticated
  WITH CHECK (public.profile_role(auth.uid()) IN ('admin', 'validator'));

-- Paramètres canaux
CREATE POLICY channel_admin ON public.channel_settings FOR ALL TO authenticated
  USING (public.profile_role(auth.uid()) = 'admin')
  WITH CHECK (public.profile_role(auth.uid()) = 'admin');

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE public.feedbacks;

-- ---------------------------------------------------------------------------
-- Storage (bucket — à créer dans le dashboard ou via API ; politiques ici si bucket existe)
-- ---------------------------------------------------------------------------

INSERT INTO public.categories (slug, label_fr, sort_order) VALUES
  ('besoins_de_base', 'Besoins de base (eau, nourriture)', 10),
  ('sante', 'Santé', 20),
  ('abri', 'Abri / logement', 30),
  ('protection', 'Protection', 40),
  ('securite', 'Sécurité / urgence', 50),
  ('information', 'Information / rumeurs', 60),
  ('plainte', 'Plainte / mécontentement', 70),
  ('autre', 'Autre', 100)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.channel_settings (key, value) VALUES
  ('sms_sim', '{"enabled": true, "label": "SMS simulé"}'::jsonb),
  ('whatsapp_sim', '{"enabled": true, "label": "WhatsApp simulé"}'::jsonb),
  ('telegram_sim', '{"enabled": true, "label": "Telegram simulé"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Soumission publique (accusé de réception renvoyé au client)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_public_feedback(
  p_channel text,
  p_feedback_type text,
  p_description text,
  p_location_label text DEFAULT NULL,
  p_contact_name text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  rmsg text;
BEGIN
  IF p_channel IS NULL OR p_channel NOT IN ('web', 'sms_sim', 'whatsapp_sim', 'telegram_sim') THEN
    RAISE EXCEPTION 'invalid channel';
  END IF;
  IF p_feedback_type IS NULL OR p_feedback_type NOT IN ('feedback', 'alert', 'complaint', 'suggestion', 'question') THEN
    RAISE EXCEPTION 'invalid feedback type';
  END IF;
  IF p_description IS NULL OR char_length(trim(p_description)) < 10 THEN
    RAISE EXCEPTION 'description too short';
  END IF;

  INSERT INTO public.feedbacks (
    channel, feedback_type, description, location_label,
    contact_name, contact_phone, contact_email, lat, lng
  ) VALUES (
    p_channel, p_feedback_type, trim(p_description), NULLIF(trim(p_location_label), ''),
    NULLIF(trim(p_contact_name), ''), NULLIF(trim(p_contact_phone), ''), NULLIF(trim(p_contact_email), ''),
    p_lat, p_lng
  ) RETURNING id INTO new_id;

  SELECT receipt_message INTO rmsg FROM public.feedbacks WHERE id = new_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    NULL,
    'public_submit',
    'feedback',
    new_id,
    jsonb_build_object('channel', p_channel, 'type', p_feedback_type)
  );

  RETURN jsonb_build_object('id', new_id, 'receipt_message', COALESCE(rmsg, ''));
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_feedback(text, text, text, text, text, text, text, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_feedback(text, text, text, text, text, text, text, double precision, double precision) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_public_feedback(text, text, text, text, text, text, text, double precision, double precision) TO authenticated;
